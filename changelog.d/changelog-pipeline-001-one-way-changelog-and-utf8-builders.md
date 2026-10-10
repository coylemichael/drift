---
date: "2026-10-10T17:53:59+01:00"
section: "Fixed"
artifact: "drift/changelog-pipeline/001-handoff-one-way-changelog-and-utf8-builders.md"
---
The changelog generator no longer copies edits from the generated region back into their changelog.d/ fragments: the region is a one-way view, and a hand-edited bullet is reported and refused instead of silently reverting fragment corrections. Both builders emit UTF-8 regardless of console code page, and a leading bullet marker in a fragment renders a single '- ' instead of doubling.
