#!/usr/bin/env python3
"""List Drift artifacts in chronological running order, from their frontmatter.

Usage:
    build-index.py [<drift-dir>] [--json]

    <drift-dir>  Path to a project's drift/ directory. Defaults to ./drift.
    (default)    Print the timeline table to stdout. Nothing is written.
    --json       Print the raw-artifact catalog (dated/undated metadata, each dated
                 entry with its display row) for the Pi extension and other hosts.
                 An empty tree is successful.

Every row comes from an artifact's frontmatter, read fresh on each run; no view
file is kept. `--stdout` is accepted as an alias of the default for callers that
predate this (it used to select print-only over writing a file).

Requires only the Python standard library (3.7+).
"""
import datetime as dt
import io
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I omits the script dir; trusted sibling import
from _driftmeta import FRONTMATTER, parse_date, scalar

NAME_PREFIX = re.compile(r"(\d{3})-")
NAME_KIND = re.compile(r"\d{3}-(research|plan|handoff)-")
BODY_DATE = re.compile(r"^\*\*Date:\*\*\s*(\S+)", re.MULTILINE)


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
        "status": scalar(block, "status"),
        "superseded_by": scalar(block, "superseded_by"),
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


def ordered(rows):
    """Split and sort rows the way the index lists them."""
    dated = [r for r in rows if r["when"]]
    undated = [r for r in rows if not r["when"]]
    # Feature then sequence keeps equal timestamps stable across rebuilds.
    dated.sort(key=lambda r: (r["when"].astimezone(dt.timezone.utc), r["feature"], r["sequence"]))
    undated.sort(key=lambda r: (r["feature"], r["path"]))
    return dated, undated


def index_row(number, row):
    """The display row shared by the printed timeline and the catalog."""
    return (f"| {number:03d} | {format_date(row)} | {row['feature']} | {row['kind']} "
            f"| [{row['title']}]({row['path']}) |")


def catalog(dated, undated):
    """Structured discovery from raw artifacts; never consult the persisted view."""
    def entry(row, number=None):
        return {
            **{key: row[key] for key in ("path", "title", "feature", "sequence", "kind", "status", "superseded_by", "approximate")},
            "date": row["when"].isoformat() if row["when"] else None,
            "row": index_row(number, row) if number is not None else None,
        }
    return {"dated": [entry(row, number) for number, row in enumerate(dated, 1)],
            "undated": [entry(row) for row in undated]}


def artifact_rows(root):
    """Read primary records without glob's silent permission-error skips or symlink traversal."""
    paths = []

    def visit(directory):
        # iterdir raises on unreadable directories; rglob can silently omit them.
        for path in sorted(directory.iterdir()):
            if path.name == "INDEX.md":  # A retired generated view, never an artifact.
                continue
            if path.is_symlink():
                raise ValueError(f"Managed artifact path is a symlink: {path}")
            if path.is_dir():
                # Windows junctions are not is_symlink() on every supported Python.
                if path.resolve() != path:
                    raise ValueError(f"Managed artifact directory traverses a symlink or junction: {path}")
                if path.suffix == ".md":
                    raise ValueError(f"Managed artifact is not a file: {path}")
                visit(path)
            elif path.suffix == ".md":
                paths.append(path)

    visit(root)
    return [parse_artifact(path, root) for path in sorted(paths)]


def render(dated, undated):
    lines = [
        "# Drift artifacts",
        "",
        "Oldest first, by the true instant of each artifact's frontmatter `date`. `#` is a",
        "global running number, not a folder's `NNN` sequence; the Date column shows the",
        "local wall-clock time and offset as recorded.",
        "",
        "| # | Date | Feature | Type | Artifact |",
        "|---|---|---|---|---|",
    ]
    lines.extend(index_row(number, row) for number, row in enumerate(dated, 1))

    if undated:
        lines += [
            "",
            "## Undated",
            "",
            "Artifacts with no parsable `date`. Add one to place them in order.",
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
    # UTF-8 and LF everywhere, never the console code page (a cp1252 console crashes on
    # non-cp1252 artifact titles) or text-mode translation.
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", newline="\n")
    args = [a for a in argv[1:] if not a.startswith("-")]
    flags = {a for a in argv[1:] if a.startswith("-")}
    if flags & {"-h", "--help"}:
        print((__doc__ or "").strip())
        return 0
    # --stdout: alias of the default print mode, kept for publishers still loaded from before.
    if flags - {"--json", "--stdout"} or len(flags) > 1 or len(args) > 1:
        print((__doc__ or "").strip(), file=sys.stderr)
        return 2

    raw_root = Path(os.path.abspath(args[0] if args else "drift"))
    root = raw_root.resolve()
    if "--json" in flags and root != raw_root:
        print(f"error: managed artifact root traverses a symlink or junction: {raw_root}", file=sys.stderr)
        return 1
    if not root.is_dir():
        print(f"error: not a directory: {root}", file=sys.stderr)
        return 1

    try:
        rows = artifact_rows(root)
    except (OSError, ValueError) as error:
        print(f"error: could not read Drift artifacts: {error}", file=sys.stderr)
        return 1
    dated, undated = ordered(rows)
    if "--json" in flags:
        print(json.dumps(catalog(dated, undated), ensure_ascii=False))
        return 0
    if not rows:
        print(f"error: no Drift artifacts found under {root}", file=sys.stderr)
        return 1
    print(render(dated, undated), end="")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
