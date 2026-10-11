---
date: "2026-10-11T14:14:48+01:00"
section: "Fixed"
artifact: "drift/editor-diagnostics/002-handoff-ruff-clean-and-py37-floor.md"
---
The helper scripts pass Ruff's default lint while staying inside the documented Python 3.7 floor: canonical regex flag names, explicit `subprocess.run(check=False)` where return codes are handled manually, tuple `startswith`, `.items()`-style dict iteration and unused `noqa` directives removed, a 3.8-only walrus expression in the index builder's kind fallback replaced with 3.7-safe code, and a root `ruff.toml` pins `target-version = "py37"` so suggested fixes (such as `datetime.UTC` or `str.removeprefix`) never exceed what the README promises to support.
