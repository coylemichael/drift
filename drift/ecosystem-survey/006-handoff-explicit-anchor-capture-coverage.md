---
date: "2026-10-13T19:26:53+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "ecosystem-survey"
sequence: "006"
type: "handoff"
status: "complete"
session_started: "2026-10-13T18:20:56+01:00"
session_id: "01a12f95-80ad-768a-beab-3053980bf7c7"
interval_id: "0ecb0465-f704-4b33-87b8-72310ed3af96"
start_branch: "main"
start_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
source_research: "drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md"
related_artifacts: ["drift/ecosystem-survey/005-plan-explicit-anchor-coverage.md","drift/ecosystem-survey/004-handoff-raw-artifact-navigation.md"]
next_session_profile: "implementation"
---

## Objective

Make missing or partial citation anchors explainable through deterministic publisher-generated capture accounting, while keeping symbol-only handoffs valid and capture completeness separate from freshness or claim truth.

## Source Documents

- drift/ecosystem-survey/005-plan-explicit-anchor-coverage.md — user-approved scope.
- drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md — evidence boundaries and anchor-versus-behavior distinctions.
- drift/ecosystem-survey/004-handoff-raw-artifact-navigation.md — inherited raw-catalog implementation and intentionally symbolic references.

## Status

- **Completed:** plan steps 1–5: reproduced absent metadata, implemented deterministic capture accounting, added publication metadata and reader notes, verified bounded/legacy/error behavior, documented limits and obtained two Claude Fable 5 reviews.
- **Verified:** final `npm test` — 166 tests total, 157 passed, 9 skipped for platform/ACP conditions, zero failures. Actual Pi's tracked-artifact publication fixture asserts the new zero-eligible metadata. `npm run typecheck`, changed-script Ruff checks for check-staleness.py/build-index.py, and `git diff --check` passed.
- **Uncommitted:** no staging, commits or pushes. The current work interval began with the previous raw-catalog changes and another session's changelog compatibility changes already dirty; those remain intact.
- **Deferred:** deterministic body/template rendering, mandatory References sections, anchor-payload compaction, completed-handoff policy and storage/identity migrations.

## What Changed

References below describe uncommitted working-tree code by symbol, not transient numeric lines.

- lib/anchors.ts: captureAnchors(), AnchorCoverage, AnchorSkip — capture returns anchors plus code-derived not-applicable/complete/partial coverage. Unique recognized numeric candidates are all accounted for, including invalid ranges. Counts include all skips; reasons classify invalid/unsafe/missing/non-file/oversized/read-error/cap-limited cases. Default anchor cap remains 100; detailed skip examples are limited to 25 and labels to 512 characters with an explicit truncation flag. extractAnchors() remains an array-returning compatibility wrapper.
- lib/anchors.ts: extractCitations(), cited() — exact string identity preserves deduplication beyond JS's safe integer range; optional invalid-range candidates support accounting without changing ordinary grading eligibility. Bare continuations now choose the actual most recent path by position.
- lib/state.ts: ManagedPathError, safePath() — typed path-boundary errors let capture record unsafe-path without depending on error-message wording. Existing boundary behavior/messages are preserved.
- lib/artifacts.ts: prepare() — always stores anchor_coverage for newly prepared snapshots, including zero-citation cases; the model cannot supply this metadata. Existing anchors payload remains conditional on captured anchors. Pending intent and receipt retries preserve the original content rather than recapturing files.
- scripts/check-staleness.py: capture_coverage(), coverage_summary(), check(), render() — validates capture counts, sample bounds and anchor/body consistency; absence is not-recorded, malformed/inconsistent metadata is invalid, both advisory. Exact/heuristic freshness behavior remains, with mixed mode when only some citations have anchors. Human/JSON reports include coverage independently of freshness. Malformed anchor keys no longer crash the advisory report.
- scripts/check-staleness.py: extract_citations() — optional invalid-range candidates, position-based continuation and ASCII regex parity with the JS grammar.
- lib/pickup.ts: citationNote() — explicit bounded coverage notes for zero numeric citations and legacy/malformed metadata. A missing checker report is reader-unavailable, not mislabeled as legacy artifact metadata. Checker failures retain the instruction to treat references as unverified. Ledger additions contain status/counts, not skipped reference bodies. Finished-newest pickup still stops, but now receives the advisory note too.
- tests/anchor-coverage.test.ts (new) — zero/all/some/none captured, duplicate/bare/large-integer/ASCII parity, non-file/oversized/unsafe/read-error references, cap/sample bounds, dirty-versus-complete distinction, legacy/malformed metadata, older-reader separation, and immutable retry snapshots.
- tests/pi-runtime.test.ts: existing tracked-publication fixture — reads the actual artifact generated by fresh Pi and asserts not-applicable/zero counts. Prior raw-catalog and unrelated null/blank-changelog fixtures are preserved.
- docs/citation-anchors.md, README.md citation paragraph, skills/drift/handoff.md guideline and hosts/pi.md publisher clarification — capture statuses/reasons, syntax limits, bounded samples, no fabricated line numbers, no new gate, and reload/legacy handling.
- This handoff's publisher-managed changelog fragment records the user-visible addition; no generated changelog text was hand-edited.

