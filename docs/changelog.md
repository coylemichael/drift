# Changelog from fragments (per repository)

Part of [Drift](../README.md). How `CHANGELOG.md` is generated from
`changelog.d/` fragments, and when.

Many agents editing one `[Unreleased]` section conflict on every rebase and lose
entries to "keep mine" resolutions. That can only happen where two copies of the
file can meet in git, so the trigger is a shared branch: in a repository with an
`origin` remote and a root `CHANGELOG.md`, Drift makes the changelog a generated
file at the first session start or publication, with no command. One fragment per
change goes in `changelog.d/`, named after the artifact so names never collide,
and the file is rebuilt between two marker comments at each publication and
session start, with the project's own text outside the markers preserved byte
for byte. A local-only repository has one writer and is left alone. Entries are grouped by the first
version tag whose tree contains the fragment (`v*` by default; configurable as
`changelog.tags` in `.drift.json`), so releases need no step of their own;
untagged entries are `[Unreleased]`, and a repository without version tags is
grouped by day. Adoption also writes `CHANGELOG.md merge=drift-changelog` to
`.gitattributes`; the matching driver, installed per clone at session start,
unions entries by id on rebase and three-way merges the hand-written parts.

`drift_publish` takes an optional `changelog: { section, text }` and writes the
fragment beside the artifact in the same transaction:

```text
changelog.d/cards-pass-043-ledger-recut.md
---
date: "2026-10-09T16:29:21+01:00"
section: "Changed"
artifact: "drift/cards-pass/043-handoff-ledger-recut.md"
---
One Markdown bullet; further lines continue it. No blank lines.
```

The generated region is a one-way view of `changelog.d/`: to change a bullet,
edit its fragment and regenerate. A bullet edited directly in the region, or a
line added there without an id, is reported with its line number and left
alone; regeneration stops until the text is moved into its fragment or deleted.
Drift does not guess at text it did not write, and never copies view text back
into a fragment. A repository that already uses changesets or towncrier is left to its own
convention. `.drift.json` overrides the trigger: `"changelog": false` keeps a
shared repository's changelog hand-written, `true` (or `{ "tags": ... }`) forces
generation in a local one; `/drift-changelog on|off|status` sets or explains it.
`changelog.d/README.md` states the convention for anything else that reads the
repository. Nothing is staged or committed.
