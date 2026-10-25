---
date: "2026-10-25T11:38:01+00:00"
branch: "main"
git_commit: "593784754f3a4e8f656a811831df8cc0b34b9375"
feature: "shared-files"
sequence: "008"
type: "handoff"
status: "complete"
session_started: "2026-10-25T11:34:18+00:00"
session_id: "01a13c36-3c70-7052-9825-2ca6aeedb072"
interval_id: "ff7eea5a-7d4f-4e30-a24e-3823d7799cac"
start_branch: "main"
start_commit: "4b6de509f46c9b654eaba12b0c81eaa992e7ec55"
source_research: "drift/shared-files/005-research-retire-changelog-and-assess-index-view.md"
previous_handoff: "drift/shared-files/007-handoff-changelog-and-index-retired-commits-pending.md"
related_artifacts: ["drift/shared-files/006-plan-retire-changelog-and-index-view.md","drift/auto-continue/005-handoff-two-mode-continuation-built-live-check-pending.md"]
next_session_profile: "implementation"
anchor_coverage: {"status":"partial","eligible":7,"captured":2,"skipped_count":5,"skipped_by_reason":{"file-not-found":5},"skipped":[{"reference":"src/core/save.ts:108","reason":"file-not-found"},{"reference":"AGENTS.md:58","reason":"file-not-found"},{"reference":"docs/architecture/archetypes-and-drift.md:113","reason":"file-not-found"},{"reference":"docs/product/settings-and-extensions.md:131","reason":"file-not-found"},{"reference":"src/shared/archetypes.ts:111-112","reason":"file-not-found"}]}
anchors: [{"path":"README.md","start":28,"end":28,"sha256":"c9b2716f985c2fa335e82dbe3e32491b0bbb98397a2f180fb84b44cdbc94e7ab","context":["Restart Pi (or `/reload`) after installing or updating the checkout; a running","Restart Pi (or `/reload`) after installing or updating the checkout; a running"]},{"path":"README.md","start":18,"end":18,"sha256":"8af8182ab1e8f509cf81961103ae39b0aa62a55a70dfd31bb9437408df4b7c20","context":["```sh","```sh"]}]
---

## Objective

Finish plan 006, which retires Drift's changelog and `INDEX.md` view:
- commit and push every cleaned repository;
- make sure the local Drift install is current;
- give the user a prompt for Perimeter to tidy its own leftovers.

## Source Documents

- drift/shared-files/006-plan-retire-changelog-and-index-view.md (now `complete`)
- drift/shared-files/007-handoff-changelog-and-index-retired-commits-pending.md (resumed; superseded by this handoff)
- drift/shared-files/005-research-retire-changelog-and-assess-index-view.md

## Status

**Complete.** Every step of plan 006 is done and verified.

