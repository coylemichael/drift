---
date: 2026-08-21T14:24:38+0100
branch: main
git_commit: f498bfd4ea005b2855879f97eb9c0cb8dd5905e1
feature: drift-handoff-navigation
sequence: 001
source_research: null
previous_handoff: drift/drift-handoff-navigation/handoffs/2026-08-21_14-19-57_numbered-work-items.md
related_artifacts:
  - drift/drift-handoff-navigation/handoffs/2026-08-21_13-26-06_drift-handoff-navigation-planning.md
type: handoff
---

## Objective
Evaluate and implement improvements to Drift artifact organization so humans can quickly identify the latest handoff and next work item from the file tree.

## Source Documents
- drift/drift-handoff-navigation/handoffs/2026-08-21_13-26-06_drift-handoff-navigation-planning.md
- drift/drift-handoff-navigation/handoffs/2026-08-21_14-19-57_numbered-work-items.md

## Status
Revised the selected convention from numbered work-item folders with `research/` and `handoffs/` subfolders to flat numbered artifact files inside a stable feature folder.

- **Completed:** Updated Drift prompt source files to use `drift/<feature>/NNN-{research,plan,handoff}-<slug>.md`.
- **Completed:** Preserved the user's desired grouping semantics: all research, plans, and handoffs for `drift-handoff-navigation` appear together inside `drift/drift-handoff-navigation/`.
- **Completed:** Updated README and changelog to document flat numbered artifact files.
- **Completed:** Synced updated prompt files to the installed global skill under `~/.agents/skills/drift/`.
- **Not started:** Migrating older legacy subfolder artifacts into flat numbered files. Existing subfolder paths remain legacy-supported.

## What Changed
- `SKILL.md:59-104` — now defines one feature folder with flat ordered artifact files (`001-research-*`, `002-plan-*`, `003-handoff-*`), three-digit sequence allocation inside the feature folder, and no research/handoff subfolders for new artifacts.
- `research.md:12-80` — now writes research to `drift/<feature>/NNN-research-<topic>.md`, scans the feature folder for the next artifact number, and adds `feature` / `sequence` frontmatter.
- `plan.md:14-91` — now reads from flat research artifact paths and writes `NNN-plan-<description>.md` in the same feature folder.
- `handoff.md:14-111` — now writes `NNN-handoff-<description>.md` in the same feature folder, including when resuming from legacy `handoffs/` subfolders.
- `README.md:49-124` — updated examples and storage explanation to show all artifacts sorted inside one feature folder.
- `CHANGELOG.md:5-26` — updated the unreleased breaking-change note to describe flat numbered artifact files.
- `~/.agents/skills/drift/SKILL.md`, `~/.agents/skills/drift/research.md`, `~/.agents/skills/drift/plan.md`, `~/.agents/skills/drift/handoff.md` — installed global skill files synced from the repo source.

## Codebase Context
- The active feature folder is `drift/drift-handoff-navigation/`. Existing handoffs are still in the legacy `handoffs/` subfolder, but this new handoff is written as a flat artifact at `001-handoff-flat-artifact-files.md` under the feature folder.
- Under the new convention, agents should scan only immediate markdown files in `drift/<feature>/` for `NNN-*` prefixes when allocating the next sequence number. Legacy subfolder artifacts are preserved as source references but do not control the flat sequence unless migrated.
- The user explicitly preferred the at-a-glance sequence inside the feature folder, e.g. `001-research`, `002-plan`, `003-handoff`, `004-handoff`, `005-handoff`, then later `006-research`, `007-research`, `008-plan`.

## What Deviated from Plan
- The prior implementation selected numbered work-item folders (`drift/0001-work-slug/research/` and `handoffs/`). The user clarified they prefer stable feature folders with all artifact types interleaved as numbered files. This session replaced the previous convention accordingly.

## Open Questions
- Should existing legacy artifacts under `drift/<feature>/handoffs/` or `drift/<feature>/research/` be migrated into the new flat numbering scheme, or left as historical paths?
- Should sequence numbers always be three digits (`001`) or eventually expand naturally beyond `999` if needed?

## Next Steps
1. Review whether the wording around legacy subfolder paths should be stricter: preserve legacy only when explicitly requested, or always write the next flat artifact when resuming from legacy.
2. Optionally add example artifacts under `examples/` showing the flat sequence pattern.
3. Decide whether to commit `.gitignore` with `/drift/`, which remains untracked.
