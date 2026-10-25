---
date: "2026-10-09T19:38:53+01:00"
branch: "main"
git_commit: "999390e44b25ad9c10f3aa69c0f4cd7ca67761aa"
feature: "shared-files"
sequence: "003"
type: "plan"
status: "complete"
source_research: "drift/shared-files/001-research-shared-files-under-many-agents.md"
related_artifacts: ["drift/shared-files/002-plan-self-merging-index-derived-changelog-and-landing.md"]
---

## Objective

Finish the shared-files work after step 1 landed (`999390e`): a derived
`CHANGELOG.md` whose versions come from tags, and landing that happens by
itself at the interval boundary, with every check shell-neutral.

## Source Research

- drift/shared-files/001-research-shared-files-under-many-agents.md
- docs/shared-files-plan.html (design; §5 changelog, §8 landing, revised
  2026-10-09)
- drift/shared-files/002 — superseded by this plan. Its step 1 (index merge
  driver, attribute, per-clone install, remote-aware `NNN`, mid-merge guard,
  shared private store) is complete in `999390e`; steps 7–13 are replaced
  below.

## Starting Point

Step 1 below (the Python changelog builder), because the fragment format and
the tag-derived grouping fix what everything else consumes. Steps 1–2 are
Python only; steps 3–5 are TypeScript and can proceed in parallel with 2 once
the format in 1 is fixed. Step 6 (landing) is independent of 1–5 but reuses
the driver and lock code from `999390e`.

## Key Files

- `scripts/build-index.py:30-60, 103-146` — `scalar`, `parse_date`,
  `render` and the `--merge` row model; the changelog builder mirrors them.
- `lib/artifacts.ts:275-330` — `publish`: fragment write joins the pending
  transaction; `syncIndex` (`:221`) is the template for `syncChangelog`;
  `setArtifactTracking` (`:152`) is the template for `/drift-changelog`.
- `lib/state.ts` — `artifactStore` (store root for linked worktrees),
  `trackArtifacts` (config reader, gains `changelog` and `land` fields),
  `withLock`, `atomicWrite`, `mergeInProgress`, `Records.checkpoint`.
- `lib/git-drivers.ts` — `installDriver`, `attributeFor`, `hasAttribute`;
  gains the `drift-changelog` driver definition.
- `extensions/drift.ts:50-75` — `refreshIndex` (add changelog sync and driver
  install); `:126-141` command template; the `agent_settled` handler where
  the profiled handoff triggers compaction (landing slots in before it).
- `skills/drift/SKILL.md` §"Derived Files Under Many Agents", `hosts/pi.md`,
  `README.md` — procedure text.

## Implementation Sequence

1. **[§5.2–5.3 — `scripts/build-changelog.py`]** — Fragment parser for
   `changelog.d/*.md` (frontmatter `date`, `section` from the Keep a
   Changelog set, `artifact`; body is the bullet). Version grouping from
   tags: list tags matching the configured pattern (default `v*`) in
   semver order; for each, `git ls-tree -r --name-only <tag> --
   changelog.d/`; a fragment's version is the first tag containing it;
   fragments in no tag are Unreleased. No tags → group by day. Render newest
   first: `## [X.Y.Z] — <date>` / `## [Unreleased]` / `## YYYY-MM-DD`, then
   `### Section`, bullets each ending in `<!-- changelog.d/<file> -->`.
   Marker line owns the generated region; everything below preserved
   byte-for-byte. Modes `--stdout | --check | --merge O A B`. Un-id'd lines
   in the generated region → carried through at the top, listed on stderr,
   exit 2 ("report, do not write"). Verify: unit tests for tag grouping
   (fragment in tag N+1 not N; untagged → Unreleased; no tags → days),
   ordering with ties, marker with and without history, un-id'd detection,
   CRLF, LF output.

