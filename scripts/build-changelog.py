#!/usr/bin/env python3
"""Regenerate CHANGELOG.md from changelog.d/ fragments.

Usage:
    build-changelog.py [<repo>] [--check | --stdout]
    build-changelog.py --merge <base> <ours> <theirs>

    <repo>    Repository root holding CHANGELOG.md and changelog.d/. Defaults to ".".
    --check   Exit non-zero if CHANGELOG.md's generated region is out of date. Writes nothing.
    --stdout  Print the whole file as it would be written. Writes nothing.
    --merge   Git merge driver (%O %A %B): union the generated entries of two versions
              by fragment id, regroup and reorder, three-way merge the hand-written parts
              around them, and write the result over <ours>.

Without a flag the file is regenerated in place. The generated region is a one-way view of
changelog.d/: to change a bullet, edit its fragment and regenerate. A bullet whose region
text matches no current or committed version of its fragment was edited by hand and stops
regeneration (exit 2), as does a line no fragment produced, reported with its line number:
Drift does not guess at content it did not write, and never copies view text back into a
fragment.

Fragments:
    changelog.d/<feature>-<NNN>-<slug>.md
    ---
    date: "2026-10-09T16:29:21+01:00"
    section: "Changed"            # Added, Changed, Deprecated, Removed, Fixed, Security
    artifact: "drift/<feature>/<NNN>-handoff-<slug>.md"   # optional
    ---
    The bullet text. Markdown allowed; further lines continue the same bullet.

Grouping: a fragment belongs to the first version tag (default pattern `v*`, configurable as
`changelog.tags` in .drift.json) whose tree contains it, so versions come from git ancestry
and never from timestamps; fragments in no tag are [Unreleased]. With no matching tags the
file is grouped by day instead. The generated region sits between two marker comments;
everything outside them is the project's own text and is preserved byte for byte.

Requires only the Python standard library (3.7+) and git on PATH.
"""
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I omits the script dir; trusted sibling import
from _driftmeta import FRONTMATTER, git, parse_date, scalar  # noqa: E402

START = "<!-- drift:changelog: generated from changelog.d/ - edit a bullet only if you keep its id comment -->"
END = "<!-- /drift:changelog -->"
FRAGMENT_DIR = "changelog.d"
SECTIONS = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"]
# The id comment also carries the fragment's date, so a driver merge reorders exactly as a rebuild would.
ID_COMMENT = re.compile(r" <!-- (changelog\.d/[^ ]+\.md)(?: (\S+))? -->$")
GROUP_HEADING = re.compile(r"^## (?:\[Unreleased\]|\[(?P<version>[^\]]+)\] — (?P<vdate>\d{4}-\d{2}-\d{2})|(?P<day>\d{4}-\d{2}-\d{2}))$")
SECTION_HEADING = re.compile(r"^### (?P<name>\S.*)$")


def normalize_body(body):
    """One bullet's text with no leading list marker on its first line: the renderer owns the
    "- ", so a marker in a fragment (or doubled in a legacy region) would render twice.
    Continuation lines keep theirs; a nested sub-bullet is intentional."""
    body = body.strip()
    first, sep, rest = body.partition("\n")
    return re.sub(r"^[-*+] +", "", first) + sep + rest


# --- fragments -----------------------------------------------------------------------------

def read_fragment(path, repo):
    text = path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n")
    match = FRONTMATTER.match(text)
    if not match:
        raise ValueError(f"invalid fragment (no frontmatter): {path.relative_to(repo).as_posix()}")
    block = match.group(1)
    section = scalar(block, "section")
    if not section or "\n" in section:
        raise ValueError(f"invalid fragment (missing section): {path.relative_to(repo).as_posix()}")
    body = text[match.end():].strip("\n").rstrip()
    if not body.strip():
        raise ValueError(f"invalid fragment (empty body): {path.relative_to(repo).as_posix()}")
    if re.search(r"\n\s*\n", body):
        raise ValueError(f"invalid fragment (a fragment is one bullet; no blank lines): {path.relative_to(repo).as_posix()}")
    body = normalize_body(body)
    raw_date = scalar(block, "date")
    return {
        "id": path.relative_to(repo).as_posix(),
        "section": section,
        "when": parse_date(raw_date) if raw_date else None,
        "body": body,
        "frontmatter": match.group(0),
    }


def load_fragments(repo):
    folder = repo / FRAGMENT_DIR
    if not folder.is_dir():
        return []
    # README.md documents the folder for people and other agents; it is the one file here that is not a fragment.
    return [read_fragment(p, repo) for p in sorted(folder.glob("*.md")) if p.name != "README.md"]


