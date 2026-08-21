# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed (breaking)
- **Prompt filenames shortened** to `research.md`, `plan.md`, `handoff.md` (from `research-codebase.md`, `plan-from-research.md`, `mid-work-handoff.md`). Frontmatter `name:` values updated to match. Slash-command invocations are now `/research`, `/plan`, `/handoff` across all supported tools.
- **Artifact paths restructured to flat numbered files inside feature folders: `drift/<feature>/NNN-research-topic.md`, `drift/<feature>/NNN-plan-description.md`, and `drift/<feature>/NNN-handoff-description.md`** — replaces the previous top-level `research/`, `.handoffs/<TICKET>/`, and split `drift/<feature>/research/` / `handoffs/` layouts for new work. Existing subfolder layouts remain legacy-supported when resuming from an existing artifact path.
- All three prompts now require the agent to confirm/derive a **feature identifier** before writing. Ticket reference or descriptive slug — anything unique — is used as the folder name under `drift/<feature>/`, while artifact files receive the next three-digit sequence number.

### Changed
- `SKILL.md` now acts as a single router entrypoint for research, planning, handoff, and resume requests
- Renamed `from-research.md` → `plan-from-research.md` (subsequently shortened to `plan.md` — see above)
- Frontmatter `name:` values match filenames so VS Code prompt-file tooling resolves them correctly
- `research.md` — research output now includes `date` / `branch` / `git_commit` / `type` frontmatter, matching the handoff prompts
- All three prompts — "Writing to Disk" sections now include an explicit **Path verification** subsection enumerating forbidden destinations (editor memory, temp dirs, user-profile paths, absolute paths outside the repo)

### Added
- Drift artifact writing now ensures the repository-root `.gitignore` exists and includes `/drift/` before creating project-local Drift output folders.
- `SKILL.md` — reusable skill entrypoint for agents that support global skill directories such as `~/.agents/skills`
- `README.md` — "When not to use Drift" section
- `README.md` — reusable skill installation instructions and "Installing as reusable commands or skills" table covering Zed Agent, VS Code Copilot, Claude Code, Cursor, and paste-into-chat
- `README.md` — explicit guidance to summarize completed phases when handoff chains exceed three documents
- `README.md` — illustrated flat numbered artifact files inside `drift/<feature>/` in "Where files are stored"
- `examples/` directory (placeholder for future example artifacts)


## [0.2.0] - 2026-04-01

### Changed
- All prompts now anchor output paths to the **repository root** with explicit "do not use editor memory systems" guardrail
- `research-codebase.md` — research saves to disk by default instead of only when asked
- `mid-work-handoff.md` — `git diff --stat` replaced with state-resilient alternatives (`git diff HEAD --stat` / `git log --stat -1`)
- `README.md` — added "Where files are stored" section with `.gitignore` guidance, updated references to renamed file

### Added
- `mid-work-handoff.md` — "Resuming from a Handoff" section with 7-step resume protocol

### Renamed
- `mid-work-handover.md` → `mid-work-handoff.md` — normalized terminology across the project

## [0.1.0] - 2026-03-30

### Added
- `research-codebase.md` — prompt for investigating and documenting how a codebase works
- `from-research.md` — prompt for turning a research document into an actionable implementation handoff
- `mid-work-handover.md` — prompt for snapshotting mid-implementation state for the next session