## Codebase Context

The original regression failed because symbol-only publication emitted neither anchors nor a coverage marker. Fresh publisher tests now emit an explicit not-applicable report with eligible/captured/skipped counts all zero. Zero capture with a recognized reference instead reports partial and a reason, so those situations no longer share a missing field.

Coverage describes the publication snapshot: eligible = captured + skipped_count, and skipped_by_reason totals equal skipped_count. The first 25 skipped references are examples, not the denominator. Symbol references, unsupported syntax, orphan bare continuations without a preceding path, and references the model never wrote are not magically discovered by accounting. Full template/evidence completeness remains deferred.

Complete capture is not successful verification: dirty captures still grade uncertain; later source changes do not change the recorded complete count, but can grade changed/gone. Partial capture is not an all-exact report just because one anchor exists. An invalid coverage marker does not block freshness grading or pickup.

Retry tests prove an interrupted publication preserves its already-captured anchors/coverage even when files change before retry. Older artifacts and older pending intents are never backfilled or rewritten. A running extension retains loaded code until reload; actual fresh Pi RPC verifies the new field is emitted. This live-session closure may be published by older loaded code: if its coverage field is absent, it is correctly not-recorded, not a reason to hand-edit it or infer complete capture.

The new interval's measured baseline already contains the previous catalog and peer changelog changes. This handoff claims only the coverage changes listed above; it does not claim the shared checkout's entire diff. Peer coordination confirmed no overlapping implementation lane.

## What Deviated from Plan

No scope expansion into full handoff rendering or anchor compaction. Correct counting required fixing the existing most-recent-path bug for multiple bare continuations and aligning Python ASCII numeric grammar with JS. Read-side robustness was tightened for malformed anchor keys; capture safety uses a typed error instead of fragile message matching. These protect the approved accounting semantics without adding a gate.

Detailed skip samples are bounded while aggregate counts cover every candidate. The older-reader fallback is explicitly reader-unavailable, distinct from not-recorded artifact metadata; this avoids misleading metrics under version skew.

## Open Questions

- Full deterministic body templates, declared reference/evidence fields and detection of model-omitted facts still need a separate design. This implementation measures recognized numeric capture only.
- Anchor-payload bulk is unchanged. Bounded coverage metadata does not solve the existing large first/last-line payload concern.
- Source readability/syntax beyond the supported grammar and live publisher version skew remain explicit limits. Reload before expecting new snapshots to carry the field.
- Nine platform/ACP tests were skipped on this Windows environment; no claim is made that the skipped POSIX permission test ran here. Whole-scripts lint still has the previously recorded unrelated clean-changelog-residue.py findings; changed scripts pass.

## Next Steps

No unfinished implementation in plan 005. Reload or restart running Pi sessions to activate the publisher/reader changes. Leave this completed task and existing artifacts alone; no retroactive metadata editing or automatic reopening. All changes remain uncommitted until the user requests review/commit/landing.
