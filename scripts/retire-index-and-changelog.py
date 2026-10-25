#!/usr/bin/env python3
"""Retire Drift's generated changelog and root index from repositories.

One-off cleanup. Drift no longer generates CHANGELOG.md from changelog.d/ fragments or
maintains drift/INDEX.md. This removes what earlier versions left behind:

  CHANGELOG.md    Drift-generated (HEAD carries Drift's markers): deleted; git history
                  keeps it. Markers Drift inserted uncommitted into a project's own
                  changelog: restored to HEAD, or only Drift's lines removed when the file
                  has other uncommitted edits. A project's own changelog is never deleted.
  changelog.d/    holding only Drift's README and Drift-format fragments: deleted.
  drift/INDEX.md  deleted, whether tracked, ignored or untracked.
  .gitattributes  Drift's two merge lines removed; the file is deleted only when nothing
                  else remains, or restored when what remains equals HEAD.
  .drift.json     its "changelog" key removed; malformed JSON is reported, not touched.
  git config      merge.drift-index.* and merge.drift-changelog.* unset in the clone.

Repositories using changesets or towncrier keep CHANGELOG.md and changelog.d/ untouched.
Linked worktrees and repositories mid-merge, rebase, cherry-pick or revert are reported
and skipped. Uncommitted non-Drift edits are never lost. Nothing is staged or committed.

Usage:
  python3 -I scripts/retire-index-and-changelog.py <path> [<path> ...] [--apply]
  py -3 -I scripts\\retire-index-and-changelog.py <path> [<path> ...] [--apply]   (Windows)

Without --apply it is a dry run: it prints every action and changes nothing. A path that
is a repository root is processed; otherwise repositories are found up to two levels
below it. Exit status is 0 unless a repository could not be processed.

Requires only the Python standard library (3.7+) and git on PATH.
"""

import json
import os
import re
import shutil
import stat
import subprocess
import sys

START = "<!-- drift:changelog: generated from changelog.d/ - edit a bullet only if you keep its id comment -->"
END = "<!-- /drift:changelog -->"
MARKERS = (START, END)
ATTRIBUTES = (("drift/INDEX.md", "drift-index"), ("CHANGELOG.md", "drift-changelog"))
ATTRIBUTE_PATTERNS = [re.compile(r"^" + re.escape(path) + r"\s+(?:\S+\s+)*merge=" + name + r"(?:\s|$)")
                      for path, name in ATTRIBUTES]
DRIVERS = ("drift-index", "drift-changelog")
FRONTMATTER = re.compile(r"^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)")
SKIP_DIRS = {"node_modules", ".venv", "venv", "target", "dist", "build", ".cache", ".git"}
DEPTH = 2
COMMIT = 'git add -A -- {paths} && git commit -m "chore: retire Drift changelog and index"'
CLASSES = (
    ("A", "Drift adopted it"),
    ("B", "uninvited Drift residue"),
    ("C", "foreign changelog system"),
)
# Variables that would redirect `git -C <repo>` elsewhere. Config isolation (GIT_CONFIG_*) is kept.
GIT_REDIRECTS = {"GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY",
                 "GIT_NAMESPACE", "GIT_PREFIX", "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM"}


class RepoError(Exception):
    pass


def git(repo, *args):
    env = {key: value for key, value in os.environ.items() if key not in GIT_REDIRECTS}
    return subprocess.run(["git", "-c", "core.quotepath=off", "-C", repo, *args], capture_output=True, check=False,
                          env=env, encoding="utf-8", errors="replace")


def lf(text):
    return text.replace("\r\n", "\n")


def nonblank(text):
    return [line for line in lf(text).split("\n") if line.strip()]


def read(path):
    with open(path, encoding="utf-8", errors="replace", newline="") as handle:
        return handle.read()


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)


def blob(repo, spec):
    """Text of a git object (HEAD:path or :path), or None when it does not exist."""
    shown = git(repo, "show", spec)
    return shown.stdout if shown.returncode == 0 else None


def has_markers(text):
    return text is not None and START in text and END in text


