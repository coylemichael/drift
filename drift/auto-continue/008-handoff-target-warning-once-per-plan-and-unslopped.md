---
date: "2026-10-26T22:47:10+00:00"
branch: "main"
git_commit: "3e32c2536800e351914b1631bd25867b4e11d301"
feature: "auto-continue"
sequence: "008"
type: "handoff"
status: "superseded"
superseded_by: "drift/auto-continue/010-handoff-continuation-follow-ups-committed-claude-folders-removed.md"
session_started: "2026-10-26T22:44:15+00:00"
session_id: "01a177bf-50cd-70ea-9236-6d96a8257206"
interval_id: "93415ea8-8d88-4adc-ac17-66131fb6bcf8"
start_branch: "main"
start_commit: "3e32c2536800e351914b1631bd25867b4e11d301"
previous_handoff: "drift/auto-continue/007-handoff-breakpoints-and-acceptance-criteria-stop-the-chain.md"
next_session_profile: "implementation"
anchor_coverage: {"status":"not-applicable","eligible":0,"captured":0,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
---

## Objective

Follow-up to 007, from user feedback. The "nothing to work towards" warning must not repeat on every continuation hop because it wastes tokens. The new wording also had to pass `/skill:unslop`.

## Source Documents
- drift/auto-continue/007-handoff-breakpoints-and-acceptance-criteria-stop-the-chain.md (superseded by this one; its open items carry forward below)

## Status
- **Completed:** the warning now appears once per plan in each Pi session, and the text added in 006/007 has had an unslop pass. `npm test`: 146 pass, 1 fail, 4 skipped. The failure is the same other-thread test described in 007.
- **Not done:** no commit, no typecheck, no live check in Zed.

## What Changed
- `extensions/drift.ts`:
  - A new `warnedTargets` Set next to `registry` holds the plans already warned about.
  - drift_publish computes `featureDir` and skips the warning, both the notify and the "Tell the user" line, when `featureDir + warning` has already been warned about. A new plan or a changed plan produces different text, so it warns again.
  - Unslop wording in `promptGuidelines`, the `breakpoint` param description, and the breakpoint result, which now reads "Stopped at a breakpoint. Nothing is queued…".
- `lib/routing.ts: planTargetWarning()` — new text: "It doesn't look like you've set anything to work towards. <plan> has no acceptance criteria or breakpoint, so auto-continue may never stop. I'd recommend coming up with acceptance criteria." With no plan, it names `drift/<feature> has no plan`.
- Unslop rewrites (no em dashes, no mid-sentence colons, shorter sentences, "once per plan" stated) in:
  - `docs/continuation.md` "Where the chain stops"
  - `README.md` checkpoint paragraph
  - `skills/drift/execute.md`, `handoff.md`, `SKILL.md`, `plan.md` template lines, `hosts/pi.md`
- Tests:
  - `tests/drift.test.ts`: the `planTargetWarning` regexes match the new text.
  - `tests/pi-runtime.test.ts`: the chain test asserts exactly one warning across its three publishes, and the breakpoint assertion matches the new text.

## Codebase Context
- The Set lives in memory only, so it resets when Pi reloads. A fresh continuation window stays in the same Pi session, which keeps the warning to once per chain.

## What Deviated from Plan
- Nothing beyond 007.

## Open Questions
- Carried from 007:
  - Another thread is editing `extensions/drift.ts` at the same time. Its `terminate: autoContinue` change and its reworded adoption refusal break "actual Pi refuses adoption while a profiled continuation is queued…". Ask that thread to re-check its diff: this session briefly swapped `extensions/drift.ts` and `tests/pi-runtime.test.ts` with backups and restored them during debugging, which could have overwritten an edit it saved in that window.
  - The three untracked Claude-era folders (`drift/claude-host/`, `drift/install-and-hooks/`, `drift/model-routing/`) still need a decision.

## Next Steps
1. The other thread fixes its adoption test, then `npm test` should report 0 failures.
2. `npm ci && npm run typecheck`.
3. Reload Pi and run the live checks from 006/007, adding one: the warning appears once per plan across a chain.
4. Commit when the user asks.
5. Get a decision on the untracked folders.
