"""Shared helpers for Drift's session hooks.

A *session record* is what the hooks leave behind so that a handoff written at
the end of a context window does not have to remember how the session began.
The record is created at session start, updated at session end, and promoted
into a numbered artifact when a handoff is written.

Records live outside the target repository, under ~/.claude/drift-sessions/,
because they are scratch state about a session rather than a project artifact.
Nothing here writes to the repo.

Both hooks import this module so the record's shape is defined in one place.
Requires only the Python standard library (3.7+).
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

HOME = Path(os.path.expanduser("~"))
RECORD_ROOT = HOME / ".claude" / "drift-sessions"
SKILL_ROOT = Path(__file__).resolve().parent.parent.parent


def now():
    """The clock, in the form Drift's frontmatter requires."""
    return datetime.now().astimezone().isoformat(timespec="seconds")


def git(repo, *args):
    """Run git in `repo`, returning stripped stdout, or "" on any failure."""
    try:
        done = subprocess.run(
            ["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=10
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return done.stdout.strip() if done.returncode == 0 else ""


def repo_root(cwd):
    """The git root containing cwd, or None when cwd is not in a repository."""
    root = git(cwd, "rev-parse", "--show-toplevel")
    return Path(root) if root else None


def slug(path):
    """A filesystem-safe key for a repo path, kept readable for debugging."""
    return re.sub(r"[^A-Za-z0-9]+", "-", str(path)).strip("-").lower() or "root"


def record_dir(repo):
    return RECORD_ROOT / slug(repo)


def record_path(repo, session_id):
    safe = re.sub(r"[^A-Za-z0-9_-]+", "", session_id or "unknown") or "unknown"
    return record_dir(repo) / (safe + ".json")


def read_record(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return None


def write_record(path, record):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2, sort_keys=True)
        handle.write("\n")
    os.replace(str(tmp), str(path))


def open_records(repo, exclude=None):
    """Records for this repo other than `exclude`, newest first.

    A record left behind by a session that ended without a handoff is an
    orphan: it names work that happened and was never written up.
    """
    found = []
    for path in sorted(record_dir(repo).glob("*.json")) if record_dir(repo).is_dir() else []:
        if exclude and path.name == exclude.name:
            continue
        record = read_record(path)
        if record:
            found.append((path, record))
    found.sort(key=lambda pair: pair[1].get("started", ""), reverse=True)
    return found


def worktree_fingerprint(repo):
    """What the working tree looks like right now, per file.

    Taken at session start and again at session end so that a session is
    credited only with what it actually changed. Comparing against the starting
    *commit* instead would hand every session the uncommitted work it merely
    found lying there, which is how a two-second session that did nothing came
    to report ten changed files.

    `--numstat` gives added/deleted counts per path, so a file that was already
    dirty and got edited further is still detected.
    """
    numstat = {}
    for line in git(repo, "diff", "HEAD", "--numstat").split("\n"):
        parts = line.split("\t")
        if len(parts) >= 3 and parts[2]:
            numstat[parts[2]] = "%s/%s" % (parts[0], parts[1])
    untracked = sorted(
        line for line in git(repo, "ls-files", "--others", "--exclude-standard").split("\n") if line
    )
    return {"numstat": numstat, "untracked": untracked}


def fingerprint_delta(before, end):
    """Paths whose working-tree state differs between two fingerprints."""
    before = before or {}
    start_numstat = before.get("numstat") or {}
    end_numstat = end.get("numstat") or {}
    changed = {
        path
        for path in set(start_numstat) | set(end_numstat)
        if start_numstat.get(path) != end_numstat.get(path)
    }
    changed |= set(before.get("untracked") or []) ^ set(end.get("untracked") or [])
    return changed


def reap_records(keep_days=30):
    """Drop records whose repository is gone, or that are simply too old.

    Nothing else removes them: a record for a repo under /tmp outlives the repo,
    and a machine left alone accumulates them indefinitely.
    """
    if not RECORD_ROOT.is_dir():
        return 0
    cutoff = time.time() - keep_days * 86400
    removed = 0
    for path in RECORD_ROOT.rglob("*.json"):
        record = read_record(path)
        gone = record is None or not Path(record.get("repo", "")).is_dir()
        try:
            stale = path.stat().st_mtime < cutoff
        except OSError:
            stale = False
        if gone or stale:
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass
    for directory in RECORD_ROOT.iterdir() if RECORD_ROOT.is_dir() else []:
        if directory.is_dir() and not any(directory.iterdir()):
            try:
                directory.rmdir()
            except OSError:
                pass
    return removed


def load_index_builder():
    """Reuse build-index.py's frontmatter parsing rather than re-implementing it.

    Imported by path because the filename contains a hyphen.
    """
    import importlib.util

    script = SKILL_ROOT / "scripts" / "build-index.py"
    if not script.is_file():
        return None
    try:
        spec = importlib.util.spec_from_file_location("drift_build_index", str(script))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    except Exception:
        return None


def feature_board(repo, limit=8, status_chars=110):
    """One line per feature: where that feature actually stands right now.

    The chronological index answers "what happened, in order". Resuming needs
    "what is open", which means the latest artifact per feature and whatever
    status it recorded. Derived here rather than stored, so it cannot go stale.
    """
    drift = Path(repo) / "drift"
    if not drift.is_dir():
        return []
    builder = load_index_builder()
    if builder is None:
        return []

    latest = {}
    for path in drift.rglob("*.md"):
        if path.name == "INDEX.md":
            continue
        try:
            row = builder.parse_artifact(path, drift)
        except Exception:
            continue
        if not row.get("when"):
            continue
        feature = row["feature"]
        if feature not in latest or row["when"] > latest[feature]["when"]:
            text = path.read_text(encoding="utf-8", errors="replace")[:4000]
            match = re.search(r"^status:\s*(.+?)\s*$", text, re.M)
            row["status"] = match.group(1).strip().strip("\"'") if match else ""
            latest[feature] = row
        # A feature is only as fresh as its newest artifact, so keep looking.

    rows = sorted(latest.values(), key=lambda r: r["when"], reverse=True)[:limit]
    lines = []
    for row in rows:
        status = " ".join(row["status"].split())
        if len(status) > status_chars:
            status = status[: status_chars - 1].rstrip() + "…"
        lines.append(
            "- %s: %s (%s, %s)%s"
            % (
                row["feature"],
                row["title"],
                row["kind"],
                row["when"].strftime("%Y-%m-%d"),
                " — " + status if status else "",
            )
        )
    return lines


def emit(context):
    """Hand text back to the session as additional context, or stay silent."""
    if context:
        json.dump(
            {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": context,
                }
            },
            sys.stdout,
        )
        sys.stdout.write("\n")


def read_event():
    """Parse the hook payload on stdin. Never raises."""
    try:
        return json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return {}