def any_marker(text):
    return text is not None and any(marker in text for marker in MARKERS)


def outside_region(text):
    """Non-blank lines outside Drift's generated region, without the markers themselves."""
    lines, inside = [], False
    for line in nonblank(text):
        stripped = line.strip()
        if stripped == START:
            inside = True
        elif stripped == END:
            inside = False
        elif not inside:
            lines.append(line)
    return lines


def strip_region(text):
    """Remove Drift's marker lines (and an all-blank region between them) from a changelog.

    Returns (new text, kept): kept is True when non-blank text sat between the markers and was kept.
    """
    newline = "\r\n" if "\r\n" in text else "\n"
    lines = lf(text).split("\n")
    out, kept, index = [], False, 0
    while index < len(lines):
        line = lines[index]
        if line.strip() == START:
            end = next((at for at in range(index + 1, len(lines)) if lines[at].strip() == END), None)
            inner = lines[index + 1:end] if end is not None else []
            if end is not None and not any(item.strip() for item in inner):
                index = end + 1
            else:
                kept = kept or any(item.strip() for item in inner)
                index += 1
            # Drift inserted a blank line beside the region; do not leave two in a row.
            while out and not out[-1].strip() and index < len(lines) and not lines[index].strip():
                index += 1
            continue
        if line.strip() == END:
            index += 1
            while out and not out[-1].strip() and index < len(lines) and not lines[index].strip():
                index += 1
            continue
        out.append(line)
        index += 1
    return newline.join(out), kept


def is_drift_attribute(line):
    return any(pattern.match(line.strip()) for pattern in ATTRIBUTE_PATTERNS)


def drift_readme(text):
    return text.startswith("# Changelog fragments") and "drift:changelog" in text


def drift_fragment(text):
    match = FRONTMATTER.match(text)
    return bool(match) and re.search(r"^section:\s*\S", match.group(1), re.MULTILINE) is not None


def changelog_folder(folder):
    """'drift' when changelog.d/ holds only Drift's files, 'mixed', 'own' (the project's), or None."""
    if not os.path.isdir(folder) or os.path.islink(folder):
        return None
    drift_files, other_files = 0, 0
    for parent, dirs, files in os.walk(folder):
        dirs[:] = [name for name in dirs if not os.path.islink(os.path.join(parent, name))]
        for name in files:
            path = os.path.join(parent, name)
            if name == ".gitkeep":
                continue
            text = read(path) if name.endswith(".md") and os.path.isfile(path) else None
            if text is not None and parent == folder and (drift_readme(text) if name == "README.md" else drift_fragment(text)):
                drift_files += 1
            else:
                other_files += 1
    if other_files == 0:
        return "drift"
    return "mixed" if drift_files else "own"


def foreign_system(repo):
    if os.path.exists(os.path.join(repo, ".changeset")):
        return "changesets (.changeset/)"
    if os.path.exists(os.path.join(repo, "newsfragments")):
        return "towncrier (newsfragments/)"
    if os.path.exists(os.path.join(repo, "towncrier.toml")):
        return "towncrier (towncrier.toml)"
    pyproject = os.path.join(repo, "pyproject.toml")
    if os.path.isfile(pyproject) and "[tool.towncrier]" in read(pyproject):
        return "towncrier (pyproject.toml)"
    return None


def tracked(repo, path):
    return bool(git(repo, "ls-files", "--", path).stdout.strip())


def in_progress(repo):
    names = {"MERGE_HEAD": "a merge", "rebase-merge": "a rebase", "rebase-apply": "a rebase",
             "CHERRY_PICK_HEAD": "a cherry-pick", "REVERT_HEAD": "a revert"}
    for name, what in names.items():
        path = git(repo, "rev-parse", "--git-path", name).stdout.strip()
        if path and os.path.exists(path if os.path.isabs(path) else os.path.join(repo, path)):
            return what
    return None


def remove_tree(path):
    def retry(function, target, _info):
        os.chmod(target, stat.S_IWRITE)
        function(target)
    shutil.rmtree(path, onerror=retry)


# ---------------------------------------------------------------- discovery

