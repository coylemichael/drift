---
date: "2026-10-09T18:51:30+01:00"
branch: "main"
git_commit: "05e46971767fa207e3dce522c37c87b45c85df6c"
feature: "shared-files"
sequence: "002"
type: "plan"
status: "superseded"
source_research: "drift/shared-files/001-research-shared-files-under-many-agents.md"
related_artifacts: []
---

## Objective

Make `drift/INDEX.md` and `CHANGELOG.md` derived files that many agents can
land concurrently without conflicts or hand resolution, consolidate private
artifacts across worktrees, and reduce the landing rulebook to one command.

## Source Research

- drift/shared-files/001-research-shared-files-under-many-agents.md
- docs/shared-files-plan.html (the design document; sections cited as §n)

## Starting Point

Step 1, the index. It is the smallest piece, it is the pattern the changelog
reuses (row-level merge driver, per-clone install, deterministic rebuild), and
it fixes the private-mode worktree hole that affects every repo. The changelog
(step 2) and `/drift-land` (step 3) depend on nothing in each other but both
reuse the driver-install and lock code from step 1. Docs (step 4) are woven
through each step, not left to the end.

## Key Files

- `scripts/build-index.py:63-195` — `parse_artifact`, `render`, `main`; gains
  `--merge O A B`. The row format it emits is what the merger parses.
- `lib/artifacts.ts:240-273` — `prepare`: `NNN` allocation at `:244` becomes
  remote-aware in tracked mode; `:275` `publish` gains fragment writing and
  changelog regeneration; `:221` `syncIndex` gains the in-progress guard and a
  changelog sibling; `:152` `setArtifactTracking` gains the `.gitattributes`
  line.
- `lib/state.ts:94-108` — `safePath`: permit a `drift/` junction whose real
  path is the repo's own main-worktree store; `:147` `withLock` (reused for the
  landing lock); `:110-145` atomic write (compare-and-swap added for
  `CHANGELOG.md`); `:79` `repoRoot` gains a sibling that resolves the main
  worktree from `git rev-parse --git-common-dir`.
- `extensions/drift.ts:50-60` — `refreshIndex`: install drivers, skip during
  merges, add changelog sync; `:126-141` the `drift-track-artifacts` command
  as the template for `/drift-changelog` and `/drift-land`.
- `skills/drift/SKILL.md:147-212` (Root Index, At Session Start), `:243` (Git
  Policy); `skills/drift/hosts/pi.md`; `README.md` — procedure text.
- `tests/drift.test.ts`, `tests/pi-runtime.test.ts`, `tests/pickup.test.ts` —
  existing fixtures (`fixture()`, two-process `child()`, real-Pi RPC client).

## Implementation Sequence

1. **[§4.1 — `build-index.py --merge O A B`]** — Parse rows (`| # | Date |
   Feature | Type | [name](path) |`) from all three files; union keyed by path
   with base-deletion rule (removed on one side and untouched on the other →
   removed); sort by UTC instant, feature, sequence; renumber; recount footer;
   header prose from A; `## Undated` unioned; same path with different text →
   B's. Write to A, exit 0; exit 1 only if an input is not a Drift index.
   Verify: unit tests for appended rows both sides, base deletion, undated
   union, CRLF input, header preserved.

2. **[§4.2 — attribute via `/drift-track-artifacts on`]** — In
   `setArtifactTracking`, when turning on, add `drift/INDEX.md merge=drift-index`
   to `.gitattributes` (create if absent, keep other lines, atomic write, same
   restore-on-failure path as `.gitignore`). Leave it on `off`. Report it in
   the command's summary. Verify: unit test extends the existing on/off test.

3. **[§4.2 — driver install at session start]** — New `lib/git-drivers.ts`:
   `installDriver(repo, name, command)` reads `git config --get`, sets
   `merge.<name>.name` and `merge.<name>.driver` when unset, reports (does not
   overwrite) a different existing value. Command:
   `<python> -I <forward-slash path to build-index.py> --merge %O %A %B`,
   honouring `DRIFT_PYTHON`. Called from `refreshIndex` when the repo is tracked
   and `git check-attr merge drift/INDEX.md` returns `drift-index`. Verify:
   real-Pi test asserts the config after session start; unit test for the
   forward-slash path and the no-overwrite rule.

