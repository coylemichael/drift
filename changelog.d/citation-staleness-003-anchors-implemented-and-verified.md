---
date: "2026-10-10T19:47:39+01:00"
section: "Added"
artifact: "drift/citation-staleness/003-handoff-anchors-implemented-and-verified.md"
---
Drift artifacts now carry citation anchors: `drift_publish` records a content hash per `path:line` reference, and `/drift` or an automatic continuation grades every citation at pickup — fresh (proven), moved (forwarded to its new location), changed (with a similarity ratio), gone, or uncertain — so a reading session knows exactly what to re-check instead of trusting stale references. Older artifacts are graded heuristically from their recorded commit; `scripts/check-staleness.py` also runs standalone.
