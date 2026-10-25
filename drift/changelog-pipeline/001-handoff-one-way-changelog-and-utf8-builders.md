---
date: "2026-10-10T17:53:59+01:00"
branch: "main"
git_commit: "2097285b90329faafb3fd5fd2abb89361a2c5e6f"
feature: "changelog-pipeline"
sequence: "001"
type: "handoff"
status: "superseded"
session_started: "2026-10-10T14:21:28+01:00"
session_id: "01a125f9-c16f-7269-bdae-02bcc7fbf22f"
interval_id: "a6478237-6d48-4923-b75d-3b2971654825"
start_branch: "main"
start_commit: "04cb106d8b0075119913f02aebbc0303d0904356"
source_research: "drift/citation-staleness/001-research-prior-art-derived-records-and-citation-anchoring.md"
related_artifacts: ["drift/shared-files/003-plan-derived-changelog-and-automatic-landing.md"]
---

## Objective

Make Drift's changelog/index generation one-way and robust: remove the write-back that silently reverted fragment corrections, stop doubled bullet markers, and emit UTF-8 from both builders regardless of console code page.

## Source Documents

- drift/citation-staleness/001-research-prior-art-derived-records-and-citation-anchoring.md (prior-art study grounding every change; §1 and §Design Consequences)
- drift/shared-files/003-plan-derived-changelog-and-automatic-landing.md (the original derived-changelog design this amends)

## Status

- **Completed:** all four approved fix-lane items. Full suite green: 106 tests, 100 pass, 6 platform skips, 0 fail. `build-changelog.py --check` and `build-index.py --check` pass on this repository. Committed as 2097285 on main.
- **Deferred (deliberately):** the shared `scalar()`/`parse_date()` module extraction — see Open Questions.

## What Changed

- scripts/build-changelog.py — `write_back_edits` deleted. Replaced by `normalize_body` / `committed_bodies` / `hand_edited`: a region bullet whose normalized text matches neither the current fragment nor any committed version of it (git log/show per fragment) is reported per-id and stops regeneration with exit 2 in all modes (--write, --check, --stdout); a stale view regenerates freely; a deleted fragment's bullet simply leaves the view. `read_fragment` normalizes a leading `[-*+] ` marker off the first body line only (continuation sub-bullets kept), which also heals legacy `- -` regions instead of refusing them. `main()` reconfigures stdout **and** stderr to `encoding="utf-8", newline="\n"`. Docstring rewritten for the one-way contract.
- scripts/build-index.py — same stdout/stderr UTF-8 reconfigure.
- lib/changelog.ts — `classify()` gains a branch mapping the new "edited in the generated region" builder error to a reported `unrecognised` sync outcome instead of a thrown publisher error; `readme` template and the `syncChangelog` doc comment updated to the one-way contract.
- changelog.d/README.md — this repo's instance of that template updated to match.
- skills/drift/SKILL.md — "Changelog Fragments" region rules rewritten: one-way view; region edits are reported and stop regeneration.
- extensions/drift.ts — `changelog.text` schema description now says the renderer adds the leading `- `.
- tests/changelog-build.test.ts — write-back test replaced by one-way semantics (fragment edit regenerates stale view; region edit refused in all three modes, file untouched, nothing copied back); new tests for marker normalization + nested-continuation preservation + legacy `- -` healing, and for UTF-8 output under a forced cp1252 console (`PYTHONIOENCODING=cp1252`, byte-level assertion); idempotence assertion (second build byte-identical) added to the grouping test.

## Codebase Context

- Marker comments (`START`/`END`) were kept byte-identical in scripts/build-changelog.py, lib/changelog.ts:8-9 and the tests. Changing their text would require prefix-matching compat in `split_file`, both-text handling in `adoptChangelog` (else duplicate-region insertion on existing files), and merge-driver inputs from git history. The old marker's embedded hint ("edit a bullet only if you keep its id comment") is therefore stale, but a user following it now gets a clear refusal naming the fragment rather than silent behaviour.
- The hand-edit guard distinguishes "stale view" from "hand edit" via git history of the fragment path, not stored hashes — no marker-format change, no state file, works through the existing `git()` helper (env-scrubbed, `--no-optional-locks`). Known edge: a region rendered from an *uncommitted* fragment state that is then edited again reads as a hand edit; the refusal message's remedy (put the wanted text in the fragment, rerun) is correct for that case too, and nothing is lost.
- The builders are invoked `python -I` at eight sites (git-drivers.ts:25,29; artifacts.ts:261,389; land.ts:98,106; changelog.ts:155,168). `-I` strips the script dir from sys.path on all Python versions (CPython `Modules/main.c`, `else if (!config->isolated)`), so bare sibling imports between scripts fail everywhere — the reason the UTF-8 fix must live inside each script and the shared-module extraction needs explicit `sys.path.insert(0, str(Path(__file__).resolve().parent))`.
- `python` is not on PATH on this machine; use `py`. Tests resolve the interpreter via `python()` in lib/state.ts.
- package.json (modified) and package-lock.json (untracked) in the working tree are the user's own `npm i -D @types/node` and are deliberately excluded from the commit, pending the user's decision.

## What Deviated from Plan

- The peer sessions' spec proposed a stored-hash guard "in/near the markers"; implemented as git-history comparison instead, to keep markers byte-identical (see Codebase Context). Same refuse-don't-absorb semantics, strictly less format churn.
- The shared frontmatter-module extraction was in the approved lane but is deferred: `package.json`'s `files` array ships only `scripts/build-index.py`, so a new module file requires a packaging change to a file whose uncommitted modifications are the user's own parked decision. Extraction lands with the citation-staleness implementation, which needs it anyway.

## Open Questions

- Shared module extraction: blocked on the package.json decision (`files` must include the module; the array currently omits build-changelog.py too, which looks like a pre-existing packaging gap worth fixing in the same change).
- Marker hint text: refresh the stale instruction embedded in `START` whenever a compat-matching change is justified on its own.
- The citation-staleness feature (publish-time fingerprints, pickup-time graded report, heuristic backfill) is approved and designed at the research level (see source research §Design Consequences) but has no plan artifact yet.

## Next Steps

1. Land this commit per the SKILL landing order (fetch, rebase, verify only own files, test, push) — in progress by this session.
2. When the user resolves package.json: extract `scalar()`/`parse_date()` into a scripts/ module with explicit script-relative import under `-I`, add it (and build-changelog.py) to `files`, and point both builders plus the future check-staleness.py at it.
3. Write the citation-staleness plan artifact (002) from the source research: fingerprint schema and location, lib/artifacts.ts publish-time recording, lib/pickup.ts / extensions/drift.ts report integration, scripts/check-staleness.py as backfill using the shared module.
