---
date: "2026-10-10T18:28:02+01:00"
branch: "main"
git_commit: "3d9e1eae6de7825160906774c1957eece275f6d4"
feature: "changelog-pipeline"
sequence: "002"
type: "handoff"
status: "complete"
session_started: "2026-10-10T18:08:45+01:00"
session_id: "01a125f9-c16f-7269-bdae-02bcc7fbf22f"
interval_id: "76bcaeae-5e2f-4cbb-930e-34c774270383"
start_branch: "main"
start_commit: "1faeee43042ce9351ec3df22ae4f5e9494b9b574"
previous_handoff: "drift/changelog-pipeline/001-handoff-one-way-changelog-and-utf8-builders.md"
related_artifacts: ["drift/citation-staleness/001-research-prior-art-derived-records-and-citation-anchoring.md"]
---

## Objective

Resolve the parked `package.json`/`package-lock.json` working-tree changes so the repository is clean and the shared-module extraction (and with it the citation-staleness implementation) is unblocked.

## Source Documents

- drift/changelog-pipeline/001-handoff-one-way-changelog-and-utf8-builders.md (previous interval; its Open Questions flagged this blocker)

## Status

- **Completed:** the user's `npm i -D @types/node` churn is resolved and landed as 3d9e1ea on main; working tree clean; full suite green (106 tests, 100 pass, 6 platform skips, 0 fail).
- **Not started:** citation-staleness plan and implementation (next feature work, user decision to proceed pending).

## What Changed

- package.json — restored the repo's compact hand-written formatting from HEAD (undoing npm's wholesale reformat), then re-added the one intended change in matching style: `"devDependencies": { "@types/node": "^26.6.5" }` so lint/type-checking resolve Node built-ins.
- package-lock.json — committed as npm generated it (lockfileVersion 3, single dev dependency).

## Codebase Context

- The `files` array in package.json ships `scripts/build-index.py` but **not** `scripts/build-changelog.py` — a pre-existing packaging gap. The planned shared frontmatter module must be added to `files` too; fix both in the extraction commit.
- `python` is not on PATH on this machine; use `py`. Tests resolve the interpreter via `python()` in lib/state.ts.
- Landing with uncommitted tracked files: `git rebase --autostash origin/main` preserved the then-uncommitted package.json through the previous interval's landing; no longer needed now the tree is clean.

## What Deviated from Plan

Nothing. The user chose: keep the type fix, keep the lockfile, restore compact formatting.

## Open Questions

- None for this housekeeping. The citation-staleness feature's open questions live in drift/citation-staleness/001 (fingerprint granularity, storage location, backfill policy, unified report surface).

## Next Steps

1. Write the citation-staleness plan artifact (citation-staleness/002) from drift/citation-staleness/001 §Design Consequences: fingerprint schema and storage, publish-time recording in lib/artifacts.ts, pickup-time graded report in lib/pickup.ts / extensions/drift.ts, scripts/check-staleness.py as heuristic backfill.
2. In the same implementation: extract shared `scalar()`/`parse_date()` into a scripts/ module with explicit script-relative import under `-I` (sys.path.insert of the script's own dir, str()-converted), add the module and build-changelog.py to package.json `files`, and test under `-I` from an arbitrary cwd across the publisher and landing invocation paths.
