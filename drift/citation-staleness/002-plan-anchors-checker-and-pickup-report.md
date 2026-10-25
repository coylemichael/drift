---
date: "2026-10-10T19:34:07+01:00"
branch: "main"
git_commit: "43a7e0802aec5316abc0d8c2ec024a3800584f2c"
feature: "citation-staleness"
sequence: "002"
type: "plan"
status: "complete"
session_started: "2026-10-10T18:33:49+01:00"
session_id: "01a125f9-c16f-7269-bdae-02bcc7fbf22f"
interval_id: "dfd3e639-f6bf-4eb3-8be2-71ec4dbde31e"
start_branch: "main"
start_commit: "43a7e0802aec5316abc0d8c2ec024a3800584f2c"
source_research: "drift/citation-staleness/001-research-prior-art-derived-records-and-citation-anchoring.md"
related_artifacts: ["drift/changelog-pipeline/002-handoff-types-node-housekeeping-landed.md"]
---

## Objective

Make Drift artifacts verifiable maps of the code: record content-hash anchors for code citations at publish time, grade every citation at pickup (fresh / moved / changed / gone / uncertain), and teach the skill to write more durable anchors — so a reading session knows exactly which claims still hold instead of trusting or re-verifying everything.

## Source Research

- drift/citation-staleness/001-research-prior-art-derived-records-and-citation-anchoring.md (§2 anchoring pattern, §Design Consequences 2–4, §Open Questions)

## Starting Point

Phase 1 (skill instruction updates) and Phase 2 (shared module) are independent of everything else and of each other — start with either. Phase 3 (checker) needs Phase 2's module. Phase 4 (publish-time anchors) and Phase 5 (pickup report) need Phase 3's normalization contract. User decisions already taken: anchors live in frontmatter; checking is pickup-time and non-blocking; backfill is lazy; symbol extraction deferred; verdict ladder = exact hash fast path + difflib grading, fuzzy hashing explicitly rejected.

## Key Files

- scripts/build-index.py:47-66 and scripts/build-changelog.py:59-75 — the duplicated `scalar()`/`parse_date()` to extract; FRONTMATTER regex duplicated too
- scripts/build-changelog.py:78-91 — `git()` helper with env scrubbing (`GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL`, `--no-optional-locks`); move or mirror into the shared module intact
- lib/artifacts.ts `prepare()` — builds the frontmatter `fields` object (date, branch, git_commit, …); anchors are computed here from `input.body` against the `active` worktree
- lib/artifacts.ts `publish()` — resolution of `active`/`root`, the publish lock, and the index render via `python -I` (the invocation pattern the checker must copy)
- lib/pickup.ts `pickup()` — composes the `/skill:drift …` request text and `notes` array; the citation report appends here
- extensions/drift.ts — hosts the `/drift` command and `drift-continue` flow that consume `pickup()`; also the `drift_publish` schema if anchors need a user-facing note
- skills/drift/research.md (Code References section), skills/drift/handoff.md (Output Format, Guidelines, Resuming steps 7–8), skills/drift/plan.md (Key Files guidance) — anchor-writing instructions
- package.json `files` array — ships only `scripts/build-index.py` today; must gain the shared module, `scripts/build-changelog.py` (pre-existing gap), and `scripts/check-staleness.py`
- tests/changelog-build.test.ts — the pattern for script tests (temp repo fixture, `python -I` invocation, byte-level assertions)

## Implementation Sequence

