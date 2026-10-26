---
date: "2026-10-12T18:23:29+01:00"
branch: "main"
git_commit: "ee2a0d334e4d72e83d08ea6d1228fc3aad84bc3c"
feature: "changelog-coexistence"
sequence: "001"
type: "handoff"
status: "complete"
session_started: "2026-10-12T16:26:40+01:00"
session_id: "01a130b9-18fd-75f2-a9cb-40929c307c50"
interval_id: "161dfbff-5ea8-422e-be64-9915b48013ec"
start_branch: "main"
start_commit: "58250e08c0996b7d05e67fe259082a5c9f8c4deb"
related_artifacts: []
next_session_profile: "research"
---

## Objective

Stop Drift's changelog feature from breaking repositories that never chose it (cy, tprm-agent, fresh clones), clean up what it already left, and keep exploring whether changelog entries should live somewhere other than fragment files.

## Source Documents

None in this repository. The feature began from reports out of cy's lanes (cy `drift/cy-always-on/021-plan-hud-live-wiring-and-runtime-orchestration.md`, 2026-10-12 15:38–15:45 entries). Background read in cy: `drift/multi-session-concurrency/001-handoff-worktrees-and-changelog-fragments.md`. The design being partly reversed: commit 7b5b121 (2026-10-09) and `docs/shared-files-plan.html` ("Trigger: automatic with an origin remote").

## Status

- **Completed and pushed:** ee2a0d3 on origin/main (signed). Full suite 117 pass / 4 skipped / 0 fail, `tsc --noEmit` clean, `ruff check scripts` clean.
- **Completed on this machine:** every repository is clean. `python3 -I scripts/clean-changelog-residue.py` reports 40 worktrees, 0 changes.
- **Done right after this publication, by this session:** commit and push this publication's fragment and the regenerated `CHANGELOG.md` as a separate docs commit. Check with `git log origin/main`.
- **Not done (user actions):** the other two machines (Next Steps 1); `/reload` of Pi sessions still running old Drift.
- **Open (design, continuing in this thread):** where changelog entries should live. See Open Questions.

## What Changed

Commit ee2a0d3:

- `lib/changelog.ts`
  - `changelogState()`: with no `.drift.json` setting, generation is on only if `adoptionCommitted()` finds both markers in `HEAD:CHANGELOG.md`. The origin-remote trigger is gone.
  - `foreignFragmentFolder()` (called from `foreignFragmentSystem()`) treats `changelog.d/` as the project's own convention when it holds no fragment with Drift frontmatter (`driftFragment()`), or only a README that lacks `drift:changelog`.
  - `syncChangelog()` adopts only when `.drift.json` turns the changelog on, and first runs the builder with `--stdout` so an invalid fragment stops adoption before anything is written.
  - `classify()` reports `invalid fragment (...)`.
  - The README template uses the one-way wording.
- `extensions/drift.ts`: `refreshIndex()` keeps the changelog sync in its own try/catch (`customType: "drift-changelog"`). The adoption notice and the `/drift-changelog` description no longer say "automatic with an origin remote".
- `lib/artifacts.ts`: `validate()` error text. `lib/state.ts`: config comment.
- `scripts/clean-changelog-residue.py` (new, one-off): dry run by default, `--apply` to change. It changes only Drift's exact uncommitted writes and reports everything else:
  - an empty marker pair, compared non-blank line by line with the index;
  - Drift's stub `CHANGELOG.md`;
  - an untracked `.gitattributes` holding only Drift's line, or a tracked one with only that line appended;
  - an untracked `changelog.d/` holding only a README whose sha256 matches one of the two templates Drift has shipped;
  - the clone's `merge.drift-changelog`, when no worktree uses Drift's changelog.
- Tests:
  - `tests/changelog-residue.test.ts` (new).
  - `tests/drift.test.ts`: "an origin remote and a CHANGELOG.md adopt nothing; ...", "a changelog.d/ already kept in another format ...", and the landing test opting in with `"changelog": true`.
  - `tests/pi-runtime.test.ts`: "actual Pi leaves a fresh shared clone's changelog untouched ...", and the landing test opting in.
- Docs:
  - `docs/changelog.md`: trigger paragraph, foreign-convention paragraph, new "Cleaning up after automatic adoption" section.
  - `README.md` command table, and `skills/drift/hosts/pi.md`.
  - `skills/drift/SKILL.md`: a sentence in "Changelog Fragments", and the `.drift.json` field list in "Artifact Git Policy", which previously told sessions to stop on anything but `trackArtifacts`.

Outside this repository, by hand, after checking each item was exactly Drift's bytes:

