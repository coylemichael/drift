---
name: execute
description: Use when picking up a plan or handoff to implement — orchestrates the step sequence, delegating self-contained steps to sub-agents, and writes a handoff at the end
---

# Execute

You are the **orchestrator** of an implementation session driven by an existing Drift plan or handoff. Your job is to run the step sequence, delegate self-contained work to sub-agents, verify results, and produce a handoff when the sequence is complete or you need to stop.

## Core Constraint

**Trust the plan or handoff.** Do not re-research the codebase, re-order steps, or expand scope. If the plan is wrong, note the deviation and adapt — do not rewrite the plan.

**Stay at orchestrator altitude.** Prefer delegating step work to sub-agents so your context stays lean for the final handoff. Do the work directly only when delegation is clearly worse (see heuristics below).

## Before Executing

- Identify the **feature** from the source path (`drift/<feature>/NNN-plan-...`, `drift/<feature>/NNN-handoff-...`, or a legacy path such as `drift/<feature>/handoffs/...`). All new artifacts for this feature live directly inside that `<feature>` folder.
- Read the plan or handoff you were pointed at.
- Read the source research document it references.
- If the input is a handoff, also skim the previous handoff (if any) — most recent is enough; do not walk the whole chain.
- Skim the tail of `drift/INDEX.md` for artifacts written after the plan or handoff you are executing. Work in another feature may have moved the ground under this plan; if it looks like it has, note it and adapt rather than halting.
- Skim the Key Files it lists to confirm they still match what's described. If a file has changed significantly, note it and adapt — do not halt.
- Build a **step queue** from the input:
  - From a plan artifact (`NNN-plan-...`) → the Implementation Sequence
  - From a handoff artifact (`NNN-handoff-...` or legacy) → the Next Steps

## Delegation Heuristics

For each step in the queue, decide: delegate to a sub-agent, or do it directly?

**Delegate when:**
- The step has a bounded scope (specific files, clear goal, clear verification).
- The step involves non-trivial reads, searches, or multi-file edits that would bloat your context.
- Multiple queued steps have **disjoint write scopes** and can run in parallel.

**Do it directly when:**
- The step is a one-or-two-tool edit (small config change, single-line fix).
- The step is tightly coupled to state you just changed and needs live iteration (debugging a failure, tweaking until a test passes).
- The step is a verification action (running tests, builds, linters) — you need the raw output to decide the next move.
- The step needs a clarifying question you can only ask the user.

**Never:**
- Delegate a step whose scope you can't clearly describe. If you can't write a self-contained prompt for it, the step needs to be broken down first — flag it in Open Questions and either split it yourself or defer.
- Delegate multiple steps in parallel if they touch the same files.
- Ask a sub-agent to write a Drift handoff or touch `drift/INDEX.md`. Both are the orchestrator's job; sub-agents return step-level summaries only.

## Sub-Agent Prompt Skeleton

When delegating, give the sub-agent everything it needs in one message. Adapt this skeleton:

```text
Task: [Step N from the plan/handoff — one line]

Source context (read for background):
- drift/<feature>/NNN-plan-<description>.md — the plan driving this work
- drift/<feature>/NNN-research-<topic>.md — the source research
  (or the legacy path the orchestrator was pointed at, e.g. drift/<feature>/handoffs/<file>.md)

Key files (read before editing):
- path/to/file.ext:lines — what it does / why it matters
- path/to/other.ext — ...

Do:
- [Specific action described in the step]

Verify:
- [How to confirm it worked — build passes, tests pass, specific behavior]

Return in your final message:
- Files changed (path:line references)
- What you did in 2-4 sentences
- Any deviations from the plan and why
- Any discoveries the orchestrator should know for later steps
- Do NOT write a Drift handoff — that's the orchestrator's job
```

For parallel delegation, spawn each sub-agent with its own scoped prompt in the same batch, and confirm write scopes don't overlap before dispatching.

## Running the Queue

1. Pick the next step (or a parallel batch of disjoint steps).
2. Decide delegate vs. direct using the heuristics above.
3. Execute — dispatch the sub-agent(s) or do the work yourself.
4. Verify the step landed (build/test/lint/read the file — whichever is appropriate).
5. Record the outcome in your working notes: what changed, deviations, new discoveries.
6. If verification fails: try one or two focused fixes yourself. If still failing, stop and either surface to the user or write a handoff describing the blocker.
7. Move to the next step.

Keep the working notes structured so the final handoff writes itself. Track at minimum:

- Completed steps (with file:line refs to changes)
- In-progress step and where you stopped
- Not-started steps
- Deviations from the plan
- New codebase context discovered during the run
- Open questions

## When to Stop and Hand Off

Write a handoff (following `handoff.md`) when any of the following is true:

- The step sequence is complete.
- Your context is filling up and further work risks losing continuity — stop **before** you lose the ability to write a clean handoff.
- You hit a blocker requiring user input or a design decision beyond the plan's scope.
- The plan turned out to be materially wrong and needs re-planning (write the handoff, then the next session can revisit `plan.md`).

Do not push past a stopping point just to finish "one more step." A clean handoff is more valuable than a partially-broken extra step.

## Writing the Final Handoff

Follow `handoff.md` for format, path allocation (`NNN-handoff-<description>.md`), frontmatter (including `feature`, `sequence`, `related_artifacts`), gitignore rules, and appending the new artifact to `drift/INDEX.md`. Writing the index row is the orchestrator's job, like the handoff itself — do not delegate it, and do not let a sub-agent write one. The orchestrator's working notes should map directly onto handoff sections:

- Completed / In progress / Not started → **Status**
- Files changed across all steps (including sub-agent reports) → **What Changed**
- New codebase discoveries → **Codebase Context**
- Deviations recorded during the run → **What Deviated from Plan**
- Blockers, unresolved questions → **Open Questions**
- Where the next session should resume → **Next Steps**

Reference the plan or prior handoff you executed against as `previous_handoff` in the frontmatter. Include any related artifacts (source research, prior plans) under `related_artifacts`. If the input was a legacy subfolder path, still write the new handoff as the next flat numbered file in `drift/<feature>/` unless the user explicitly asks to preserve the legacy chain.

## Guidelines

- **Orchestrator altitude.** If you find yourself deep in file reads and edits for a delegatable step, you've dropped altitude — reconsider whether the step should have been delegated.
- **One source of truth for scope.** The plan/handoff defines the work. Don't invent extra steps, don't skip steps without noting it.
- **Verify each step.** A completed step that wasn't verified is an in-progress step.
- **File refs over prose in working notes.** `src/db/schema.py:84` beats "the schema file."
- **Fail loudly, not quietly.** If a sub-agent reports a deviation or a failure, surface it in the handoff — don't paper over it.
- **Don't re-plan mid-run.** If the plan is wrong, finish or stop cleanly and let the next session re-plan.
