#!/usr/bin/env python3
"""Drift SessionEnd hook: close the session record, or throw it away.

Registered by install.py for every SessionEnd matcher. Reads the hook payload on
stdin and writes nothing to the session, which has already ended.

It closes the record opened at session start with what actually happened:
commits made since the starting commit, and the files the session itself
changed. A session that changed nothing leaves no record at all — the file is
deleted, so trivial sessions cost nothing and the only records that survive are
ones that mean something.

A record that survives without a handoff is an orphan, and the next session in
this repo is told about it by the session-start hook. That inverts Drift's worst
failure: instead of the most exhausted agent writing the handoff, the next one
writes it from this record and the git history, with a full context window.

Can also be run by hand for agents that have no session-end event:

    python3 session-end.py --repo .
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import session_state as st  # noqa: E402


def newest_open_record(repo):
    """The most recent record for this repo that was never closed."""
    for path, record in st.open_records(repo):
        if not record.get("ended"):
            return path
    return None


def resolve(argv):
    """Work out which record to close. Returns (repo, path, why, manual)."""
    if "--repo" in argv:
        index = argv.index("--repo")
        where = argv[index + 1] if len(argv) > index + 1 else "."
        repo = st.repo_root(where)
        if repo is None:
            print("not a git repository: %s" % where, file=sys.stderr)
            return None, None, None, True
        path = newest_open_record(repo)
        if path is None:
            print("no open Drift session record for %s" % repo)
        return repo, path, "manual", True

    event = st.read_event()
    session_id = event.get("session_id")
    if not session_id:
        return None, None, None, False  # No payload, no session to close.
    repo = st.repo_root(event.get("cwd") or ".")
    if repo is None:
        return None, None, None, False
    return repo, st.record_path(repo, session_id), event.get("why") or "other", False


def main():
    repo, path, why, manual = resolve(sys.argv[1:])
    if repo is None or path is None:
        return

    record = st.read_record(path)
    if record is None:
        return  # No start record: nothing to close.

    start = record.get("start_commit") or ""
    head = st.git(repo, "rev-parse", "HEAD")

    commits = []
    if start and head and start != head:
        log = st.git(repo, "log", "--format=%h %s", "%s..HEAD" % start)
        commits = [line for line in log.split("\n") if line]

    # Credit the session only with what changed while it ran. Diffing against
    # the starting commit instead would hand it every uncommitted file that was
    # already sitting in the tree when it opened.
    touched = st.fingerprint_delta(record.get("start_fingerprint"), st.worktree_fingerprint(repo))
    if start and head and start != head:
        committed = st.git(repo, "diff", "--name-only", start, head)
        touched |= {line for line in committed.split("\n") if line}
    touched_files = sorted(touched)
    uncommitted = len([line for line in st.git(repo, "status", "--porcelain").split("\n") if line])

    if not commits and not touched_files:
        try:
            path.unlink()  # Nothing happened; leave no trace.
        except OSError:
            pass
        if manual:
            print("closed: nothing changed, record removed (%s)" % path.name)
        return

    record.update(
        {
            "ended": st.now(),
            "why": why,
            "end_branch": st.git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
            "end_commit": head,
            "commits": commits,
            "files_changed": len(touched_files),
            "files": touched_files[:60],
            "uncommitted": uncommitted,
        }
    )
    st.write_record(path, record)
    if manual:
        print(
            "closed %s: %d file(s), %d commit(s). Write a Drift handoff from it, then delete it."
            % (path.name, len(touched_files), len(commits))
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("drift session-end hook: %s" % err, file=sys.stderr)
    sys.exit(0)
