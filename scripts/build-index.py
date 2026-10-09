#!/usr/bin/env python3
"""Rebuild drift/INDEX.md — the chronological running order of Drift artifacts.

Usage:
    build-index.py [<drift-dir>] [--check | --stdout]
    build-index.py --merge <base> <ours> <theirs>

    <drift-dir>  Path to a project's drift/ directory. Defaults to ./drift.
    --check      Report whether the index is out of sync and exit non-zero
                 instead of writing. Nothing is modified.
    --stdout     Print the rendered index without writing (used by the Pi publisher).
    --merge      Git merge driver (%O %A %B): union the rows of two index
                 versions by artifact path, reorder by date, renumber, and
                 write the result over <ours>. Two threads that each appended a
                 row then rebase without a conflict. Rows removed on one side
                 stay removed; a path with different text on both sides takes
                 <theirs>, since the next rebuild from frontmatter is final.

The index is a derived view: every row comes from an artifact's frontmatter, so
this can be re-run at any time, including against a project that has Drift
artifacts but no index yet. See the "Root Index" section of SKILL.md for the
specification this implements.

To install the merge driver in a clone (the Pi extension does this itself):
    git config merge.drift-index.name "Drift index row merge"
    git config merge.drift-index.driver "python3 -I /path/to/build-index.py --merge %O %A %B"
with `drift/INDEX.md merge=drift-index` in .gitattributes. Use forward slashes
in the path on Windows; git runs drivers through `sh -c`.

Requires only the Python standard library (3.7+).
"""
import datetime as dt
import re
import sys
from pathlib import Path

FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.S)
NAME_PREFIX = re.compile(r"(\d{3})-")
NAME_KIND = re.compile(r"\d{3}-(research|plan|handoff)-")
BODY_DATE = re.compile(r"^\*\*Date:\*\*\s*(\S+)", re.M)
# The rows this script renders, read back for --merge. Everything a row needs is in the row.
INDEX_HEADER = "| # | Date | Feature | Type | Artifact |"
INDEX_ROW = re.compile(r"^\| \d+ \| (?P<date>.+?) \| (?P<feature>.+?) \| (?P<kind>.+?) \| \[(?P<title>.+?)\]\((?P<path>.+?)\) \|$")
INDEX_UNDATED = re.compile(r"^- (?P<feature>.+?) / \[(?P<title>.+?)\]\((?P<path>.+?)\)$")


def scalar(block, key):
    """Read a flat `key: value` scalar out of a frontmatter block."""
    match = re.search(rf"^{key}:\s*(.+?)\s*$", block, re.M)
    if not match:
        return None
    value = match.group(1).strip().strip('"').strip("'")
    return None if value in ("", "null", "~") else value


def parse_date(raw):
    """Parse an ISO 8601 datetime, or a bare date, into an aware datetime.

    Every result is timezone-aware, because the index sorts on absolute instants
    and naive values cannot be compared against aware ones. A value carrying no
    offset is read as UTC: the only dates that reach here without one are bare
    `**Date:**` body lines, which the index already marks approximate.
    """
    # fromisoformat covers the frontmatter case and zero-padded bare dates. It
    # only gained "Z" support in 3.11, so normalize the suffix for older runtimes.
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
    for parse in (
        lambda: dt.datetime.fromisoformat(normalized),
        # Catches a hand-written date that isn't zero-padded, e.g. 2026-8-30.
        lambda: dt.datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc),
    ):
        try:
            parsed = parse()
        except ValueError:
            continue
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    return None


def parse_artifact(path, root):
    text = path.read_text(encoding="utf-8", errors="replace")
    match = FRONTMATTER.match(text)
    block = match.group(1) if match else ""

    # Frontmatter `date` is the source of truth. Artifacts predating the
    # convention may only carry a `**Date:**` line in the body — take it, but
    # mark the row approximate so the gap stays visible.
    raw_date = scalar(block, "date")
    approximate = False
    if not raw_date:
        body = BODY_DATE.search(text)
        raw_date = body.group(1) if body else None
        approximate = True

    relative = path.relative_to(root)
    name_prefix = NAME_PREFIX.match(path.name)
    name_kind = NAME_KIND.match(path.name)

    return {
        "path": relative.as_posix(),
        "title": path.stem,
        # Legacy subfolder layouts still index under their feature folder.
        "feature": scalar(block, "feature") or (relative.parts[0] if len(relative.parts) > 1 else "-"),
        "sequence": scalar(block, "sequence") or (name_prefix.group(1) if name_prefix else "---"),
        "kind": scalar(block, "type") or (name_kind.group(1) if name_kind else "-"),
        "when": parse_date(raw_date) if raw_date else None,
        "approximate": approximate,
    }


def format_date(row):
    """Local wall-clock time and offset, exactly as the artifact recorded it."""
    when = row["when"]
    if row["approximate"]:
        return f"{when:%Y-%m-%d} (approx)"
    offset = when.strftime("%z") or "+0000"
    return f"{when:%Y-%m-%d %H:%M} {offset[:3]}:{offset[3:]}"


def parse_index(text):
    """Rows of a rendered index keyed by artifact path.

    Returns None when the text is not a Drift index at all. An empty file is an
    empty index: git hands the driver an empty base when the file is new on both
    sides.
    """
    lines = text.replace("\r\n", "\n").split("\n")
    if INDEX_HEADER not in lines:
        return {} if not text.strip() else None
    rows = {}
    for line in lines:
        match = INDEX_ROW.match(line)
        if match:
            raw = match.group("date")
            approximate = raw.endswith(" (approx)")
            try:
                when = (parse_date(raw[: -len(" (approx)")]) if approximate
                        else dt.datetime.strptime(raw, "%Y-%m-%d %H:%M %z"))
            except ValueError:
                when = None
            rows[match.group("path")] = row_from_index(match, when, approximate or when is None)
            continue
        match = INDEX_UNDATED.match(line)
        if match:
            rows[match.group("path")] = row_from_index(match, None, True)
    return rows


