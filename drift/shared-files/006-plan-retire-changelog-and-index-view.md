---
date: "2026-10-23T20:20:12+01:00"
branch: "main"
git_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
feature: "shared-files"
sequence: "006"
type: "plan"
status: "complete"
session_started: "2026-10-20T10:59:59+01:00"
session_id: "01a13c36-3c70-7052-9825-2ca6aeedb072"
interval_id: "66b9319c-db55-4c09-96d4-7f2c0949cb71"
start_branch: "main"
start_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
source_research: "drift/shared-files/005-research-retire-changelog-and-assess-index-view.md"
related_artifacts: ["drift/shared-files/001-research-shared-files-under-many-agents.md","drift/shared-files/003-plan-derived-changelog-and-automatic-landing.md","drift/shared-files/004-research-release-step-prior-art-and-tag-derived-changelog.md","drift/auto-continue/005-handoff-two-mode-continuation-built-live-check-pending.md"]
anchor_coverage: {"status":"partial","eligible":31,"captured":25,"skipped_count":6,"skipped_by_reason":{"file-not-found":6},"skipped":[{"reference":"hosts/pi.md:31","reason":"file-not-found"},{"reference":"research.md:60","reason":"file-not-found"},{"reference":"plan.md:68","reason":"file-not-found"},{"reference":"handoff.md:75","reason":"file-not-found"},{"reference":"execute.md:47","reason":"file-not-found"},{"reference":"github/workflows/ci.yml:31","reason":"file-not-found"}]}
anchors: [{"path":"scripts/build-index.py","start":49,"end":51,"sha256":"179c340a8db8e2816c5dadd864e73b46856330f0ab988d2e1e6ee43fcdd2bb98","context":["INDEX_HEADER = \"| # | Date | Feature | Type | Artifact |\"","INDEX_UNDATED = re.compile(r\"^- (?P<feature>.+?) / \\[(?P<title>.+?)\\]\\((?P<path>.+?)\\)$\")"]},{"path":"lib/git-drivers.ts","start":9,"end":14,"sha256":"f3421c677a68e88d6cb9e8775c7c59f6b0649b455bd6054f7b496d753c8be5b6","context":["export const indexDriver = { name: \"drift-index\", description: \"Drift index row merge\", path: \"drift/INDEX.md\" } as const;","const changelogBuilder = fileURLToPath(new URL(\"../scripts/build-changelog.py\", import.meta.url));"]},{"path":"lib/state.ts","start":178,"end":220,"sha256":"0334c82dbd91b8683297c892a552bf6c97a83bda36227814bd4f89fdcc793504","context":["  /** `auto`: on only where the committed CHANGELOG.md carries Drift's markers; never adopts. `on`/`off`: the repo's explicit override. */","      tags: (typeof changelog === \"object\" && changelog.tags?.trim()) || \"v*\","],"dirty":true},{"path":"lib/state.ts","start":366,"end":380,"sha256":"abdda88ca1374209f37b0f1ed39f5e4b640b878cba2cd28ecb3118bb6e5702fc","context":["const catalogBuilder = fileURLToPath(new URL(\"../scripts/build-index.py\", import.meta.url));","            : entry.date !== null || entry.row !== null) ||"],"dirty":true},{"path":"lib/state.ts","start":758,"end":768,"sha256":"807a9aae614933bb3bf5107afcdcfb8e65dc7cecc31fa7fb13783e0c0ab924a9","context":["    try {","      lines.push(`Recent artifact discovery unavailable: ${String(error).slice(0, 600)}. No stale index fallback was used.`);"],"dirty":true},{"path":"lib/artifacts.ts","start":21,"end":25,"sha256":"63e525081dac644ea7b599c4c5821e9fe4b8696b7447c62be271ddeeb425b2c2","context":["  /** One changelog bullet when the repo has opted in; null or blank text means no entry is requested. */","const fragmentPathPattern = /^changelog\\.d\\/[A-Za-z0-9][A-Za-z0-9_-]{0,159}\\.md$/;"]},{"path":"lib/land.ts","start":5,"end":10,"sha256":"8c13785c39113a5ecca8c344d23874ee695ff8c8cc88656832a8989bfa6a48a1","context":["import { changelogState } from \"./changelog.ts\";","const changelogBuilder = fileURLToPath(new URL(\"../scripts/build-changelog.py\", import.meta.url));"]},{"path":"extensions/drift.ts","start":5,"end":7,"sha256":"6153167e7954e356dd7fc583d257e6ca6e23e85123cb2490e28524dae9a4269b","context":["import { ensureIndexAttribute, hasArtifacts, publish, setArtifactTracking, syncIndex, trackArtifacts, type TrackingRequest } from \"../lib/artifacts.ts\";","import { attributeFor, changelogDriver, changelogDriverCommand, indexDriver, indexDriverCommand, installDriver } from \"../lib/git-drivers.ts\";"],"dirty":true},{"path":"lib/pickup.ts","start":4,"end":4,"sha256":"c009e436c91985b7baea8a84361d78b09aea7437d09653d6bba7975ed88ed3fe","context":["import { artifactLifecycle, artifactStore, exists, python, readArtifactCatalog, run, safePath, supersessionNote } from \"./state.ts\";","import { artifactLifecycle, artifactStore, exists, python, readArtifactCatalog, run, safePath, supersessionNote } from \"./state.ts\";"]},{"path":"skills/drift/SKILL.md","start":95,"end":95,"sha256":"42d20aa4bb0ae30607ec800dd5d1fadead8a4e4a2496ca103bc5fc13dfbba2cf","context":["  INDEX.md","  INDEX.md"]},{"path":"package.json","start":31,"end":35,"sha256":"2194293088869e0d73b4b9cf439e25b254cbda2901cd7b1cc5f9edfa52e4fc21","context":["    \"scripts/build-index.py\",","    \"CHANGELOG.md\","]},{"path":"tests/drift.test.ts","start":814,"end":814,"sha256":"c221a9ae8d4f2f145cce5bcc8fbca61b16a37515170540f52b186bc9bdfc2a4b","context":["test(\"Drift configuration accepts trackArtifacts, changelog, autoContinue and land, rejects anything else, and partial updates keep other fields\", async (t) => {","test(\"Drift configuration accepts trackArtifacts, changelog, autoContinue and land, rejects anything else, and partial updates keep other fields\", async (t) => {"],"dirty":true},{"path":"tests/pi-runtime.test.ts","start":386,"end":386,"sha256":"932617d07c9b19799b5c48b0608fc40b783179364beddd58229e0dbd39aeac54","context":["test(\"actual Pi recovers research with null or blank changelog arguments while generation stays off\", { skip: !piPresent, timeout: 90_000 }, async (t) => {","test(\"actual Pi recovers research with null or blank changelog arguments while generation stays off\", { skip: !piPresent, timeout: 90_000 }, async (t) => {"],"dirty":true},{"path":"tests/worktrees.test.ts","start":256,"end":256,"sha256":"91eda4391ab0efafd53260a7aea8a85ccb0cb0c6e51a06347a334ec4ffaf81f4","context":["test(\"private artifacts stay in the main store while metadata and fragments come from the adopted worktree\", async (t) => {","test(\"private artifacts stay in the main store while metadata and fragments come from the adopted worktree\", async (t) => {"]},{"path":"tests/drift.test.ts","start":172,"end":172,"sha256":"13a69bab58523f2744c30e436ad346b29f1f51b1f4ffe4f43828a08a1531b6af","context":["test(\"publication supplies original metadata, stable numbering, references and a canonical index\", async (t) => {","test(\"publication supplies original metadata, stable numbering, references and a canonical index\", async (t) => {"],"dirty":true},{"path":"tests/pi-runtime.test.ts","start":366,"end":366,"sha256":"2fe034544b93c48d99a0ba6e1005482895c510b066d6a001ffd7dc4f2d3476f3","context":["test(\"actual Pi installs the index merge driver at session start in a tracked clone that carries the attribute\", { skip: !piPresent, timeout: 60_000 }, async (t) => {","test(\"actual Pi installs the index merge driver at session start in a tracked clone that carries the attribute\", { skip: !piPresent, timeout: 60_000 }, async (t) => {"],"dirty":true},{"path":"tests/pickup.test.ts","start":31,"end":31,"sha256":"ba535aef8302d022fd44e0e3828256675070a42a7006010a1a32a458f05dab5e","context":["test(\"/drift finds raw artifacts when a missing index cannot be generated under Git policy\", async (t) => {","test(\"/drift finds raw artifacts when a missing index cannot be generated under Git policy\", async (t) => {"]},{"path":"tests/catalog.test.ts","start":147,"end":147,"sha256":"1b18d8fac87a86a861408e3eb8eee58894a9fab92dc210a3100184f45efb9aeb","context":["test(\"raw read failures surface honestly without a stale-index fallback\", async (t) => {","test(\"raw read failures surface honestly without a stale-index fallback\", async (t) => {"]},{"path":"tests/pi-runtime.test.ts","start":347,"end":347,"sha256":"38745dd40615fbf2eae20180f4512102deb91f17c7cc672b6e78752078b4f906","context":["test(\"actual Pi /drift picks up raw artifacts even when the index view cannot be refreshed\", { skip: !piPresent, timeout: 60_000 }, async (t) => {","test(\"actual Pi /drift picks up raw artifacts even when the index view cannot be refreshed\", { skip: !piPresent, timeout: 60_000 }, async (t) => {"],"dirty":true},{"path":"README.md","start":65,"end":65,"sha256":"be8383d585e46e9fb0bdc84c56ed64e0bae98326d55a0c5de831dca4db91153f","context":["| `/drift-changelog on\\|off\\|status` | Whether `CHANGELOG.md` is generated from `changelog.d/` fragments (never automatic: on where a committed `CHANGELOG.md` carries Drift's markers or `.drift.json` turns it on). ([details](docs/changelog.md)) |","| `/drift-changelog on\\|off\\|status` | Whether `CHANGELOG.md` is generated from `changelog.d/` fragments (never automatic: on where a committed `CHANGELOG.md` carries Drift's markers or `.drift.json` turns it on). ([details](docs/changelog.md)) |"],"dirty":true},{"path":"docs/artifact-git-policy.md","start":43,"end":54,"sha256":"41facfd4caa34580f45cfaee24f93e120d5784da89212d200d43d902309c8003","context":["Drift writes `drift/INDEX.md merge=drift-index` to `.gitattributes` at session","git config merge.drift-index.driver \"python3 -I /path/to/drift/scripts/build-index.py --merge %O %A %B\""]},{"path":"docs/landing.md","start":15,"end":15,"sha256":"609163ad1cb2b351a31ae4688371949ec6ca87debee49fff96b032b9a666a58e","context":["[index](artifact-git-policy.md) and [changelog](changelog.md) drivers resolve","[index](artifact-git-policy.md) and [changelog](changelog.md) drivers resolve"]},{"path":"docs/worktrees.md","start":36,"end":37,"sha256":"b2a4c7fcbb4d46d270c4f9296f08ed24e2b5bce965881b4090c0563c05d2434b","context":["  metadata, numbering, index, publication, refs, changelog fragments,","  `/drift-track-artifacts`, `/drift-changelog`, `/drift-auto-continue`,"],"dirty":true},{"path":"assets/context-drifts.svg","start":98,"end":98,"sha256":"812ca1d5aa0ea4ad20ed3fa51f533452953822e3bfb8d6071df2744f8899d4d9","context":["  <text class=\"m\" x=\"426\" y=\"522\" font-size=\"11.5\" fill=\"#8b968f\">INDEX.md &#8212; chronological timeline</text>","  <text class=\"m\" x=\"426\" y=\"522\" font-size=\"11.5\" fill=\"#8b968f\">INDEX.md &#8212; chronological timeline</text>"]},{"path":"assets/parallel-workers.svg","start":68,"end":68,"sha256":"4eab5afd92a4b8a31fb7eaf6a0d84fa514167c7018f9744dcb749ebbfa21a7fe","context":["  <text class=\"m\" x=\"640\" y=\"500\" text-anchor=\"middle\" font-size=\"14\" fill=\"#2bbd97\">drift/INDEX.md &#8212; one chronological timeline</text>","  <text class=\"m\" x=\"640\" y=\"500\" text-anchor=\"middle\" font-size=\"14\" fill=\"#2bbd97\">drift/INDEX.md &#8212; one chronological timeline</text>"]}]
---

