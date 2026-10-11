# Artifact Git policy (per repository)

Part of [Drift](../README.md). Whether a repository's `drift/` artifacts are
committed to Git or stay private.

Artifacts are ignored by default. To let handoffs travel between machines,
commit this **repository-root** `.drift.json` alongside the artifacts:

```json
{ "trackArtifacts": true }
```

This is host-neutral project data, not a Pi user setting or a per-tool argument.
The Pi publisher reads it on every publication; other hosts follow the same
choice through the portable skill. Missing config, `{}` or `false` keeps the
ignored default and adds `/drift/` to `.gitignore` if needed.

With `true`, Drift does not create or edit `.gitignore`, stage files, commit, or
push. Artifact and index paths must actually be unignored; resolve existing
rules explicitly. The flag is permission to publish trackable files, **not** an
automatic commit. Already-tracked artifacts or an `!/drift/` exception alone do
not select this mode. Invalid JSON, unknown fields, non-boolean values and unsafe
config paths fail rather than silently selecting a policy.

## `/drift-track-artifacts` on Pi

**On Pi, use `/drift-track-artifacts`** in a thread bound to the target checkout
(the session's Drift root; see [worktrees.md](worktrees.md)): `on`, `off`,
or `status` (no argument shows status). It is a Pi command, never
sent to a model. **On** writes the flag and removes the `/drift/` rule (and
`/drift`, `drift/`, `drift` variants) from `.gitignore`, keeping everything
else. **Off** writes `false` and adds `/drift/` back; files already committed
stay tracked until you run the `git rm -r --cached drift` it suggests. Either
way it then asks Git whether an index and an artifact path landed on the chosen
side; if another rule defeats the choice, both files are restored and the rule
is named. Nothing is staged or committed. In other hosts, make the same edits
and commit them.

## Many threads, one index

A tracked index is committed, so two worktrees'
copies meet at every rebase. In a tracked repository with an `origin` remote,
Drift writes `drift/INDEX.md merge=drift-index` to `.gitattributes` at session
start (`/drift-track-artifacts on` writes it too) and installs the matching
driver in the clone
(`build-index.py --merge`): rows from both sides are unioned, reordered by
timestamp and renumbered, so the rebase never stops on the index. Without the
driver git falls back to its normal text merge; nothing else changes. In
tracked mode the next `NNN` also counts artifacts already landed on any
remote-tracking ref. Other hosts install the driver with one command:

```sh
git config merge.drift-index.name "Drift index row merge"
git config merge.drift-index.driver "python3 -I /path/to/drift/scripts/build-index.py --merge %O %A %B"
```

## Worktrees in private mode

Linked worktrees in private mode share the main worktree's `drift/`: a linked
worktree holds no `drift/` of its own, publishes into the shared store, and
sees the whole history in `/drift`, so nothing is lost when the worktree is
removed. `.drift.json`, changelog fragments and record metadata still come from
the linked worktree itself. Tracked worktrees keep a folder each, because those
artifacts travel with the branch. Adoption mechanics are in
[worktrees.md](worktrees.md).
