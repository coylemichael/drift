---
date: "2026-10-12T18:23:29+01:00"
section: "Fixed"
artifact: "drift/changelog-coexistence/001-handoff-no-uninvited-adoption-and-residue-cleaner.md"
---
**Drift no longer adopts a changelog by itself.** It generates `CHANGELOG.md` only where the committed file already carries its markers or `.drift.json` sets `"changelog"`, so opening a repository, a fresh clone included, writes nothing to `CHANGELOG.md`, `.gitattributes` or `changelog.d/`. A `changelog.d/` kept in another format (fragments without Drift's frontmatter, or only a README that is not Drift's) is left alone; adoption checks that every existing fragment builds before writing anything; and a changelog failure is reported as one instead of as a failed index refresh. `scripts/clean-changelog-residue.py`, run once per machine, removes only the exact uncommitted setup that Drift from 2026-10-09 to 2026-10-12 left in repositories that never chose it. The `changelog.d/` README template drops the outdated edit-back wording, and `SKILL.md` lists every `.drift.json` field, so the documented `"changelog": false` opt-out is no longer refused as unsupported config.