def is_repo_root(path):
    return os.path.exists(os.path.join(path, ".git"))


def discover(paths):
    found, missing = [], []

    def scan(path, depth):
        try:
            entries = sorted(os.scandir(path), key=lambda entry: entry.name.lower())
        except OSError:
            return
        for entry in entries:
            if entry.name in SKIP_DIRS:
                continue
            try:
                if not entry.is_dir(follow_symlinks=False):
                    continue
            except OSError:
                continue
            if is_repo_root(entry.path):
                found.append(entry.path)
            elif depth > 1:
                scan(entry.path, depth - 1)

    for path in paths:
        if not os.path.isdir(path):
            missing.append(path)
        elif is_repo_root(path):
            found.append(path)
        else:
            scan(path, DEPTH)
    unique, seen = [], set()
    for path in found:
        key = os.path.normcase(os.path.realpath(path))
        if key not in seen:
            seen.add(key)
            unique.append(os.path.realpath(path))
    return unique, missing


def linked_main(repo):
    """The main worktree when repo is a linked worktree, else None. Raises RepoError for a broken repository."""
    dirs = git(repo, "rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir")
    if dirs.returncode != 0:
        # Older git has no --path-format; resolve relative output against the repository.
        dirs = git(repo, "rev-parse", "--git-dir", "--git-common-dir")
        if dirs.returncode != 0:
            raise RepoError("not a usable git repository: " + (dirs.stderr.strip() or "rev-parse failed"))
    git_dir, common = [os.path.realpath(os.path.join(repo, item)) for item in dirs.stdout.strip().split("\n")[:2]]
    if os.path.normcase(git_dir) == os.path.normcase(common):
        return None
    return os.path.dirname(common) if os.path.basename(common) == ".git" else common


# ---------------------------------------------------------------- planning

class Plan:
    def __init__(self, repo):
        self.repo = repo
        self.actions = []  # (description, callable)
        self.notes = []
        self.paths = []  # paths a commit would need to record
        self.label = None
        self.reasons = []

    def act(self, description, function, path=None):
        self.actions.append((description, function))
        if path and path not in self.paths:
            self.paths.append(path)

    def note(self, text):
        self.notes.append(text)


def plan_changelog(plan, head, foreign):
    repo = plan.repo
    path = os.path.join(repo, "CHANGELOG.md")
    if not os.path.isfile(path) or os.path.islink(path):
        return
    text = read(path)
    if foreign:
        if any_marker(text):
            plan.note("CHANGELOG.md carries Drift's markers but the repository uses " + foreign + "; left alone")
        return
    index = blob(repo, ":CHANGELOG.md")
    if has_markers(head):
        clean = outside_region(text) == outside_region(head) and (index is None or outside_region(index) == outside_region(head))
        if clean:
            plan.act("delete CHANGELOG.md (Drift-generated; git history keeps it)", lambda: os.remove(path), "CHANGELOG.md")
        else:
            plan.note("CHANGELOG.md is Drift-generated but has uncommitted edits outside Drift's region; left in place")
        return
    if not any_marker(text):
        return
    if head is not None:
        if outside_region(text) == nonblank(head) and (index is None or outside_region(index) == nonblank(head)):
            plan.act("restore CHANGELOG.md to HEAD (only Drift's markers differed)",
                     lambda: git(repo, "checkout", "HEAD", "--", "CHANGELOG.md"))
            return
    elif index is None and outside_region(text) in ([], ["# Changelog"]):
        plan.act("delete CHANGELOG.md (an untracked stub Drift created)", lambda: os.remove(path))
        return
    if index is not None and any_marker(index) and head is None:
        plan.note("CHANGELOG.md: Drift's markers are staged; left in place")
        return
    stripped, kept = strip_region(text)
    suffix = "; kept the text between them" if kept else ""
    plan.act("remove only Drift's marker lines from CHANGELOG.md (it has other uncommitted edits, which stay" + suffix + ")",
             lambda: write(path, stripped), "CHANGELOG.md")