## Objective

Retire Drift's changelog feature and its generated `drift/INDEX.md` view entirely, and tidy both out of the user's repositories (drift, Rig, dotfiles).

History stays in three places:
- **Commit messages:** they say what changed and why, and name the Drift artifact.
- **Handoffs.**
- **The raw-artifact catalog:** it already drives `/drift` pickup and the per-session "Recent project artifacts" list.

## Source Research

- drift/shared-files/005-research-retire-changelog-and-assess-index-view.md (inventory, usage evidence)
- Background: drift/shared-files/001 (original design), drift/shared-files/004 (release-step analysis, now moot)

## Starting Point

Step 0 first: commit the uncommitted auto-continue work. It is plan `drift/auto-continue/004…` / handoff `005`, and it touches `extensions/drift.ts`, `lib/state.ts`, `lib/routing.ts`, tests, `README.md`, `docs/continuation.md`, `docs/worktrees.md` and `skills/drift/hosts/pi.md`. Committing it keeps this retirement a separate, reviewable change. Commit only with the user's approval.

Then do the code removals (steps 1–2), the cleanup tool (3), skill/docs (4) and tests (5), and apply the cleanup to the repos last (6).

## Key Files

Line references are from research 005; the working tree includes the auto-continue edits.

- `scripts/build-changelog.py`, `scripts/clean-changelog-residue.py`, `lib/changelog.ts` — the changelog implementation (whole files)
- `scripts/build-index.py:49-51, 96, 141-183, 202, 220, 276-308` — catalog (`catalog()`, `--json`, `row`) versus view (default write, `--stdout`, `--check`, `--merge`, `parse_index`, `merge_rows`, `write_index`)
- `lib/git-drivers.ts:9-14, 24-29` — index and changelog drivers and attribute lines; `installDriver`/`attributeFor`/`hasAttribute` are generic
- `lib/state.ts:178-220` — the `changelog` config field and validation; `:366-380` `readArtifactCatalog` (keep); `:758-768` recent rows (keep)
- `lib/artifacts.ts:21-25, 50, 72-89, 110, 137, 197-228, 245-281, 338-349, 368-425` — changelog input/validation/fragment write, index probe/attribute/sync/publish write
- `lib/land.ts:5-10, 25, 46, 94-110, 126` — `knownLines`, owned files, `verifyDerived`
- `extensions/drift.ts:5-7, 70-75, 140-190, 367-382, 462-467, 590, 601-623, 647` — `refreshIndex` (session-start hook), driver installs, `/drift-changelog`, session-context "Changelog:" line, prompt guideline, `drift_publish` `changelog` param, `Index:`/`Fragment:`/`Changelog:` result lines
- `lib/pickup.ts:4, 85` — catalog-only (keep)
- `skills/drift/SKILL.md:95, 159-256, 292`; `hosts/pi.md:31, 47`; `research.md:60`; `plan.md:68`; `handoff.md:75`; `execute.md:47`
- `.gitattributes:2`; `package.json:31-35`; `.github/workflows/ci.yml:31, 47`
- Tests:
  - changelog: `tests/changelog-build.test.ts`, `tests/changelog-residue.test.ts`, `tests/drift.test.ts:814, 839, 892, 921, 931, 966, 1067, 1123`, `tests/pi-runtime.test.ts:386, 439, 511, 537, 827`, `tests/worktrees.test.ts:256`
  - index view: `tests/index-merge.test.ts`, `tests/drift.test.ts:172, 327, 460, 505, 565, 625, 651, 670-691, 713, 733, 1120`, `tests/pi-runtime.test.ts:366, 537`
  - catalog (reword only): `tests/pickup.test.ts:31, 42, 68, 94, 159`, `tests/catalog.test.ts:147`, `tests/pi-runtime.test.ts:347`
