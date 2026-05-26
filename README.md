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

```
research.md       Investigate. Document what exists.
        │
        ▼
plan.md           Plan. Turn findings into an actionable starting point.
        │
        ▼
handoff.md        Continue. Snapshot so the next session picks up where you left off.
```

## Getting Started

Each prompt file is self-contained. Copy the one you need, paste it into your LLM conversation, and follow it with your actual request. No dependencies, no setup, no cloning required.

### 1. Research — understanding the codebase

Copy [research.md](research.md) into a new LLM session, then ask your question:

> *"How does the authentication flow work?"*
> *"What happens when a user submits an endorsement?"*
> *"Map out the data flow from API request to database write for policy creation."*

The prompt constrains the agent to document what exists — no unsolicited suggestions, no refactoring advice. The agent will ask you to confirm a feature identifier (ticket ref or descriptive slug) and write findings to `drift/<feature>/research/`.

### 2. Planning — turning research into a plan

Once you have a research document, open a **new session**. Copy [plan.md](plan.md) into it, then point it at your research:

> *"Read drift/auth-refactor/research/2026-03-30-auth-flow.md and create an implementation handoff."*

This produces a concrete plan: which files to touch, in what order, with what constraints. It trusts the research — it won't re-read the entire codebase.

### 3. Continuing — picking up where you left off

When a session runs long or you need to refresh context, copy [handoff.md](handoff.md) into the current session:

> *"Write a handoff."*

Then start a **new session**, paste the same prompt, and point it at the handoff document to continue:

> *"Read drift/auth-refactor/handoffs/2026-03-30_14-30-00_session-2.md and continue."*

Repeat as many times as needed until the work is complete.

If the handoff chain grows past three documents, summarize the completed phases in the new handoff's `Status` section rather than asking the next session to read every prior link. The whole point of Drift is to keep context lean — apply that to the handoffs themselves.

## When not to use Drift

Drift is overhead. It pays off when work spans sessions or touches code you don't fully hold in your head. Skip it for:

- **Trivial one-file changes** — typo fixes, dependency bumps, single-function tweaks
- **Throwaway scripts and prototypes** — anything you'd delete before merging
- **Exploratory spikes** — when you're still deciding whether to do the work at all
- **Work that fits comfortably in one session** — if you'll finish before context gets stale, the handoff is wasted effort

The research/plan/handoff loop earns its weight on multi-session work in unfamiliar code. Anything smaller, just do it.

### Where files are stored

All Drift artifacts live under `drift/<feature>/` at the root of your repository, where `<feature>` is a ticket reference (e.g., `PROJ-1234`) or a descriptive slug (e.g., `auth-refactor`). Each feature folder contains a `research/` subfolder and a `handoffs/` subfolder.

```
drift/
  auth-refactor/
    research/
      2026-03-30-auth-flow.md
    handoffs/
      2026-03-30_14-30-00_session-1.md
      2026-03-30_18-45-00_session-2.md
  PROJ-1234/
    research/
      ...
    handoffs/
      ...
```

The agent will ask you to confirm a feature identifier before writing the first artifact. Anything that uniquely identifies the work is fine.

These are project artifacts — they travel with the repo, not with your editor or user profile. Whether you commit them is up to you; add `drift/` to `.gitignore` if you prefer to keep them local.

### Where these work

These are plain markdown. Paste them into any agent or LLM — VS Code Copilot, Cursor, ChatGPT, Claude, Windsurf, or anything that accepts a system prompt. The YAML frontmatter at the top of each file is recognized by tools that support it and harmlessly ignored by those that don't.

### Installing as slash commands

Drift works pasted into any chat, but most tools support installing the prompts as reusable slash commands. Copy the three `.md` files into your tool's command directory:

| Tool | Location | Invocation |
|------|----------|------------|
| **VS Code Copilot Chat** | `.github/prompts/` — rename with the `.prompt.md` suffix (e.g. `research.md` → `.github/prompts/research.prompt.md`) | `/research`, `/plan`, `/handoff` |
| **Claude Code** | `.claude/commands/` — copy as-is (e.g. `research.md` → `.claude/commands/research.md`) | `/research`, `/plan`, `/handoff` |
| **Cursor** | `.cursor/rules/` — rename with the `.mdc` suffix (e.g. `research.md` → `.cursor/rules/research.mdc`) and adjust frontmatter to Cursor's `globs:` / `alwaysApply:` keys | Triggered by rule scope |
| **Anything else** | Paste the file contents directly into the chat | n/a |

The frontmatter is consumed by tools that understand it and ignored by those that don't — nothing breaks either way.