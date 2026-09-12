<p align="center">
  <img src="assets/drift-logo.svg" alt="Drift" width="400"/>
</p>

<h3 align="center"><em>Context drifts if you don't pin it down</em></h3>

Drift preserves useful context across long-running coding sessions: what was
investigated, what was decided, what changed, and what to do next.

**Portable skills. Pi-focused automation.** The prompts guide judgement; a small
Pi extension handles session metadata and artifact publication. No separate agent
runtime, background service or multi-agent installer.

## Install in Pi

Requires Pi (tested with 0.85.1), Node 22.18+, Git and Python 3.7+ for the index
renderer. The extension uses Node built-ins and packages already supplied by Pi;
there is no build step or additional runtime dependency installation.

```sh
git clone https://github.com/coylemichael/drift ~/projects/drift
pi install ~/projects/drift
```

Pi links the local package through its own settings without copying the checkout.
Restart Pi or start a fresh **Pi ACP** thread in Zed. Keep your existing provider
and authentication. The package loads both the extension and the root `SKILL.md`;
an existing shared skill link need not be removed. First activation in an older
session measures a new interval; it cannot reconstruct the pre-install baseline.

Remove this package with `pi remove ~/projects/drift`. This removes the package
registration, not your checkout, project artifacts or saved records. If you also
have a separate skill link, manage that separately.

## Use the same workflow

[`SKILL.md`](SKILL.md) routes to four portable prompts:

| Mode | File | Example request |
|---|---|---|
| Research | [research.md](research.md) | “Use Drift to research the auth flow. Feature: auth-refactor.” |
| Plan | [plan.md](plan.md) | “Plan the implementation from that research.” |
| Execute | [execute.md](execute.md) | “Execute this plan, verifying each step.” |
| Handoff/resume | [handoff.md](handoff.md) | “Write a handoff” / `drift-continue drift/auth-refactor/003-handoff-progress.md` in a fresh Pi thread. |

Skip the formal workflow for trivial work that comfortably fits one session.
Delegation in execute mode depends on the host's available tools; Drift does not
install a sub-agent runtime.

Artifacts stay in the **target project**, not the skill checkout or an editor's
private memory:

```text
drift/
  INDEX.md
  auth-refactor/
    001-research-auth-flow.md
    002-plan-implementation.md
    003-handoff-progress.md
```

Each feature has its own sequence. `INDEX.md` is the cross-feature timeline,
sorted by real timestamps including timezone offsets. Artifacts are ignored via
`/drift/` by default; explicitly track them yourself if they should be shared.

## What Pi automates

- Opens an immediately persisted record before work, keyed by the actual Pi
  session ID and canonical Git repository. Records live under
  `~/.pi/agent/drift/<repo-hash>/<session-id>.json` (respecting Pi's agent-directory override).
- Captures a real local-offset timestamp, branch, commit and dirty-file content
  fingerprints; retains the baseline across turns, reload and resume.
- Injects bounded current metadata and recent artifact pointers into ordinary
  model requests, including after compaction. Detailed context stays in artifacts.
- Checkpoints observed changes on settled turns and graceful teardown. Detaching
  an ACP process is not treated as permanent completion.
- Provides **`drift_publish`**: the model supplies feature/kind/slug, Markdown body
  and optional references; code supplies metadata, numbering, safe paths, the
  canonical index and a retryable publication receipt.

A published **handoff** completes the current work interval. Its receipt remains;
Pi session logs are never deleted. The next model-run prompt starts a new measured
interval (there is no language-based guess about whether a message is "substantive").
Research and plan artifacts leave the interval active.

The skill handles the content; the publisher validates mechanics, not prose
accuracy. You still request a handoff. `drift_publish` remains usable through the
existing `pi-acp` adapter; profile-directed resume is a Pi extension command.

### Profile-directed handoff continuation

A new handoff may declare a portable `next_session_profile`: use `research`,
`planning`, or `implementation` for the three standard Drift work modes. It
deliberately contains no provider/model selection. After a successful profiled publication, start
a fresh Pi thread and paste the path returned by the tool:

```text
drift-continue drift/<feature>/<NNN>-handoff-<description>.md
```

Before sending a resume prompt to any model, the command validates that the argument
is a repository-local current-format handoff, reads its profile, resolves it through
an explicit local profile map, selects the mapped model, and applies its optional
thinking level. It does not silently choose a fallback: an absent profile, malformed
artifact/configuration, unavailable model, or failed authentication is reported
without inference. Handoffs created before this feature can still be resumed by the
ordinary manual workflow.

Configure global defaults in `~/.pi/agent/drift-model-profiles.json` (or Pi's
configured agent directory), and optionally override named profiles in the trusted
project at `.pi/drift-model-profiles.json`:

```json
{
  "profiles": {
    "research": {
      "provider": "your-provider",
      "model": "your-fast-research-model",
      "thinkingLevel": "medium"
    },
    "planning": {
      "provider": "your-provider",
      "model": "your-planning-model",
      "thinkingLevel": "high"
    },
    "implementation": {
      "provider": "your-provider",
      "model": "your-coding-model",
      "thinkingLevel": "high"
    }
  }
}
```

Profile names must be lowercase hyphenated. Each entry permits only `provider`,
`model`, and optional `thinkingLevel` (`off`, `minimal`, `low`, `medium`, `high`,
`xhigh`, or `max`). Set `model` to Pi's catalog **model ID** (for example
`claude-opus-5`), not its human-readable picker label (for example `Claude Opus 5`);
run `pi --list-models` to see IDs. Global profiles are defaults; a trusted project can override a
profile with the same name. Configure the referenced providers/models through Pi
normally. The profile map is intentionally local and should not be committed with
credentials.

