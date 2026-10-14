# Changelog from fragments (per repository)

Part of [Drift](../README.md). How `CHANGELOG.md` is generated from
`changelog.d/` fragments, and when.

Many agents editing one `[Unreleased]` section conflict on every rebase and lose
entries to "keep mine" resolutions. Drift fixes that by generating the file, but
only where the project chose it: Drift never adopts a changelog on its own.
Opening a repository, including a fresh clone with an `origin` remote, writes
nothing to `CHANGELOG.md`, `.gitattributes` or `changelog.d/`. A project adopts
once, explicitly, with `/drift-changelog on` (or `"changelog": true` in
`.drift.json`), and commits the result; from then on the committed markers are
the trigger, so every clone and worktree generates with no command or flag.
Markers that exist only in a working tree are not an adoption. A committed
adoption is only regenerated; Drift does not put back a README or attribute line
the project removed. One fragment per
change goes in `changelog.d/`, named after the artifact so names never collide,
and the file is rebuilt between two marker comments at each publication and
session start, with the project's own text outside the markers preserved byte
for byte. Entries are grouped by the first
version tag whose tree contains the fragment (`v*` by default; configurable as
`changelog.tags` in `.drift.json`), so releases need no step of their own;
untagged entries are `[Unreleased]`, and a repository without version tags is
grouped by day. Adoption also writes `CHANGELOG.md merge=drift-changelog` to
`.gitattributes`; the matching driver, installed per clone at session start
where generation is on,
unions entries by id on rebase and three-way merges the hand-written parts.

`drift_publish` takes an optional `changelog: { section, text }` and writes the
fragment beside the artifact in the same transaction. When no entry is requested,
omit `changelog` or pass `null`; an object with a supported `section` and empty or
whitespace-only `text` also means no entry. These forms normalise identically before
retry matching and create no fragment, whether generation is on or off.

A non-empty entry still requires generation to be on. If rejected before publication
starts, retry with `changelog: null` instead of repeating the rejected arguments or
rewriting the artifact body. Do not adopt a changelog just to unblock publication:
that is the user's policy choice. If an earlier publication is already pending,
preserve its original input and resolve the blocker; removing a real changelog entry
cannot bypass pending-publication protection.

A requested entry produces a fragment such as:

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
into a fragment. A repository that already keeps fragments another way is left to its own
convention: changesets, towncrier, or a `changelog.d/` whose files carry no Drift
frontmatter (or that holds only a README that is not Drift's). Drift writes nothing
there: no markers, no `.gitattributes` line. Adoption also checks first that every existing
fragment would build, so an invalid one is reported and nothing is written. A
changelog failure is reported as a changelog failure and never blocks the index. `.drift.json` overrides the trigger: `"changelog": false` keeps the
changelog hand-written even where markers are committed, `true` (or
`{ "tags": ... }`) adopts it; `/drift-changelog on|off|status` sets or explains it.
`changelog.d/README.md` states the convention for anything else that reads the
repository. Nothing is staged or committed.

## Cleaning up after automatic adoption

Drift from 2026-10-09 to 2026-10-12 adopted the changelog at session start in any
repository with an `origin` remote and a `CHANGELOG.md`, including fresh clones and
repositories that keep their own `changelog.d/` format. To remove what it left in
repositories that never chose it, update Drift, reload any running Pi sessions, then
run this once per machine:

```sh
python3 -I scripts/clean-changelog-residue.py           # report only
python3 -I scripts/clean-changelog-residue.py --apply   # make the changes
```

(`py -3` on Windows.) It scans the home directory and every linked worktree, and
changes only Drift's exact, uncommitted writes: the empty marker pair in
`CHANGELOG.md`, Drift's `.gitattributes` line, a `changelog.d/` holding only Drift's
README, and the clone's `merge.drift-changelog` driver. Anything staged, committed or
edited is reported and left alone, and repositories that adopted the changelog are
skipped. Nothing is staged or committed.
