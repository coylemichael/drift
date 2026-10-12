---
date: "2026-10-12T11:35:58+01:00"
section: "Changed"
artifact: "drift/salience-tiers/002-handoff-tiers-implemented-and-verified.md"
---
Drift's model-facing context is now tiered: a session records silently behind a minimal note until a deterministic signal (existing artifacts, .drift.json, another engaged session, work landing in the tree, or explicit Drift use) engages the full lifecycle context; an unchanged context keeps its place instead of re-arriving every turn; and Drift attaches automatically when a repository appears in the launch directory after session start (for example, cloning into an empty folder).
