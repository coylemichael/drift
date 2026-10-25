---
date: "2026-10-25T11:01:49+00:00"
branch: "main"
git_commit: "4b6de509f46c9b654eaba12b0c81eaa992e7ec55"
feature: "shared-files"
sequence: "007"
type: "handoff"
status: "superseded"
superseded_by: "drift/shared-files/008-handoff-retirement-committed-pushed-perimeter-prompt.md"
session_started: "2026-10-20T10:59:59+01:00"
session_id: "01a13c36-3c70-7052-9825-2ca6aeedb072"
interval_id: "66b9319c-db55-4c09-96d4-7f2c0949cb71"
start_branch: "main"
start_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
source_research: "drift/shared-files/005-research-retire-changelog-and-assess-index-view.md"
related_artifacts: ["drift/shared-files/006-plan-retire-changelog-and-index-view.md","drift/shared-files/004-research-release-step-prior-art-and-tag-derived-changelog.md","drift/auto-continue/005-handoff-two-mode-continuation-built-live-check-pending.md"]
next_session_profile: "implementation"
anchor_coverage: {"status":"not-applicable","eligible":0,"captured":0,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
---

## Objective

Retire Drift's changelog feature and its generated `drift/INDEX.md` view, and tidy both out of every repository under `C:\Projects_2.0` and `C:\Users\BLACKHAND-CL1\OneDrive\__projects` (plan `drift/shared-files/006`).

## Source Documents

- drift/shared-files/006-plan-retire-changelog-and-index-view.md (executed; `in-progress` until the commits land)
- drift/shared-files/005-research-retire-changelog-and-assess-index-view.md
- drift/shared-files/004-research-release-step-prior-art-and-tag-derived-changelog.md (made moot by the decision to retire)

## Status

- **Completed and verified:**
  - **Step 0.** The auto-continue work is committed as `4b6de50`.
  - **Steps 1–5.** Code, the cleanup tool, skill/docs and tests are done.
    - `npm run typecheck` is clean.
    - `npm test`: 152 tests, 143 pass, 0 fail, 9 skipped (environment-gated).
    - `uvx ruff check scripts` is clean.
  - **Step 6, cleanup applied** with `scripts/retire-index-and-changelog.py … --apply`:
    - **Class A (Drift adopted; files deleted, uncommitted):** drift, perimeter (main worktree), Rig, dotfiles.
    - **Class B (uninvited residue restored to HEAD; `git status` clean, nothing to commit):** REA-official, basic-memory, beads, herdr-nono-plugin, ruflo.
    - **Skipped by user decision:** the 25 perimeter linked worktrees. They will be fixed from the perimeter repo later.
    - **No residue:** OpenSpec and claude-task-master (own `.changeset`) and the other 44 repos.
  - **Live publish check.** Zed was restarted before the Rig and dotfiles cleanup, so this session runs the new code. Its session context no longer carries a "Changelog:" line. This publication is the first made with the new code.
- **Not done:** committing the cleanups and the drift retirement. That waits on the user's approval.

## What Changed

**drift repo (uncommitted on top of `4b6de50`)**
- **Deleted:**
  - scripts/build-changelog.py, scripts/clean-changelog-residue.py;
  - lib/changelog.ts, lib/git-drivers.ts (nothing generic remained);
  - tests/changelog-build.test.ts, tests/changelog-residue.test.ts, tests/index-merge.test.ts;
  - docs/changelog.md, plus this repo's CHANGELOG.md, changelog.d/ and the ignored drift/INDEX.md.
- **lib/artifacts.ts:**
  - All changelog input, validation and fragment code is gone, along with `syncIndex`, `ensureIndexAttribute`, the index attribute on tracking-on, and publish's index render/write/verify.
  - `policyProbes` holds only the artifact path.
  - The new publish safety check: after writing, `readArtifactCatalog` must list the new artifact, or the publication stays a retryable pending intent.
- **lib/state.ts:** `changelog` is gone from `DriftConfig`, `configShape`, validation and parsing. It is now rejected as an unknown key. `Receipt`/`Pending` lost `fragment`, and the session-context index mention is gone.
- **lib/land.ts:** `verifyDerived` and the "derived" stage are removed. `knownLines` is just `/drift/`, and owned files are `drift/` plus `.gitignore`.
- **extensions/drift.ts:**
  - `refreshIndex` is now `prepareSession`. It keeps the two-stores notice and the baseline ordering, and its failure type is `drift-store`.
  - Removed: the driver installs, `/drift-changelog`, the session-context "Changelog:" lines, the `drift_publish` `changelog` parameter, and the `Index:`/`Fragment:`/`Changelog:` result lines.
  - The tool description and promptGuidelines are reworded.
- **scripts/build-index.py:**
  - The default mode prints a "# Drift artifacts" table and writes nothing. `--stdout` stays as an alias, for old publishers still loaded in memory.
  - `--json` is unchanged; `--check` and `--merge` are rejected.
  - Skipping `INDEX.md` is kept, so a leftover file is never parsed as an artifact.
- **New: scripts/retire-index-and-changelog.py.**
  - It runs a dry run by default and never stages or commits.
  - It discovers repo roots up to depth 2 and skips linked worktrees and repos mid-merge.
  - Class A deletes the Drift-generated CHANGELOG.md, Drift-only `changelog.d/` and `drift/INDEX.md`; strips Drift's `.gitattributes` lines; unsets `merge.drift-index.*` and `merge.drift-changelog.*`; and removes a `.drift.json` `changelog` key.
  - Class B restores uninvited residue to HEAD.
  - Class C leaves foreign changelog systems alone.
  - It is idempotent.
- **New: tests/retire.test.ts** (10 tests).
- **Adapted tests:** tests/drift.test.ts, tests/pi-runtime.test.ts, tests/worktrees.test.ts, tests/pickup.test.ts, tests/catalog.test.ts. They now assert that no `INDEX.md`, no `changelog.d/` and no `changelog` schema parameter exist, that a `changelog` key is rejected, and that build-index's default mode is print-only.
- **package.json** no longer ships build-changelog.py or CHANGELOG.md.
- **.github/workflows/ci.yml:** the changelog `--check` step and its fetch-depth/tags block are removed.
- **.gitattributes** now holds only `* text=auto eol=lf`.
- **Skill and docs:**
  - skills/drift/SKILL.md: §Root Index, §Changelog Fragments and §Derived Files are removed. New §Cross-Feature Navigation, §Landing and §Project history: commit messages state what changed and why and name the Drift artifact; history is `git log` plus handoffs plus the recent list.
  - Index and changelog mentions are removed from research.md, plan.md, handoff.md, execute.md (commits follow §Project history), hosts/pi.md, README.md (with a cleanup-tool note), docs/artifact-git-policy.md, docs/landing.md, docs/worktrees.md, claude/commands/drift.md and prompts/drift.md.
  - docs/shared-files-plan.html has a dated "Retired 2026-10-23" note at the top.
  - The three SVGs are relabelled; check what-lands-in-repo.svg in a viewer, because its coordinates moved.

**Other repositories (uncommitted deletions)**
- **Rig:** `.gitattributes` (only Drift lines, so the file is deleted), CHANGELOG.md, `changelog.d/` (14 files) and drift/INDEX.md.
- **dotfiles:** CHANGELOG.md, `changelog.d/` (19 files) and drift/INDEX.md; `.gitattributes` keeps its other lines.
- **perimeter (main):** CHANGELOG.md, `changelog.d/README.md` and drift/INDEX.md; `.gitattributes` keeps its other lines.
- Clone merge-driver config is unset in all class A and B repos.

## Codebase Context

**Commands that worked**
- `npm run typecheck`
- `npm test` (about 15 minutes with the actual-Pi runtime tests)
- `uvx ruff check scripts`. `npm run lint` fails only because `ruff` is not on PATH.
- `py -3 -I scripts/retire-index-and-changelog.py C:/Projects_2.0 C:/Users/BLACKHAND-CL1/OneDrive/__projects`, which reports 80 repos: A 4, B 5, D 46, 25 skipped. Add `--apply` to act.
- `py -3 -I scripts/build-index.py <repo>/drift`, the print-only timeline.

**Warnings**
- **Old in-memory publishers.** Pi sessions still running the old extension code re-create `drift/INDEX.md` through the `--stdout` alias. Where HEAD still carries changelog markers, they can also re-adopt changelog residue at session start. Restart Zed (or `/reload`) after updates, and commit the cleanups so HEAD has no markers.
- **Uncommitted cleanup mixed with work in progress.**
  - Rig has unrelated work in progress (S5 step files and handoff 074, untracked).
  - dotfiles has unrelated work in progress (`zed/settings.json`, an untracked research 006, and a stray `nul` file).
  - Commit the cleanup with explicit paths only:
    - `git add -A -- CHANGELOG.md changelog.d drift/INDEX.md .gitattributes`
    - Rig's agent commits with `git add drift changelog.d CHANGELOG.md` patterns and would otherwise sweep the deletions into its own commit.
- **Perimeter linked worktrees.** All 25 still track `drift/INDEX.md`; perimeter-w2 also has changelog adoption. Their `.gitattributes` lines name drivers that no longer exist, but the shared clone config was unset, so git falls back silently to a text merge. The retire tool skips linked worktrees by design; fixing them needs either a run per branch or a new `--include-linked` option.
- **Old `changelog` key.** A `.drift.json` with a `changelog` key now makes Drift fail (session start and publish). None remain in the user's repos.
- **Landing.** It no longer treats `.gitattributes` diffs as Drift's own; an uncommitted `.gitattributes` change now halts landing.
- **Markdown lint.** `.markdownlint.jsonc` still has MD024 `siblings_only`, which was kept for the frozen CHANGELOG. CHANGELOG.md is now deleted, so the rule can go.

## What Deviated from Plan

User decisions made during execution:
- CHANGELOG.md is **deleted** rather than kept as frozen history.
- **No backward compatibility**, since the user is Drift's only user:
  - the `changelog` key is rejected rather than tolerated;
  - there is no session-start unsetting of driver config, because the tool does it once.
- The tool **scans both repository roots**, including uninvited residue in other people's projects (class B).
- The **25 perimeter linked worktrees are skipped**.

Implementation deviations:
- `build-index.py --stdout` is kept as an alias for old in-memory publishers.
- `lib/git-drivers.ts` is deleted outright.
- The landing "derived" stage is removed.
- A symlink test now uses `drift/TEST-1`, because `INDEX.md` is skipped before the symlink check.
- There are no class C repos in practice: OpenSpec and claude-task-master had no Drift residue.

## Open Questions

- Commit approval for the four class A repos and the drift retirement (asked; not yet answered).
- Should the per-session recent list show more than 8 rows now that it is the only timeline view?
- How should the perimeter linked worktrees be handled later: a per-branch run, or an `--include-linked` option?

## Next Steps

1. **With the user's approval, commit with explicit paths.**
   - drift: all retirement changes, including the new tool and tests. Message e.g. "refactor: retire the changelog feature and INDEX.md view; add retire-index-and-changelog", naming drift/shared-files/006.
   - perimeter, Rig and dotfiles: only `CHANGELOG.md changelog.d drift/INDEX.md .gitattributes`, with message "chore: retire Drift changelog and index".
2. **After the commits,** set plan 006 and this handoff to `complete` (status lines only). Optionally drop the MD024 rule in `.markdownlint.jsonc`.
3. **Later, in perimeter:** decide how to retire the files in the 25 linked worktrees.
4. **Separate and still open:** the auto-continue live check (plan `drift/auto-continue/004`, handoff `005`) at Rig's next in-progress profiled handoff.
