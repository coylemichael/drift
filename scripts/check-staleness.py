#!/usr/bin/env python3
"""Grade the code citations in a Drift artifact against the current tree.

Usage:
    check-staleness.py <artifact.md> [<repo>] [--json]

    <artifact.md>  A Drift artifact. Citations are `path:line` or `path:start-end`
                   references in its body (plain or backticked); a backticked bare
                   `:N` or `:N-M` continues the most recent cited path.
    <repo>         Repository the citations point into. Defaults to the parent of
                   the artifact's `drift/` folder.
    --json         Machine-readable report (used by the Pi pickup flow).

Verdicts per citation:
    fresh      the cited lines are identical (after normalization) to what was recorded
    moved      the recorded text now lives at a different range or file; reported
    changed    the cited range differs; a difflib similarity ratio is reported
    gone       neither the range nor the recorded text can be located
    uncertain  nothing to grade against: no anchor and no recorded commit, the anchor
               was taken over uncommitted changes, or the recorded commit is gone

Modes:
    exact      the frontmatter carries `anchors` written by the publisher (content
               hashes per citation): grading is a proof, not a guess.
    heuristic  older artifacts without anchors: the expectation is reconstructed
               from `git show <git_commit>:<path>`, resolving paths by unique suffix.

This is a report, not a gate: it never writes anything, and it exits 0 whenever the
report was produced regardless of verdicts (1 is a usage or IO error). Similarity uses
difflib over the real texts; fuzzy hashes are deliberately not used (see _driftmeta).

Requires only the Python standard library (3.7+) and git on PATH.
"""
import difflib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I omits the script dir; trusted sibling import
from _driftmeta import FRONTMATTER, anchor_hash, git, normalize_lines, scalar  # noqa: E402

# A file path with a letter-led extension, then :start[-end]. The extension rule keeps
# timestamps (2026-10-10T18:33) and URL ports out; the lookbehind keeps scheme tails out.
CITATION = re.compile(
    r"(?<![\w:/\\])(?P<path>[A-Za-z0-9_][A-Za-z0-9_.\-]*(?:[\\/][A-Za-z0-9_.\-]+)*\.[A-Za-z][A-Za-z0-9]{0,7})"
    r":(?P<start>\d+)(?:-(?P<end>\d+))?")
BARE = re.compile(r"\A:(?P<start>\d+)(?:-(?P<end>\d+))?\Z")
CODE_SPAN = re.compile(r"`([^`\n]+)`")


def extract_citations(body):
    """Ordered, deduplicated citations: (path, start, end). Backticked bare `:N` refs
    continue the most recent cited path, the way this repo's research artifacts write them."""
    found = []  # (position, path, start, end)
    for match in CITATION.finditer(body):
        tail = body[max(0, match.start() - 8):match.start()]
        if "://" in tail:
            continue  # URL, not a file reference.
        start = int(match.group("start"))
        end = int(match.group("end") or start)
        found.append((match.start(), match.group("path").replace("\\", "/").lstrip("./"), start, end))
    for span in CODE_SPAN.finditer(body):
        bare = BARE.match(span.group(1).strip())
        if not bare:
            continue
        earlier = [f for f in found if f[0] < span.start()]
        if not earlier:
            continue  # A bare ref before any pathed one has nothing to continue.
        start = int(bare.group("start"))
        end = int(bare.group("end") or start)
        found.append((span.start(), earlier[-1][1], start, end))
    found.sort()
    seen, citations = set(), []
    for _, path, start, end in found:
        key = (path, start, end)
        if key not in seen and end >= start:
            seen.add(key)
            citations.append({"path": path, "start": start, "end": end})
    return citations


def commit_exists(repo, commit):
    if not commit:
        return False
    try:
        # cat-file -e: exit 0 when the object exists; anything else raises or returns None.
        return git(repo, "cat-file", "-e", f"{commit}^{{commit}}") is not None
    except RuntimeError:
        return False


def resolve_path(repo, path, names):
    """The cited path itself, or the unique tracked path ending with it."""
    if (repo / path).is_file() or path in names:
        return path
    suffix = "/" + path.lstrip("/")
    matches = [name for name in names if name.endswith(suffix)]
    return matches[0] if len(matches) == 1 else None


def file_lines(repo, path):
    target = repo / path
    if not target.is_file():
        return None
    return target.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n").split("\n")


def range_text(lines, start, end):
    if lines is None or start < 1 or start > len(lines):
        return None
    return "\n".join(lines[start - 1:min(end, len(lines))])


def find_window(lines, needle, size, expected_hash):
    """Line numbers (1-based) where a `size`-line window containing `needle` hashes to expected."""
    if lines is None or not needle.strip():
        return None
    for i, line in enumerate(lines):
        if needle in line:
            for offset in range(max(0, i - size + 1), i + 1):
                window = "\n".join(lines[offset:offset + size])
                if anchor_hash(window) == expected_hash:
                    return offset + 1
    return None


def locate_moved(repo, names, home, needle, size, expected_hash):
    """(path, line) of the recorded text's new home: same file first, then tracked files."""
    home_lines = file_lines(repo, home) if home else None
    line = find_window(home_lines, needle, size, expected_hash)
    if line:
        return home, line
    try:
        hits = git(repo, "grep", "-nF", "--", needle, ok=(0, 1)) or ""
    except RuntimeError:
        hits = ""
    checked = set()
    for hit in hits.splitlines()[:50]:
        path = hit.split(":", 1)[0].replace("\\", "/")
        if path == home or path in checked or path not in names:
            continue
        checked.add(path)
        line = find_window(file_lines(repo, path), needle, size, expected_hash)
        if line:
            return path, line
    return None