- Docs:
  - `README.md:65, 85, 92, 119, 127, 134-143, 173, 187, 244-264, 292`
  - `docs/changelog.md`, `docs/artifact-git-policy.md:43-54, 62`, `docs/landing.md:15, 28-29`, `docs/worktrees.md:36-37`, `docs/shared-files-plan.html`
  - `assets/what-lands-in-repo.svg`, `assets/context-drifts.svg:98`, `assets/parallel-workers.svg:68`

## Implementation Sequence

0. **Commit the auto-continue work (user approval required).**
   - Commit the 10 modified files from plan 004.
   - Drop the untracked fragment `changelog.d/auto-continue-005-…` and the regenerated `CHANGELOG.md` from that commit; they disappear in this plan.
   - Verify: `git status` shows only ignored `drift/`.

1. **Remove the changelog feature from the code.**
   - Delete `scripts/build-changelog.py` and `lib/changelog.ts`.
   - Delete `scripts/clean-changelog-residue.py`; step 3 replaces it.
   - `lib/git-drivers.ts`: remove the changelog driver, attribute and command.
   - `lib/state.ts`:
     - remove `changelog` from `DriftConfig` and `configShape`;
     - **accept and ignore** an existing `changelog` key, so `.drift.json` files in the field keep validating;
     - keep the other keys strict.
   - `lib/artifacts.ts`: remove `ArtifactInput.changelog`, the fragment path/validation/write/pending check and the receipt `fragment`.
   - `lib/land.ts`: remove `changelog.d/`/`CHANGELOG.md` from owned files and `knownLines`, and the changelog `verifyDerived` branch.
   - `extensions/drift.ts`:
     - remove `/drift-changelog`, `syncChangelog`/`installChangelogDriver`/`describeSync`, the session-context "Changelog:" lines and the `changelog` parameter from the `drift_publish` schema;
     - remove the `Fragment:`/`Changelog:` result lines.
   - `package.json`: stop shipping `scripts/build-changelog.py`.
   - `.github/workflows/ci.yml`: remove the `build-changelog.py --check` step and the tag-fetch comment at :31 if it exists only for it.
   - Verify: `npm run typecheck`; `rg -n "changelog" lib extensions scripts` shows only the ignored-config tolerance and the step-3 cleanup.