1. **Phase 1 — anchor-writing instructions (skill only, no code).** In handoff.md: instruct that handoffs prefer function/section references over bare line numbers (handoffs are routinely written on dirty trees where line numbers are wrong at birth), keeping `path:line` only for precise, committed state; in Resuming, extend step 8: when a citation report is supplied with the pickup, use it to decide what to re-check instead of trusting blind. research.md and plan.md keep `path:line` precision; add one line to each naming the normalization the checker uses (cite committed state where possible). Verify: prose only; `npm test` unaffected.
2. **Phase 2 — shared module `scripts/_driftmeta.py`.** Move `scalar()`, `parse_date()`, the FRONTMATTER regex, and `git()` (with its env hardening intact) into it; both builders import it via `sys.path.insert(0, str(Path(__file__).resolve().parent))` before `import _driftmeta` (bare sibling imports fail under `-I` on every Python version). Add the module and `scripts/build-changelog.py` to package.json `files`. Verify: new test invoking both builders with `-I` from `cwd=/` (or drive root) passes; full suite green; `py -I scripts/build-changelog.py . --check` passes in this repo.
3. **Phase 3 — `scripts/check-staleness.py` (stdlib-only, uses `_driftmeta`).** Input: one artifact path (and optional repo root); `--json` for machine output. Pipeline per citation: (a) extract `path:line[-end]` references from the body (backticked or plain, either slash); (b) read `anchors` from frontmatter when present (exact mode) else derive expectation from `git show <git_commit>:<path>` at the recorded commit (heuristic/backfill mode, with unique path-suffix resolution); (c) verdict ladder — hash of current normalized range equals expected → `fresh`; expected hash found at another range/file (locate by first+last stored context lines, confirm by hash) → `moved → path:N`; else `difflib.SequenceMatcher.ratio()` between expected and current text → `changed (NN% similar)` with changed line numbers; nothing located → `gone`; artifact has no commit or anchor marked dirty → `uncertain`. Normalization contract (shared with Phase 4, documented in the module): strip trailing whitespace per line, join with `\n`, sha256 hex. Never writes anything. Verify: new tests/check-staleness.test.ts with a temp repo exercising every verdict, run under `-I` from an arbitrary cwd.
4. **Phase 4 — publish-time anchors in lib/artifacts.ts `prepare()`.** Extract citations from `input.body` with the same grammar as Phase 3; for each (capped at 100), read the file in the `active` worktree, normalize and hash the cited range, and record `{ path, start, end, sha256, context: [firstLine, lastLine], dirty }` where `dirty` is whether `git status --porcelain -- <path>` is non-empty; add `anchors` to the frontmatter `fields` object (single-line JSON array; omit the key when no citations). Anchors are immutable after publication, like every other frontmatter field. Verify: cross-language parity test — publish a fixture artifact through the real publisher, run check-staleness.py, expect every citation `fresh`; then edit a cited file and expect `changed`/`moved` accordingly.
5. **Phase 5 — pickup report in lib/pickup.ts + extensions/drift.ts.** After `pickup()` resolves `artifact`, run `python -I scripts/check-staleness.py <artifact> --json` (same interpreter resolution as the publisher); summarize into one note appended to `notes`: counts plus the non-fresh citations with verdicts and new locations. Strictly non-blocking: any checker failure degrades to a single "citation check unavailable" note. Lazy backfill falls out free: fingerprint-less artifacts take the heuristic path every pickup. Verify: pickup.test.ts cases for fresh-only (silent or one-line), mixed verdicts (listed), checker crash (degraded note), artifact without citations (no note).
6. **Phase 6 — docs, changelog, landing.** README changelog section gains a short "citation anchors" paragraph; publish the completion handoff with a changelog fragment (section: Added); land per the SKILL landing order (commit, fetch, rebase, verify own files only, full `npm test`, push). Verify: both builders `--check` green, suite green, remote updated.

Phases 1 and 2 are disjoint (prose vs scripts) and can run in parallel. Phases 4 and 5 touch disjoint files but share the Phase 3 contract.

## Decisions & Constraints

- **Anchors in frontmatter**, written once by the publisher, never updated; forwarded locations are computed at read time and never stored back (CodeStream rule from the research).
- **Verdicts are graded, never binary**: fresh / moved→N / changed(ratio, lines) / gone / uncertain. Auto-forward only `moved`. The report informs the reading agent; nothing rewrites artifacts.
- **Fuzzy hashing (ssdeep/TLSH/simhash) rejected**: originals are always available (git at the pinned commit, plus stored context lines), so `difflib` over real text is strictly more informative. Record this in the checker's docstring so it is not reinvented.
- **Normalization is a cross-language contract** (TS writer, Python checker): strip trailing whitespace per line, LF joins, sha256. One definition, two implementations, one parity test.
- **Pickup-time, non-blocking, never session-start, never INDEX.md** — settled with the user; Swimm's blocking CI is the documented anti-pattern.
- **Stdlib-only Python, `-I` everywhere**, explicit script-relative imports with `str()` paths; `git()` env hardening must survive the move; checker lives in `scripts/` beside the module.
- Backfill is **lazy** (heuristic path at pickup); no bulk migration, no sidecar store.
- Symbol-level anchors (enclosing function) are **deferred**, not rejected — the anchor schema should leave room (an optional `symbol` field) without implementing extraction.
- Don't add scope: no INDEX column, no CI gate, no artifact rewriting, no prose/semantic checking.

## Open Questions

- Citation grammar edges: bare `:102` continuation references (used in this repo's artifacts) and `path:12-34` ranges must parse; bare function names without a path are unverifiable in v1 — decide whether the report counts them as `unanchored` or ignores them (recommend: count, don't grade).
- Anchors size: cap at 100 citations and 4 KiB of context lines per artifact, or tighter? (Recommend: cap and note truncation in the report.)
- Should `drift-continue` (automatic continuation) receive the same report as `/drift`? (Recommend: yes if it flows through the same pickup composition; confirm in extensions/drift.ts while implementing Phase 5.)
- `git show` cost on large artifacts in heuristic mode — acceptable per research timing (~instant per artifact); re-measure once implemented, and consider `--json` caching only if real numbers demand it.
