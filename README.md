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

**Workflow selection is self-healing on Pi.** The extension binds Drift's
model-facing skill entry and explicit `/skill:drift` requests to the workflow
shipped in the same package. An older standalone copy (for example under
`~/.agents/skills/drift`) cannot silently supply an outdated workflow. This is
reapplied on working prompts, including after reload, resume and compaction;
there is no repair command or settings edit to run. Old checkouts, local edits,
other skills and user settings are left untouched. Pi's discovery inventory may
still report the duplicate; the runtime uses the bundled workflow.

To retire an older copy, save any local edits it holds, then replace it with a
symlink to `skills/drift` in this checkout. The binding compares real paths, so
the symlinked entry counts as the bundled file and the notice stops, and any host
that reads that folder (Zed's native agent reads `~/.agents/skills`) follows the
current workflow:

```sh
ln -s ~/projects/drift/skills/drift ~/.agents/skills/drift
```

Explicitly disabled skill discovery stays disabled. If a required bundled
workflow file is missing or unreadable, Drift blocks inference rather than
falling back to another version, and retries on the next prompt after the file
is restored. This does not invent model mappings or credentials: profile routing
still uses your configuration below.

**Claude Code, including Zed's `claude-acp` agent** — the checkout carries a
`.claude-plugin/plugin.json`, so a folder under `~/.claude/skills/` that points
at it loads as the `drift` plugin on the next session with no install step:

```sh
ln -s ~/projects/drift ~/.claude/skills/drift
```

The skill is advertised as `drift:drift`. Remove the symlink to uninstall.
Claude namespaces everything a plugin provides, so `/drift` itself comes from a
personal command file. Copy `claude/commands/drift.md` from this checkout to
`~/.claude/commands/drift.md`; then `/drift`, `/drift <artifact>` and
`/drift <request>` behave as on Pi (pick up the newest artifact, a named one,
or run a Drift request), expanding to the `drift:drift` skill with your words.
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

`INDEX.md` is the repository-wide chronological timeline.

Each artifact's frontmatter also carries a `status` — `pending`, `in-progress`,
`complete` or `superseded` — so you can see which plans have run and which
handoffs are still live without opening files:

```sh
grep -r "^status:" drift/
```

Plans start `pending` and execution flips them to `in-progress`, then
`complete`; handoffs are written `in-progress` or `complete` and become
`superseded` when a later handoff resumes them; research is `complete` on write.
Flipping `status` is the one in-place edit Drift makes to an existing artifact.
It is not an index column, because index rows never change.

### Artifact Git policy (per repository)

Artifacts are ignored by default. To let handoffs travel between machines,
commit this **repository-root** `.drift.json` alongside the artifacts:

```json
{ "trackArtifacts": true }
```

This is host-neutral project data, not a Pi user setting or a per-tool argument.
The Pi publisher reads it on every publication; other hosts follow the same
choice through the portable skill. Missing config, `{}` or `false` keeps the
ignored default and adds `/drift/` to `.gitignore` if needed.

With `true`, Drift does not create or edit `.gitignore`, stage files, commit, or
push. Artifact and index paths must actually be unignored; resolve existing
rules explicitly. The flag is permission to publish trackable files, **not** an
automatic commit. Already-tracked artifacts or an `!/drift/` exception alone do
not select this mode. Invalid JSON, unknown fields, non-boolean values and unsafe
config paths fail rather than silently selecting a policy.

**On Pi, use `/drift-track-artifacts`** in the target repo's thread: `on`, `off`,
or `status` (no argument shows status). It is a Pi command, never
sent to a model. **On** writes the flag and removes the `/drift/` rule (and
`/drift`, `drift/`, `drift` variants) from `.gitignore`, keeping everything
else. **Off** writes `false` and adds `/drift/` back; files already committed
stay tracked until you run the `git rm -r --cached drift` it suggests. Either
way it then asks Git whether an index and an artifact path landed on the chosen
side; if another rule defeats the choice, both files are restored and the rule
is named. Nothing is staged or committed. In other hosts, make the same edits
and commit them.

**Many threads, one index.** A tracked index is committed, so two worktrees'
copies meet at every rebase. In a tracked repository with an `origin` remote,
Drift writes `drift/INDEX.md merge=drift-index` to `.gitattributes` at session
start (`/drift-track-artifacts on` writes it too) and installs the matching
driver in the clone
(`build-index.py --merge`): rows from both sides are unioned, reordered by
timestamp and renumbered, so the rebase never stops on the index. Without the
driver git falls back to its normal text merge; nothing else changes. In
tracked mode the next `NNN` also counts artifacts already landed on any
remote-tracking ref. Other hosts install the driver with one command:

```sh
git config merge.drift-index.name "Drift index row merge"
git config merge.drift-index.driver "python3 -I /path/to/drift/scripts/build-index.py --merge %O %A %B"
```

**Worktrees in private mode** share the main worktree's `drift/`: a linked
worktree holds no `drift/` of its own, publishes into the shared store, and
sees the whole history in `/drift`, so nothing is lost when the worktree is
removed. Tracked worktrees keep a folder each, because those artifacts travel
with the branch.

### Changelog from fragments (per repository)

Many agents editing one `[Unreleased]` section conflict on every rebase and lose
entries to "keep mine" resolutions. That can only happen where two copies of the
file can meet in git, so the trigger is a shared branch: in a repository with an
`origin` remote and a root `CHANGELOG.md`, Drift makes the changelog a generated
file at the first session start or publication, with no command. One fragment per
change goes in `changelog.d/`, named after the artifact so names never collide,
and the file is rebuilt between two marker comments at each publication and
session start, with the project's own text outside the markers preserved byte
for byte. A local-only repository has one writer and is left alone. Entries are grouped by the first
version tag whose tree contains the fragment (`v*` by default; configurable as
`changelog.tags` in `.drift.json`), so releases need no step of their own;
untagged entries are `[Unreleased]`, and a repository without version tags is
grouped by day. Adoption also writes `CHANGELOG.md merge=drift-changelog` to
`.gitattributes`; the matching driver, installed per clone at session start,
unions entries by id on rebase and three-way merges the hand-written parts.

`drift_publish` takes an optional `changelog: { section, text }` and writes the
fragment beside the artifact in the same transaction:

```
changelog.d/cards-pass-043-ledger-recut.md
---
date: "2026-10-09T16:29:21+01:00"
section: "Changed"
artifact: "drift/cards-pass/043-handoff-ledger-recut.md"
---
One Markdown bullet; further lines continue it. No blank lines.
```

A bullet edited in `CHANGELOG.md` that keeps its trailing id comment is written
back to its fragment. A line added to the generated region without an id is
reported with its line number and left alone; regeneration skips until it is
moved into a fragment or deleted. Drift does not guess at text it did not
write. A repository that already uses changesets or towncrier is left to its own
convention. `.drift.json` overrides the trigger: `"changelog": false` keeps a
shared repository's changelog hand-written, `true` (or `{ "tags": ... }`) forces
generation in a local one; `/drift-changelog on|off|status` sets or explains it.
`changelog.d/README.md` states the convention for anything else that reads the
repository. Nothing is staged or committed.

### Landing (per repository)

Drift already knows when a unit of work ends: the handoff that completes the
interval. With a one-time opt-in, that handoff lands itself:

```json
{ "land": { "auto": true, "check": "pytest -q" } }
{ "land": { "auto": true, "check": ["cargo fmt --check", "cargo test"] } }
```

The sequence is fetch; rebase onto origin's default branch (the index and
changelog drivers resolve their files); verify the derived files; the guard
(`git diff origin/<default> --name-only` may list only files the branch's own
commits touch, which is how a squash against a moved ref or a push from a stale
index reverts other threads' work); the repo's check commands, any shell
command run in order, stopping at the first failure, nothing assumed about the
toolchain and nothing run when unset; `git push origin HEAD:<default>`; redo
from the fetch when the tip moved, at most three times; a `land` checkpoint on
the record. Then the profiled continuation starts from landed `main`. It never
squashes, force-pushes or resets against a moving ref. The one thing it commits
is Drift's own publication output, which the handoff has just produced and which
holds nothing the agent decided: the artifact and index in a tracked repo, the
fragment and regenerated changelog, and Drift's own ignore and attribute lines,
in one `drift: publish <artifact>` commit. Any other uncommitted tracked change
is the agent's and stops the landing before anything happens.

A real conflict in a non-derived file, or the guard tripping, halts the chain:
the rebase is aborted, the branch is left as it was, the handoff stays
published, continuation is held, and the tool result says what blocked.
`/drift-land` is the same sequence as a manual command. Landings are
serialised across a repository's worktrees.

In Zed, Pi extension commands only appear in the `/` menu with an adapter that
advertises them; upstream `pi-acp` v0.0.33 does not, and also leaves a turn
open until a model run settles, so a command that never starts one spins.

After changing the extension code, reload Pi or open a new Pi adapter connection;
already-running extensions keep their loaded publisher. Config edits alone need
no reload. Review artifacts before committing: handoffs can contain private
project context even though they must not contain credentials.

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

## Picking up work: `/drift`

On Pi, `/drift` is the one entry point:

| You type | Drift does |
|---|---|
| `/drift` | Picks the newest artifact in `drift/INDEX.md`: resumes an `in-progress` handoff, executes a `pending` plan, plans from research. If it is already `complete`, it says so and asks rather than reopening it. |
| `/drift <link, path or file name>` | Picks up that artifact; anything else you write is passed on as your note. Zed `@` mentions and Windows paths work. |
| `/drift <anything else>` | An ordinary Drift request, like `/skill:drift`. |

The choice is made in code, not by the model, and is announced ("Drift: picking up …").
It keeps the current model; `drift-continue <handoff>` is the variant that switches
to the handoff's `next_session_profile`. In Zed, `/drift` appears in the `/` menu
as a Pi prompt command and needs no adapter patch. Other hosts follow the same
pick-up rule from `SKILL.md` when you ask to "pick up" without naming an artifact.

## What Pi automates

- A durable record keyed to Pi's real session ID and Git repository.
- `/drift`, which picks up the newest artifact (or the one you name) and
  routes it to the right workflow.
- A current `drift/INDEX.md` at session start: when the repo already holds
  artifacts (for example, written by Claude or Zed's native agent) and the
  index is missing or stale, it is rebuilt before the record's baseline is taken.
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
resume, and compaction. Stale-skill regressions cover automatic runtime binding,
explicit skill invocation, damaged-workflow recovery, disabled discovery, and a
three-handoff chain that stops at completion. Set `PI_TEST_ACP=/path/to/pi-acp/dist/index.js` to also
run the installed ACP checks.