def grade(repo, names, citation, expected_text, expected_hash, resolved):
    """The verdict ladder: fresh -> moved -> changed(ratio) -> gone."""
    size = citation["end"] - citation["start"] + 1
    lines = file_lines(repo, resolved) if resolved else None
    current = range_text(lines, citation["start"], citation["end"])
    if current is not None and anchor_hash(current) == expected_hash:
        return {"verdict": "fresh"}
    needle = max(expected_text.split("\n"), key=lambda l: len(l.strip())) if expected_text else None
    if needle:
        moved = locate_moved(repo, names, resolved, needle.strip(), size, expected_hash)
        if moved:
            return {"verdict": "moved", "to": {"path": moved[0], "line": moved[1]}}
    if current is not None and current.strip():
        if expected_text is None:
            return {"verdict": "changed", "detail": "content differs; original text unavailable"}
        ratio = difflib.SequenceMatcher(None, normalize_lines(expected_text), normalize_lines(current)).ratio()
        return {"verdict": "changed", "similarity": round(ratio, 2)}
    return {"verdict": "gone"}


def check(artifact, repo):
    text = artifact.read_text(encoding="utf-8", errors="replace")
    match = FRONTMATTER.match(text.replace("\r\n", "\n"))
    block = match.group(1) if match else ""
    body = text[match.end():] if match else text
    commit = scalar(block, "git_commit")
    anchors = []
    anchor_line = re.search(r"^anchors:\s*(\[.*\])\s*$", block, re.M)
    if anchor_line:
        try:
            anchors = json.loads(anchor_line.group(1))
        except ValueError:
            anchors = []
    by_range = {(a.get("path"), a.get("start"), a.get("end")): a for a in anchors if isinstance(a, dict)}
    citations = extract_citations(body)
    names = set((git(repo, "ls-files") or "").splitlines())
    pinned = commit_exists(repo, commit)
    results = []
    for citation in citations:
        anchor = by_range.get((citation["path"], citation["start"], citation["end"]))
        resolved = resolve_path(repo, citation["path"], names)
        expected_text = None
        if pinned:
            shown = git(repo, "show", f"{commit}:{resolve_path(repo, citation['path'], names) or citation['path']}", ok=(0, 128))
            if shown:
                expected_text = range_text(shown.replace("\r\n", "\n").split("\n"), citation["start"], citation["end"])
        if anchor and anchor.get("sha256"):
            if anchor.get("dirty"):
                results.append({**citation, "verdict": "uncertain", "detail": "anchored over uncommitted changes"})
                continue
            results.append({**citation, **grade(repo, names, citation, expected_text, anchor["sha256"], resolved)})
        elif expected_text is not None:
            results.append({**citation, **grade(repo, names, citation, expected_text, anchor_hash(expected_text), resolved)})
        else:
            why = "no recorded commit" if not commit else ("recorded commit not in this repository" if not pinned else "cited path not in the recorded commit")
            results.append({**citation, "verdict": "uncertain", "detail": why})
    return {"artifact": artifact.as_posix(), "mode": "exact" if anchors else "heuristic",
            "commit": commit, "date": scalar(block, "date"), "citations": results,
            "counts": {v: sum(1 for r in results if r["verdict"] == v) for v in ("fresh", "moved", "changed", "gone", "uncertain")}}


def reference(result):
    span = f"{result['start']}" + (f"-{result['end']}" if result["end"] != result["start"] else "")
    return f"{result['path']}:{span}"


def render(report):
    lines = [f"{report['artifact']} — {len(report['citations'])} citation(s), {report['mode']} mode"]
    for result in report["citations"]:
        extra = ""
        if result["verdict"] == "moved":
            extra = f" → {result['to']['path']}:{result['to']['line']}"
        elif result["verdict"] == "changed" and "similarity" in result:
            extra = f" ({round(result['similarity'] * 100)}% similar)"
        elif result.get("detail"):
            extra = f" ({result['detail']})"
        lines.append(f"  {result['verdict']:<9} {reference(result)}{extra}")
    counts = report["counts"]
    lines.append("summary: " + ", ".join(f"{counts[v]} {v}" for v in ("fresh", "moved", "changed", "gone", "uncertain") if counts[v]))
    return "\n".join(lines)


def main(argv):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", newline="\n")
    args = [a for a in argv[1:] if not a.startswith("-")]
    flags = {a for a in argv[1:] if a.startswith("-")}
    if flags & {"-h", "--help"} or not args or len(args) > 2 or flags - {"--json", "-h", "--help"}:
        print(__doc__.strip(), file=sys.stderr if args or flags - {"-h", "--help"} else sys.stdout)
        return 0 if flags & {"-h", "--help"} else 2
    artifact = Path(args[0]).resolve()
    if not artifact.is_file():
        print(f"error: not a file: {artifact}", file=sys.stderr)
        return 1
    if len(args) == 2:
        repo = Path(args[1]).resolve()
    else:
        # The artifact store folder is the LAST `drift` component before the filename;
        # the repository itself may be named drift (this one is).
        parts = artifact.parts
        stores = [i for i, part in enumerate(parts[:-1]) if part == "drift"]
        repo = Path(*parts[:stores[-1]]) if stores else artifact.parent
    if not repo.is_dir():
        print(f"error: not a directory: {repo}", file=sys.stderr)
        return 1
    try:
        report = check(artifact, repo)
    except RuntimeError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2) if "--json" in flags else render(report))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
