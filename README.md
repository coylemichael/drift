<p align="center">
  <img src="assets/drift-logo.svg" alt="Drift" width="400"/>
</p>

<h3 align="center"><em>Context drifts if you don't pin it down</em></h3>

<p align="center">
  A lightweight system for maintaining context continuity across LLM sessions.
</p>

---

## The Problem

Most LLM-assisted work breaks down not because the model can't do the task, but because context gets stale or bloated mid-session. You lose track of what was investigated, what was decided, and where work stopped. Starting a new chat means starting from scratch — or spending half the session re-explaining what happened last time.

## The Solution

Three prompt files that create natural checkpoints across your workflow. Each session starts clean but informed, carrying forward only what the next session actually needs.

### Workflow

```mermaid
flowchart TD
    research["research.md — Investigate. Document what exists."]
    plan["plan.md — Plan. Turn findings into an actionable starting point."]
    handoff["handoff.md — Continue. Snapshot so the next session picks up where you left off."]

    research --> plan --> handoff
```

## Getting Started

Each prompt file is self-contained. For manual use, copy the one you need, paste it into your LLM conversation, and follow it with your actual request. No dependencies, no setup, no cloning required.

## Installing as a reusable skill

Some agents can load reusable skills from `~/.agents/skills`. For those tools, install Drift once:

```sh
mkdir -p ~/.agents/skills
git clone https://github.com/coylemichael/drift ~/.agents/skills/drift
```

Once installed, any agent that supports `~/.agents/skills` can load Drift from that location. The root `SKILL.md` acts as a router to `research.md`, `plan.md`, and `handoff.md`, so you manage one Drift skill directory instead of separate prompt installs.

For tools that use commands, rules, or prompt libraries instead, see the installation table below.

The model is intentionally split:

- The reusable Drift prompts live outside your target projects.
- Generated Drift artifacts live locally in each target project under feature folders such as `drift/auth-refactor/`.
- Each feature folder contains numbered artifact files such as `001-research-auth-flow.md`, `002-plan-implementation.md`, and `003-handoff-session-1.md`.
- This avoids cloning Drift into every project you work on.

### 1. Research — understanding the codebase

**Paste [research.md](research.md), then ask your question.**

Example prompts:

- *"How does the authentication flow work?"*
- *"What happens when a user submits an endorsement?"*
- *"Map out the data flow from API request to database write for policy creation."*

The agent documents what exists — no unsolicited suggestions, no refactoring advice. It will ask for a feature identifier (ticket ref or slug), allocate the next artifact number in that feature folder, and save findings as `drift/<feature>/NNN-research-<topic>.md`.

### 2. Planning — turning research into a plan

**In a new session, paste [plan.md](plan.md), then point it at your research.**

> *"Read drift/auth-refactor/001-research-auth-flow.md and create an implementation handoff."*

You get a concrete plan: which files to touch, in what order, with what constraints. The plan trusts the research — it won't re-read the codebase.

### 3. Continuing — picking up where you left off

Two actions, same prompt file.

**To snapshot the current session** — paste [handoff.md](handoff.md) into the running session:

> *"Write a handoff."*

**To resume in a new session** — paste [handoff.md](handoff.md) again, then point it at the snapshot:

> *"Read drift/auth-refactor/003-handoff-session-2.md and continue."*

Repeat until done. If the handoff chain exceeds three documents, summarize completed phases in the new handoff's `Status` section rather than asking the next session to read every prior link — the whole point of Drift is to keep context lean.

## When not to use Drift

Drift is overhead. It pays off when work spans sessions or touches code you don't fully hold in your head. Skip it for:

- **Trivial one-file changes** — typo fixes, dependency bumps, single-function tweaks
- **Throwaway scripts and prototypes** — anything you'd delete before merging
- **Exploratory spikes** — when you're still deciding whether to do the work at all
- **Work that fits comfortably in one session** — if you'll finish before context gets stale, the handoff is wasted effort

The research/plan/handoff loop earns its weight on multi-session work in unfamiliar code. Anything smaller, just do it.

### Where files are stored

All Drift artifacts live under feature folders at the root of your repository. A feature folder is a ticket reference or descriptive slug, such as `auth-refactor` or `PROJ-1234`. Each artifact is a numbered markdown file directly inside that folder; Drift does not split research, plans, and handoffs into separate subfolders for new artifacts.

```
drift/
  auth-refactor/
    001-research-auth-flow.md
    002-plan-implementation.md
    003-handoff-session-1.md
    004-handoff-session-2.md
    005-research-edge-cases.md
    006-plan-follow-up.md
  PROJ-1234/
    001-research-policy-flow.md
    002-plan-policy-flow.md
```

The agent will ask you to confirm a feature identifier before writing the first artifact, scan existing `NNN-*` markdown files in `drift/<feature>/`, and allocate the next number. Anything that uniquely identifies the feature or work grouping is fine.

New work for the same feature gets a new numbered artifact in that feature folder rather than modifying an older artifact. Distinct features should get separate feature folders. Drift does not maintain `INDEX.md`, `CURRENT.md`, or status directories; file-tree navigation comes from feature folders and numbered artifact filenames.

These are project artifacts — they travel with the repo, not with your editor or user profile. Drift ensures the repository-root `.gitignore` contains `/drift/` before writing artifacts by default.

### Where these work

These are plain markdown. Paste them into any agent or LLM — Zed, VS Code Copilot, Cursor, ChatGPT, Claude, Windsurf, or anything that accepts a system prompt. The YAML frontmatter at the top of each file is recognized by tools that support it and harmlessly ignored by those that don't.

### Installing as reusable commands or skills

Drift works pasted into any chat, and many tools support installing the prompts as reusable skills, slash commands, or rules:

| Tool | Location | Invocation |
|------|----------|------------|
| **Zed Agent** | `~/.agents/skills/drift` — clone the repo as-is so `SKILL.md` can route to `research.md`, `plan.md`, and `handoff.md` | Ask the agent to use the Drift skill |
| **VS Code Copilot Chat** | `.github/prompts/` — rename with the `.prompt.md` suffix (e.g. `research.md` → `.github/prompts/research.prompt.md`) | `/research`, `/plan`, `/handoff` |
| **Claude Code** | `.claude/commands/` — copy as-is (e.g. `research.md` → `.claude/commands/research.md`) | `/research`, `/plan`, `/handoff` |
| **Cursor** | `.cursor/rules/` — rename with the `.mdc` suffix (e.g. `research.md` → `.cursor/rules/research.mdc`) and adjust frontmatter to Cursor's `globs:` / `alwaysApply:` keys | Triggered by rule scope |
| **Anything else** | Paste the file contents directly into the chat | n/a |

The frontmatter is consumed by tools that understand it and ignored by those that don't — nothing breaks either way.