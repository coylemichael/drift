---
date: "2026-10-11T14:37:52+01:00"
branch: "main"
git_commit: "75c10cefbb5edeb20f7c64af56d8bbc97b3ff5ca"
feature: "readme-illustrations"
sequence: "001"
type: "handoff"
status: "complete"
session_started: "2026-10-11T14:16:51+01:00"
session_id: "01a12b1b-e16f-776d-b7ca-a22fa3775df8"
interval_id: "3f771ca2-63ce-4fe4-b695-7369ef74db8d"
start_branch: "main"
start_commit: "d3936ad17cd7d23d477e3f77c4d4dbbb9e36ef7f"
related_artifacts: []
next_session_profile: "implementation"
anchors: [{"path":"README.md","start":11,"end":11,"sha256":"1feb5b3d05e01b21195497b4a2588bdb4280636230fa7bb66ff4b07d8b768bca","context":["![Without Drift, each new session starts from zero and pays the context tax again; with Drift, sessions publish research, plan and handoff artifacts into drift/ and the next session resumes exactly where the work stopped.](assets/context-drifts.svg)","![Without Drift, each new session starts from zero and pays the context tax again; with Drift, sessions publish research, plan and handoff artifacts into drift/ and the next session resumes exactly where the work stopped.](assets/context-drifts.svg)"],"dirty":true},{"path":"README.md","start":98,"end":98,"sha256":"5399f6422200898b2e2e804e9ce24d91b8578f3c053c509b2243adef67586f70","context":["![Four Drift modes — research, plan, execute, handoff — each landing as a numbered artifact, with drift-continue looping a fresh session back to pick up the handoff.](assets/workflow-loop.svg)","![Four Drift modes — research, plan, execute, handoff — each landing as a numbered artifact, with drift-continue looping a fresh session back to pick up the handoff.](assets/workflow-loop.svg)"],"dirty":true},{"path":"README.md","start":135,"end":135,"sha256":"be1deb756c966aeeda12c4ed5345aeeb77105bc8261b59df5dfd5b297555900a","context":["![A repository tree showing drift/INDEX.md, numbered feature artifacts with status chips, changelog.d fragments and a generated CHANGELOG.md, annotated with callouts for the timeline, measured metadata with graded citations, and conflict-free changelogs.](assets/what-lands-in-repo.svg)","![A repository tree showing drift/INDEX.md, numbered feature artifacts with status chips, changelog.d fragments and a generated CHANGELOG.md, annotated with callouts for the timeline, measured metadata with graded citations, and conflict-free changelogs.](assets/what-lands-in-repo.svg)"],"dirty":true},{"path":"README.md","start":302,"end":302,"sha256":"112f416a429f446add6e0e3857e1288cded2e877eed3cb1d1f5aabf9d29aafaf","context":["![An orchestrator in the main checkout assigns three workers their own Git worktrees; all publish into one drift/INDEX.md whose rows are unioned, re-ordered and renumbered by a merge driver.](assets/parallel-workers.svg)","![An orchestrator in the main checkout assigns three workers their own Git worktrees; all publish into one drift/INDEX.md whose rows are unioned, re-ordered and renumbered by a merge driver.](assets/parallel-workers.svg)"],"dirty":true},{"path":"README.md","start":366,"end":366,"sha256":"6a605511274ee1d60def3926aa09331cd1d3cbf91b3342b3626d26958b31a8b7","context":["![Three sessions — research on a fast model, planning on a structured model, implementation on a strong model — chained by handoff documents that each declare the next session profile, every continuation starting in a fresh context window.](assets/profiled-continuation.svg)","![Three sessions — research on a fast model, planning on a structured model, implementation on a strong model — chained by handoff documents that each declare the next session profile, every continuation starting in a fresh context window.](assets/profiled-continuation.svg)"],"dirty":true}]
---

## Objective

Give the README visual explanations of what Drift does, in the style of Rig's README illustrations: a hero image for the core problem plus section diagrams, all approved by the user and embedded.

## Source Documents

None — this work started from a direct user request referencing `C:\Projects_2.0\Rig\README.md` as the style model.

## Status