def tag_pattern(repo):
    config = repo / ".drift.json"
    if not config.is_file():
        return "v*"
    try:
        data = json.loads(config.read_text(encoding="utf-8"))
    except ValueError as error:
        raise ValueError(f"invalid .drift.json: {error}")
    changelog = data.get("changelog") if isinstance(data, dict) else None
    if isinstance(changelog, dict) and isinstance(changelog.get("tags"), str) and changelog["tags"].strip():
        return changelog["tags"].strip()
    return "v*"


def version_key(name):
    numbers = tuple(int(n) for n in re.findall(r"\d+", name))
    return (numbers, name)


def version_groups(repo, fragments):
    """Assign each fragment the first version tag whose tree contains it. Returns {id: (version, date)} or None without tags."""
    listing = git(repo, "tag", "--list", tag_pattern(repo))
    tags = sorted((t for t in (listing or "").split("\n") if t.strip()), key=version_key)
    if not tags:
        return None
    assigned = {}
    for tag in tags:
        tree = git(repo, "ls-tree", "-r", "--name-only", tag, "--", FRAGMENT_DIR) or ""
        committed = git(repo, "log", "-1", "--format=%cI", tag)
        date = (committed or "").strip()[:10]
        label = tag[1:] if tag.startswith("v") and len(tag) > 1 and tag[1].isdigit() else tag
        for path in tree.split("\n"):
            if path and path not in assigned:
                assigned[path] = (label, date)
    return assigned


def groups_from_fragments(repo, fragments):
    """-> list of groups: {"key": (...), "heading": str, "sections": {name: [entry]}}"""
    assigned = version_groups(repo, fragments)
    entries = {}
    for fragment in fragments:
        if assigned is None:
            # The fragment's own local date, as recorded; never the building machine's zone.
            key = ("day", fragment["when"].strftime("%Y-%m-%d")) if fragment["when"] else ("undated",)
        elif fragment["id"] in assigned:
            key = ("version",) + assigned[fragment["id"]]
        else:
            key = ("unreleased",)
        entries.setdefault(key, []).append({**fragment, "key": key})
    return build_groups(entries)


# --- rendering ------------------------------------------------------------------------------

def heading_for(key):
    if key[0] == "unreleased":
        return "## [Unreleased]"
    if key[0] == "version":
        return f"## [{key[1]}] — {key[2]}"
    if key[0] == "day":
        return f"## {key[1]}"
    return "## Undated"


def group_order(key):
    # Unreleased first, then versions newest first, then days newest first, undated last.
    rank = {"unreleased": 0, "version": 1, "day": 2, "undated": 3}[key[0]]
    if key[0] == "version":
        numbers, _ = version_key(key[1])
        return (rank, tuple(-n for n in numbers), key[1])
    if key[0] == "day":
        return (rank, -int(key[1].replace("-", "")))
    return (rank,)


def section_order(name):
    return (SECTIONS.index(name), name) if name in SECTIONS else (len(SECTIONS), name)


def entry_order(entry):
    when = entry["when"]
    return (0, -when.astimezone(dt.timezone.utc).timestamp(), entry["id"]) if when else (1, 0, entry["id"])


def build_groups(entries_by_key):
    groups = []
    for key in sorted(entries_by_key, key=group_order):
        sections = {}
        for entry in entries_by_key[key]:
            sections.setdefault(entry["section"], []).append(entry)
        for name in sections:
            sections[name].sort(key=entry_order)
        groups.append({"key": key, "sections": dict(sorted(sections.items(), key=lambda kv: section_order(kv[0])))})
    return groups


def render_entry(entry):
    lines = entry["body"].split("\n")
    out = ["- " + lines[0]] + ["  " + line for line in lines[1:]]
    stamp = f" {entry['when'].isoformat(timespec='seconds')}" if entry["when"] else ""
    out[-1] = out[-1] + f" <!-- {entry['id']}{stamp} -->"
    return out


def render_region(groups, strays=()):
    if not groups and not strays:
        return [START, END]  # Exactly what adoption writes, so an empty region is stable.
    lines = [START]
    if strays:
        lines += [""] + list(strays)
    for group in groups:
        lines += ["", heading_for(group["key"])]
        for name, entries in group["sections"].items():
            lines += ["", f"### {name}", ""]
            for entry in entries:
                lines += render_entry(entry)
    lines += ["", END]
    return lines


# --- parsing the generated file -------------------------------------------------------------

def split_file(text):
    """-> (head_lines, region_lines, tail_lines) or None when the markers are absent."""
    lines = text.replace("\r\n", "\n").split("\n")
    if START not in lines or END not in lines:
        return None
    start, end = lines.index(START), lines.index(END)
    if end < start:
        return None
    return lines[:start], lines[start:end + 1], lines[end + 1:]