2. **Remove the `INDEX.md` view; keep the catalog.**
   - `scripts/build-index.py`:
     - keep `catalog()`, the scan, the `row` formatting and `--json`;
     - **the default mode must no longer write**: replace it with a print-only listing (the same table to stdout, no file);
     - delete `--check`, `--merge`, `parse_index`, `merge_rows`, `write_index`, `merge` and the merge-driver docstring.
   - `lib/artifacts.ts`:
     - remove `syncIndex`, `ensureIndexAttribute`, the index attribute on tracking-on and the `INDEX.md` policy probe; keep the artifact probe;
     - remove the publish index render/write/verify;
     - **keep a publish safety check** by confirming the new artifact appears in `readArtifactCatalog` (or the parsed frontmatter round-trips) instead of the rendered index.
   - `lib/git-drivers.ts`: remove the index driver and attribute. Delete the module if nothing generic remains in use.
   - `lib/land.ts`: remove the index `verifyDerived` branch and `knownLines` entry; the "derived" stage may disappear entirely.
   - `extensions/drift.ts`:
     - rename `refreshIndex` to a session-start preparation hook, keeping the two-stores notice and the record baseline order;
     - **unset Drift-installed clone config `merge.drift-index.*` and `merge.drift-changelog.*` if present**, so a leftover `.gitattributes` line falls back silently to git's text merge;
     - remove `installIndexDriver` and the `Index: drift/INDEX.md` result line, and reword the :590 guideline.
   - The session-context recent list stays, sourced from the catalog.
   - Verify: typecheck; publishing in a fixture writes the artifact and no `drift/INDEX.md`.

