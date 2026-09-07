# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **`install.py` — one command installs Drift for every supported agent on the machine.** Clone anywhere, run `python3 <clone>/install.py`, done. It detects Claude Code and Zed and symlinks each one's skills directory to the clone, so `git pull` in the clone is the upgrade and there is nothing to re-run; on Windows, where a symlink needs Developer Mode, it falls back to a directory junction. It is Python rather than shell because the repo already requires python3 for `scripts/build-index.py`, one script covers Arch, macOS and Git Bash on Windows, and the hook-registration step planned next is a JSON merge that shell cannot do safely. Behaviour is deliberately narrow: it creates nothing but those links (no project repo, no `.gitignore`, no agent settings, no sudo), re-running leaves anything already right alone and says so, `--dry-run` prints the same plan the real run would execute, `--check` reports the install state with a non-zero exit on any fault, `--uninstall` removes only links that point at this clone and leaves anything else with a reason, and a real directory in the way is reported and never removed unless `--force` moves it aside as `drift.bak-<timestamp>`. Running it from a clone that already sits at a skills path is recognised as installed in place. Exercised against a throwaway `$HOME` for fresh install, re-run, stale-link repoint, conflict, forced move, in-place clone, check, dry-run and uninstall.
- `README.md` — "Installing" now leads with the two-line clone-and-run; the Claude Code and Zed rows point at the installer, VS Code and Cursor stay manual. "Developing Drift itself" collapses to the same command, since the dev setup and the user setup are now one symlink made the same way.
- **`scripts/smoke-test.sh` — an end-to-end check that the install actually works**, as opposed to the links merely resolving. It runs `install.py --check`, finds a Claude Code binary (the `claude` CLI, or the one Zed bundles on Linux and macOS), asks a print-mode session to list its skills and confirms `drift` is among them, then runs a real Drift research pass in a throwaway repo under `/tmp` and verifies what came out: the artifact exists, its `date` is a full clock read with an offset, `git_commit` is a 40-character hash, `INDEX.md` carries the row, and `.gitignore` gained `/drift/`. The repo is deleted afterwards. Without a binary it runs the link check and says to try `/drift` in a new session. Two things it surfaced while being written: `claude -p --allowedTools` is variadic and silently swallows a positional prompt, so the script feeds prompts on stdin; and the agent hand-writes `INDEX.md` with the right row but its own header prose, so `build-index.py --check` reports it out of date. The script reports that as a note, not a failure, since it is a Drift design issue rather than an install fault.

### Added
- **`SKILL.md` — "Timestamps" section requiring `date` to be read from the system clock**, with `date -Iseconds` and a portable `python3` equivalent (BSD/macOS `date` has no `-I`). Drift previously specified the frontmatter date's *format* and never said where to get the value; an agent has no clock, so it filled one in. Audited against git, one repo's 86 artifacts held 34 provably impossible dates — several claiming a time hours *after* the commit the same artifact recorded as `HEAD`, a hash that could not have existed yet. The section names the three observed failure modes (a date-only harness value padded to `T00:00:00`; forward-compounding drift from extrapolating off the previous artifact; an invented round session start where there was no anchor), requires the machine's real offset rather than hand-normalizing to `Z`, and says to record day precision and mark it approximate when no clock is reachable. False precision outranks real evidence; honest coarseness does not.
- `research.md` / `plan.md` / `handoff.md` — the same instruction inline beneath each frontmatter block, so each prompt is self-sufficient when read as active workflow instructions.
- `README.md` — note in "The running order" that index ordering is only as good as its timestamps, linking the new section.
- **`drift/INDEX.md` — a root chronological index of every artifact in the repo.** Feature folders show a feature's own narrative, but each folder's `NNN` counts from `001`, so the file tree stops being a timeline once a repo has more than a few features and interleaved work becomes invisible. The index is one table, oldest first, with a global running `#` that is deliberately independent of the folder-local sequence. Rows sort on the **UTC-normalized instant** of each artifact's frontmatter `date`, not the raw string — a repo worked on from more than one machine mixes offsets, and `2026-08-31T00:00:00Z` is an hour *after* `2026-08-31T00:00:00+01:00`. Ties break on feature then sequence so rebuilds are stable.
- `SKILL.md` — "Root Index" section: format, column and ordering rules, the append-on-write rule, and a rebuild procedure covering artifacts with no parsable `date` (fall back to a body date and mark approximate, or list under `## Undated`) and legacy subfolder paths.
- `scripts/build-index.py` — stdlib-only rebuild helper for the index; takes a project's `drift/` directory, with `--check` to report an out-of-sync index without writing. First script in the repo, matching the Agent Skills convention of `SKILL.md` plus optional `scripts/`: judgment stays in the prompts, deterministic work moves to a tool. `SKILL.md` still specifies the format, so an agent without a shell can rebuild the index by following the procedure.
- `README.md` — "The running order" section explaining why the index exists and how `#` relates to `NNN`.
- `handoff.md` / `execute.md` — resuming now skims the tail of the index for work landed in *other* features since the artifact being resumed was written, so a stale plan is noticed rather than followed blindly.