For the current GitHub Copilot model set, the recommended three-profile starting
point is:

```json
{
  "profiles": {
    "research": { "provider": "github-copilot", "model": "gemini-3.8-flash", "thinkingLevel": "medium" },
    "planning": { "provider": "github-copilot", "model": "gpt-6-astra", "thinkingLevel": "high" },
    "implementation": { "provider": "github-copilot", "model": "claude-opus-5", "thinkingLevel": "high" }
  }
}
```

This is a starting policy, not a claim that one benchmark predicts every repository.
Keep the model that did the work on its handoff; the handoff profile selects the
model for the next independent research, planning, or implementation task.

### Boundaries and recovery

- No guessing among nested repos: outside Git, automation is explicitly inactive.
- Git deltas observe shared-worktree changes, not exclusive authorship. Unreadable
  files have explicitly marked metadata-only fingerprints.
- A loaded extension handles known initialization failures by stopping the prompt
  and blocking tools. This is not a sandbox or a guarantee if the extension is
  disabled/fails to load; Pi otherwise catches many extension errors and continues.
- Context is reinjected after compaction; Drift does not replace Pi's summarizer
  or claim injection into the separate summary request.
- Abrupt termination retains the last durable record, not necessarily the last
  file change. Records are not automatically reaped or turned into prose handoffs.
- Optional reference paths may be omitted or blank; non-empty references must
  name existing `drift/...md` artifacts. Correct invalid arguments before retrying.
  Once a pending publication exists, retry **the same tool input**. Within the same
  work interval, intent/receipts prevent premature completion or duplicate artifacts.
  Conflicting partial files or stale locks require explicit inspection; never
  delete another running thread's lock/record. Individual writes are atomic, not
  a multi-file filesystem transaction.
- The publisher rebuilds the index with the shared renderer. Existing artifact
  contents remain untouched; index boilerplate is normalized. Manual index checks
  are byte-canonical, so different prose can fail `--check` even with correct rows.

Set `DRIFT_PYTHON` to a Python executable path if `python3` is not available.

## Other agents: skill only

Place or link this checkout in your agent's skill directory, or have it read
`SKILL.md` and the referenced workflow files from disk. The prompts retain manual
artifact-writing instructions. Without a measured session baseline, omit
`session_started`; never invent it.

Drift no longer installs Claude/Copilot hooks or native-Zed personal instructions.
When upgrading an older installation, remove its **Drift-owned** hook entries and
marked `<!-- drift:start -->` block before removing the old scripts. Preserve
unrelated settings, skill links, historical records and agent installations.

## Development and checks

```sh
npm test
python3 scripts/build-index.py /path/to/project/drift --check
git diff --check
```

Tests use disposable repositories/homes and a loopback model stub. They cover
record identity/fingerprints, publication failures/concurrency, actual Pi RPC
lifecycle, reload/resume/compaction and the publisher. Missing Pi is reported as a
skip; `PI_TEST_BINARY=/absolute/path/to/pi` selects it explicitly.

To additionally exercise the installed ACP adapter, without downloading one:

```sh
PI_TEST_ACP=/path/to/pi-acp/dist/index.js npm test
```

These are runtime/mechanics checks, not Zed UI automation or proof of model-written
handoff quality. Use ordinary work to judge the latter. Local package edits are
live after restart/reload; preserve pending work before switching versions.