3. **Retirement tool for adopted repos: `scripts/retire-index-and-changelog.py <repo> [--apply]`.**
   - The default is a dry run listing every action. `--apply` performs them; it never stages or commits, and it prints the suggested `git add -A … && git commit` line.
   - Actions:
     - (a) `CHANGELOG.md` with Drift markers: remove the two marker lines and the trailing `<!-- changelog.d/… -->` id comments, keeping all text as frozen history;
     - (b) delete `changelog.d/` (`git rm -r` when tracked);
     - (c) delete `drift/INDEX.md` (`git rm` when tracked, plain delete when ignored);
     - (d) remove `drift/INDEX.md merge=drift-index` and `CHANGELOG.md merge=drift-changelog` from `.gitattributes`, deleting the file only if Drift's lines were its sole content;
     - (e) `git config --unset-all` both drivers' `name` and `driver` in the clone;
     - (f) remove a `changelog` key from `.drift.json`, preserving the other keys and refusing on malformed JSON.
   - It refuses mid-merge or rebase, leaves foreign changelog systems alone (towncrier, changesets, newsfragments), and is idempotent.
   - Verify: unit tests on fixtures (tracked, private, foreign, already-clean, re-run).

4. **Skill and docs. Disjoint from steps 1–3 except prompt wording; can be delegated.**
   - `SKILL.md`:
     - delete §"The Root Index" (Format, Updating, Rebuilding) and §"Changelog Fragments";
     - remove the index and changelog parts of §"Derived Files Under Many Agents", or delete the section if only landing text remains (move landing to §Landing);
     - `INDEX.md` leaves the layout tree;
     - "status is not an index column" → catalog wording; Timestamps "orders the index" → "orders the catalog and pickup";
     - Artifact Git Policy: drop `changelog` from the config field list, noting it is ignored if present.
   - Add a short §"Project history":
     - commit messages state what changed and why, and name the Drift artifact path;
     - to learn a project's history, read `git log`, recent handoffs and the recent-artifact list;
     - no changelog or index file is maintained.
   - `research.md:60`, `plan.md:68`, `handoff.md:75`: remove the "update the view" lines. `execute.md:47`: drop the `INDEX.md` mention. `hosts/pi.md:31, 47`: remove the changelog-argument and index-refresh text.
   - `README.md`: remove the `/drift-changelog` row and §"Changelog from fragments", and the `INDEX.md` mentions. Describe the catalog and the print-only listing.
   - Delete `docs/changelog.md`.
   - Update `docs/artifact-git-policy.md`, `docs/landing.md` and `docs/worktrees.md`.
   - `docs/shared-files-plan.html`: add a dated "retired" note at the top rather than rewriting history. Leave `docs/field-observations.md` (historical).
   - SVGs: remove the `INDEX.md`/`changelog.d` labels where simple; otherwise list them for the user.
   - Verify: `rg -n "INDEX\.md|changelog\.d|drift-changelog|drift-index" README.md docs skills` shows only historical or retired notes.