def parse_region(region, first_line_number=1):
    """-> (entries {id: entry}, strays [(line_number, text)]). Entries keep their group key and section."""
    entries, strays = {}, []
    key, section = None, None
    i = 1  # skip START
    while i < len(region) - 1:  # stop before END
        line = region[i]
        number = first_line_number + i
        if not line.strip():
            i += 1
            continue
        heading = GROUP_HEADING.match(line)
        if heading:
            if heading.group("version"):
                key = ("version", heading.group("version"), heading.group("vdate"))
            elif heading.group("day"):
                key = ("day", heading.group("day"))
            else:
                key = ("unreleased",)
            section = None
            i += 1
            continue
        if line == "## Undated":
            key, section = ("undated",), None
            i += 1
            continue
        named = SECTION_HEADING.match(line)
        if named and key is not None:
            section = named.group("name")
            i += 1
            continue
        if line.startswith("- ") and key is not None and section is not None:
            # A bullet runs from its "- " line to the line ending in its id comment; continuation lines are indented.
            block = [line]
            j = i + 1
            while not ID_COMMENT.search(block[-1]) and j < len(region) - 1:
                nxt = region[j]
                if nxt.startswith("- ") or nxt.startswith("#") or not nxt.strip():
                    break
                block.append(nxt)
                j += 1
            match = ID_COMMENT.search(block[-1])
            if match:
                block[-1] = ID_COMMENT.sub("", block[-1])
                body = [block[0][2:]] + [text[2:] if text.startswith("  ") else text for text in block[1:]]
                entries[match.group(1)] = {"id": match.group(1), "section": section, "key": key, "body": "\n".join(body).rstrip(),
                                           "when": parse_date(match.group(2)) if match.group(2) else None}
            else:
                strays.extend((number + k, text) for k, text in enumerate(block))
            i += len(block)
            continue
        strays.append((number, line))
        i += 1
    return entries, strays


# --- writing ----------------------------------------------------------------------------------

