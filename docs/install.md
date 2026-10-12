# Installing Drift

Part of [Drift](../README.md). The quick version is in the README; this page
carries the full per-host detail.

Drift is one portable skill plus optional host automation. Clone it once; every
host reads the same checkout. Git and Python 3.7+ are required everywhere.

```sh
git clone https://github.com/coylemichael/drift ~/projects/drift
```

## Pi

Pi 0.85.1+ and Node 22.18+. The extension owns session records and artifact
publication:

```sh
pi install ~/projects/drift
```

Restart Pi or open a fresh Pi ACP thread after installation (and after updating
the checkout: a running extension keeps the tools it loaded, so a new tool such
as `drift_worktree` appears only after `/reload` or a new connection). Remove the package
with `pi remove ~/projects/drift`; this does not remove the checkout, artifacts,
or session records.

**Keep Pi current where you can.** Drift is developed and tested against the Pi
version pinned in `package-lock.json` (1.1.0 today). Releases from 0.85.1 still
pass the suite, but Pi's queued-input and skill handling has changed between
releases, so an old Pi is the first thing to rule out when something misbehaves.
For an npm-global Pi: `npm install -g @earendil-works/pi-coding-agent@latest`,
then `/reload` or a fresh session; `pi --version` shows what is running.

After changing the extension code, reload Pi or open a new Pi adapter connection;
already-running extensions keep their loaded publisher. Config edits alone need
no reload.

### Workflow selection is self-healing on Pi

The extension binds Drift's model-facing skill entry and explicit `/skill:drift`
requests to the workflow shipped in the same package. An older standalone copy
(for example under `~/.agents/skills/drift`) cannot silently supply an outdated
workflow. This is reapplied on working prompts, including after reload, resume
and compaction; there is no repair command or settings edit to run. Old
checkouts, local edits, other skills and user settings are left untouched. Pi's
discovery inventory may still report the duplicate; the runtime uses the
bundled workflow.

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
still uses your configuration in [continuation.md](continuation.md).

## Claude Code, including Zed's `claude-acp` agent

The checkout carries a `.claude-plugin/plugin.json`, so a folder under
`~/.claude/skills/` that points at it loads as the `drift` plugin on the next
session with no install step:

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
portable manual procedure, and the profiled continuation chain described in
[continuation.md](continuation.md) is Pi-only until the Claude worker agents
and hooks land.

## Zed notes

In Zed, Pi extension commands only appear in the `/` menu with an adapter that
advertises them; upstream `pi-acp` v0.0.33 does not, and also leaves a turn
open until a model run settles, so a command that never starts one spins.
`/drift` itself appears in the `/` menu as a Pi prompt command and needs no
adapter patch.

## Naming

`skills/drift/` in this checkout is the skill; `drift/` inside a target
repository holds that repository's artifacts.
