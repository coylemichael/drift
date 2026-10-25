---
date: "2026-10-25T15:13:01+00:00"
branch: "main"
git_commit: "ead875c7a95ed6e7f82b977cf205fda5eef15814"
feature: "shared-files"
sequence: "009"
type: "handoff"
status: "complete"
session_started: "2026-10-25T12:35:05+00:00"
session_id: "01a1730e-b1ee-7186-b1fe-ffe6440b6c37"
interval_id: "7989711a-d0b0-4bf0-a173-0e8245a3e43a"
start_branch: "main"
start_commit: "593784754f3a4e8f656a811831df8cc0b34b9375"
related_artifacts: ["drift/shared-files/001-research-shared-files-under-many-agents.md","drift/shared-files/003-plan-derived-changelog-and-automatic-landing.md","drift/shared-files/008-handoff-retirement-committed-pushed-perimeter-prompt.md"]
next_session_profile: "implementation"
anchor_coverage: {"status":"not-applicable","eligible":0,"captured":0,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
---

## Objective

Remove Drift's unused landing feature and its Claude Code packaging, and fix documentation that no longer matched the code.

## Source Documents

- drift/shared-files/001-research-shared-files-under-many-agents.md records where landing came from: the `git reset --soft` incident.
- drift/shared-files/003-plan-derived-changelog-and-automatic-landing.md is where landing was planned.
- drift/shared-files/008-handoff-retirement-committed-pushed-perimeter-prompt.md is the previous shared-files handoff. It is complete and was not resumed; this session started from a user question.

## Status

- **Completed:** all work for this repository. Four local commits on `main` plus the annotated tag `v0.7.0`.
- **Not pushed:** `main` is 4 commits ahead of `origin/main`. The user pushes.
- **Not started, other repository:** a pre-push guard in `perimeter`. The user wants it done from the perimeter agent's window, not here. The prompt is under Next Steps.

## What Changed

- `f90541f refactor: remove landing and /drift-land`
  - `lib/land.ts` is deleted.
  - `extensions/drift.ts` no longer has the `drift-land` command or the auto-land step inside `drift_publish`.
  - In `lib/state.ts`, `DriftConfig` is now `{ trackArtifacts, autoContinue }`, and `rawConfig()` rejects a `land` key like any unknown key. `hasOrigin()` and `mergeInProgress()` are deleted.
  - In `tests/drift.test.ts`, the landing fixture and the landing tests are removed, and the config test asserts that `land` is rejected. Three landing scenarios are removed from `tests/pi-runtime.test.ts`, each checked against other tests that cover the same ground.
  - `docs/landing.md` is deleted.
  - README, `docs/continuation.md`, `docs/worktrees.md`, `skills/drift/hosts/pi.md`, `assets/parallel-workers.svg` and `assets/profiled-continuation.svg` no longer describe landing.
  - In `skills/drift/SKILL.md`, the "Landing" section is renamed "Pushing to a shared branch" and keeps the push order. The host sentence and the `land` config are removed.
  - `docs/shared-files-plan.html` gets a dated removal note in its history banner.
- `1f899fd docs: drop the hosts/claude.md route and show /drift in the images`
  - The host-overlay list in `SKILL.md` no longer routes to `hosts/claude.md`, which never existed.
  - `assets/workflow-loop.svg` and `assets/profiled-continuation.svg` show `/drift` instead of the internal `drift-continue` step.
- `2e4537b chore: remove Claude Code packaging`
  - Deletes `.claude-plugin/` and `claude/commands/drift.md`.
  - Removes the Claude sections of README and `docs/install.md`, and the `.claude-plugin/` entry in `package.json` `files`.
- `ead875c chore: v0.7.0` bumps the version and adds the annotated tag `v0.7.0`. The previous tag was `v0.6.0`.
- **Outside the repository:** the `~/.claude/skills/drift` symlink and `~/.claude/commands/drift.md` were removed at the user's request. The command copy was identical to the repository file, which is still in Git history.

## Codebase Context

- **Why landing was removed.**
  - No `.drift.json` under the user's home folder or `C:\Projects_2.0` (searched five levels deep) sets `land`. Four configs exist: `dotfiles`, `perimeter` and `perimeter-w2` set `trackArtifacts`; `Rig` sets `trackArtifacts` and `autoContinue`.
  - No Pi session log shows the user typing `/drift-land`.
  - No local repository has a `drift: publish` landing commit.
  - `/drift-land` had done nothing since `88dd9b6` (2026-10-12).
- **Why Claude Code support was removed.** Claude Code sessions used `drift:drift` from 2026-10-08 to 2026-10-10 and not since. The user confirmed Drift is Pi-only and for them alone. `hosts/claude.md` never existed; commit `04e5745` says the Claude agents were "designed, not implemented".
- **What a stale `land` key does now.** Measured in a temporary repository:
  - `driftConfig()` throws "Drift configuration must be an object with only trackArtifacts (boolean) and autoContinue (boolean): <path>".
  - `Records.open()` and `beginTurn()` still succeed.
  - `Records.context()` throws once Drift is engaged. Reading the context hook in `extensions/drift.ts` (not run in live Pi), that error stops the turn and the failure stays until `/reload`.
  - The `changelog` key got the same strict treatment in `5937847`. The user agreed to keep this strict.
- **Kept on purpose.**
  - The push order in `SKILL.md`. It is the only written copy of the rule on this machine. Its origin is the incident described in `d8c7964`'s commit message.
  - `docs/field-observations.md`, untouched. Its scope is salience observations, and it is append-only.
  - `docs/shared-files-plan.html`, kept as history.
- **Environment.**
  - `npm run lint` fails here because `ruff` is not on PATH. `uvx ruff check scripts` passes.
  - `python` on this machine is the Windows Store stub; use `py`.
  - `core.autocrlf=true`, so working-copy files are CRLF. The edit tool keeps that.
- **Verification.**
  - `npm run typecheck` passes.
  - `npm test`: 146 tests, 137 pass, 0 fail, 9 skipped. The baseline before the work was 152, 143, 0 and 9; the six removed landing tests account for the difference.
  - The suite was run after each code or skill-text commit.

## What Deviated from Plan

There was no plan. The task started as "explain the repository" and "fix old documentation". The user then decided in conversation to remove landing and Claude Code support, keep the push guidance, keep config strict with a 0.7.0 bump, and leave `field-observations.md` alone.

## Open Questions

None for this repository. The README claim that Pi releases from 0.85.1 still pass the suite was not checked this session.

## Next Steps

1. The user runs `git push origin main v0.7.0`. CI then runs lint, typecheck and tests on three operating systems.
2. In the perimeter agent's window, not here, give it this prompt:

> Several threads push to perimeter's main in parallel. Earlier, a `git reset --soft origin/main` taken after origin/main had moved reverted three other threads' work (20 files, e6f4938b, repaired in d8b3b8c0). Drift used to block this in its landing step, and Drift v0.7.0 removed landing. Add a guard that runs before every push to main. Refuse the push when, against the fresh remote tip, the pushed branch changes a file that none of the pushed commits touch. Drift's removed version is `landingGuard()` in the output of `git -C C:/Users/BLACKHAND-CL1/OneDrive/__projects/drift show f90541f^:lib/land.ts`. Decide with me whether the hook is committed (core.hooksPath) or per clone, and prove it with a reproduction of the reset --soft case.