5. **Tests.**
   - Delete the changelog tests and the index-view tests listed in Key Files.
   - Reword the catalog and pickup tests so they assert no `INDEX.md` is created.
   - Add tests:
     - publish writes no `INDEX.md` and no fragment, and its result has no `Index:`/`Changelog:` lines;
     - `drift_publish` no longer advertises `changelog`;
     - `.drift.json` with `"changelog": true` is accepted and ignored;
     - session start unsets leftover driver config;
     - `build-index.py` default mode writes nothing;
     - the retire tool's dry run and apply (step 3).
   - Verify: `npm test`, `npm run typecheck`. `npm run lint` needs `ruff`; install it or note it as unavailable.

6. **Apply the cleanup to the user's repos, and verify live.**
   - For each repo (drift, Rig, dotfiles): run the dry run and show the user the output.
   - With the user's approval, run `--apply`, then commit per repo (user approval). Rig must be idle; it is tracked, so changes are `git rm`.
   - `/reload` or restart Zed, then publish one artifact in each tracked repo and confirm:
     - no `INDEX.md` or fragment is written;
     - the session context has no "Changelog:" line;
     - the recent list still shows.
   - Publish a completing handoff for this plan. There is no changelog entry, by design.

## Decisions & Constraints

- **User decision (2026-10-23): retire both the changelog feature and the `INDEX.md` view, and tidy existing repos.**
  - The evidence is research 005.
  - Perimeter's historical index use (377 `tail`/`grep` reads) predates the per-session recent list and stopped because work there paused. Rig is the active project.
- **Kept:**
  - the raw catalog (`build-index.py --json`, `readArtifactCatalog`), `/drift` pickup and the per-session recent rows;
  - the `#` running number in those rows;
  - `scripts/_driftmeta.py`;
  - the landing sequence (it is not view-specific) and `/drift-land`.
- **Defaults chosen** (flip if the user prefers):
  - existing `CHANGELOG.md` files are kept as frozen plain history rather than deleted;
  - `changelog.d/` and `drift/INDEX.md` are deleted;
  - the `.drift.json` `changelog` key is removed by the retire tool and tolerated by Drift.
- **Never commit or delete in a user repo without approval.** The retire tool is dry-run by default and never commits.
- **Field safety:** leftover `.gitattributes` lines must become harmless. Drift unsets its own clone driver config at session start, and git falls back silently to a text merge for an undefined driver (shared-files/001 §3).
- **Drift's own releases** continue via tags and commit messages; `package.json` version bumps are unchanged.
- **Never delete Drift records or Pi session logs.**

## Open Questions

- Keep or delete the frozen `CHANGELOG.md` files? The default is keep. The user said nobody reads them; deleting is a one-line change to the retire tool.
- Should the per-session recent list show more than 8 rows now that it is the only timeline view?
- Should the retire tool also be exposed as a `/drift-…` command for other users' repos, or stay a script?
