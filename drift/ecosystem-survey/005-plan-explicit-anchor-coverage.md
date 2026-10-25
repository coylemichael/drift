---
date: "2026-10-13T18:52:34+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "ecosystem-survey"
sequence: "005"
type: "plan"
status: "complete"
session_started: "2026-10-13T18:20:56+01:00"
session_id: "01a12f95-80ad-768a-beab-3053980bf7c7"
interval_id: "0ecb0465-f704-4b33-87b8-72310ed3af96"
start_branch: "main"
start_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
source_research: "drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md"
related_artifacts: ["drift/ecosystem-survey/004-handoff-raw-artifact-navigation.md"]
---

## Objective

Make absence or partial presence of citation anchors unambiguous through publisher-generated coverage metadata and reader reports, without requiring numeric references in symbol-only handoffs or changing their templates.

## Source Research

- drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md — handoff evidence, citation freshness versus claim quality, and bounded metadata.
- drift/ecosystem-survey/004-handoff-raw-artifact-navigation.md — prior work, intentionally symbol-based references and no numeric anchors.
- User approved the proposed first step: explicit anchor accounting; full deterministic template enforcement remains deferred.

## Starting Point

lib/artifacts.ts: prepare() calls extractAnchors() and emits anchors only when its array is nonempty. lib/anchors.ts silently omits unresolved/non-file/oversized/out-of-range references and stops at the cap. Thus missing anchors cannot distinguish zero eligible references, skipped citations or a legacy/manual publisher. scripts/check-staleness.py grades citations but does not account for publication coverage; citationNote() produces no note for zero citations.

This work interval's baseline already includes the previous uncommitted raw-catalog change and another session's null/blank-changelog recovery changes. Preserve those. The current HEAD is 97c61c2; no commits/push were requested. Another live session was notified about the new anchor write scope.

## Key Files

- lib/anchors.ts — citation extraction and anchor capture; add deterministic capture result and skipped reasons while retaining a compatible array API if useful.
- lib/artifacts.ts: prepare() only — always write anchor_coverage, including zero-citation cases, alongside existing anchors. Preserve unrelated dirty validation/retry work.
- scripts/check-staleness.py — expose legacy/not-recorded versus recorded coverage, validate counts, and render advisory coverage separately from freshness.
- lib/pickup.ts: citationNote() — bounded coverage notes even when no numeric citations; keep raw-catalog pickup changes and existing routing semantics.
- tests/anchor-coverage.test.ts (new), tests/check-staleness.test.ts, tests/pickup.test.ts and targeted runtime/publisher tests where appropriate.
- docs/citation-anchors.md, README.md and relevant handoff/host guidance — clarify capture eligibility, skipped reasons, dirty/freshness independence and reload/legacy behavior.

## Implementation Sequence

1. **Reproduce ambiguity.** Test an actual publication with symbol-only references and assert an explicit zero-eligible coverage field. Record the old failure (no field), without rewriting real artifacts.
2. **Account for capture deterministically.** Return anchors plus coverage: not-applicable when zero numeric candidates, complete when all captured, partial otherwise. Count recognized unique numeric references; classify invalid ranges, missing/non-file/oversized/unreadable/unsafe paths and cap-limited attempts. Do not read outside managed paths. Every recognized candidate must be counted, while symbol references stay ineligible. Retain the 100-anchor cap; bound detailed skip samples (25) and record complete totals/by-reason counts so accounting cannot itself create unbounded frontmatter.
3. **Publish measured metadata.** Add anchor_coverage in prepare() for all artifact kinds; the model cannot supply it. Do not change existing anchors payload, input schema, policy, pending intent, retries, changelog behavior, or statuses. Old artifacts/pending publications remain immutable and are not backfilled.
4. **Expose coverage at read time.** Checker reports not-recorded for absent legacy metadata, invalid for malformed/inconsistent metadata, and recorded coverage otherwise. Coverage describes capture, not proof of current correctness; dirty anchors still grade uncertain. Partial anchor sets must not be presented as all-exact verification. Pickup notes remain advisory and bounded, including explicit zero-eligible and legacy cases rather than silent absence.
5. **Verify and document.** Test zero/all/some/none captured, invalid and missing ranges, deduplication, bare continuation grammar parity, cap and sample bounds, dirty anchors, legacy/malformed metadata, real publication/retries and pickup output. Run focused and full tests, typecheck, changed-script lint and diff checks. Obtain Claude Fable 5 review. Document that a running extension must reload before newly implemented publisher fields appear; tests use freshly loaded modules.

## Decisions & Constraints

- This is coverage accounting, not a full template renderer, mandatory References section, semantic claim validator, anchor-payload compaction, or forced citation policy.
- Status/count/reason fields are machine-generated. Absence of old metadata means not-recorded, never proof of an error or zero expected references.
- Coverage of recognized numeric references cannot detect a reference the model failed to write, nor resolve arbitrary symbol names. State that limit honestly.
- Capture coverage and freshness/behavioral evidence remain separate. Complete coverage can contain dirty anchors and is not a successful-test claim.
- Reasons/counts must be deterministic and bounded; no raw exception/secret content stored in metadata. Large citation sets are accounted for without dumping every skipped reference.
- Keep legacy exact/heuristic checking operational; report mixed capture when appropriate. Validation is advisory, not a new publication/pickup gate.
- Preserve the current raw-catalog changes and overlapping changelog compatibility work. No staging, commits, pushes, external services or legacy hooks.

## Open Questions

- Full deterministic handoff sections/typed content are deferred pending a separate schema/workflow decision.
- Existing artifacts are not backfilled. The currently running publisher may retain old code until reload; a closure published before reload must be described as not-recorded rather than hand-edited to imitate new metadata.
- Anchor bulk/compaction and semantic detection of missing evidence are not solved by this scoped accounting change.