- **Completed:** all five diagrams drafted, reviewed by the user, one reworked (draft 4), all approved, promoted to final names under `assets/`, and embedded into `README.md`. markdownlint-cli2 reports 0 issues.
- **In progress:** nothing.
- **Not started:** nothing required; optional polish ideas are under Next Steps.

## What Changed

- assets/context-drifts.svg (new) — hero image: "without Drift" row (transcript dies, context tax) vs "with Drift" row (artifacts in `drift/`, next session resumes). Embedded after the intro paragraph, before `## Install` (README.md:11).
- assets/workflow-loop.svg (new) — Research → Plan → Execute → Handoff boxes with filenames/status flow and a dashed loop back via `drift-continue` / `/drift`. Embedded under `## Workflow` (README.md:98).
- assets/what-lands-in-repo.svg (new) — terminal-style file tree with status chips and three callouts (one timeline, measured metadata + citation grading, changelog fragments). Embedded at the end of the Workflow intro, before `### Artifact Git policy` (README.md:135).
- assets/parallel-workers.svg (new) — orchestrator in main checkout, three workers in adopted worktrees, one merged INDEX bar. Embedded under `## Worktrees for parallel workers (Pi)` (README.md:302).
- assets/profiled-continuation.svg (new) — research/planning/implementation session cards chained by document-shaped handoff chips declaring `next_session_profile`; fresh-context band below. Embedded under `## Profile-directed continuation` (README.md:366).
- README.md — five markdown image insertions with descriptive alt text; no other prose changed by this session.
- assets/drafts/ — transient during review (five `draft-N-*.svg` plus `preview.html`); files were renamed into `assets/` and the folder removed after approval. It never existed in a commit.

## Codebase Context

- **Authorship overlap:** this interval's Git delta also contains `.markdownlint.jsonc`, `CHANGELOG.md` and other files from the editor-diagnostics session (see artifacts `drift/editor-diagnostics/001` and `002`). This session authored only the five `assets/*.svg` files and the five README image lines.
- **Design system used by all five SVGs** (reuse for future diagrams): background `#0f1311`, panels `#171c19` stroke `#2b342f`, repo/doc chips `#131a16` stroke `#1f5c4a`, text `#e8ede9` / muted `#9aa49d` / dim `#8b968f`, green accent `#2bbd97` (bright form of the logo gradient `#17806a → #2bbd97`), amber `#d2a44a`, red `#c0655a`. Fonts: `'Segoe UI', system-ui` for prose, `Consolas, 'Cascadia Code', Menlo` monospace for filenames/commands.
- **GitHub-safety constraints honoured:** self-contained dark backgrounds (render in both GitHub themes), system font stacks only, no scripts or external references — required because GitHub serves README SVGs through camo as `<img>`.
- **Layout math for SVG text:** no auto-wrap; line positions are hand-placed. Width estimates used: ~0.52×font-size per char for Segoe UI, ~0.6× for monospace. Draft 4's first version overflowed its 116px chips with `profile: implementation` — the fix was 160px folded-corner document chips with three short centred lines and a single arrow passing behind the (opaque) chip.
- `.markdownlint.jsonc` allows `p/img/h3/em/br/a` HTML (MD033); plain markdown `![alt](path)` image syntax was used, so no config change was needed. MD013 (line length) is off, so long alt-text lines are fine.
- Verification used: `py -c "xml.etree.ElementTree.parse(...)"` for SVG well-formedness (`python` alias is not installed on this machine; use `py`), and `npx --no-install markdownlint-cli2 README.md` (v0.23.3, 0 issues).

## What Deviated from Plan

No written plan existed; the user asked for "a handful of drafts". Five angles were drafted, the user approved four immediately and rejected draft 4's first version (text overflow, awkward `next_session_` line split, chips colliding with card dividers); the rework was approved. Hero placement (draft 1 at the top) followed this session's recommendation without objection.

## Open Questions

- None blocking. Cosmetic option: the drift-logo at the README top is dark-on-transparent while the new diagrams are self-backgrounded dark; a `<picture>` light/dark variant for the logo would unify appearance in GitHub light theme, but the user has not asked for it.

## Next Steps

1. Review the rendered README on GitHub after the next push — confirm the five SVGs render at full width through camo and the alt text reads well.
2. (Optional) If any diagram needs tweaking later, edit the SVG in `assets/` directly; the palette and layout conventions are in Codebase Context above.
