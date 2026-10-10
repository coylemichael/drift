---
date: "2026-10-10T20:39:46+01:00"
section: "Added"
artifact: "drift/citation-staleness/004-handoff-usefulness-ledger-and-perimeter-baseline.md"
---
Every citation check at pickup is recorded to a local usefulness ledger (`<agent dir>/drift/citation-metrics.jsonl`): one line per checked artifact with verdict counts, mode and artifact date, zero-citation pickups included, so the feature's exposure and delivery can be measured over time. The ledger lives beside Drift's records, never in a repository, and a ledger failure never affects the pickup.
