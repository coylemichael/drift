---
date: "2026-10-13T11:55:39+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "ecosystem-survey"
sequence: "004"
type: "handoff"
status: "complete"
session_started: "2026-10-12T11:08:10+01:00"
session_id: "01a12f95-80ad-768a-beab-3053980bf7c7"
interval_id: "4b42486d-272a-4989-955d-b129efcd4348"
start_branch: "main"
start_commit: "e871e2fae8a243ab6e7c1abf70b5fd1b69534dd1"
source_research: "drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md"
related_artifacts: ["drift/ecosystem-survey/003-plan-raw-artifact-pickup-and-recent-catalog.md","drift/ecosystem-survey/001-research-comparative-survey-and-index-design-debate.md"]
next_session_profile: "implementation"
---

## Objective

Make Drift pickup and recent-context navigation use the actual Markdown artifacts through the shared parser, independently of the generated INDEX.md view.

## Source Documents

- drift/ecosystem-survey/003-plan-raw-artifact-pickup-and-recent-catalog.md — approved implementation scope.
- drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md — verified comparison and design boundaries.
- drift/ecosystem-survey/001-research-comparative-survey-and-index-design-debate.md — original alternatives and corrections.

## Status

- **Completed:** plan steps 1–5: reproduced the old false-empty failure, added raw catalog output, switched pickup/recent context, added regressions and portable documentation, and obtained two Claude Fable 5 reviews.
- **Verification:** final `npm test` — 149 tests total, 141 passed, 8 skipped for platform/ACP conditions, zero failures. This includes the actual Pi RPC fixture where INDEX.md is a directory and cannot be refreshed, plus the new 500-artifact bounded-context fixture. `npm run typecheck`, `uvx ruff check scripts/build-index.py`, and `git diff --check` passed.
- **Uncommitted:** changes remain on main as requested; nothing staged, committed, pushed or automatically continued.
- **Not changed:** artifact IDs/filenames, newest-only policy, publisher/landing requirements, changelog algorithm, SQLite/caches, archival, anchor bulk and completed-handoff policy.

## What Changed

All implementation references describe uncommitted working-tree state; symbols are used instead of transient line-number anchors.

- scripts/build-index.py: catalog(), artifact_rows(), index_row(), main() — new read-only `--json` mode, dated/undated metadata and status; shares parsing/order/display formatting with the existing Markdown view. Empty catalogs succeed without creating a file. Explicit directory enumeration surfaces read errors instead of silently skipping inaccessible folders. Managed symlinks/junctions are refused; JSON CLI also checks its root boundary. Existing view/merge modes remain available.
- lib/state.ts: readArtifactCatalog(), ArtifactCatalogEntry, Records.context() — shared validated TypeScript bridge over the Python parser; missing stores are empty, genuine failures are not. Recent context now queries raw records and retains eight rows of at most 600 characters each, with an undated notice and bounded failure message. No view fallback, publication lock or navigation writes.
- lib/pickup.ts: pickup(), status() — raw default selection; named overrides, UTC/tie order, completed-newest stop and citations preserved. Undated-only stores ask for a name; failures and unrecognized newest kinds are reported rather than reopening older work. Filename-kind matching is basename-anchored, with frontmatter fallback for legacy names; named status supports the same ordinary quote styles as default pickup. Discovery error text is bounded.
- tests/catalog.test.ts (new) — empty/read-only behavior, JSON/Markdown parity, UTC/ties/legacy/Unicode/status/undated data, 500-file context bounds, raw failures, interpreter failure, and managed symlink/junction boundaries. POSIX permission/file-symlink checks are present but skipped on this Windows run.
- tests/pickup.test.ts — reproduced missing-index/Git-policy failure and regressions for stale/directory/conflicting/locked views, no view writes or lock reaping, undated/unknown/error cases, kind/status parity and existing routing/citation behavior.
- tests/pi-runtime.test.ts: existing /drift RPC fixture — an INDEX.md directory blocks view generation while actual Pi still picks the artifact and supplies raw recent context. The other session's separate null/blank-changelog recovery test is preserved.
- README.md, prompts/drift.md, claude/commands/drift.md, skills/drift/SKILL.md, execute.md, handoff.md, plan.md, research.md, hosts/pi.md — raw navigation instructions and portable JSON helper location; optional-for-navigation view wording, errors/undated behavior, and retained publication/startup view generation.
- extensions/drift.ts: refreshIndex() comment/warning and publish tool wording only — readable-view terminology; the other session's runtime changelog-recovery changes remain intact.
- This publication adds the change's changelog fragment and regenerates the adopted view through the publisher; no generated region was hand-edited.

