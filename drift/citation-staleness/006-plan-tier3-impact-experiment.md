---
date: "2026-10-10T20:44:59+01:00"
branch: "main"
git_commit: "08ad7e4dce909e129b7364b2ef398d4d9cf2f32a"
feature: "citation-staleness"
sequence: "006"
type: "plan"
status: "pending"
session_started: "2026-10-10T20:43:14+01:00"
session_id: "01a125f9-c16f-7269-bdae-02bcc7fbf22f"
interval_id: "407ad18c-d4b7-47ee-b2ed-23cd135234ed"
start_branch: "main"
start_commit: "08ad7e4dce909e129b7364b2ef398d4d9cf2f32a"
source_research: "drift/citation-staleness/005-research-baseline-staleness-metrics.md"
related_artifacts: ["drift/citation-staleness/004-handoff-usefulness-ledger-and-perimeter-baseline.md"]
---

## Objective

Run the Tier 3 impact experiment: measure whether the pickup citation report actually changes agent behavior — fewer stale-trust errors, less verification cost — using the perimeter corpus and the saved 2026-10-10 baseline.

## Source Research

- drift/citation-staleness/005-research-baseline-staleness-metrics.md

## Starting Point

Deliberately scheduled a few weeks after 2026-10-10, for two reasons: the live ledger (`<agent dir>/drift/citation-metrics.jsonl`) needs real pickup entries to confirm the feature fires in practice before measuring its impact, and the perimeter corpus keeps aging, widening the measurable gap. Phase 1 (harness design) has no dependencies and can start whenever the user says go.

## Key Files

- scripts/check-staleness.py — produces the per-artifact JSON the harness uses both to select test artifacts and to score answers
- C:/Users/BLACKHAND-CL1/.pi/agent/drift/citation-baseline-perimeter-2026-10-10.jsonl — the frozen baseline: 655 artifacts, 3,033 citations, per-artifact verdict counts
- C:/Users/BLACKHAND-CL1/.pi/agent/drift/citation-metrics.jsonl — live ledger; its entry count and verdict mix gate whether the experiment is worth running
- lib/pickup.ts: citationNote() — the exact note format the "with-report" arm must reproduce
- C:/Users/BLACKHAND-CL1/OneDrive/__projects/perimeter — the corpus; READ-ONLY throughout, no artifacts written there, no sessions launched in it

## Implementation Sequence

1. **Select the sample.** From the baseline JSONL, stratify perimeter artifacts into: mostly-fresh (≥50% fresh), mixed, mostly-stale (0–10% fresh), and uncertain-heavy. Sample ~10 artifacts per stratum, preferring handoffs and research with ≥5 citations. Verify selection is reproducible (seeded) and record it.
2. **Author the task set.** Per sampled artifact, derive 2–3 questions whose correct answers depend on cited code as it is NOW (e.g. "per this handoff, what does the function cited at X do — confirm against the code"), such that trusting a stale citation produces a checkably wrong answer. Ground truth comes from the current tree plus the checker's verdicts; store tasks beside the harness, not in perimeter.
3. **Build the paired runner.** For each task, two sessions with identical prompts except the citation note: arm A gets artifact + note (exactly `citationNote`'s format), arm B gets artifact only. Same model, same budget. Subagents are sufficient; no Drift lifecycle in either arm.
4. **Score.** Per response: stale-trust errors (assertions matching the artifact's stale text where the verdict was changed/gone), verification actions taken (reads/greps of cited files), tokens to final answer, answer correctness against ground truth. Score blind to arm where feasible.
5. **Analyze and publish.** Paired comparison per task; report error-rate delta, verification-cost delta, and correctness delta with simple sign-test confidence. Publish as the next research artifact in this feature, with the harness committed to this repository (not perimeter).

Steps 1–2 are disjoint from 3 and can run in parallel once sampling is approved.

## Decisions & Constraints

- Perimeter is read-only evidence: nothing written, committed or published there; the harness, tasks and results live in this repository and the agent dir.
- Arm A's note must be byte-faithful to production (`citationNote` format) — measuring a better-written note would measure prompt quality, not the feature.
- Grade behavior, not vibes: the three scored quantities (stale-trust errors, verification actions, tokens) are countable from transcripts; no self-reported usefulness.
- The baseline file is frozen; a fresh sweep at experiment time is taken alongside it so rot-curve drift between baseline and experiment is itself reported (Tier 1 byproduct).
- Abort criterion: if the live ledger shows pickups almost never encounter non-fresh citations in real use by experiment time, report that instead — a feature that never fires needs no impact study.

## Open Questions

- Sample size vs cost: 40 artifacts × ~2.5 tasks × 2 arms ≈ 200 session runs; trim strata if budget demands.
- Whether to include an arm C (note present but artifact fully fresh) to measure false-alarm cost; cheap to add from the mostly-fresh stratum.
- Model choice: pin one model for both arms, or repeat across two models to check the effect generalizes.
- Carried from the research: splitting perimeter's 19% uncertain bucket (lost commits vs never-recorded) while the harness is in that corpus anyway.