def plan_folder(plan, foreign):
    folder = os.path.join(plan.repo, "changelog.d")
    kind = changelog_folder(folder)
    if kind is None:
        return
    if foreign:
        if kind != "own":
            plan.note("changelog.d/ holds Drift files but the repository uses " + foreign + "; left alone")
        return
    if kind == "drift":
        where = "tracked" if tracked(plan.repo, "changelog.d") else "untracked"
        plan.act("delete changelog.d/ (" + where + ", only Drift's README and fragments)", lambda: remove_tree(folder), "changelog.d")
    elif kind == "mixed":
        plan.note("changelog.d/ holds Drift's files beside others; left in place")


def plan_index(plan):
    path = os.path.join(plan.repo, "drift", "INDEX.md")
    if not os.path.isfile(path) and not os.path.islink(path):
        return
    if tracked(plan.repo, "drift/INDEX.md"):
        where = "tracked"
    elif git(plan.repo, "check-ignore", "-q", "--", "drift/INDEX.md").returncode == 0:
        where = "ignored"
    else:
        where = "untracked"

    def remove():
        os.remove(path)
        try:
            os.rmdir(os.path.dirname(path))
        except OSError:
            pass
    plan.act("delete drift/INDEX.md (" + where + ")", remove, "drift/INDEX.md")


def plan_attributes(plan):
    repo = plan.repo
    path = os.path.join(repo, ".gitattributes")
    if not os.path.isfile(path) or os.path.islink(path):
        return
    text = read(path)
    lines = lf(text).split("\n")
    if not any(is_drift_attribute(line) for line in lines):
        return
    newline = "\r\n" if "\r\n" in text else "\n"
    kept = [line for line in lines if not is_drift_attribute(line)]
    remaining = newline.join(kept)
    head = blob(repo, "HEAD:.gitattributes")
    index = blob(repo, ":.gitattributes")
    if head is not None and not any(is_drift_attribute(line) for line in lf(head).split("\n")) \
            and nonblank(remaining) == nonblank(head) and (index is None or nonblank(index) == nonblank(head)):
        plan.act("restore .gitattributes to HEAD (only Drift's lines differed)",
                 lambda: git(repo, "checkout", "HEAD", "--", ".gitattributes"))
    elif not nonblank(remaining) and (head is None or not [line for line in nonblank(head) if not is_drift_attribute(line)]):
        plan.act("delete .gitattributes (it held only Drift's lines)", lambda: os.remove(path), ".gitattributes")
    else:
        plan.act("remove Drift's merge lines from .gitattributes (other lines stay)", lambda: write(path, remaining), ".gitattributes")


def plan_config(plan):
    path = os.path.join(plan.repo, ".drift.json")
    if not os.path.isfile(path):
        return
    text = read(path)
    if '"changelog"' not in text:
        return
    try:
        data = json.loads(text)
    except ValueError as error:
        plan.note(".drift.json is malformed (" + str(error) + "); left untouched")
        return
    if not isinstance(data, dict) or "changelog" not in data:
        return
    del data["changelog"]
    newline = "\r\n" if "\r\n" in text else "\n"
    rendered = (json.dumps(data, indent=2, ensure_ascii=False) + "\n").replace("\n", newline)
    plan.act('remove the "changelog" key from .drift.json (other keys stay)', lambda: write(path, rendered), ".drift.json")


def plan_clone_config(plan):
    listed = git(plan.repo, "config", "--local", "--name-only", "--get-regexp", r"^merge\.drift-(index|changelog)\.")
    keys = sorted({line.strip() for line in listed.stdout.split("\n") if line.strip()})
    if not keys:
        return

    def unset():
        for key in keys:
            git(plan.repo, "config", "--local", "--unset-all", key)
        for name in DRIVERS:
            # Recent git drops an emptied section by itself; this removes the header where it does not.
            git(plan.repo, "config", "--local", "--remove-section", "merge." + name)
    plan.act("unset " + ", ".join(keys) + " in the clone's git config", unset)