## Codebase Context

The original regression was observed before implementation: a valid plan existed, but removing the fixture's .gitignore caused syncIndex() to reject view generation, after which old pickup returned no artifact. The same regression now passes without creating an index or changing Git policy.

The JSON catalog uses the same parser and ordered() as the view. TypeScript does not implement a second chronology or derive identity from table ordinals. INDEX.md is ignored by navigation even when stale, conflicting, oversized, missing, or a directory; publication/session-start still maintain the readable view for compatibility. "Optional" means not required to read/pick up work, not a new configuration toggle relaxing publisher/landing checks.

Discovery is fresh and uncached on each engaged context request and default pickup. It requires a working Python installation; a failure is surfaced honestly, not masked by a persisted index. The synthetic 500-file test proves bounded output/correctness, not production latency. No speed claim or watcher/database architecture was added.

Review findings addressed: bounded pickup errors, basename rather than directory kind matching, CLI root/junction safety, portable script path (`../../scripts/build-index.py` from SKILL.md), quoted-status parity and mixed-undated notices. Reviewers found no critical issues. Manual hosts with only a copied skill may enumerate/order raw frontmatter by the documented rules when the script is unavailable; they must not treat INDEX.md as authority.

Ownership: this thread's record spans earlier overlapping repository work. The other active session owns the null/blank-changelog validation/recovery edits in lib/artifacts.ts, parts of extensions/drift.ts, tests/drift.test.ts, tests/pi-runtime.test.ts, docs/changelog.md and the publication paragraph of hosts/pi.md, and its field-observation updates. Those were preserved, not claimed here. Peer coordination confirmed the discovery write scope and the targeted RPC edit; both sessions agreed to leave all work uncommitted.

## What Deviated from Plan

The small TypeScript bridge lives in existing lib/state.ts instead of adding lib/catalog.ts, avoiding circular imports between catalog/state/artifacts. Two Claude Fable 5 reviewers supported this placement. Additional hardening/tests address directory look-alike kind parsing, ordinary quoted-status parity and portable Windows junction handling; they preserve the approved navigation contract.

Whole-scripts `uvx ruff check scripts` reports three pre-existing findings in scripts/clean-changelog-residue.py (UP022, PLW1510, UP031). The changed build-index.py passes. Those unrelated findings were left untouched per peer coordination.

## Open Questions

- Actual scan latency for the user's 400–500-artifact Windows/OneDrive deployments remains unmeasured. Fresh scanning is intentional; any future cache/header-read optimization needs evidence and must preserve truthful failure/freshness semantics.
- Removing persisted-view maintenance or relaxing landing checks is a separate unapproved change. No index/driver was deleted or new policy flag introduced.
- The ecosystem proposals for SQLite, IDs, physical archives, cumulative standards and outcome accounting remain deferred; this implementation selects none of them.
- Existing unrelated lint findings and the other session's uncommitted changes remain in the shared checkout. Do not silently fold them into this task or commit the combined diff without user instruction.

## Next Steps

No unfinished implementation in the approved plan. Reload or restart a running Pi session to activate the changed extension/modules; the installed checkout is already updated. A new session should not automatically reopen this completed work. Leave the code uncommitted unless the user asks to commit or land it.
