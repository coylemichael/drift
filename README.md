# Context Engineering Prompts

A lightweight system for maintaining context continuity across LLM sessions.

## The Problem

Most LLM-assisted work breaks down not because the model can't do the task, but because context gets stale or bloated mid-session. You lose track of what was investigated, what was decided, and where work stopped. Starting a new chat means starting from scratch — or spending half the session re-explaining what happened last time.

## The Solution

Three prompt files that create natural checkpoints across your workflow. Each session starts clean but informed, carrying forward only what the next session actually needs.

### Workflow

```
research-codebase.md          Investigate. Document what exists.
        │
        ▼
from-research.md               Plan. Turn findings into an actionable starting point.
        │
        ▼
mid-work-handover.md           Continue. Snapshot state so the next session picks up where you left off.
                                (Repeat as needed until work is complete.)
```

### The Files

| File | When to use | What it produces |
|---|---|---|
| `research-codebase.md` | Starting a new question or investigation | A research doc saved to `research/` |
| `from-research.md` | After research is done, before implementation begins | A handoff doc saved to `.handoffs/` |
| `mid-work-handover.md` | When stopping mid-implementation or refreshing context | A continuation doc saved to `.handoffs/` |

## How to Use

1. **Start a new session** with the appropriate prompt — paste it in or attach it as context.
2. **Give it the task** — a question for research, a research doc for planning, or a previous handoff for continuation.
3. **When done**, the prompt instructs the LLM to save its output to disk in a standardized format with file references and git metadata.
4. **Next session**, feed the output from the last session into the next prompt.

These are plain markdown files. They work in any LLM tool — VS Code Copilot, Cursor, ChatGPT, Claude, or anything that accepts a system/user prompt. The YAML frontmatter is recognized by tools that support it and ignored by those that don't.

## Design Principles

- **Document what IS, not what SHOULD BE.** Every prompt constrains the LLM to describe reality, not editorialize. Research documents the codebase as it exists. Handoffs document the implementation as it stands — including broken or incomplete state.
- **File references over prose.** `src/db/schema.py:84` beats "the schema file." Every output format emphasizes concrete `file:line` references so the next session can navigate directly to what matters.
- **Don't re-investigate.** Each session trusts the previous session's output. The planning prompt doesn't re-read the codebase. The continuation prompt doesn't re-derive the plan. This keeps sessions focused and prevents context waste.
- **Carry forward open questions.** Unresolved questions never get silently dropped between sessions. Every handoff format includes an explicit Open Questions section.
- **Small and verifiable steps.** Implementation sequences are broken into tasks small enough to confirm independently before moving on.