def plan_repo(repo):
    plan = Plan(repo)
    head = blob(repo, "HEAD:CHANGELOG.md")
    foreign = foreign_system(repo)
    folder = changelog_folder(os.path.join(repo, "changelog.d"))
    config_on = False
    try:
        data = json.loads(read(os.path.join(repo, ".drift.json")))
        config_on = isinstance(data, dict) and data.get("changelog") not in (None, False)
    except (OSError, ValueError):
        pass
    if has_markers(head):
        plan.reasons.append("HEAD's CHANGELOG.md carries Drift's markers")
    if folder in ("drift", "mixed") and tracked(repo, "changelog.d"):
        plan.reasons.append("changelog.d/ is tracked")
    if tracked(repo, "drift/INDEX.md"):
        plan.reasons.append("drift/INDEX.md is tracked")
    elif os.path.isfile(os.path.join(repo, "drift", "INDEX.md")):
        plan.reasons.append("drift/INDEX.md exists")
    if config_on:
        plan.reasons.append('.drift.json turns "changelog" on')
    if foreign:
        plan.label = "C"
        plan.reasons = ["uses " + foreign]
    elif plan.reasons:
        plan.label = "A"
    else:
        plan.label = "B"

    plan_changelog(plan, head, foreign)
    plan_folder(plan, foreign)
    plan_index(plan)
    plan_attributes(plan)
    plan_config(plan)
    plan_clone_config(plan)
    if not plan.actions and not plan.notes:
        plan.label = "D"
    return plan


# ---------------------------------------------------------------- main

def main(argv):
    args = argv[1:]
    if "-h" in args or "--help" in args:
        print(__doc__.strip())
        return 0
    flags = [arg for arg in args if arg.startswith("--")]
    paths = [arg for arg in args if not arg.startswith("--")]
    if set(flags) - {"--apply"} or not paths:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    apply = "--apply" in flags
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    repos, missing = discover([os.path.abspath(path) for path in paths])
    counts = {"A": 0, "B": 0, "C": 0, "D": 0}
    skipped = [(path, "not a directory") for path in missing]
    errors = len(missing)
    commits = []
    titles = dict(CLASSES)
    print(("Applying" if apply else "Dry run (nothing will change)") + ": " + str(len(repos)) + " repositor"
          + ("y" if len(repos) == 1 else "ies") + " found")
    for repo in repos:
        try:
            main_worktree = linked_main(repo)
            if main_worktree:
                skipped.append((repo, "linked worktree of " + main_worktree + "; fix it from the main repository"))
                continue
            busy = in_progress(repo)
            if busy:
                skipped.append((repo, busy + " is in progress"))
                continue
            plan = plan_repo(repo)
            counts[plan.label] += 1
            if plan.label == "D":
                continue
            print("\n" + repo)
            print("  class " + plan.label + ": " + titles[plan.label] + " (" + "; ".join(plan.reasons or ["Drift's files in the working tree or clone config"]) + ")")
            for description, function in plan.actions:
                if apply:
                    function()
                print("  " + ("did " if apply else "would ") + description)
            for note in plan.notes:
                print("  left in place: " + note)
            if apply and plan.paths:
                changed = [path for path in plan.paths if git(repo, "status", "--porcelain", "--", path).stdout.strip()]
                if changed:
                    commits.append((repo, COMMIT.format(paths=" ".join(changed))))
        except (RepoError, OSError, subprocess.SubprocessError) as error:
            errors += 1
            skipped.append((repo, "error: " + str(error)))

    print("\nSummary (" + ("applied" if apply else "dry run") + "):")
    for label, title in CLASSES:
        print("  " + label + " " + title + ": " + str(counts[label]))
    print("  D nothing to do: " + str(counts["D"]))
    print("  skipped: " + str(len(skipped)))
    for path, reason in skipped:
        print("    " + path + ": " + reason)
    if commits:
        print("\nNothing was staged or committed. To record the changes, in each repository run:")
        for repo, line in commits:
            print("  cd \"" + repo + "\"\n    " + line)
    if not apply and (counts["A"] or counts["B"] or counts["C"]):
        print("\nNothing was changed. Run again with --apply to make these changes.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
