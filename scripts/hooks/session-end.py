#!/usr/bin/env python3
"""Drift SessionEnd hook: close the session record, or throw it away.

Registered by install.py for every SessionEnd matcher. Reads the hook payload on
stdin and writes nothing to the session, which has already ended.

It closes the record opened at session start with what actually happened:
uncommitted changes, and commits made since the starting commit. A session that
changed nothing leaves no record at all — the file is deleted, so trivial
sessions cost nothing and the only records that survive are ones that mean
something.

A record that survives without a handoff is an orphan, and the next session in
this repo is told about it by the session-start hook. That inverts Drift's worst
failure: instead of the most exhausted agent writing the handoff, the next one
writes it from this record and the git history, with a full context window.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import session_state as st  # noqa: E402


def main():
    event = st.read_event()
    cwd = event.get("cwd") or "."
    session_id = event.get("session_id")
    if not session_id:
        return  # No payload, no session to close.

    repo = st.repo_root(cwd)
    if repo is None:
        return

    path = st.record_path(repo, session_id)
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
        return

    record.update(
        {
            "ended": st.now(),
            "why": event.get("why") or "other",
            "end_branch": st.git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
            "end_commit": head,
            "commits": commits,
            "files_changed": len(touched_files),
            "files": touched_files[:60],
            "uncommitted": uncommitted,
        }
    )
    st.write_record(path, record)


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("drift session-end hook: %s" % err, file=sys.stderr)
    sys.exit(0)
