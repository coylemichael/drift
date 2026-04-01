# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]


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
