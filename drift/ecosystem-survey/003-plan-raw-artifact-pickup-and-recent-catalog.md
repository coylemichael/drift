---
date: "2026-10-13T11:32:41+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "ecosystem-survey"
sequence: "003"
type: "plan"
status: "complete"
session_started: "2026-10-12T11:08:10+01:00"
session_id: "01a12f95-80ad-768a-beab-3053980bf7c7"
interval_id: "4b42486d-272a-4989-955d-b129efcd4348"
start_branch: "main"
start_commit: "e871e2fae8a243ab6e7c1abf70b5fd1b69534dd1"
source_research: "drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md"
related_artifacts: ["drift/ecosystem-survey/001-research-comparative-survey-and-index-design-debate.md"]
---

## Objective

Make default Drift pickup and recent-artifact context derive from the actual Markdown artifacts through the existing shared parser, so a missing, stale, unwritable, or conflicting INDEX.md cannot misdirect navigation. Retain INDEX.md generation as a human-readable compatibility view, independent of navigation.

## Source Research

- drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md — verified current behavior and scoped catalog adaptation.
- drift/ecosystem-survey/001-research-comparative-survey-and-index-design-debate.md — original survey and alternatives.

The user approved: "Select newest/recent artifacts directly through the shared parser. Generate INDEX.md separately as an optional view." No storage, identity, physical archive, or readiness-scheduler migration was approved.

## Starting Point

The current default newest() calls syncIndex(), catches errors, and reads the table anyway. A missing view after failed refresh can therefore produce a false no-artifacts message, while a stale table can select old work. Records.context() likewise reads table rows. The stdlib Python renderer already implements actual artifact parsing and UTC/tie/legacy ordering; reuse it rather than duplicate semantics in TypeScript.

Several files are dirty from overlapping changelog-policy work (lib/artifacts.ts, extensions/drift.ts, tests/drift.test.ts, tests/pi-runtime.test.ts, docs/changelog.md, docs/field-observations.md, skills/drift/hosts/pi.md, CHANGELOG.md and a fragment). Preserve these changes; do not attribute them to this task, commit them, or refactor their publication behavior. A peer session was notified about intended write scope.

## Key Files

- scripts/build-index.py — shared parsing, ordering, Markdown render and merge; add read-only structured catalog output without changing existing render/merge modes.
- lib/state.ts — shared Python/path utilities and Records.context(); add a small raw catalog bridge and use bounded recent entries rather than persisted table content.
- lib/pickup.ts — remove syncIndex/table dependency from default newest selection; preserve explicit names, statuses, citations and newest-only contract.
- tests/pickup.test.ts — regression fixtures for missing/stale/blocked view, ordering/status routing, no navigation writes.
- tests/catalog.test.ts (new, if useful) — parser JSON parity, empty/legacy/undated handling, raw recent context, managed-path safety and diagnostic behavior.
- tests/index-merge.test.ts — unchanged byte-parity/merge regression coverage.
- README.md and skills/drift/SKILL.md, execute.md, handoff.md, hosts/pi.md — update navigation wording and portable scan instructions while keeping publication/index-view policy accurate.

## Implementation Sequence

1. **Reproduce the dependency failure.** Add a deterministic pickup fixture with a real artifact, no index, and index generation blocked (for example, an INDEX.md directory or a Git-policy mismatch). Run it against the old implementation and record the failure. Do not depend on chmod behavior on Windows.
2. **Expose the shared read-only catalog.** Add a JSON mode to scripts/build-index.py using the same parse/order functions, with dated/undated metadata and no writes, including a successful empty-catalog representation. Preserve Python 3.7/stdlb support, original Markdown rendering and merge behavior. Add a TypeScript bridge using existing safePath/run/python utilities. Surface read/parse errors honestly rather than trusting a stale index or claiming an empty repository.
3. **Switch default pickup and recent context.** Query raw entries for default newest and last-eight context. Keep true-instant order, deterministic ties, named pickup, finished-newest stop, shared private-worktree store resolution, citation grading, and current context bounds. Never write or repair INDEX.md as part of navigation. Report undated/invalid metadata without guessing chronology or silently re-opening older work.
4. **Test the outcome, not just the helper.** Missing/stale/unwritable view must not affect newest/recent results or be changed by reads. Cover empty and undated catalogs, timezone and tie order, read errors, safe paths/symlinks, large/bounded recent context, and private-worktree behavior. Run focused tests, typecheck/lint, existing index tests and full npm test when practical.
5. **Align documentation and review.** Portable hosts should call the shared raw query helper for pickup/recent navigation; table repair is a view-maintenance action, not a precondition. Keep existing publication/session-start view generation and driver installation for compatibility—no new .drift.json toggle, removal of tracked views, landing-policy changes, or publisher atomicity refactor in this task. Have Claude Fable 5 review correctness and coverage before a completion handoff.

## Decisions & Constraints

- Artifact frontmatter/body remain authoritative; INDEX.md is a derived readable view, not a navigation API.
- Preserve current default newest-only semantics and the stop-at-complete behavior. Do not replace them with readiness or an older-open-item search.
- No SQLite, embeddings, watcher/cache subsystem, filename/ID migration, physical archival, task claims, external writes, or generated changelog changes.
- Reuse one parser/order implementation. Read-only structured output must not allocate records, acquire publication locks, modify ignore rules, create a view, stage, commit, or run verification commands from artifact content.
- Keep existing publication and startup view generation for compatibility. "Optional" here means not required for pickup/recent navigation; a separate configuration/decommission decision is needed before removing view maintenance from the publisher/landing pipeline.
- Managed-path boundaries continue to apply. Do not follow artifact symlinks outside the store or use an index fallback when raw discovery fails.
- Test commands execute only repository tests in temporary fixture repositories; do not modify the cloned competitors.
- The main session verifies tests and owns plan status/handoff publication. Reviewer subagents use Claude Fable 5 and remain read-only.

## Open Questions

- The research's wider SQLite, IDs, archive, outcome and knowledge proposals remain deferred.
- Raw scan latency at 400–500 artifacts remains unmeasured; do not claim this change is a speed optimization.
- Existing generated-view publication/landing requirements are retained, not relaxed by this navigation change.
- If a reviewer finds a materially different default/legacy/security contract is necessary, surface it instead of expanding scope silently.
