---
date: "2026-10-11T13:45:33+01:00"
branch: "main"
git_commit: "d3936ad17cd7d23d477e3f77c4d4dbbb9e36ef7f"
feature: "editor-diagnostics"
sequence: "001"
type: "handoff"
status: "superseded"
session_started: "2026-10-11T12:19:14+01:00"
session_id: "01a12ab0-338b-713b-bf02-c9481bdff81e"
interval_id: "39901feb-a6ca-4b33-a38b-23df40dd6450"
start_branch: "main"
start_commit: "cc57146f22ba106856f8de7b58c9d5dfc923b1f4"
related_artifacts: ["drift/changelog-pipeline/001-handoff-one-way-changelog-and-utf8-builders.md"]
---

## Objective

Clear the repository's editor diagnostics (148 TypeScript errors, 16 markdownlint warnings in VS Code) by making the project type-check and lint cleanly, fixing the real bugs those diagnostics exposed.

## Source Documents

- None — direct user request; no research or plan artifact.

## Status

- **Completed:** everything. Verified: `npx tsc --noEmit` 0 errors; `npx pyright scripts` 0 errors/warnings; `npx markdownlint-cli2 README.md CHANGELOG.md` 0 issues; `python scripts/build-changelog.py --check .` reports "up to date (6 fragments)"; test suite passes (one pre-existing flake, see Open Questions).

## What Changed

Only the files below are this task's work. The interval's measured diff also contains pre-existing WIP that predates this task (parts of README.md, skills/drift/hosts/pi.md, tests/drift.test.ts, tests/pi-runtime.test.ts, changelog.d/auto-continue-001-manual-default-and-switch.md) — do not attribute those to this handoff.

- tsconfig.json (new) — strict `nodenext` config: target es2023, `types: ["node"]`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `noEmit`, `skipLibCheck`; includes extensions/, lib/, tests/. This plus the dev installs is what removed the 148-error cascade (TS2307 missing modules → TS7006 implicit any).
- package.json / package-lock.json — devDependencies added: `@earendil-works/pi-coding-agent@1.1.0`, `@earendil-works/pi-ai@1.1.0`, `typebox@1.3.36`, `typescript`. Local install is for type resolution only; `peerDependencies`/`peerDependenciesMeta` unchanged.
- lib/state.ts: `Pending` — was `Receipt & { content; fragment?: { path; content } }`, an impossible intersection with `Receipt`'s `fragment?: string` (only `undefined` was assignable); now `Omit<Receipt, "fragment"> & …`. Runtime code (`prepare()`, `validatePending()`, the Receipt built in `publish()`) already treated `fragment` as the object shape; `validReceipt()` never checks `fragment`, so no runtime behavior changed.
- extensions/drift.ts: `drift_worktree` execute — returns `details: undefined`; `AgentToolResult.details` is a required property (pi-agent-core types.d.ts) and `drift_publish` already returned `details: receipt`.
- scripts/build-changelog.py: `committed_bodies()` — real bug fixed: frontmatter match offsets were computed on the CRLF-normalized copy but sliced on the raw `git show` text, so a committed CRLF fragment could yield a wrong body and misfire hand-edit detection. Now normalizes once and matches/slices the same string. Also `(__doc__ or "").strip()` in main(), `isinstance(stream, io.TextIOWrapper)` guard replacing non-narrowing `hasattr` before `reconfigure`, `import io`.
- scripts/build-index.py — walrus narrowing for the `NAME_KIND.match(title)` double call in `row_from_index()`; same `__doc__`/`reconfigure`/`import io` fixes.
- scripts/check-staleness.py — same `__doc__`/`reconfigure`/`import io` fixes.
- .markdownlint.jsonc (new) — MD013 off (long prose lines are house style), MD024 `siblings_only` (Keep a Changelog repeats section headings per version), MD033 `allowed_elements: p/img/h3/em/br/a` (README's centered header), MD041 off (README opens with the logo block).
- README.md — four table separator rows `|---|---|` → `| --- | --- |` (MD060, matches spaced data rows); the changelog.d example fence gained a `text` language (MD040).
- CHANGELOG.md — legacy hand-written region only: blank lines after `### Changed`/`### Added`/`### Renamed` headings in the 0.2.0/0.1.0 sections (MD022/MD032), and an explicit `markdownlint-disable-next-line no-duplicate-heading` comment above the hand-written `## [Unreleased]` that duplicates the generated one. The generated region between the `drift:changelog` markers was never touched.

## Codebase Context

- `AgentToolResult<T>` (pi-agent-core dist/types.d.ts) has `details: T` required, not optional — any future `pi.registerTool` execute must return `details`, even `details: undefined`.
- The VS Code markdownlint extension lints only open files; the stable 16-warning count was README.md + CHANGELOG.md being open. Other markdown (docs/, skills/) was not linted or fixed in this pass.
- `npx pyright scripts` now matches a clean Pylance; `python` on this machine is 3.13.15 (the `py`-shim warning "Python was not found" from npx wrappers is noise).
- The changelog builder's `--check` mode is the cheap way to prove the generated region is intact after editing CHANGELOG.md outside the markers.

## What Deviated from Plan

No plan artifact existed. Within the session: an attempt to `mv node_modules` aside (to prove the flaky test was unrelated to the new local install) failed with permission denied under OneDrive; replaced by running `tests/pi-runtime.test.ts` alone, which passes 24/24 with the local install present.

## Open Questions

- tests/pi-runtime.test.ts "actual Pi binds stale standalone Drift skills…" fails intermittently under full-suite load with 'original session history was rewritten' (assert at pi-runtime.test.ts:959), but passes in isolation and when its file runs alone. Pre-existing flake; the test body is part of the uncommitted WIP that predates this task. Worth deflaking separately.
- CHANGELOG.md still has the hand-written legacy `## [Unreleased]` section duplicating the generated one; the duplicate heading is suppressed, not resolved. Folding that history into a release section is a maintainer decision.
- The new devDependencies and lockfile growth are uncommitted; whether to land them on main is the user's call (precedent: changelog-pipeline/002 landed `@types/node` the same way).

## Next Steps

- None — work is complete. If diagnostics reappear in VS Code after a window reload, restart the TS server and confirm the markdownlint extension picked up `.markdownlint.jsonc`.