- **cy:** main checkout plus worktrees `docs-operational-lessons-2026-10`, `feat-mail-replies` and `feat-slack-thread-outbox-kind`. `CHANGELOG.md` marker pair reverted and untracked `.gitattributes` deleted in each. Other agents' uncommitted work there was not touched.
- **`~/it-tprm-contract-renewal`:** `CHANGELOG.md` reverted; `.gitattributes`, `changelog.d/` and `merge.drift-changelog` removed. Its 3 modified workflow files are someone else's.
- **`~/it-azure-cert-expiry-monitor`:** `merge.drift-changelog` removed by the cleaner. The adoption committed in 7fe458d had already been reverted by 8126964 (pushed) by someone else.

## Codebase Context

- **Cy's changelog convention.** Cy's `changelog.d/` (`<branch-slug>.<type>.md`, no frontmatter, `scripts/assemble-changelog.sh` folds at release and deletes) is a Drift session's earlier answer to the same contention problem: cy `multi-session-concurrency/001`, 2026-09-18. tprm-agent got a port in debcd27 (2026-09-24). Neither repo has tags, so the assembler has never run. Cy holds 66 fragments, and its `CHANGELOG.md` last changed on 2026-09-22. Both assemblers pass `--check`. Cy's `scripts/lint-skills.sh` paperwork check depends on the `<branch-slug>.*.md` names. Cy main needs Michael's signed commits through a PR.
- **Cy format vs Drift format.** 44/66 cy fragments contain blank lines and 19/66 hold more than one bullet (tprm-agent: 6/10 and 3/10). Drift's builder rejects both, so migrating needs builder changes or rewritten fragments.
- **Drift fragments are permanent by design.** `docs/shared-files-plan.html`: "Fragments are never deleted or moved by Drift". The region is a pure function of the fragments, and deleting one drops its bullet (`scripts/build-changelog.py` `hand_edited()`). Drift and `dotfiles` each gain 3–5 a day.
- **The marker text is stale but fixed.** The START marker still says "edit a bullet only if you keep its id comment". That wording predates one-way generation, but it is the detection key for every existing adoption, so changing it needs a compatibility plan.
- **Changing the README template.** `tests/changelog-residue.test.ts` deletes a README written by `ensureChangelog()`, so a template change fails that test. Add the new hash to `DRIFT_READMES` in the script, or retire the one-off script and its test.
- **Pi loads Drift from the checkout.** `~/.pi/agent/settings.json` lists `../../repos/drift`, so updating a machine means `git pull`. Running sessions keep the old code until `/reload`.
- **Cy lanes may still run old Drift.** About 7 cy Pi lanes were started around 15:30 on this machine with the old Drift loaded. Any of them that starts a new session before `/reload` will put the markers back into cy; rerunning the cleaner removes them.
- **`dotfiles` is a real adoption.** It has committed markers and 20 fragments, and stays on under the new rule. Its `changelog.d/README.md` still has the old edit-back text; it was not changed, because another session has uncommitted work in that repository.
- **Drift's own hand-written history.** Below the markers, drift's `CHANGELOG.md` has a `## [Unreleased]` with 27 entries. It existed unchanged when v0.6.0 was tagged, so those entries shipped in 0.6.0.

## What Deviated from Plan

There was no plan. The change reverses the origin-remote adoption decided in 7b5b121. The user was asked about this (options A–D). They then directed "get the other repos updated however we need so they start working again", and B, the minimal general fix, was shipped. The one-time suggestion of option C was not built. Adding `"changelog": false` to cy's `.drift.json` was considered and dropped: under the old `SKILL.md` text it would have stopped Claude-hosted Drift sessions in cy, and the format detection makes it unnecessary.

## Open Questions

1. **Where changelog entries live.** Under consideration: move entries out of fragment files into commit trailers (GitLab: `Changelog: fixed`) or PR notes (Kubernetes: a `release-note` block plus labels), and generate `CHANGELOG.md` from history, possibly only at landing on main. That would remove fragment pile-up, the fold question and probably the merge driver. Trade-offs:
   - editing an entry after it is committed;
   - squash merges and trailers on GitHub;
   - commits made without Drift;
   - full history needed for generation;
   - freezing existing fragments.
2. **Fragment pile-up, if fragments stay:** do nothing yet, fold closed months, or group into month folders.
3. Whether to retitle drift's hand-written `[Unreleased]` to 0.6.0 (the user's call).
4. Whether cy and tprm-agent run their own assemblers, and how often. That is their decision; migrating to Drift's format is possible later.
5. Which Drift version the other two machines run.

## Next Steps

1. **Other two machines** (user):
   - `git -C ~/repos/drift pull`, and `/reload` every running Pi session.
   - `python3 -I ~/repos/drift/scripts/clean-changelog-residue.py`, then the same with `--apply` (`py -3` on Windows).
   - **This machine:** `/reload` the cy lanes, and rerun the cleaner if any put the markers back first.
2. **Continue Open Question 1 in this feature:** research how trailers or PR notes would replace fragments for Drift's `drift_publish`, landing and solo repositories without releases, then write a plan. Do not build before the user chooses.
3. **Small follow-ups:** the `dotfiles` README text, and the 0.6.0 heading. Do each only when the user agrees.
