---
date: "2026-10-13T10:29:34+01:00"
section: "Fixed"
artifact: "drift/changelog-pipeline/003-handoff-no-changelog-recovery-and-policy-guard.md"
---
drift_publish accepts null or an empty/whitespace-only changelog entry as no entry, so research can recover from optional-field retry loops without adopting the repository's changelog. Equivalent no-entry forms share one receipt; non-empty entries remain blocked when generation is off and pending real entries cannot be discarded. Engaged context and validation errors now state the correct recovery; tracked field evidence and actual-Pi regression tests cover the failure.