4. **[§4.4 — in-progress guard]** — `syncIndex` (and later the changelog sync)
   returns false without writing when `<git-dir>/rebase-merge`, `rebase-apply`
   or `MERGE_HEAD` exists; use `git rev-parse --git-dir` for the worktree's own
   git dir. Verify: unit test plants `MERGE_HEAD`.

5. **[§4.3 — remote-aware `NNN`]** — In `prepare`, when tracked, extend the
   number scan with `git for-each-ref --format=%(refname) refs/remotes` then
   `git ls-tree --name-only <ref> drift/<feature>/` per ref (tolerate missing
   paths, exit 128). Verify: fixture with a bare remote holding `003` while the
   worktree has `002` allocates `004`.

6. **[§4.5 — shared private store across worktrees]** — `mainWorktree(repo)`:
   `git rev-parse --git-common-dir` → parent is the main worktree when it is a
   checkout (has `.git` as a directory). In private mode only, when the current
   repo is a linked worktree and a main worktree exists: the publish and sync
   paths use `<main>/drift` as the store, and on first publish create
   `<repo>/drift` as a junction (Windows) or symlink to it when `<repo>/drift`
   does not exist; if it exists as a real folder with artifacts, do not touch it
   and say so (open question 4). `safePath` accepts a symlink at exactly
   `<repo>/drift` whose real path equals the store. No main worktree → current
   behaviour plus one context line. Tracked mode unchanged. Verify: fixture with
   `git worktree add`; two worktrees publish into one index with distinct
   numbers; `safePath` still refuses any other symlink; removing the worktree
   leaves the store intact.

7. **[§5.2–5.3 — `scripts/build-changelog.py`]** — Fragment parser
   (`changelog.d/*.md`, frontmatter `date`, `section`, `artifact`, body);
   render newest-first by day then section, Keep a Changelog section set, id
   comment `<!-- changelog.d/<file> -->` at each bullet's end; marker line owns
   the generated region, everything below preserved byte-for-byte;
   `--stdout | --check | --merge O A B`; un-id'd lines in the generated region
   → carried through at the top and listed on stderr, exit 2 for "report, do
   not write". Verify: unit tests for grouping, ordering with ties, marker with
   and without history, un-id'd detection, CRLF.

8. **[§5.6 — changelog driver]** — `--merge`: entries keyed by id from A and
   B's generated regions, base-deletion rule, same id different text → B,
   un-id'd lines carried; below the marker, three-way merge with
   `git merge-file -p` on temp files; conflict there → exit 1. Verify: unit
   tests through a real `git rebase` as in the index prototype.

9. **[§5.3, §5.5 — regeneration in TypeScript]** — `lib/changelog.ts`:
   `syncChangelog(repo)` runs the builder under the publish lock, with
   compare-and-swap (hash before read, re-check before `atomicWrite`, retry up
   to 3); edit-back: for each id'd bullet whose text differs from its
   fragment, rewrite the fragment body first; exit 2 from the builder →
   `ctx.ui.notify` warning with line numbers, no write. Called from `publish`
   (non-fatal, after the index) and `refreshIndex`. Verify: unit tests for CAS
   retry (concurrent writer in `child()`), edit-back, skip-and-report.

10. **[§5.2 — `drift_publish` `changelog` input]** — Optional
    `changelog: { section, text }` validated against the section set and a
    size cap; fragment written as `changelog.d/<feature>-<NNN>-<slug>.md` with
    the artifact's `date` and path, inside the publish transaction (staged and
    linked like the artifact; part of the pending receipt so retries are
    idempotent). Only when `.drift.json` has `"changelog": true`; otherwise the
    input is rejected with the opt-in hint. Verify: unit tests for write, retry
    idempotence, rejection when not opted in.

