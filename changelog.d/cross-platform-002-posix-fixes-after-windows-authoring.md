---
date: "2026-10-12T13:57:31+01:00"
section: "Fixed"
---
Scripts and docs authored on Windows now work as documented on macOS and Linux: `build-changelog.py` and `check-staleness.py` are tracked executable, every documented script invocation is `python3 -I scripts/…` rather than relying on the exec bit, the citation-anchors doc no longer assumes a `python` command, and one ruff `E741` is cleared. The stale-skill runtime test asserts the stored form of queued `/skill:drift` invocations exactly for the Pi under test: Pi 1.1 runs input handlers on steer and follow-up, so the binding expands the bundled skill before anything is stored, where Pi 0.85 stored the native stale expansion and relied on the context-time rebind.
