---
date: "2026-10-11T13:09:36+01:00"
section: "Changed"
artifact: "drift/auto-continue/001-handoff-manual-default-and-switch.md"
---
Automatic continuation after a profiled handoff is now a per-repository opt-in: `/drift-auto-continue on` records `autoContinue: true` in `.drift.json`. By default the handoff is only published (and still lands itself where `land.auto` is set); the tool result names the `drift-continue` command so you decide if and when the work continues, and in which thread.