11. **[§5.1 — `/drift-changelog on|off|status`]** — Mirrors
    `/drift-track-artifacts`: flag in `.drift.json`; `changelog.d/README.md`
    from a template; marker inserted at the top of `CHANGELOG.md` (created if
    absent); `.gitattributes` `CHANGELOG.md merge=drift-changelog`; refuses
    with a message when towncrier config, `.changeset/` or `newsfragments/` is
    present; driver install added to `refreshIndex` when the flag is on.
    `status` reports the flag, fragment count and any unrecognised entries.
    Verify: unit tests for each branch; real-Pi test turns it on, publishes
    with a `changelog` input, and asserts the regenerated file.

12. **[§8 — `/drift-land`]** — `lib/land.ts`: preconditions (branch, clean
    apart from Drift-regenerated files, no merge in progress); lock at
    `<git-common-dir>/drift-land.lock` via `withLock`; `git fetch`;
    `git rebase origin/<default>` (default from
    `git symbolic-ref refs/remotes/origin/HEAD`, else `main`); on a non-driver
    conflict, `rebase --abort` and report the file; regenerate index and
    changelog, `--check` both; guard: `git diff origin/<default> --name-only`
    must equal the union of `git log origin/<default>..HEAD --name-only`, else
    stop and show the difference; run `.drift.json` `land.check` if set;
    `git push origin HEAD:<default>`; on rejection loop from fetch, at most 3
    times. Never squash, force-push or reset. Verify: fixture with a bare remote
    and two worktrees racing; guard trips on a planted stray file; retry on a
    planted rejection.

13. **[§9 — docs and release]** — `SKILL.md`: "never hand-edit a derived
    file"; changelog fragment procedure and the id rule; shared private store
    note. `hosts/pi.md`: what the extension automates for each. `README.md`:
    the three commands, the Drift-only statement, the `.gitattributes` lines.
    `changelog.d/README.md` template and a suggested `AGENTS.md` line.
    `CHANGELOG.md` entries; `package.json` version bump. Verify:
    `git diff --check`; the fragment procedure followed by hand once from
    Claude Code against a fixture repo.

Disjoint scopes: steps 7–8 (Python builder) and step 9–11 (TypeScript
integration) can proceed in parallel once the fragment format in step 7 is
fixed; step 12 is independent of steps 7–11.

## Decisions & Constraints

- Drift-only support; no fallback story for web merges or clones without
  Drift. State it, do not engineer around it.
- Never lose a fragment, never guess. Unknown content is carried through and
  reported, in the style of malformed `.drift.json` handling.
- Merge rows/entries, never trees, inside drivers; the frontmatter/fragment
  rebuild is the correction pass.
- Deterministic ordering: UTC instant, then id. Both sides of any merge must
  compute identical text from identical inputs.
- The index is rebuilt in every mode; only the driver and remote-aware
  numbering are tracked-mode. Private mode shares the main worktree's
  `drift/`; Drift never creates a folder outside a project root.
- Changelog derived continuously; fragments never deleted; day grouping by
  default; `stamp` optional and later. Keep a Changelog section vocabulary.
- Hand edits: id kept → written back to the fragment; no id → unsupported,
  preserved, reported, regeneration skipped for that run; publication of the
  artifact, index and fragment still succeeds.
- Reuse: `withLock`, `atomicWrite`, `safePath`, `git()` from `lib/state.ts`;
  the command shape of `setArtifactTracking`; the stdlib-only builder pattern.
  No new runtime dependencies.
- Forward-slash paths in anything git runs through `sh -c`.

## Open Questions

1. Does `stamp X.Y.Z` ship in step 11 or wait for a project that wants it?
   (Proposal: wait.)
2. Default for `land.check` when unset? (Proposal: run nothing.)
3. Should unrecognised-entry reports also appear in Pi's session context?
   (Proposal: yes, one line, alongside "Unpublished work".)
4. Step 6: a linked worktree that already holds a real `drift/` with artifacts
   when the store is introduced. Proposal: leave it, report "two stores", and
   offer `/drift-adopt` later rather than moving files automatically.
