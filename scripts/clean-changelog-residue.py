#!/usr/bin/env python3
"""Find and remove the changelog setup Drift wrote into repositories that never chose it.

One-off repair. Drift from 2026-10-09 to 2026-10-12 adopted a generated CHANGELOG.md at
session start in any repository with an origin remote and a CHANGELOG.md: it inserted two
marker comments, wrote "CHANGELOG.md merge=drift-changelog" to .gitattributes, created
changelog.d/README.md and set merge.drift-changelog.driver in the clone's git config. It did
so even where the repository keeps its own changelog.d/ format. Current Drift adopts only
where the committed CHANGELOG.md carries its markers or .drift.json sets "changelog".

Run it once per machine after updating Drift (and reloading Pi sessions that loaded the old
one). Only Drift's exact, uncommitted writes are changed:

  CHANGELOG.md    whose only non-blank difference from the index is Drift's empty marker
                  pair: restored from the index. A stub Drift created: deleted.
  .gitattributes  untracked and holding only Drift's line: deleted. Tracked with only
                  Drift's line appended: restored from the index.
  changelog.d/    untracked and holding only a README.md byte-identical to one Drift has
                  written: deleted.
  git config      merge.drift-changelog in the clone's own config, when no worktree of the
                  clone uses Drift's changelog: removed.

Anything staged, committed, edited or otherwise unproven is reported and left alone, and a
repository that adopted Drift's changelog (markers in HEAD, or "changelog" set in
.drift.json) is skipped. Nothing is staged or committed.

Usage:
  python3 -I scripts/clean-changelog-residue.py [--apply] [ROOT ...]
  py -3 -I scripts\\clean-changelog-residue.py [--apply] [ROOT ...]     (Windows)

Without --apply it only reports. ROOT defaults to the home directory. Repositories are found
up to five directories below each root (skipping hidden folders, node_modules and system
folders), and each repository's linked worktrees are checked wherever they live.
"""

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

START = "<!-- drift:changelog: generated from changelog.d/ - edit a bullet only if you keep its id comment -->"
END = "<!-- /drift:changelog -->"
ATTRIBUTE = "CHANGELOG.md merge=drift-changelog"
STUB = "# Changelog\n\n" + START + "\n" + END + "\n"
# Every changelog.d/README.md Drift has written (sha256 of the LF-normalized text).
DRIFT_READMES = {
    "3b594fc81b00fb148f0a4ce94386794fc7cf1bd0873cd3676e7407e6eae9d4e8",  # 2026-10-09 to 2026-10-12
    "f8985584e50a34af003108d095290981fd1f5650e229fb0abe596a6dee1b6de4",  # one-way wording
}
SKIP = {"node_modules", "Library", "AppData", "Applications", "Pictures", "Music", "Movies", "Downloads", "venv"}
DEPTH = 5


def git(cwd, *args):
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    return subprocess.run(["git", "-C", str(cwd)] + list(args), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          env=env, encoding="utf-8", errors="replace")


def lf(text):
    return text.replace("\r\n", "\n")


def nonblank(text):
    return [line for line in lf(text).split("\n") if line.strip()]


def read(path):
    with open(str(path), encoding="utf-8", errors="replace", newline="") as handle:
        return lf(handle.read())


def find_repositories(roots):
    found = []

    def walk(path, depth):
        try:
            entries = list(os.scandir(path))
        except OSError:
            return
        if any(entry.name == ".git" for entry in entries):
            found.append(path)
        if depth == 0:
            return
        for entry in entries:
            if entry.name.startswith(".") or entry.name in SKIP:
                continue
            try:
                if entry.is_dir(follow_symlinks=False):
                    walk(entry.path, depth - 1)
            except OSError:
                continue

    for root in roots:
        walk(str(root), DEPTH)
    return found


def worktrees(path):
    """{common git dir: [worktree roots]} for the repository at path."""
    common = git(path, "rev-parse", "--git-common-dir")
    if common.returncode != 0:
        return None, []
    common_dir = os.path.realpath(os.path.join(str(path), common.stdout.strip()))
    listing = git(path, "worktree", "list", "--porcelain")
    roots = []
    for line in listing.stdout.split("\n"):
        if line.startswith("worktree "):
            root = line[len("worktree "):].strip()
            if os.path.isdir(root):
                roots.append(os.path.realpath(root))
    if not roots:
        top = git(path, "rev-parse", "--show-toplevel")
        if top.returncode == 0:
            roots.append(os.path.realpath(top.stdout.strip()))
    return common_dir, roots


def adoption(worktree):
    """Why this worktree uses Drift's changelog, or None. An unreadable .drift.json counts, to stay hands-off."""
    head = git(worktree, "show", "HEAD:CHANGELOG.md")
    if head.returncode == 0 and START in head.stdout and END in head.stdout:
        return "its committed CHANGELOG.md carries Drift's markers"
    config = Path(worktree, ".drift.json")
    if config.exists():
        try:
            data = json.loads(read(config))
        except (OSError, ValueError):
            return ".drift.json could not be read"
        if isinstance(data, dict) and data.get("changelog") not in (None, False):
            return ".drift.json turns Drift's changelog on"
    return None


def in_progress(worktree):
    for name in ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD"):
        path = git(worktree, "rev-parse", "--git-path", name).stdout.strip()
        if path and os.path.exists(os.path.join(worktree, path) if not os.path.isabs(path) else path):
            return True
    return False


def tracked(worktree, name):
    return git(worktree, "ls-files", "--error-unmatch", "--", name).returncode == 0


