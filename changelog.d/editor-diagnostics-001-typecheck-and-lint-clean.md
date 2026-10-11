---
date: "2026-10-11T13:45:33+01:00"
section: "Fixed"
artifact: "drift/editor-diagnostics/001-handoff-typecheck-and-lint-clean.md"
---
The repository type-checks and lints clean, and the diagnostics exposed three real bugs now fixed: `drift_worktree`'s tool result carries the required `details` field, the `Pending` record type matches the changelog-fragment object it actually stores (the old `Receipt` intersection made `fragment` unsatisfiable), and the changelog builder normalizes CRLF before slicing a committed fragment's body, so hand-edit detection cannot misfire on Windows checkouts. A strict `tsconfig.json`, locally installed peer-dependency types and a `.markdownlint.jsonc` keep editor diagnostics at zero.