def atomic_write(path, text):
    data = text.encode("utf-8")
    fd, temp = tempfile.mkstemp(dir=str(path.parent), prefix=".changelog-", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.replace(temp, path)
        except PermissionError:
            # Windows: another process holds the file open without delete sharing; rewrite in place.
            with open(path, "wb") as handle:
                handle.write(data)
    finally:
        if os.path.exists(temp):
            os.remove(temp)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def committed_bodies(repo, ident):
    """Every committed version of a fragment's body, normalized, so a stale view is recognisable."""
    bodies = set()
    for sha in (git(repo, "log", "--format=%H", "--", ident) or "").split():
        text = git(repo, "show", f"{sha}:{ident}", ok=(0, 128))
        match = FRONTMATTER.match((text or "").replace("\r\n", "\n"))
        if match:
            bodies.add(normalize_body(text[match.end():].strip("\n").rstrip()))
    return bodies


def hand_edited(repo, fragments, current_entries):
    """Region bullets that match no current or committed version of their fragment. The region is a
    one-way view: a stale bullet regenerates, a hand-edited one is the caller's to move into its
    fragment; nothing is ever copied back from the view into a source."""
    by_id = {f["id"]: f for f in fragments}
    edited = []
    for ident, entry in sorted(current_entries.items()):
        fragment = by_id.get(ident)
        if fragment is None:
            continue  # Fragment deleted: its bullet simply leaves the view.
        body = normalize_body(entry["body"])
        if body != normalize_body(fragment["body"]) and body not in committed_bodies(repo, ident):
            edited.append(ident)
    return edited


def regenerate(repo, mode):
    changelog = repo / "CHANGELOG.md"
    for attempt in range(3):
        before = digest(changelog)
        text = changelog.read_text(encoding="utf-8", errors="replace") if changelog.exists() else ""
        parts = split_file(text)
        fragments = load_fragments(repo)
        if parts is None:
            if mode == "--stdout":
                print("\n".join(render_region(groups_from_fragments(repo, fragments))))
                return 0
            print(f"error: {changelog} has no Drift markers; run /drift-changelog on to adopt it", file=sys.stderr)
            return 1
        head, region, tail = parts
        current, strays = parse_region(region, len(head) + 1)
        if strays:
            for number, line in strays:
                print(f"{changelog}:{number}: not produced by any fragment: {line}", file=sys.stderr)
            print("error: move these lines into changelog.d/ fragments or delete them; nothing written", file=sys.stderr)
            return 2
        edited = hand_edited(repo, fragments, current)
        if edited:
            for ident in edited:
                print(f"{changelog}: the bullet for {ident} was edited in the generated region; edit the fragment instead", file=sys.stderr)
            print("error: the generated region is a one-way view of changelog.d/; move these edits into their fragments or restore the bullets; nothing written", file=sys.stderr)
            return 2
        content = "\n".join(head + render_region(groups_from_fragments(repo, fragments)) + tail)
        if mode == "--stdout":
            print(content, end="")
            return 0
        if mode == "--check":
            if content == text.replace("\r\n", "\n"):
                print(f"{changelog}: up to date ({len(fragments)} fragments)")
                return 0
            print(f"{changelog}: out of date", file=sys.stderr)
            return 1
        if content == text.replace("\r\n", "\n"):
            return 0
        if digest(changelog) != before:
            continue  # Someone wrote meanwhile: recompute from their version rather than replace it.
        atomic_write(changelog, content)
        print(f"wrote {changelog}: {len(fragments)} fragments")
        return 0
    print(f"error: {changelog} kept changing underneath; try again", file=sys.stderr)
    return 1


# --- merge driver --------------------------------------------------------------------------------

def three_way(base, ours, theirs):
    """git merge-file on three line lists; returns merged lines, or None on a real conflict."""
    with tempfile.TemporaryDirectory() as folder:
        paths = []
        for name, lines in (("base", base), ("ours", ours), ("theirs", theirs)):
            path = Path(folder) / name
            path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8", newline="\n")
            paths.append(str(path))
        proc = subprocess.run(["git", "merge-file", "-p", paths[1], paths[0], paths[2]], capture_output=True, text=True, encoding="utf-8")
        if proc.returncode < 0 or proc.returncode > 0 and "<<<<<<<" in proc.stdout:
            return None
        merged = proc.stdout.replace("\r\n", "\n")
        return merged[:-1].split("\n") if merged.endswith("\n") else (merged.split("\n") if merged else [])


def merge(paths):
    texts = [Path(p).read_text(encoding="utf-8", errors="replace") for p in paths]
    parts = [split_file(t) for t in texts]
    if parts[1] is None or parts[2] is None:
        print("error: --merge inputs are not Drift changelogs (markers missing)", file=sys.stderr)
        return 1
    base = parts[0] or ([], [START, END], [])
    (head_o, region_o, tail_o), (head_a, region_a, tail_a), (head_b, region_b, tail_b) = base, parts[1], parts[2]
    entries_o, _ = parse_region(region_o)
    entries_a, strays_a = parse_region(region_a)
    entries_b, strays_b = parse_region(region_b)
    merged = {**entries_a, **entries_b}
    for ident, entry in entries_a.items():
        # A side that has fetched the tag knows the version; the other still shows the entry as unreleased.
        other = entries_b.get(ident)
        if other and other["key"][0] == "unreleased" and entry["key"][0] != "unreleased":
            merged[ident] = entry
    for ident in entries_o:
        if ident not in entries_a or ident not in entries_b:
            merged.pop(ident, None)
    by_key = {}
    for entry in merged.values():
        by_key.setdefault(entry["key"], []).append(entry)
    strays = [text for _, text in strays_a] + [text for _, text in strays_b if text not in {t for _, t in strays_a}]
    head = three_way(head_o, head_a, head_b)
    tail = three_way(tail_o, tail_a, tail_b)
    if head is None or tail is None:
        print("error: conflict in the hand-written part of CHANGELOG.md; resolve it, then rebuild", file=sys.stderr)
        return 1
    content = "\n".join(head + render_region(build_groups(by_key), strays) + tail)
    with open(paths[1], "w", encoding="utf-8", newline="\n") as handle:
        handle.write(content if content.endswith("\n") else content + "\n")
    return 0


def main(argv):
    # --stdout feeds the Pi publisher byte for byte: UTF-8 and LF everywhere, never the console
    # code page (a cp1252 console crashes on characters the changelog already uses) or the
    # platform's text-mode translation. stderr too: error reports quote region lines verbatim.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", newline="\n")
    args = [a for a in argv[1:] if not a.startswith("-")]
    flags = {a for a in argv[1:] if a.startswith("-")}
    if flags & {"-h", "--help"}:
        print(__doc__.strip())
        return 0
    modes = flags & {"--check", "--stdout", "--merge"}
    if flags - modes or len(modes) > 1 or ("--merge" in flags) != (len(args) == 3):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        if "--merge" in flags:
            return merge(args)
        repo = Path(args[0] if args else ".").resolve()
        if not repo.is_dir():
            print(f"error: not a directory: {repo}", file=sys.stderr)
            return 1
        return regenerate(repo, "--stdout" if "--stdout" in flags else "--check" if "--check" in flags else "--write")
    except (ValueError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