def only_markers_added(text, base):
    """True when text is base plus Drift's empty marker pair, ignoring blank lines."""
    lines = nonblank(text)
    if lines.count(START) != 1 or lines.count(END) != 1:
        return False
    at = lines.index(START)
    if at + 1 >= len(lines) or lines[at + 1] != END:
        return False
    return lines[:at] + lines[at + 2:] == nonblank(base)


def plan_worktree(worktree):
    """(actions, notes): actions are (description, callable); notes are things left for a person."""
    actions, notes = [], []
    changelog = Path(worktree, "CHANGELOG.md")
    if changelog.is_file() and not changelog.is_symlink():
        text = read(changelog)
        if START in text and END in text:
            if tracked(worktree, "CHANGELOG.md"):
                index = git(worktree, "show", ":CHANGELOG.md").stdout
                if START in index:
                    notes.append("CHANGELOG.md: Drift's markers are staged; unstage them or keep them deliberately")
                elif only_markers_added(text, index):
                    actions.append(("restore CHANGELOG.md (only Drift's empty marker pair differs)",
                                    lambda: git(worktree, "checkout", "--", "CHANGELOG.md")))
                else:
                    notes.append("CHANGELOG.md: has Drift's marker pair and other uncommitted edits; delete the two "
                                 "drift:changelog lines by hand")
            elif text == STUB:
                actions.append(("delete CHANGELOG.md (an empty stub Drift created)", lambda: changelog.unlink()))
            else:
                notes.append("CHANGELOG.md: untracked, with Drift's markers and other text; left alone")

    attributes = Path(worktree, ".gitattributes")
    if attributes.is_file() and not attributes.is_symlink():
        lines = nonblank(read(attributes))
        if ATTRIBUTE in lines:
            if not tracked(worktree, ".gitattributes"):
                if lines == [ATTRIBUTE]:
                    actions.append(("delete .gitattributes (untracked, only Drift's line)", lambda: attributes.unlink()))
                else:
                    notes.append(".gitattributes: untracked, with Drift's line and others; delete \"" + ATTRIBUTE + "\" by hand")
            else:
                index = nonblank(git(worktree, "show", ":.gitattributes").stdout)
                if ATTRIBUTE in index:
                    notes.append(".gitattributes: \"" + ATTRIBUTE + "\" is committed or staged; left alone")
                elif lines == index + [ATTRIBUTE]:
                    actions.append(("restore .gitattributes (only Drift's line was appended)",
                                    lambda: git(worktree, "checkout", "--", ".gitattributes")))
                else:
                    notes.append(".gitattributes: Drift's line plus other uncommitted edits; delete \"" + ATTRIBUTE + "\" by hand")

    folder = Path(worktree, "changelog.d")
    readme = folder / "README.md"
    if folder.is_dir() and not folder.is_symlink() and readme.is_file() and not git(worktree, "ls-files", "--", "changelog.d").stdout.strip():
        digest = hashlib.sha256(read(readme).encode("utf-8")).hexdigest()
        if digest in DRIFT_READMES:
            if sorted(os.listdir(str(folder))) == ["README.md"]:
                def remove_folder():
                    readme.unlink()
                    folder.rmdir()
                actions.append(("delete changelog.d/ (untracked, only Drift's README)", remove_folder))
            else:
                notes.append("changelog.d/: untracked, Drift's README beside other files; left alone")
    return actions, notes


def plan_driver(common_dir, roots, adopted):
    if adopted or not roots:
        return []
    driver = git(roots[0], "config", "--local", "--get", "merge.drift-changelog.driver")
    if driver.returncode != 0 or "build-changelog.py" not in driver.stdout or "--merge" not in driver.stdout:
        return []
    for root in roots:
        head = git(root, "show", "HEAD:.gitattributes")
        if head.returncode == 0 and ATTRIBUTE in nonblank(head.stdout):
            return []
    return [("remove merge.drift-changelog from " + os.path.join(common_dir, "config"),
             lambda: git(roots[0], "config", "--local", "--remove-section", "merge.drift-changelog"))]


def main(argv):
    flags = [arg for arg in argv[1:] if arg.startswith("-")]
    roots = [arg for arg in argv[1:] if not arg.startswith("-")]
    if set(flags) - {"--apply", "-h", "--help"}:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    if "-h" in flags or "--help" in flags:
        print(__doc__.strip())
        return 0
    apply = "--apply" in flags
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    clones = {}
    for path in find_repositories(roots or [str(Path.home())]):
        common_dir, worktree_roots = worktrees(path)
        if common_dir:
            clones.setdefault(common_dir, set()).update(worktree_roots)

    checked, changed, left = 0, 0, 0
    for common_dir in sorted(clones):
        roots = sorted(clones[common_dir])
        adopted = False
        for root in roots:
            checked += 1
            reason = adoption(root)
            if reason:
                adopted = True
                continue
            if in_progress(root):
                print(root + "\n  left alone: a merge, rebase or cherry-pick is in progress")
                left += 1
                continue
            actions, notes = plan_worktree(root)
            if actions or notes:
                print(root)
            for description, act in actions:
                print("  " + ("" if apply else "would ") + description)
                if apply:
                    act()
                changed += 1
            for note in notes:
                print("  left for you: " + note)
                left += 1
        for description, act in plan_driver(common_dir, roots, adopted):
            print(roots[0] + "\n  " + ("" if apply else "would ") + description)
            if apply:
                act()
            changed += 1

    verb = "made" if apply else "to make"
    print("\nChecked %d worktree(s): %d change(s) %s, %d item(s) left for you." % (checked, changed, verb, left))
    if changed and not apply:
        print("Nothing was changed. Run again with --apply to make these changes.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
