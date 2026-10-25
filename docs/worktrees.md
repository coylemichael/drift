# Worktrees for parallel workers (Pi)

Part of [Drift](../README.md). Full adoption semantics for binding a session to
a linked worktree.

A common layout: start several Pi ACP sessions in the main checkout, then have
an orchestrator assign each worker an existing linked worktree. A Pi session's
`cwd` is fixed when it starts, so Drift binds a worktree explicitly:

| Form | Effect |
| --- | --- |
| `/drift-worktree` or `/drift-worktree status` | Shows the launch repo, the active Drift root and the record. Read-only. |
| `/drift-worktree <path>` | Adopts that worktree. A relative path resolves from the session's original `cwd`. |
| `drift_worktree { action: "status" }` / `{ action: "adopt", path }` | The same, as a model tool. |

What adoption accepts and does:

- **Target:** the exact root of an existing worktree of the **same repository**
  (same Git common directory). Other clones, submodules, subdirectories and
  missing paths are rejected. Drift never creates, rebases or repairs a
  worktree, and never edits its policy; the target's own (branch-local)
  `.drift.json` applies. Session-start preparation runs before the new baseline;
  tracking opt-in and ignore rules are not changed.
- **When:** as the sole call in its tool-call batch, with no publication pending and
  no continuation queued; otherwise it fails and changes nothing. Adopting the
  current root is a no-op.
- **Record:** the session keeps one record under Pi's agent directory, keyed to
  the launch repository, with the active worktree on it. Each adoption snapshots the previous interval's
  baseline and receipts into the record's history and takes a fresh measured
  baseline in the target. Switching back is another adoption with another fresh
  baseline. No handoff is written and no interval is marked complete; work done
  before adoption is not measured against the new root. Worktree-aware records
  use version 2 so an older publisher refuses them rather than measuring main.
- **Scope:** every Drift repository operation then uses the adopted root:
  metadata, numbering, publication, refs,
  `/drift-track-artifacts`, `/drift-auto-continue`,
  `/drift-land` and continuation
  artifacts. Tracked artifacts follow the worktree's branch; private artifacts
  go to the shared main-worktree store, with metadata from the
  worker (see [artifact-git-policy.md](artifact-git-policy.md)).
- **Durability:** the binding survives reload, resume, compaction and automatic
  continuation of the same session. A new, forked or cloned session is not
  adopted automatically.

What it does not change: Pi's `cwd`, the default directory of built-in
`read`/`edit`/`bash`, where Pi stores session files, and project trust. Use
explicit worker paths with those tools. `cd` in a shell has no effect on Drift.
A trusted launch project does not make the adopted checkout's
`.pi/drift-model-profiles.json` trusted; the global profile file is used
instead (see [continuation.md](continuation.md)). Worktree selection is not a
sandbox: the adopted branch's `.drift.json`
still controls `land.auto` and the shell commands in `land.check`, just as when
launching in that checkout directly (see [landing.md](landing.md)). Review that
branch and its landing config
before adopting it; adoption does not itself run a landing.

If the adopted worktree is removed or its Git directory is recreated, Drift
operations fail and name it; there is no silent fallback to the launch repo.
`status` and `adopt` still work: explicitly adopt another root, or the recreated
worktree, to take a fresh baseline. If a queued continuation stalls, status names
the artifact to pick up with `/drift <file>`; reload clears the in-memory queue
without removing the artifact.

Workers should adopt their assigned worktree before any substantive work; the
orchestrator can stay in the main checkout.
