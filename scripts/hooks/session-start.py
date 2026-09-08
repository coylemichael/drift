#!/usr/bin/env python3
"""Drift SessionStart hook: open a session record and say where the repo stands.

Registered by install.py for the startup, resume, clear, compact and fork
matchers. Reads the hook payload on stdin and writes context to stdout as
`hookSpecificOutput.additionalContext`.

Two jobs:

1. **Open a session record.** Start time from the clock, plus branch and commit,
   stored outside the repo. A handoff written hours later at the ragged end of a
   context window then has the session's real beginning to work from instead of
   an estimate. This is the fix for the failure mode Drift documents in SKILL.md
   §Timestamps: the agent asked to write a handoff is the one least able to
   reconstruct when the session started.

2. **Say what is open.** The latest artifact per feature with its status, plus a
   notice for any earlier session that changed files and never wrote a handoff.

On compaction the record is left as it is and only the context is re-emitted,
because the session is the same one and its start has not moved.

This hook must never fail: a non-zero exit from SessionStart can block the
session from starting, so every path here ends in exit 0.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import session_state as st  # noqa: E402


def orphan_notice(repo, mine):
    """Earlier sessions in this repo that changed files and were never written up."""
    notes = []
    for path, record in st.open_records(repo, exclude=mine):
        if not record.get("ended") or record.get("handoff"):
            continue
        changed = record.get("files_changed") or 0
        commits = record.get("commits") or []
        if not changed and not commits:
            continue
        notes.append(
            "- session of %s left %d changed file(s) and %d commit(s) with no handoff (record: %s)"
            % (record.get("started", "unknown")[:16], changed, len(commits), path)
        )
    return notes


def main():
    event = st.read_event()
    cwd = event.get("cwd") or "."
    how = event.get("how") or "startup"
    session_id = event.get("session_id")
    if not session_id:
        return  # Malformed payload; write nothing rather than a record named "unknown".

    repo = st.repo_root(cwd)
    if repo is None:
        return  # Not a git repository; Drift has nothing to anchor to.

    path = st.record_path(repo, session_id)
    existing = st.read_record(path)

    if how in ("compact", "clear") and existing:
        # The context went away, the session did not. Its start has not moved,
        # so keep the record and only re-state what the new context needs.
        existing.setdefault("compactions", []).append(st.now())
        st.write_record(path, existing)
        record = existing
    else:
        record = existing or {}
        record.update(
            {
                "session_id": session_id,
                "repo": str(repo),
                "cwd": cwd,
                "started": record.get("started") or st.now(),
                "start_branch": st.git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
                "start_commit": st.git(repo, "rev-parse", "HEAD"),
                "how": how,
            }
        )
        st.write_record(path, record)

    parts = [
        "Drift session record: %s" % path,
        "Started %s on %s at %s."
        % (record.get("started"), record.get("start_branch") or "?", (record.get("start_commit") or "?")[:12]),
        "When you write a Drift handoff, take the session's start time, branch and"
        " commit from this record rather than estimating them, and delete the record"
        " once the artifact is written.",
    ]

    board = st.feature_board(repo)
    if board:
        parts.append("")
        parts.append("Open Drift features (latest artifact each, newest first):")
        parts.extend(board)

    orphans = orphan_notice(repo, path)
    if orphans:
        parts.append("")
        parts.append(
            "Unwritten sessions — a previous session changed files and ended without a"
            " handoff. Offer to write it from the record and git history before starting"
            " new work:"
        )
        parts.extend(orphans)

    st.emit("\n".join(parts))


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # A broken hook must not stop the session starting.
        print("drift session-start hook: %s" % err, file=sys.stderr)
    sys.exit(0)
