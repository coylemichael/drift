---
date: "2026-10-10T20:39:46+01:00"
branch: "main"
git_commit: "a2caa1d57abd4976c42473128fa8e42e8fb11a9c"
feature: "citation-staleness"
sequence: "004"
type: "handoff"
status: "complete"
session_started: "2026-10-10T19:59:22+01:00"
session_id: "01a125f9-c16f-7269-bdae-02bcc7fbf22f"
interval_id: "b80ea094-5d8b-48e0-95cd-062ed024b9cf"
start_branch: "main"
start_commit: "7ae65fe0c1af2483fc99adfe125c22e2c3fba343"
previous_handoff: "drift/citation-staleness/003-handoff-anchors-implemented-and-verified.md"
related_artifacts: ["drift/citation-staleness/002-plan-anchors-checker-and-pickup-report.md"]
---

## Objective

Add the Tier-2 usefulness ledger for citation checks and capture the perimeter corpus baseline, so the feature's value is measurable: exposure and delivery now, the before-snapshot for the Tier-3 A/B experiment in a few weeks.

## Source Documents

- drift/citation-staleness/003-handoff-anchors-implemented-and-verified.md (previous interval; its Open Questions include checker-cost measurement)
- drift/citation-staleness/002-plan-anchors-checker-and-pickup-report.md (the executed feature plan)

## Status

Complete; committed as a2caa1d. Full suite green: 112 tests, 106 pass, 6 platform skips, 0 fail. Landing is the only remaining step and is in progress by this session.

## What Changed

- scripts/check-staleness.py — the JSON report now carries the artifact's frontmatter `date`, so ledger lines are self-contained for rot-curve analysis (staleness vs artifact age).
- lib/pickup.ts — `citationNote()` and `pickup()` take an optional `ledger` path; every successful check appends one JSONL line (`ts`, `repo`, `artifact`, `date`, `commit`, `mode`, `total`, `counts`), zero-citation pickups included as the denominator. Ledger failures are swallowed: metrics never matter more than the pickup.
- extensions/drift.ts — `citationLedger()` supplies `<agentDir>/drift/citation-metrics.jsonl` to both the `/drift` pickup and the `drift-continue` note, so the ledger lives beside Drift's records, never in a repository.
- tests/pickup.test.ts — the citation test now asserts two ledger lines (fresh pickup and changed pickup) with counts, artifact path, mode and date.

## Codebase Context

- Baseline measurement taken today (read-only sweep, not committed anywhere in a repo): the perimeter corpus at C:/Users/BLACKHAND-CL1/OneDrive/__projects/perimeter has **655 artifacts, 3,033 citations: 6% fresh, 31% moved, 42% changed, 2% gone, 19% uncertain**, all heuristic mode (pre-anchor artifacts). Snapshot saved to C:/Users/BLACKHAND-CL1/.pi/agent/drift/citation-baseline-perimeter-2026-10-10.jsonl for the planned Tier-3 experiment.
- This repository's own 9-artifact sweep the same day: 84 citations, 19% fresh, 52% moved — citations rot within hours under active development.
- Sweep cost: 655 artifacts graded in well under a minute (one Python spawn per artifact); the previous interval's open question about checker cost is answered — no optimization needed.

## What Deviated from Plan

Nothing; this interval implemented the measurement tiers exactly as discussed with the user (Tier 1 sweep demonstrated, Tier 2 ledger shipped, Tier 3 deferred a few weeks with the perimeter baseline banked).

## Open Questions

- Tier 3 (A/B impact experiment on the perimeter corpus) is user-scheduled for a few weeks out: task sessions against stale artifacts with and without the citation note; score stale-trust errors and tokens-to-correct. The baseline JSONL is already saved.
- Ledger analysis tooling (rot curves, fired-report rate) is deliberately unbuilt until the ledger has real entries.

## Next Steps

1. Land this interval (commit publication outputs, fetch/rebase, verify, full suite, push) — in progress by this session.
2. In a few weeks, with ledger data accumulated: run the Tier-3 A/B on the perimeter corpus against the saved baseline.
