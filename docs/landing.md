# Landing (per repository)

Part of [Drift](../README.md). How a completed handoff lands its branch on
origin's default branch.

Drift already knows when a unit of work ends: the handoff that completes the
interval. With a one-time opt-in, that handoff lands itself:

```json
{ "land": { "auto": true, "check": "pytest -q" } }
{ "land": { "auto": true, "check": ["cargo fmt --check", "cargo test"] } }
```

The sequence is fetch; rebase onto origin's default branch (the
[index](artifact-git-policy.md) and [changelog](changelog.md) drivers resolve
their files); verify the derived files; the guard
(`git diff origin/<default> --name-only` may list only files the branch's own
commits touch, which is how a squash against a moved ref or a push from a stale
index reverts other threads' work); the repo's check commands, any shell
command run in order, stopping at the first failure, nothing assumed about the
toolchain and nothing run when unset; `git push origin HEAD:<default>`; redo
from the fetch when the tip moved, at most three times; a `land` checkpoint on
the record. Where `autoContinue` is on (see [continuation.md](continuation.md)),
the profiled continuation then resumes in the same active worktree
at the landed commit; landing does not switch to the main checkout. It never
squashes, force-pushes or resets against a moving ref. The one thing it commits
is Drift's own publication output, which the handoff has just produced and which
holds nothing the agent decided: the artifact and index in a tracked repo, the
fragment and regenerated changelog, and Drift's own ignore and attribute lines,
in one `drift: publish <artifact>` commit. Any other uncommitted tracked change
is the agent's and stops the landing before anything happens.

A real conflict in a non-derived file, or the guard tripping, halts the chain:
the rebase is aborted, the branch is left as it was, the handoff stays
published, continuation is held, and the tool result says what blocked.
`/drift-land` is the same sequence as a manual command. Landings are
serialised across a repository's worktrees.

Worktree selection is not a sandbox: an adopted branch's `.drift.json` still
controls `land.auto` and the shell commands in `land.check`, just as when
launching in that checkout directly — review a branch and its landing config
before adopting it (see [worktrees.md](worktrees.md)).
