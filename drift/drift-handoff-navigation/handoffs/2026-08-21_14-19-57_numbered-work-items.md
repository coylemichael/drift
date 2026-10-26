---
date: 2026-08-21T14:19:57+0100
branch: main
git_commit: f498bfd4ea005b2855879f97eb9c0cb8dd5905e1
work_item: drift-handoff-navigation
source_research: null
previous_handoff: drift/drift-handoff-navigation/handoffs/2026-08-21_13-26-06_drift-handoff-navigation-planning.md
related_work: []
type: handoff
---

## Objective
Evaluate and implement improvements to Drift artifact organization so humans can quickly identify the latest handoff and next work item from the file tree.

## Source Documents
- drift/drift-handoff-navigation/handoffs/2026-08-21_13-26-06_drift-handoff-navigation-planning.md

## Status
Implemented the numbered work-item folder convention in the Drift prompt source and installed global skill files.

- **Completed:** Evaluated navigation options from the previous handoff and selected numbered work-item folders as the best balance of file-tree readability, low maintenance, stable paths, and resume reliability.
- **Completed:** Updated source prompt files to use `drift/NNNN-work-slug/` for new work while supporting existing unnumbered folders as legacy resume paths.
- **Completed:** Updated README and changelog to document the numbered work-item convention.
- **Completed:** Synced updated prompt files to the installed global skill under `~/.agents/skills/drift/`.
- **Not started:** Any migration of existing unnumbered Drift artifact folders; current behavior is legacy support, not automatic migration.

## What Changed
- `.gitignore:1` — project-local Drift artifacts are ignored via `/drift/`.
- `SKILL.md:59-104` — replaced unnumbered `drift/<feature>/` guidance with numbered work-item folders, automatic next-number allocation by scanning `drift/NNNN-*`, no `INDEX.md`/`CURRENT.md`/status-directory maintenance, and `related_work` guidance for related future work.
- `research.md:12-78` — research workflow now allocates or infers a work item folder, uses `drift/<work-item>/research/...`, supports legacy unnumbered paths only when continuing existing work, and adds `work_item` / `related_work` frontmatter.
- `plan.md:14-88` — planning workflow now derives the work item from `drift/<work-item>/research/...`, writes handoffs to the same work item, supports legacy folders, and includes `work_item` / `related_work` frontmatter.
- `handoff.md:14-106` — handoff workflow now uses work item terminology, preserves legacy folder support on resume, creates new numbered work items for distinct related work, and includes updated frontmatter/resume rules.
- `README.md:49-123` — documented numbered work-item storage, updated examples, and clarified that Drift does not maintain navigation/status files.
- `CHANGELOG.md:5-26` — recorded the breaking artifact path change to numbered work-item folders.
- `~/.agents/skills/drift/SKILL.md`, `~/.agents/skills/drift/research.md`, `~/.agents/skills/drift/plan.md`, `~/.agents/skills/drift/handoff.md` — installed global skill files overwritten with the updated source prompt contents.

## Codebase Context
- The chosen convention optimizes file-tree scanning without adding index files that can become stale. The latest work item is the highest `NNNN-*` folder; the latest handoff inside it remains the lexicographically latest timestamped file.
- Unnumbered folders are explicitly treated as legacy-supported resume paths. Existing paths do not need to be renamed for agents to continue from old handoffs.
- Related later work should not reopen old work item folders. It should get a new number and link prior artifacts via `related_work` frontmatter.
- The first attempt to copy source prompt files to `~/.agents/skills/drift/` with `copy_path` did not overwrite existing files, so the installed files were overwritten directly with `write_file`.

## What Deviated from Plan
- The previous handoff listed several possible conventions but did not choose one. This session selected the numbered work-item folder convention rather than asking for another decision, because it best matched the stated criteria and the user's concern about avoiding index/current-file bloat.
- Existing unnumbered artifacts were not migrated. The prompts now support them as legacy paths and only require numbering for new work.

## Open Questions
- Should a future change provide an optional migration helper for existing unnumbered folders, or is legacy support sufficient?
- Should Drift normalize ticket references to preserve uppercase (e.g., `0002-PROJ-1234`) or always lowercase slugs? The current docs allow ticket-style uppercase examples but only require filesystem-safe normalization.

## Next Steps
1. Review the prompt wording for whether `related_work` frontmatter should be required only when non-empty, or omitted entirely when there are no related artifacts.
2. If desired, add a lightweight example artifact under `examples/` showing `drift/0001-auth-refactor/research/...` and `handoffs/...`.
3. Decide whether to commit `.gitignore` with `/drift/` in this repository, since it is currently untracked and was introduced as part of the Drift workflow.
