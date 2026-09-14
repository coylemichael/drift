<p align="center">
  <img src="assets/drift-logo.svg" alt="Drift" width="400"/>
</p>

<h3 align="center"><em>Context drifts if you don't pin it down</em></h3>

Drift preserves the useful state of multi-session coding work: research,
decisions, changes, and the next task. Its portable skill guides the workflow;
the Pi extension owns session metadata and artifact publication.

## Install

Drift is one portable skill plus optional host automation. Clone it once; every
host reads the same checkout. Git and Python 3.7+ are required everywhere.

```sh
git clone https://github.com/coylemichael/drift ~/projects/drift
```

**Pi** (0.85.1+, Node 22.18+) — owns session records and artifact publication:

```sh
pi install ~/projects/drift
```

Restart Pi or open a fresh Pi ACP thread after installation. Remove the package
with `pi remove ~/projects/drift`; this does not remove the checkout, artifacts,
or session records.

**Claude Code, including Zed's `claude-acp` agent** — the checkout carries a
`.claude-plugin/plugin.json`, so a folder under `~/.claude/skills/` that points
at it loads as the `drift` plugin on the next session with no install step:

```sh
ln -s ~/projects/drift ~/.claude/skills/drift
```

The skill is advertised as `drift:drift`. Remove the symlink to uninstall.
On this host Drift is currently the skill alone: artifacts are written by the
portable manual procedure, and the profiled continuation chain described
below is Pi-only until the Claude worker agents and hooks land.

Naming: `skills/drift/` in this checkout is the skill; `drift/` inside a target
repository holds that repository's artifacts.

## Workflow

| Mode | Use |
|---|---|
| Research | `skills/drift/research.md` — document what exists. |
| Plan | `skills/drift/plan.md` — turn research into a verifiable sequence. |
| Execute | `skills/drift/execute.md` — carry out a plan or handoff. |
| Handoff | `skills/drift/handoff.md` — record current state for the next task. |

Ask for the appropriate Drift workflow in ordinary language. Artifacts are kept
in the target repository, not the skill checkout:

```text
drift/
  INDEX.md
  auth-refactor/
    001-research-auth-flow.md
    002-plan-implementation.md
    003-handoff-progress.md
```

`INDEX.md` is the repository-wide chronological timeline. New artifacts are
ignored by `/drift/` by default; explicitly track them if the project requires it.

## Profile-directed continuation

A handoff may declare the next task's portable profile: `research`, `planning`,
or `implementation`. The model that performed the work writes its own handoff;
the profile selects the model for the **next** independent task.

After publishing a profiled handoff, Drift automatically compacts to a fresh
context window. It then validates the repository-local handoff, resolves its
profile through the local model map, selects the model and optional thinking
level, and continues the recorded work. Each profiled handoff therefore starts
the next independent task with minimal durable context rather than the old transcript.

If automatic continuation cannot validate the artifact/profile/model, it leaves
the published handoff intact and reports the error. Recover manually in a fresh
Pi thread with `drift-continue drift/<feature>/<NNN>-handoff-<description>.md`.

Configure defaults at `~/.pi/agent/drift-model-profiles.json` (or Pi's configured
agent directory). A trusted project may override profiles at
`.pi/drift-model-profiles.json`. Use Pi's **model IDs** from `pi --list-models`,
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

## User decision checkpoints

Drift asks and waits when work reveals a genuine requirement ambiguity, material
plan/scope deviation, public-contract or data-model change, security/destructive
risk, external integration/cost, priority change, or reversal of an accepted
decision. It gives the evidence, bounded options, and one clear question.

Routine implementation choices remain with the agent and are recorded in the
artifact. A pending user decision never triggers a profiled automatic handoff.

## What Pi automates

- A durable record keyed to Pi's real session ID and Git repository.
- Measured start metadata and dirty-file fingerprints that survive reload,
  resume, and compaction.
- Bounded Drift context on normal model requests and checkpoints after settled
  turns or graceful teardown.
- `drift_publish`, which validates artifact paths, writes measured frontmatter,
  allocates numbers, rebuilds the index, and retains retryable receipts.

A published handoff completes only its current work interval. Pi conversation
logs and session records are never deleted by Drift. The extension is inactive
outside Git; the skill remains usable manually in other agents.

## Development

```sh
npm test
python3 scripts/build-index.py /path/to/project/drift --check
git diff --check
```

`npm test` uses temporary repositories and loopback model fixtures. It covers
record/publication safety and actual Pi RPC lifecycle, model selection, reload,
resume, and compaction. Set `PI_TEST_ACP=/path/to/pi-acp/dist/index.js` to also
run the installed ACP checks.