2. **[§5.6 — changelog driver]** — `--merge`: entries keyed by id from both
   generated regions; base-deletion rule; same id different text → theirs;
   un-id'd lines carried; below the marker a three-way merge (`git
   merge-file -p` on temp files), conflict → exit 1. Verify: through a real
   `git rebase` as in `tests/index-merge.test.ts`.

3. **[§5.3, 5.5 — `lib/changelog.ts`]** — `syncChangelog(repo)`: resolve
   the store root, run the builder under the publish lock, compare-and-swap
   write (hash before read, re-check before replace, retry ≤3); edit-back
   (an id'd bullet whose text differs from its fragment rewrites the
   fragment body first); builder exit 2 → warning with line numbers, no
   write. Called from `publish` (non-fatal, after the index) and from
   `refreshIndex`. Verify: CAS retry with a concurrent writer in `child()`,
   edit-back, skip-and-report.

4. **[§5.2 — `drift_publish` `changelog` input]** — Optional `changelog:
   { section, text }` validated against the section set and a size cap;
   fragment `changelog.d/<feature>-<NNN>-<slug>.md` with the artifact's
   `date` and path, written inside the publish transaction (staged and
   linked like the artifact, part of the pending receipt so retries are
   idempotent). Only when `.drift.json` has `"changelog": true`; otherwise
   rejected with the opt-in hint. Verify: write, retry idempotence,
   rejection when not opted in.

5. **[§5.1 — `/drift-changelog on|off|status`]** — Flag in `.drift.json`;
   `changelog.d/README.md` from a template; marker at the top of
   `CHANGELOG.md` (created if absent); `.gitattributes` `CHANGELOG.md
   merge=drift-changelog`; refuse when towncrier config, `.changeset/` or
   `newsfragments/` exists; driver install in `refreshIndex` when on;
   `status` reports flag, fragment count, tag pattern in use, unrecognised
   entries. Verify: each branch; real-Pi: on, publish with `changelog`,
   regenerated file; a tag added to the fixture moves entries into a
   version section on the next sync.

6. **[§8 — landing]** — `lib/land.ts`: `land(repo, opts)` with
   preconditions (branch, clean apart from Drift-regenerated files, no merge
   in progress), cross-worktree lock at `<git-common-dir>/drift-land.lock`,
   `git fetch`, rebase onto `origin/<default>` (from `origin/HEAD`, else
   `main`), abort-and-name on a non-driver conflict, regenerate and `--check`
   index and changelog, guard (`git diff origin/<default> --name-only` equals
   files in `git log origin/<default>..HEAD`), configured check (string or
   array, platform shell, in order, stop on first failure; unset → none,
   reported), `git push origin HEAD:<default>`, retry ≤3 on rejection,
   `Records.checkpoint("land")`. Never squash, force-push or reset.
   `.drift.json` gains `land: { auto?: boolean, check?: string | string[] }`.
   Wiring: in the extension, after a handoff publication completes the
   interval and `land.auto` is set, run `land` **before** compaction and
   `drift-continue`; a halt leaves the handoff published, reports the cause,
   and does not continue. `/drift-land` registered as the manual form.
   Verify: fixture with a bare remote and two worktrees racing; guard trips
   on a planted stray file; retry on a planted rejection; real-Pi: profiled
   handoff lands then continues; planted conflict halts with the handoff
   intact and no continuation prompt sent.

7. **[docs and release]** — `SKILL.md`: fragment procedure and the id rule;
   version-from-tags; "landing is the handoff's last step where opted in".
   `hosts/pi.md`: what the extension automates for each. `README.md`: the
   two commands, `.drift.json` fields, the Drift-only statement.
   `changelog.d/README.md` template and a suggested `AGENTS.md` line.
   `CHANGELOG.md`; `package.json` version bump. Verify: `git diff --check`;
   the fragment procedure followed by hand once from Claude Code.

Disjoint scopes: steps 1–2 (Python) and 3–5 (TypeScript) can run in parallel
once step 1's fragment format is fixed; step 6 is independent of 1–5.

## Decisions & Constraints

- Drift-only support; never lose a fragment; never guess; deterministic
  ordering by (instant, id). Carried from `002`.
- **No `stamp`.** Versions derive from tags by tree membership, never by
  timestamp; a clone that has not fetched a tag converges when it does.
- **Landing is automatic at the interval boundary** when the repo opts in
  (`land.auto`), and manual otherwise. Pushing is the one outward-facing act,
  so it follows the `trackArtifacts` opt-in pattern. Order: handoff → land →
  compaction → continue. A real conflict or a tripped guard halts the chain.
- **No toolchain assumptions in the target repo.** The check is any shell
  command; builders are stdlib Python; drivers are plain `git config`. Node
  is Drift's runtime only.
- Committing stays the agent's act; resolving a real conflict stays a human's.
- Hand edits: id kept → written back to the fragment; no id → carried,
  reported, regeneration skipped for that run.
- Reuse `withLock`, `atomicWrite`, `safePath`, `artifactStore`, `git()`,
  `installDriver`; the command shape of `setArtifactTracking`.

## Open Questions

1. Should unrecognised-entry reports also appear in Pi's session context so
   a thread sees them before publishing? (Proposal: yes, one line.)
2. Section date for a version: the tagged commit's date, or the tag's own
   date for annotated tags? (Proposal: tagged commit's date; it exists for
   every tag kind.)
3. Default tag pattern `v*`, configurable as `changelog.tags`; confirm against
   perimeter's `vX.Y.Z` and dotfiles (no tags → days).
4. Guard strictness: start with exact equality of the two file lists and
   loosen only with evidence.
