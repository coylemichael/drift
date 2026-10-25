---
date: "2026-10-10T19:47:39+01:00"
branch: "main"
git_commit: "827d17a27057592c1b162df41e78684f7d40e1c3"
feature: "citation-staleness"
sequence: "003"
type: "handoff"
status: "superseded"
session_started: "2026-10-10T18:33:49+01:00"
session_id: "01a125f9-c16f-7269-bdae-02bcc7fbf22f"
interval_id: "dfd3e639-f6bf-4eb3-8be2-71ec4dbde31e"
start_branch: "main"
start_commit: "43a7e0802aec5316abc0d8c2ec024a3800584f2c"
previous_handoff: "drift/citation-staleness/002-plan-anchors-checker-and-pickup-report.md"
related_artifacts: ["drift/citation-staleness/001-research-prior-art-derived-records-and-citation-anchoring.md","drift/changelog-pipeline/001-handoff-one-way-changelog-and-utf8-builders.md"]
---

## Objective

Implement citation anchors end to end: publish-time content-hash anchors, a graded staleness checker, pickup-time reporting, durable-anchor writing instructions, and the shared script module — so Drift artifacts are verifiable maps of the code rather than trusted journals.

## Source Documents

- drift/citation-staleness/002-plan-anchors-checker-and-pickup-report.md (the executed plan)
- drift/citation-staleness/001-research-prior-art-derived-records-and-citation-anchoring.md (design rationale)

## Status

All six plan phases complete and verified; committed as 827d17a on main. Full suite: 112 tests, 106 pass, 6 platform skips, 0 fail (includes 4 new checker tests, a publisher anchors test and a pickup report test). Landing is the only remaining step and is in progress by this session.

- **Completed:** Phase 1 (anchor instructions), Phase 2 (shared module + packaging), Phase 3 (checker + tests), Phase 4 (publish-time anchors + parity test), Phase 5 (pickup + drift-continue report), Phase 6 (README; this handoff is the changelog/landing step).

## What Changed

- scripts/_driftmeta.py (new) — shared `scalar()`/`parse_date()`/`FRONTMATTER`/`git()` plus the anchor normalization contract (`normalize_lines`, `anchor_hash`: strip trailing whitespace per line, LF joins, sha256) and the documented rejection of fuzzy hashing. Both builders now import it via `sys.path.insert(0, str(Path(__file__).resolve().parent))`, which works under `-I` on every Python version.
- scripts/check-staleness.py (new) — grades an artifact's citations: exact mode from frontmatter `anchors`, heuristic mode from `git show <git_commit>:<path>` with unique-suffix path resolution. Verdict ladder: fresh (hash proof) → moved (needle search + hash confirm, same file then `git grep` across tracked files) → changed (difflib ratio) → gone; uncertain for no/unknown commit or dirty anchors. Report-not-gate: exit 0 with stale citations; writes nothing. Default repo derivation uses the **last** `drift` path component (this repo is itself named drift).
- scripts/build-index.py, scripts/build-changelog.py — duplicated helpers removed; import from `_driftmeta`.
- lib/anchors.ts (new) — the TS half: `extractCitations` (same grammar: letter-led extension, `:start[-end]`, backticked bare `:N` continuations, URL/timestamp exclusion), `normalize`/`anchorHash` (contract twin), `extractAnchors` (reads cited files in the active worktree, caps at 100, flags `dirty` from `git status --porcelain`, skips traversal/huge/unresolvable paths).
- lib/artifacts.ts `prepare()` — adds `anchors` to frontmatter when citations resolve; omitted otherwise.
- lib/pickup.ts — `citationNote()` (exported): runs the checker `--json`, renders one note (counts + up to 12 non-fresh citations with forwards/similarity), degrades to an "unavailable" note on any failure, silent when an artifact has no citations; inserted into `/drift` notes before the user's message.
- extensions/drift.ts `continueHandoff()` — the same note is appended to the automatic-continuation prompt (plan's open question answered: yes).
- skills/drift/handoff.md — handoffs prefer symbol-shaped references for anything not just committed (dirty-tree rationale); Resuming step 8 uses a supplied citation report instead of blind trust. skills/drift/research.md and plan.md — one line each: cite committed state; the host may verify against `git_commit`.
- package.json `files` — now ships `_driftmeta.py`, `build-changelog.py` (pre-existing gap) and `check-staleness.py`.
- README.md — new "Citation anchors (per artifact)" section; also fixed a leftover write-back paragraph from the changelog fix lane that a line-wrapped grep had missed ("written\nback").
- tests/check-staleness.test.ts (new, 4 tests) — heuristic ladder end to end, cross-implementation grammar lockstep, exact mode with dead commits + dirty anchors + parity via lib/anchors.ts `anchorHash`, human-mode output and exit-0 reporting. tests/drift.test.ts — publisher writes anchors the checker verifies fresh (full end-to-end parity). tests/pickup.test.ts — fresh and changed notes, note ordering before the user's message.

## Codebase Context

- The checker self-validated during implementation: run against the just-published plan artifact, it correctly graded the plan's own Key Files citations as 3× changed / 1× moved — because this implementation had refactored those exact ranges an hour after the plan was written.
- `git cat-file -e` on a missing object exits 128 **with stderr**: the `git()` helper raises, it does not return a distinguishable code — `commit_exists` relies on catching RuntimeError, not on `ok=` tuples.
- pickup.test.ts asserts `The user's message: ...$` at end-of-text, so any new note must be inserted **before** the user's-message note.
- Fixture artifacts without citations produce no note, which is why the pre-existing pickup tests pass unchanged; the checker does spawn Python on every artifact pickup (fast, but worth knowing).
- `python` is not on PATH on this machine; use `py`. Tests resolve via `python()` in lib/state.ts.

## What Deviated from Plan

- Phase 5's "citation check unavailable" degrade note is also silent-skipped in one case the plan did not enumerate: `citationNote` returns undefined for citation-free artifacts (plan implied this; stating it for the record).
- README's stale write-back paragraph was fixed here rather than in the changelog-pipeline lane where it belonged — the lane's grep missed it across a line wrap.
- Nothing else deviated; all six phases landed as planned.

## Open Questions

- Symbol-level anchors (optional `symbol` field) remain deferred by design.
- The anchors cap (100 citations) and the 12-item note cap are first guesses; revisit if a real artifact overflows them.
- Checker cost on artifact-dense repos is per-pickup Python spawn; measure before optimizing.

## Next Steps

1. Land this interval (commit publication outputs, fetch/rebase, verify own files only, full suite, push) — in progress by this session.
2. Flip drift/citation-staleness/002 plan status to complete (done alongside this publication).
3. Future work, user-gated: symbol anchors; checker cost measurement on large artifact sets.