def row_from_index(match, when, approximate):
    title = match.group("title")
    prefix = NAME_PREFIX.match(title)
    kind = match.groupdict().get("kind") or (NAME_KIND.match(title).group(1) if NAME_KIND.match(title) else "-")
    return {
        "path": match.group("path"),
        "title": title,
        "feature": match.group("feature"),
        "sequence": prefix.group(1) if prefix else "---",
        "kind": kind,
        "when": when,
        "approximate": approximate,
    }


def merge_rows(base, ours, theirs):
    """Union by path. A row one side removed and the other left alone stays removed."""
    rows = {**ours, **theirs}
    for path in base:
        if path not in ours or path not in theirs:
            rows.pop(path, None)
    return rows


def ordered(rows):
    """Split and sort rows the way the index lists them."""
    dated = [r for r in rows if r["when"]]
    undated = [r for r in rows if not r["when"]]
    # Feature then sequence keeps equal timestamps stable across rebuilds.
    dated.sort(key=lambda r: (r["when"].astimezone(dt.timezone.utc), r["feature"], r["sequence"]))
    undated.sort(key=lambda r: (r["feature"], r["path"]))
    return dated, undated


def write_index(path, content):
    # Explicit newline: the Pi publisher and the merge driver must produce identical bytes.
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(content)


def merge(paths):
    texts = [Path(p).read_text(encoding="utf-8", errors="replace") for p in paths]
    base, ours, theirs = (parse_index(t) for t in texts)
    if ours is None or theirs is None:
        print("error: --merge inputs are not Drift index files", file=sys.stderr)
        return 1
    dated, undated = ordered(merge_rows(base or {}, ours, theirs).values())
    write_index(paths[1], render(dated, undated))
    return 0


def render(dated, undated):
    lines = [
        "# Drift Index",
        "",
        "Chronological running order of every Drift artifact in this repository, oldest",
        "first. The feature folders hold each feature's own narrative; this index holds",
        "the cross-feature timeline, so `#` is a global running number and does **not**",
        "match a folder's `NNN` sequence.",
        "",
        "Rows are sorted by the true instant of each artifact's frontmatter `date`, with",
        "timezone offsets normalized to UTC before comparing. The Date column shows the",
        "local wall-clock time and offset as recorded, so an artifact written in another",
        "timezone can show an earlier wall-clock time in a later row.",
        "",
        "Maintained by the Drift skill: appended to whenever a new artifact is written,",
        "and rebuildable from frontmatter at any time.",
        "",
        "| # | Date | Feature | Type | Artifact |",
        "|---|---|---|---|---|",
    ]
    for number, row in enumerate(dated, 1):
        lines.append(
            f"| {number:03d} | {format_date(row)} | {row['feature']} | {row['kind']} "
            f"| [{row['title']}]({row['path']}) |"
        )

    if undated:
        lines += [
            "",
            "## Undated",
            "",
            "Artifacts with no parsable `date`. Add one and rebuild to place them in order.",
            "",
        ]
        lines += [f"- {row['feature']} / [{row['title']}]({row['path']})" for row in undated]

    def count(n, noun):
        return f"{n} {noun}" if n == 1 else f"{n} {noun}s"

    features = len({row["feature"] for row in dated})
    summary = f"{count(len(dated), 'dated artifact')} across {count(features, 'feature')}"
    lines += ["", "---", "", summary + (f"; {len(undated)} undated." if undated else ".")]
    return "\n".join(lines) + "\n"


def main(argv):
    # --stdout feeds the Pi publisher byte for byte: LF everywhere, not the platform's text-mode translation.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(newline="\n")
    args = [a for a in argv[1:] if not a.startswith("-")]
    flags = {a for a in argv[1:] if a.startswith("-")}
    if flags & {"-h", "--help"}:
        print(__doc__.strip())
        return 0
    modes = flags & {"--check", "--stdout", "--merge"}
    if flags - modes or len(modes) > 1 or ("--merge" in flags) != (len(args) == 3):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    if "--merge" in flags:
        return merge(args)

    root = Path(args[0] if args else "drift").resolve()
    if not root.is_dir():
        print(f"error: not a directory: {root}", file=sys.stderr)
        return 1

    index_path = root / "INDEX.md"
    rows = [parse_artifact(p, root) for p in sorted(root.rglob("*.md")) if p.name != "INDEX.md"]
    if not rows:
        print(f"error: no Drift artifacts found under {root}", file=sys.stderr)
        return 1

    dated, undated = ordered(rows)
    content = render(dated, undated)

    if "--stdout" in flags:
        print(content, end="")
        return 0

    if "--check" in flags:
        current = index_path.read_text(encoding="utf-8") if index_path.exists() else None
        if current == content:
            print(f"{index_path}: up to date ({len(dated)} artifacts)")
            return 0
        print(f"{index_path}: " + ("out of date" if current else "missing"), file=sys.stderr)
        return 1

    write_index(index_path, content)
    print(f"wrote {index_path}: {len(dated)} dated, {len(undated)} undated")
    for row in rows:
        if row["approximate"] and row["when"]:
            print(f"  approximate date (no frontmatter): {row['path']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