### Removed (breaking)
- **The "paste anywhere" operating model.** Drift no longer presents itself as markdown you can paste into any chat. `README.md` drops the "No skill support? Use the files directly" fallback, the "Where these work" section, and the `Anything else → paste into the chat` install row. Pasting a single prompt was never equivalent: the workflow depends on `SKILL.md` routing between prompt files, the agent reading and writing artifacts under `drift/`, and now a script to rebuild the index — none of which survive a copy/paste. Tools without a skill or prompt-file directory are explicitly unsupported rather than half-supported.
- `README.md` — "Installing as reusable commands or skills" renamed to "Installing" (anchor updated in Getting Started), reordered to lead with Claude Code, and rewritten to state the requirement up front.

### Changed (breaking)
- **Maintaining a root index is now required, reversing the previous prohibition.** `SKILL.md` and `README.md` previously said Drift does not maintain `INDEX.md`; that applied navigation-by-filename reasoning to the cross-feature case, where it does not hold. Per-feature `CURRENT.md` files and `active/`/`done/` status directories are still out. Existing projects need no migration — the index is a derived view, so rebuild it from frontmatter.
- `research.md` / `plan.md` / `handoff.md` — "Writing to Disk" now includes appending the new artifact's index row, and rebuilding the index if it has fallen out of sync. Part of writing an artifact, not a separate request.
- `execute.md` — index rows are the orchestrator's job alongside the handoff; sub-agents must not write either.

### Changed
- `README.md` — Claude Code install switched from four copied commands in `.claude/commands/` to a single skill at `~/.claude/skills/drift` (or `.claude/skills/drift` for project scope), invoked as `/drift` and routed by `SKILL.md`. Matches the skills-by-default model and `SKILL.md`'s "do not split Drift into separate global skills" rule.

### Added
- `README.md` — "Developing Drift itself" section: symlink `~/.agents/skills/drift` to a working clone for a single source of truth when developing the prompts while using the skill, with the known-good-state tradeoff called out.

### Changed
- `README.md` — reframed around a skills-by-default operating model. "Getting Started" now leads with installing Drift as a reusable agent skill (tool-agnostic, with concrete per-tool paths deferred to the compatibility table) and demotes copy/paste to a "no skill support?" fallback covering both file-linking and pasting. Workflow step callouts (Research / Plan / Execute / Handoff) reworded from "Paste [x.md]" to "Ask Drift to …", with the underlying prompt file linked for paste-mode users.

### Added
- `execute.md` — fourth mode. Orchestrates a plan or handoff: walks the step sequence, delegates self-contained steps to sub-agents (parallel where write scopes are disjoint), verifies each step, and hands off via `handoff.md` at the end. Includes delegation heuristics (delegate scoped multi-file work; keep verification, one-shot edits, and tightly-coupled iteration with the orchestrator) and a sub-agent prompt skeleton. Supports both flat numbered inputs and legacy subfolder paths; output handoffs always follow the flat numbered convention unless the user explicitly asks to preserve a legacy chain.
- `SKILL.md` — router entry and workflow step for the new `execute.md` mode.
- `README.md` — "Executing" section, mermaid updated to include the execute node with a resume edge from handoff, install-table invocations updated to include `/execute`.

### Changed
- `plan.md` — Implementation Sequence items must now be self-contained enough to hand to a sub-agent (clear files, clear goal, clear verification). Guidelines call out disjoint scopes so an orchestrator running the plan via `execute.md` can parallelize where safe.

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
