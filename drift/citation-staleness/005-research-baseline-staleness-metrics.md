---
date: "2026-10-10T20:44:25+01:00"
branch: "main"
git_commit: "08ad7e4dce909e129b7364b2ef398d4d9cf2f32a"
feature: "citation-staleness"
sequence: "005"
type: "research"
status: "complete"
session_started: "2026-10-10T20:43:14+01:00"
session_id: "01a125f9-c16f-7269-bdae-02bcc7fbf22f"
interval_id: "407ad18c-d4b7-47ee-b2ed-23cd135234ed"
start_branch: "main"
start_commit: "08ad7e4dce909e129b7364b2ef398d4d9cf2f32a"
related_artifacts: ["drift/citation-staleness/001-research-prior-art-derived-records-and-citation-anchoring.md","drift/citation-staleness/004-handoff-usefulness-ledger-and-perimeter-baseline.md"]
---

## Research Question

What is the measured staleness of code citations in Drift artifacts at the moment the citation-anchors feature shipped — the baseline against which the feature's usefulness (Tier 1 rot curves, Tier 2 ledger rates, Tier 3 behavioral A/B) will be judged?

## Summary

Two full-corpus sweeps with `scripts/check-staleness.py` on 2026-10-10 (all heuristic mode: every artifact predates anchors). In this repository, citations rot within hours of active development: 19% of 84 citations remained fresh, and artifacts a few hours old were already at 0% fresh. In the perimeter corpus — 655 artifacts spanning the longest live Drift usage — only **6% of 3,033 citations are fresh**; a third moved (recoverable by forwarding), 42% changed, and a fifth cannot be graded at all because their recorded commits are gone or absent, which is the strongest empirical argument for publish-time anchors. Baseline snapshots are saved outside any repository for the scheduled Tier 3 experiment.

## Detailed Findings

### Method

One `python -I scripts/check-staleness.py <artifact> <repo> --json` invocation per artifact (checker at commit 08ad7e4), aggregated by verdict. Heuristic mode throughout: expectations reconstructed from each artifact's recorded `git_commit`; no artifact in either corpus carries anchors yet. The perimeter sweep (655 artifacts) completed in under a minute with zero failures — checker cost is a non-issue at corpus scale.

### This repository (drift), 2026-10-10 ~20:15 +01:00, HEAD 08ad7e4

9 artifacts, 84 citations:

| verdict | count | share |
|---|---|---|
| fresh | 16 | 19% |
| moved | 44 | 52% |
| changed | 18 | 21% |
| gone | 1 | 1% |
| uncertain | 5 | 6% |

Age effect under active development: the shared-files artifacts (~1 day old) were 0% fresh across 31 citations; citation-staleness/002 (the plan this feature was built from) was 0% fresh five hours after writing, because the implementation refactored the very ranges the plan cited. worktree-scope/001 (same morning) was 10 fresh / 4 moved. Two handoffs written under the new symbol-reference guidance produced no gradeable citations — the durability↔verifiability trade is already visible in data.

### Perimeter corpus, 2026-10-10, 655 artifacts

3,033 citations, 0 sweep failures:

| verdict | count | share |
|---|---|---|
| fresh | 183 | 6% |
| moved | 944 | 31% |
| changed | 1,273 | 42% |
| gone | 62 | 2% |
| uncertain | 571 | 19% |

Readings: (1) 94% of citations in the long-lived corpus no longer hold as written; (2) the single largest recoverable bucket is `moved` — 944 citations an agent would misread that the checker forwards; (3) the 19% `uncertain` bucket (dead or unrecorded commits) is unrecoverable by any heuristic and is exactly what publish-time anchors eliminate for new artifacts, since an anchor grades without history.

### Where the baselines live

- Perimeter snapshot (655 JSONL lines, per-artifact): `C:/Users/BLACKHAND-CL1/.pi/agent/drift/citation-baseline-perimeter-2026-10-10.jsonl`
- Live ledger (appends from every real pickup from 08ad7e4 onward): `C:/Users/BLACKHAND-CL1/.pi/agent/drift/citation-metrics.jsonl`
- Both deliberately outside any repository; the perimeter corpus was read-only throughout.

### Measurement tiers these baselines serve

- Tier 1 (opportunity): re-run the sweep and diff against this artifact's tables for rot curves and citation half-life.
- Tier 2 (delivery): ledger rates — how often real pickups fired a report, with what verdict mix.
- Tier 3 (impact): the scheduled A/B on the perimeter corpus (see the follow-up plan), scored against this baseline.

## Code References

- scripts/check-staleness.py:1-35 - the checker's contract (verdicts, modes, report-not-gate) as swept
- lib/pickup.ts: citationNote() - the ledger writer feeding the live metrics file
- extensions/drift.ts: citationLedger() - the ledger's agent-dir location

## Open Questions

- Rot-curve shape: the two corpora suggest decay within hours under active development, but a single-day snapshot cannot give a half-life; the follow-up sweep in a few weeks will.
- The `uncertain` 19% in perimeter: how much is squash/force-push commit loss vs artifacts that never recorded a commit — worth splitting when the Tier 3 harness touches that corpus.
- Whether exact-mode (anchored) artifacts show a materially different moved/changed split than heuristic grading — answerable once anchored artifacts age.
