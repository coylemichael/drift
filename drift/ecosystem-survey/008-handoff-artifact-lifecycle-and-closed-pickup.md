---
date: "2026-10-14T19:41:42+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "ecosystem-survey"
sequence: "008"
type: "handoff"
status: "complete"
session_started: "2026-10-13T22:08:09+01:00"
session_id: "01a13718-1981-75dd-8a79-84bab15e829d"
interval_id: "b8e8e2c5-e49d-43fa-950e-b6b628b21d62"
start_branch: "main"
start_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
related_artifacts: ["drift/ecosystem-survey/004-handoff-raw-artifact-navigation.md","drift/ecosystem-survey/006-handoff-explicit-anchor-capture-coverage.md","drift/ecosystem-survey/007-research-anchor-freshness-and-reference-scope-prior-art.md"]
next_session_profile: "implementation"
anchor_coverage: {"status":"not-applicable","eligible":0,"captured":0,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
---

## Objective

Record explicit supersession successors and prevent completed or superseded Drift artifacts from being resumed automatically, while preserving completed research as input to planning.

## Source Documents

- User request in this session: account for complete/superseded states and report which artifact superseded an older one; user explicitly approved the superseded_by frontmatter field.
- drift/ecosystem-survey/004-handoff-raw-artifact-navigation.md — existing raw-catalog navigation foundation, inherited in the starting working tree.
- drift/ecosystem-survey/006-handoff-explicit-anchor-capture-coverage.md — completed prior implementation and inherited capture-accounting changes. It was inspected, not reopened or superseded.
- drift/ecosystem-survey/007-research-anchor-freshness-and-reference-scope-prior-art.md — newer research; its proposed freshness/reference-scope changes remain unapproved and are not part of this implementation.

## Status

- **Completed:** lifecycle documentation, successor metadata in the raw catalog, status-aware recent context, named closed-artifact confirmation, closed-handoff continuation guards and regression tests.
- **Verified:** final npm test reported 173 tests, 164 passed, 9 skipped, zero failures. npm run typecheck, py -3 -m ruff check scripts and git diff --check passed. Tests include fresh offline Pi RPC instances and a same-interval completed-receipt replay; no claim is made about the skipped platform/ACP checks.
- **Reviewed:** delegated documentation and continuation implementation were checked by the main session; an independent review found no blocking issues. Follow-up fixes aligned repeated-quote scalar parsing, bounded replacement references and corrected/proved receipt-replay semantics.
- **Release requested:** the user asked to update the changelog, commit and push the pending working tree. This snapshot is published immediately before those release commands; it does not claim a commit or push has already happened.
- **Inherited work:** the measured baseline already contained raw-artifact navigation, anchor capture coverage, no-changelog publication recovery and related field observations. Those earlier changes remain intact and are included in the user-authorized release, not claimed as this interval's implementation.

## What Changed

References describe working-tree code by symbol, rather than transient numeric line ranges.

- lib/state.ts: ArtifactLifecycle, artifactLifecycle(), supersessionNote(), ArtifactCatalogEntry, readArtifactCatalog(), Records.context() — read status and superseded_by, report recorded successors without selecting them for work, show live lifecycle metadata in bounded recent context, validate same-feature replacement paths and reject oversized/unsafe references. Legacy missing successors are reported as replacement not recorded; missing/unverifiable references remain explicit.
- scripts/build-index.py: parse_artifact(), catalog() — expose nullable superseded_by metadata in the read-only JSON catalog. Markdown timeline rows do not change when lifecycle fields change.
- scripts/_driftmeta.py: scalar() — use horizontal whitespace for flat scalar parsing so a blank value cannot consume the following metadata line. TS/Python parity covers empty/null, plain/quoted/repeated-quoted and CRLF values.
- lib/pickup.ts: pickup() — return a confirmation-only request for named completed plans/handoffs and all superseded artifacts, without a contradictory execute/continue directive. Default pickup still stops at the newest closed artifact rather than reaching back for older work. Completed research still routes to planning.
- lib/routing.ts: readHandoffRoute() — refuse complete/superseded handoffs before profile/model resolution, report the recorded successor or legacy absence and direct the user to explicitly confirm reopening. No replacement is followed automatically.
- extensions/drift.ts: drift_publish handler, continueHandoff() — a complete handoff never queues automatic continuation or proposes drift-continue, even when profiled and autoContinue is enabled; interval receipts and landing behavior remain. Continuation prompts refer to the recent raw-artifact list.
- skills/drift/SKILL.md and research.md, plan.md, execute.md, handoff.md, hosts/pi.md — allow only lifecycle edits to old artifacts: status, plus superseded_by on actual supersession, set together after successful successor publication and any pending retry. Preserve status quoting, use exact existing same-feature successor paths, never guess/backfill links and ask before reopening closed work.
- README.md, docs/continuation.md, prompts/drift.md, claude/commands/drift.md — matching lifecycle/pickup/continuation rules for users and other hosts.
- tests/catalog.test.ts, tests/pickup.test.ts, tests/drift.test.ts, tests/pi-runtime.test.ts — live successor metadata, immutable timelines, parser parity, completed research/plans/handoffs, legacy supersession, unsafe/missing/oversized references, no automatic retargeting, profile/model unchanged on refusal, no inference/compaction for complete handoffs and idempotent receipt replay.
- Publisher-managed changelog fragment — records this user-visible lifecycle fix beside this artifact. Existing fragments for inherited work are retained; the generated CHANGELOG.md region is not hand-edited.

## Codebase Context

Later lifecycle updates remain deliberate agent frontmatter edits, not new publications or an automatic publisher migration. The successor must exist and its publication must have succeeded before the older artifact is marked superseded. Receipt retries verify unchanged published content, so lifecycle edits wait for any pending retries to settle.

The index is a historical human-readable view; current state comes from raw artifact metadata. Complete research means the investigation is finished, not that its recommendations were implemented. A complete plan/handoff has no open work; a superseded artifact remains readable but no longer represents current work.

The ordinary scalar parser is deliberately tolerant of legacy quote styles. Replacement validation never constitutes approval to work from the referenced successor. Artifact storage remains private/ignored under the repository's default policy; tracked changelog fragments reference private artifact paths without changing that policy.

npm run lint could not locate the Ruff executable on this Windows PATH, but the installed Python module worked: py -3 -m ruff check scripts passed. A running Pi session may retain loaded code; reload/restart before relying on the new continuation guards. Fresh runtime fixtures verified the updated behavior independently.

## What Deviated from Plan

There was no separate implementation plan for this bounded user-approved fix. Inspection found that drift-continue and profiled complete-handoff publication could bypass the existing pickup status protection; those entry points were fixed as part of accounting for complete/superseded states. Empty-scalar and repeated-quote consistency were tightened so named, default and continuation paths agree.

No historical artifact bodies, completed statuses or absent successor fields were backfilled. The completed prior handoff was not reopened or marked superseded, and the newer citation research was not silently selected for implementation.

## Open Questions

No unresolved decision blocks this lifecycle fix or the authorized release. Research 007's proposed dirty-snapshot freshness and external-reference classification changes still require a separate user scope decision. No network-fetching citation verifier or dirty-anchor grading change was implemented here.

## Next Steps

No unfinished implementation remains for this fix. This session is completing the user's authorized commit/push after publication: commit the reviewed pending files and generated changelog output, fetch, rebase only if upstream moved, verify the branch diff and rerun checks before pushing. If release is interrupted, inspect Git history and origin/main rather than treating this pre-release snapshot as proof of landing.

Running sessions should reload/restart to activate runtime changes. Any future work should be chosen explicitly; do not automatically reopen this completed handoff or the completed prior tasks. Research 007 may be named for planning if the user approves that separate scope.
