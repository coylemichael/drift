# Profile-directed continuation

Part of [Drift](../README.md). How a handoff's declared profile selects the
model for the next independent task.

A handoff may declare the next task's portable profile: `research`, `planning`,
or `implementation`. The model that performed the work writes its own handoff;
the profile selects the model for the **next** independent task, but only when
automatic continuation is on. Continuation has exactly two modes.

## Manual pickup (default)

With auto-continue off, publishing a handoff only records it, and nothing is
queued. You decide if and when the work continues, and in which thread: run
`/drift` to pick up the latest work, or `/drift <file name, path or link>` to
pick up that artifact. `/drift` always uses the model you have selected; it
never switches models or profiles, and it continues in whatever thread you run
it in.

## Automatic continuation

`/drift-auto-continue on` turns the automatic chain on for the repository,
recording `"autoContinue": true` in `.drift.json`; it is your toggle.
`/drift-auto-continue off` returns to the manual default, and the bare command
(or `status`) only reports.

When it is on, each handoff whose work remains starts a fresh context window
from the handoff alone. No summary
of the previous conversation and no retained transcript tail is carried: the
raw history stays in the Pi session file, it is just not sent to the model.
The next window runs on the model that the handoff's `next_session_profile`
maps to in your profile map (see [Model profiles](#model-profiles)), or on
the model in use when the handoff names no profile and no model is pinned, and
follows the handoff's Next Steps. Internally the chain uses a `drift-continue`
step that validates the handoff and selects the mapped model and thinking level
before any inference; it is not a command you type. Selecting first means no
other model has to read the handoff just to decide which model does the work.

`/drift-auto-continue on` and `/drift-auto-continue status` show which profile
file is used and list each profile as `name → provider/model (thinking)`. The
`drift_publish` result names the queued profile and model.

If a named profile is missing or invalid, the model is unavailable or
authentication fails, the automatic step stops visibly without inference and
leaves the published handoff intact. Run `/drift <handoff>` to pick it up on
the model you have selected.

### Pinning one model

`/drift-model-override <provider/model> [thinking]` (Tab completes from Pi's model
list), or `/drift-model-override current` for the model and thinking level you have
selected, records `"model"` and `"thinkingLevel"` in `.drift.json`. While pinned,
every open handoff continues on that model, whatever its
`next_session_profile`. `/drift-model-override off` restores profile routing;
the bare command reports the pin.

### Context threshold

Once the context passes 60% of the model's window Drift asks for the handoff
itself, whether or not auto-continue is on: it steers once with an explicit
message (finish the current step, then publish a handoff, naming the profile
that keeps the current model when one exists) and repeats the request in its
per-turn context until the handoff is published. With auto-continue on the
fresh window starts by itself; otherwise you pick it up with `/drift`. It re-arms when usage drops below the
threshold (a fresh window or compaction). Pi's own compaction remains the
backstop if no handoff is published.

### Where the chain stops

Automatic continuation stops when the plan's `## Acceptance Criteria` are met.
The agent then publishes the final handoff as `complete`. It also stops at a
step marked `Breakpoint:` and when it needs a decision from you. The agent then
publishes the handoff with `breakpoint: true`. That handoff stays open, Drift
queues nothing, and you pick it up with `/drift` after your review.

If the feature's newest plan has neither, Drift warns you once per plan in each
Pi session, when you publish the plan or when it queues a continuation for that
feature. The warning says you haven't set anything to work towards, so
auto-continue may never stop.

## Closed handoffs

Continuation is for open work only. Publishing a handoff with `status:
complete` records that its work is finished: the result says the handoff is
complete with no open work and nothing is queued — even when it declares a
`next_session_profile` and automatic continuation is on. The interval receipt
is unchanged, and retrying the same completed publication
stays unqueued.

The automatic step (the internal `drift-continue`) refuses a handoff whose
status is `complete` or `superseded` before resolving any profile or model, so
the current model is unchanged. A superseded refusal reports the recorded
`superseded_by` replacement (or that none is recorded, or that the reference
is invalid or missing) but never continues the replacement automatically; pick
that artifact up with `/drift <path>` if it is the right one. To revisit a
closed handoff, use `/drift <path>` and confirm reopening. Legacy handoffs with
no status still continue as before.

## Model profiles

Configure defaults at `~/.pi/agent/drift-model-profiles.json` (or Pi's configured
agent directory). A trusted project may override profiles by name at
`.pi/drift-model-profiles.json` (the launch project; see
[worktrees.md](worktrees.md)). Use Pi's **model IDs** from `pi --list-models`,
not picker labels such as `Claude Opus 5`.

The current GitHub Copilot starting policy is below; the models, including the
implementation model, are only examples — map each profile to any model you have:

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
