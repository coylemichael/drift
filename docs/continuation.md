# Profile-directed continuation

Part of [Drift](../README.md). How a handoff's declared profile selects the
model for the next independent task.

A handoff may declare the next task's portable profile: `research`, `planning`,
or `implementation`. The model that performed the work writes its own handoff;
the profile selects the model for the **next** independent task.

By default the chain stops at publication: the profiled handoff is recorded —
and still lands itself where `land.auto` is set (see [landing.md](landing.md)) —
nothing is queued, and the
tool result names the `drift-continue` command; you decide if and when the
work continues, and in which thread.

`/drift-auto-continue on` opts a repository in, recording `"autoContinue":
true` in `.drift.json`. Then, after publishing a profiled handoff, Drift
automatically compacts to a fresh context window. It then validates the
repository-local handoff, resolves its profile through the local model map,
selects the model and optional thinking level, and continues the recorded
work. Each profiled handoff therefore starts the next independent task with
minimal durable context rather than the old transcript. `/drift-auto-continue
off` returns to the manual default; the bare command reports status.

If automatic continuation cannot validate the artifact/profile/model, it leaves
the published handoff intact and reports the error. Recover manually in a fresh
Pi thread with `drift-continue drift/<feature>/<NNN>-handoff-<description>.md`.

## Closed handoffs

Continuation is for open work only. Publishing a handoff with `status:
complete` records that its work is finished: the result says the handoff is
complete with no open work, nothing is queued, and no `drift-continue` command
is proposed — even when it declares a `next_session_profile` and automatic
continuation is on. Landing and the interval receipt are unchanged, and
retrying the same completed publication stays unqueued.

`drift-continue` refuses a handoff whose status is `complete` or `superseded`
before resolving any profile or model, so the current model is unchanged. A
superseded refusal reports the recorded `superseded_by` replacement (or that
none is recorded, or that the reference is invalid or missing) but never
continues the replacement automatically; continue that artifact explicitly if
it is the right one. To revisit a closed handoff, use `/drift <path>` and
confirm reopening. Legacy handoffs with no status still continue as before.

## Model profiles

Configure defaults at `~/.pi/agent/drift-model-profiles.json` (or Pi's configured
agent directory). A trusted project may override profiles at
`.pi/drift-model-profiles.json` (the launch project; see
[worktrees.md](worktrees.md)). Use Pi's **model IDs** from `pi --list-models`,
not picker labels such as `Claude Opus 5`.

The current GitHub Copilot starting policy is:

```json
{
  "profiles": {
    "research": { "provider": "github-copilot", "model": "gemini-3.8-flash", "thinkingLevel": "medium" },
    "planning": { "provider": "github-copilot", "model": "gpt-6-astra", "thinkingLevel": "high" },
    "implementation": { "provider": "github-copilot", "model": "claude-opus-5", "thinkingLevel": "high" }
  }
}
```

Profile files allow only `provider`, `model`, and optional `thinkingLevel`
(`off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`). Keep credentials
out of them.