| Repository | Commit (pushed) | Content |
|---|---|---|
| drift | `4b6de50` | auto-continue two-mode work (plan `drift/auto-continue/004`) |
| drift | `5937847` | retirement of the changelog feature and `INDEX.md` view, the cleanup tool, docs, tests, and deletion of this repo's CHANGELOG.md and changelog.d/ |
| Rig | `e2ae2db` | "chore: retire Drift changelog and index"; the push also carried Rig's previously unpushed S4/S5 commits (`8f1a983..e2ae2db`; tags not pushed) |
| dotfiles | `daa7bc6` | "chore: retire Drift changelog and index" (explicit paths; the user's work in progress untouched) |
| perimeter (main) | `3de2513a` | "chore: retire Drift changelog and index" |

- **Other repositories:** REA-official, basic-memory, beads, herdr-nono-plugin and ruflo were restored to HEAD. Nothing needed committing.
- **Local install:**
  - Pi loads Drift from the OneDrive checkout: `~/.pi/agent/settings.json` packages `..\..\OneDrive\__projects\drift`, now at `5937847`.
  - `~/.agents/skills/drift` symlinks to `skills/drift`, and `~/.claude/skills/drift` symlinks to the repo root (plugin).
  - Pi prompt templates come from the package's `./prompts`.
  - `~/.claude/commands/drift.md` is a copy and was stale: it still told Claude to read `drift/INDEX.md`. It is now refreshed from `claude/commands/drift.md`.
  - No npm-global copy exists.
- **Live check:**
  - Handoff 007 was the first publication on the new code: no `Index:` or `Changelog:` result lines, no `drift/INDEX.md` written, no "Changelog:" session context.
  - `npm run typecheck` is clean; `npm test` gave 143 passed, 0 failed, 9 skipped; `uvx ruff check scripts` is clean.

## What Changed

- This interval: the four commits and pushes listed above, plus the refreshed `~/.claude/commands/drift.md`.
- Code and documentation details are in handoff 007's What Changed (now committed as `5937847`).

## Codebase Context

**Leftover references in repositories outside Drift.** These are not Drift's to edit; each project's own agent should fix them.

- **Perimeter**
  - Deleting CHANGELOG.md broke its own release tooling:
    - `scripts/release.mjs` (:78-119) rolls `## [Unreleased]` in CHANGELOG.md and stages it;
    - `VERSIONING.md` §Changelog (:62-66);
    - `ROADMAP.md` (:6, 21, 26);
    - `README.md` (:71, the "in-app version stamp and public changelog" roadmap item; :110; :178);
    - `src/core/save.ts:108` (a comment);
    - `.gitattributes:4` (a comment naming `drift/INDEX.md`).
  - Its 25 linked worktrees still track `drift/INDEX.md`; perimeter-w2 (`t/coord`) also tracks Drift's changelog setup. The shared clone merge config was unset, so the leftover `.gitattributes` lines fall back to text merge.
- **Rig**
  - `AGENTS.md:58` (a rule naming `drift/INDEX.md` and the generated CHANGELOG region).
  - `README.md:28` (a link to the deleted CHANGELOG.md).
  - `docs/architecture/archetypes-and-drift.md:113`.
  - `docs/product/settings-and-extensions.md:131`.
  - `src/shared/archetypes.ts:111-112`: a seat archetype operation whose purpose is "Rebuild drift/INDEX.md and the generated CHANGELOG.md region … with the Drift CLIs". This is product code and needs a Rig decision.
  - Receipt logs that mention INDEX.md are historical; leave them.
- **dotfiles:** `README.md:18, 23, 47-49, 80, 86, 206-210` (navigation table, structure tree and changelog section). Per-platform changelogs such as `arch/CHANGELOG.md` are dotfiles' own, not Drift's.
- **Merge conflicts on old branches.** A branch that edited `drift/INDEX.md` or CHANGELOG.md before main deleted them will hit a modify/delete conflict when merged. Resolve it by deleting the file (`git rm`).

## What Deviated from Plan

- Pushing Rig's main also published Rig's earlier unpushed milestone commits (S4/S5). The user asked to push. Tags (v0.3.0, v0.4.0) were not pushed.
- The perimeter main cleanup deleted a CHANGELOG.md that Perimeter's own release script uses. The user approved the deletion; the follow-up belongs to Perimeter (prompt below).

## Open Questions

- Perimeter: does the game still want a player-facing changelog (README roadmap: "in-app version stamp and public changelog")? This decides whether its release script keeps a hand-maintained CHANGELOG.md or drops the changelog roll.
- Rig: what should replace the Drift-maintenance archetype operation in `src/shared/archetypes.ts:111-112`?
- Should the per-session recent list show more than 8 rows?

## Next Steps

1. Paste the Perimeter prompt below into a Perimeter session.
2. Optionally ask the Rig and dotfiles agents to fix the references listed under Codebase Context.
3. Still separate and open: the auto-continue live check (`drift/auto-continue/005`) at Rig's next in-progress profiled handoff.

### Prompt for Perimeter

> Drift has retired its generated changelog (`CHANGELOG.md` / `changelog.d/`) and its `drift/INDEX.md` view; see the drift repo commit `5937847`. History now lives in commit messages, which say what changed and why and name the Drift artifact; in Drift handoffs; and in the raw-artifact catalog that `/drift` and the session's recent-artifact list use. Perimeter's main branch was already cleaned in commit `3de2513a` (pushed): it deleted `CHANGELOG.md`, `changelog.d/README.md` and `drift/INDEX.md`, and removed Drift's merge lines from `.gitattributes`. The clone's `merge.drift-*` config is unset for every worktree. Please tidy the rest of Perimeter. Use Drift (feature `drift-retirement`) and finish with a handoff.
>
> 1. **Repair what the CHANGELOG.md deletion broke on `main`.** `scripts/release.mjs` (changelog roll at ~:78-119), `VERSIONING.md` §Changelog, `ROADMAP.md` (:6, 21, 26), `README.md` (:71, 110, 178), the `src/core/save.ts:108` comment and the `.gitattributes:4` comment all assume a CHANGELOG.md. Before changing anything, ask me one question: do we still want a player-facing changelog (README :71, "in-app version stamp and public changelog")?
>    - **No:** make `npm run release` bump versions, build, test, commit and tag without a changelog roll, with release notes coming from `git log <previous tag>..HEAD`. Update the docs to point at `git log` and Drift handoffs.
>    - **Yes:** restore a hand-maintained, player-facing `CHANGELOG.md` from `git show 3de2513a~1:CHANGELOG.md` with Drift's `drift:changelog` marker region and `<!-- changelog.d/… -->` id comments removed, and keep the release roll.
>
>    Either way, run the project's checks (`npm test`, build) and commit with a message that names the Drift artifact.
> 2. **The 25 linked worktrees** (`git worktree list`: perimeter-ashguard … perimeter-w2b; several are detached HEADs; most have uncommitted work). Give me a table with, for each one: branch, merged into main or not, ahead/behind, uncommitted files, last commit date. Then ask me per group whether to:
>    - **(a) remove the worktree:** only if it is merged or abandoned and has no uncommitted or unpushed work, and never with `--force`;
>    - **(b) retire the files on that branch:** `git rm -q drift/INDEX.md`, plus `CHANGELOG.md`, `changelog.d/` and Drift's `merge=drift-*` lines in `.gitattributes` on `t/coord` (perimeter-w2). Commit only those paths, as "chore: retire Drift changelog and index", and never touch other uncommitted work;
>    - **(c) leave it for now.**
>
>    Merging a branch that still edits `drift/INDEX.md` or `CHANGELOG.md` into main gives a modify/delete conflict; resolve it by deleting the file.
> 3. **Agent instructions.** Update `CLAUDE.md`, AGENTS.md, skills and docs that tell agents to update `drift/INDEX.md`, `CHANGELOG.md` or `changelog.d/`, or that describe the old landing rules about changelog and index hunks. Replace them with: commit messages state what changed and why and name the Drift artifact path; for project history, read `git log`, recent Drift handoffs and the recent-artifact list.
> 4. **Verify.**
>    - `py -3 -I C:/Users/BLACKHAND-CL1/OneDrive/__projects/drift/scripts/retire-index-and-changelog.py C:/Users/BLACKHAND-CL1/OneDrive/__projects/perimeter` reports nothing to do for main; linked worktrees are reported as skipped by design.
>    - `git grep -n "drift-index\|drift-changelog\|INDEX.md"` on `main` shows only history.
>    - `git status` is clean apart from known work in progress.
>
> Rules: never force-push, never squash against a moving ref, commit explicit paths only, ask before removing worktrees or deleting branches, and push `main` only after I approve.
