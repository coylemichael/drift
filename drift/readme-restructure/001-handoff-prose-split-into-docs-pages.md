---
date: "2026-10-11T14:53:42+01:00"
branch: "main"
git_commit: "b94f17dda1459970b055880d88723a941f726858"
feature: "readme-restructure"
sequence: "001"
type: "handoff"
status: "complete"
session_started: "2026-10-11T14:42:32+01:00"
session_id: "01a12b1b-e16f-776d-b7ca-a22fa3775df8"
interval_id: "97f70648-eb55-4e83-8e6a-97cc6d76b019"
start_branch: "main"
start_commit: "75c10cefbb5edeb20f7c64af56d8bbc97b3ff5ca"
related_artifacts: ["drift/readme-illustrations/001-handoff-five-svg-diagrams-embedded.md"]
next_session_profile: "implementation"
---

## Objective

Reduce the README's prose density by moving reference-manual detail into focused `docs/` pages, keeping the front page as pitch + images + summaries + links.

## Source Documents

- drift/readme-illustrations/001-handoff-five-svg-diagrams-embedded.md (related prior work: the five diagrams this restructure keeps on the front page)

## Status

- **Completed:** full split executed as agreed — seven new docs pages, README rewritten from 471 to 253 lines, markdownlint clean (8 files, 0 issues), all five SVG diagrams retained in the README.
- **In progress:** nothing.
- **Not started:** nothing required.

## What Changed

Mapping from the pre-split README (471-line version at commit b94f17d) to new files; prose moved near-verbatim with cross-links added:

- docs/install.md (new) — old README lines 13–79 (Pi reload nuance, self-healing workflow binding, stale-copy retirement, Claude Code/Zed install, naming), plus two paragraphs that had been stranded at the end of the Landing section: the Zed `/`-menu adapter note and the extension-reload note.
- docs/artifact-git-policy.md (new) — old lines 137–192 (tracking opt-in, `/drift-track-artifacts` semantics, index merge driver, worktrees in private mode).
- docs/changelog.md (new) — old lines 193–235 (fragment trigger, format, hand-edit detection, changelog merge driver).
- docs/citation-anchors.md (new) — old lines 236–256; the standalone checker invocation became a fenced block.
- docs/landing.md (new) — old lines 257–290 (land config, full sequence, guard, halt behaviour); gained a closing paragraph on adopted-branch landing config drawn from the Worktrees section.
- docs/worktrees.md (new) — old lines 300–363 (adoption table and full semantics).
- docs/continuation.md (new) — old lines 364–411 (manual default, auto-continue, model profile config and starting policy) under a new "Model profiles" subheading.
- README.md — Install trimmed to the two commands + self-healing one-liner + link; Commands table intro reworded and six rows link out via "([details](docs/...))"; the four `###` reference sections, the Worktrees body (below its table) and the Continuation body replaced with 7–10 line summaries ending in a docs link. Kept verbatim: header/intro/hero, Commands table rows' descriptions, the whole Workflow section, Worktrees intro + command table, Continuation's first paragraph, User decision checkpoints, Picking up work, What Pi automates, Development. The "Review artifacts before committing" caution was kept user-facing in the README's Artifact Git policy summary.

## Codebase Context

- **Nothing was deleted, only moved:** every behavioural guarantee from the old README exists either in a docs page or a README summary. If a future session can't find a claim in the README, grep `docs/`.
- **Docs page conventions established:** H1 title matching the old section name, a "Part of [Drift](../README.md)." context line, prose, and relative cross-links between pages where topics interact (landing ↔ changelog/artifact-git-policy drivers, continuation ↔ worktrees/landing, install → continuation).
- **README heading anchors changed meaning:** the `###` sections still exist with the same names, so inbound fragment links (e.g. `#landing-per-repository`) keep working, but they now contain summaries.
- `docs/shared-files-plan.html` already existed in docs/ and was left untouched.
- Lint: `npx --no-install markdownlint-cli2 README.md "docs/*.md"` — 0 issues; repo config `.markdownlint.jsonc` (MD013 off, MD033 allowlist, MD041 off) applies to docs/ too.

## What Deviated from Plan

Two small additions beyond the agreed table: (1) the Zed adapter and extension-reload paragraphs at the end of the old Landing section were general install/host notes in the wrong place, so they moved to docs/install.md rather than docs/landing.md; (2) docs/landing.md gained a cross-reference paragraph about adopted branches controlling `land.auto`, duplicated from worktrees semantics, because landing is where that risk bites. Both are relocations/clarifications, not new behaviour claims.

## Open Questions

None. Optional future polish: a one-line docs index table in the README (the linked Commands table already serves this role).

## Next Steps

1. Commit and push; review the rendered README and the seven docs pages on GitHub — in particular that relative links `docs/*.md` ↔ `../README.md` resolve on both the repo front page and inside docs/.
2. If any summary reads as too terse, pull one sentence back from its docs page rather than regrowing the section.
