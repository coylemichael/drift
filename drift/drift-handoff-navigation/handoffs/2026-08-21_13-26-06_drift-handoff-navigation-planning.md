---
date: 2026-08-21T13:26:06+0100
branch: main
git_commit: f498bfd4ea005b2855879f97eb9c0cb8dd5905e1
source_research: null
previous_handoff: null
type: handoff
---

## Objective
Evaluate improvements to Drift artifact organization so humans can quickly identify the latest handoff and next work item from the file tree.

## Source Documents
- None. This handoff captures an exploratory planning discussion in chat about Drift artifact organization.

## Status
Planning discussion only. No Drift skill prompt files have been changed yet.

- **Completed:** Discussed the current pain point: timestamped handoffs work well inside one feature folder, but many feature folders make it hard to see what is latest and where to work next.
- **Completed:** Compared a top-level `drift/INDEX.md` / per-feature `CURRENT.md` navigation approach against numbered workstream folders.
- **Completed:** User clarified that old work should not become active again under an old `.md`; if it is a new piece of work, it should get its own new `.md` / work item.
- **Completed:** Looked at representative external practices:
  - Claude Code memory uses `CLAUDE.md` and auto-memory with a concise `MEMORY.md` index and topic files.
  - Cline Memory Bank uses `activeContext.md`, `progress.md`, and other structured markdown files.
  - Cline Kanban models work as discrete task cards with dependencies, isolated worktrees, review, ship, and cleanup/resume IDs.
  - GitHub Issues model work as discrete issues with sub-issues, dependencies, metadata, and project views.
  - ADR guidance supports one record per decision, immutable or superseded records, and explicit filename conventions.
  - Keep a Changelog emphasizes human-oriented ordering, ISO-style dates, latest-first presentation, and avoiding raw noisy logs.
- **In progress:** Deciding which Drift convention best balances human file-tree scanning, low bloat, stable paths, and agent resume reliability.
- **Not started:** Editing Drift prompt files (`SKILL.md`, `research.md`, `plan.md`, `handoff.md`) to implement any new convention.

## What Changed
- `.gitignore:1` — added `/drift/` so project-local Drift artifacts are ignored by git by default.
- `drift/drift-handoff-navigation/handoffs/2026-08-21_13-26-06_drift-handoff-navigation-planning.md` — this handoff document.

## Codebase Context
- The current Drift skill instructions are global under `~/.agents/skills/drift/`, but generated artifacts must be written inside the current target project under `drift/<feature>/...`.
- Current Drift artifact convention from the skill is:
  - `drift/<feature>/research/YYYY-MM-DD-<topic>.md`
  - `drift/<feature>/handoffs/YYYY-MM-DD_HH-MM-SS_<description>.md`
- The skill router currently distinguishes research, planning, and handoff/resume by reading `research.md`, `plan.md`, or `handoff.md`.
- The attached Drift instructions now include a gitignore rule: before writing artifacts, ensure repository-root `.gitignore` exists and contains `/drift/`.

## What Deviated from Plan
- No implementation plan existed before this handoff.
- The assistant initially favored `drift/INDEX.md` plus `drift/<feature>/CURRENT.md`; after the user challenged that as potential bloat and clarified the “new work gets new work item” rule, the discussion shifted toward evaluating numbered workstream folders rather than simply accepting the index approach.
- The user explicitly requested not to agree for the sake of agreeing; the next session should evaluate tradeoffs rather than treat numbered folders as already decided.

## Open Questions
- Should Drift optimize primarily for human file-tree scanning, agent resume accuracy, or both equally?
- Should the convention be:
  1. Top-level `INDEX.md` / feature-local `CURRENT.md`,
  2. Numbered workstream folders, e.g. `drift/0001-some-work/`,
  3. Status directories, e.g. `drift/active/0001-some-work/`, `drift/done/0002-other-work/`,
  4. Numbered artifact files inside stable feature folders, or
  5. A hybrid?
- If numbered workstream folders are used, should numbering be assigned by scanning existing folders for the highest zero-padded integer?
- Should existing unnumbered Drift folders be migrated, left as legacy, or supported alongside numbered folders?
- Should Drift allow a user-provided feature identifier to include a number, or should Drift assign the next number automatically?
- How should completion be represented without creating index bloat: frontmatter status, terminal handoff title, folder status prefix, status subdirectories, or no explicit status?
- If related work starts later, should it always get a new numbered folder and link to prior work via `related_work` frontmatter?
- Should `research.md`, `plan.md`, and `handoff.md` all enforce the same work item allocation rule?

## Next Steps
1. Evaluate approaches explicitly, with pros/cons against the user’s criteria:
   - at-a-glance human readability in Zed’s file tree,
   - low maintenance / no bloat,
   - stable links and paths,
   - clear “new work means new work item” semantics,
   - easy agent resume behavior,
   - migration cost for existing artifacts.
2. Decide whether to update Drift with numbered workstream folders, an index/current-file model, status directories, or a hybrid.
3. If changing Drift, edit the global skill files under `~/.agents/skills/drift/`:
   - `SKILL.md` — artifact location and global routing semantics.
   - `research.md` — first-artifact / work item creation rules.
   - `plan.md` — handoff path and existing handoff lookup rules.
   - `handoff.md` — handoff path, resume behavior, and next-work-item rules.
4. If numbered folders are selected, define exact naming syntax before editing prompts. Current candidate: `drift/0001-work-slug/` with existing `research/` and `handoffs/` subfolders.
5. Decide migration behavior for existing folders such as `onepassword-helper`, `pylon-docs-kevin`, `tprm-upguard-auth`, and `upguard-api-key` based on user preference.
