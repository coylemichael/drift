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
research-codebase.md       Investigate. Document what exists.
        │
        ▼
from-research.md           Plan. Turn findings into an actionable starting point.
        │
        ▼
mid-work-handover.md       Continue. Snapshot so the next session picks up where you left off.
```

## Getting Started

Each prompt file is self-contained. Copy the one you need, paste it into your LLM conversation, and follow it with your actual request. No dependencies, no setup, no cloning required.

### 1. Research — understanding the codebase

Copy [research-codebase.md](research-codebase.md) into a new LLM session, then ask your question:

> *"How does the authentication flow work?"*
> *"What happens when a user submits an endorsement?"*
> *"Map out the data flow from API request to database write for policy creation."*

The prompt constrains the agent to document what exists — no unsolicited suggestions, no refactoring advice. If running locally the findings will be written to `research/`.

### 2. Planning — turning research into a plan

Once you have a research document, open a **new session**. Copy [from-research.md](from-research.md) into it, then point it at your research:

> *"Read research/2026-03-30-auth-flow.md and create an implementation handoff."*

This produces a concrete plan: which files to touch, in what order, with what constraints. It trusts the research — it won't re-read the entire codebase.

### 3. Continuing — picking up where you left off

When a session runs long or you need to refresh context, copy [mid-work-handover.md](mid-work-handover.md) into the current session:

> *"Write a mid-work handoff."*

Then start a **new session**, paste the same prompt, and point it at the handoff document to continue:

> *"Read .handoffs/auth-refactor/2026-03-30_14-30-00_auth-refactor_session-2.md and continue."*

Repeat as many times as needed until the work is complete.

### Where these work

These are plain markdown. Paste them into any agent or LLM — VS Code Copilot, Cursor, ChatGPT, Claude, Windsurf, or anything that accepts a system prompt. The YAML frontmatter at the top of each file is recognized by tools that support it and harmlessly ignored by those that don't.