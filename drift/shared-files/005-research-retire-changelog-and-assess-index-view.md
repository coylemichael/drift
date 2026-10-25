---
date: "2026-10-23T19:28:07+01:00"
branch: "main"
git_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
feature: "shared-files"
sequence: "005"
type: "research"
status: "complete"
session_started: "2026-10-20T10:59:59+01:00"
session_id: "01a13c36-3c70-7052-9825-2ca6aeedb072"
interval_id: "66b9319c-db55-4c09-96d4-7f2c0949cb71"
start_branch: "main"
start_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
related_artifacts: ["drift/shared-files/001-research-shared-files-under-many-agents.md","drift/shared-files/003-plan-derived-changelog-and-automatic-landing.md","drift/shared-files/004-research-release-step-prior-art-and-tag-derived-changelog.md","drift/auto-continue/005-handoff-two-mode-continuation-built-live-check-pending.md"]
anchor_coverage: {"status":"partial","eligible":52,"captured":40,"skipped_count":12,"skipped_by_reason":{"file-not-found":12},"skipped":[{"reference":"github/workflows/ci.yml:47","reason":"file-not-found"},{"reference":"hosts/pi.md:31","reason":"file-not-found"},{"reference":"SKILL.md:21","reason":"file-not-found"},{"reference":"handoff.md:146","reason":"file-not-found"},{"reference":"execute.md:22","reason":"file-not-found"},{"reference":"research.md:60","reason":"file-not-found"},{"reference":"plan.md:68","reason":"file-not-found"},{"reference":"handoff.md:75","reason":"file-not-found"},{"reference":"hosts/pi.md:47","reason":"file-not-found"},{"reference":"execute.md:47","reason":"file-not-found"},{"reference":"parallel-workers.svg:68","reason":"file-not-found"},{"reference":"what-lands-in-repo.svg:27","reason":"file-not-found"}]}
anchors: [{"path":"extensions/drift.ts","start":6,"end":6,"sha256":"f86e5310d0d862bb9c82231b07189a28ac19a5ac9f6712f1b12b84a60a76dda9","context":["import { changelogState, sections, setChangelog, syncChangelog, type ChangelogRequest, type ChangelogSync } from \"../lib/changelog.ts\";","import { changelogState, sections, setChangelog, syncChangelog, type ChangelogRequest, type ChangelogSync } from \"../lib/changelog.ts\";"],"dirty":true},{"path":"lib/artifacts.ts","start":8,"end":8,"sha256":"6e3f476fc216bee38421da017a32bcb752a196797e51155dd3036643269ab4fd","context":["import { changelogState, sections } from \"./changelog.ts\";","import { changelogState, sections } from \"./changelog.ts\";"]},{"path":"lib/land.ts","start":5,"end":5,"sha256":"21c2f65508e30d0daad530ff5b4c087afa4d1ef356e163ee2e3b33a78581f0f0","context":["import { changelogState } from \"./changelog.ts\";","import { changelogState } from \"./changelog.ts\";"]},{"path":"package.json","start":32,"end":32,"sha256":"b86ac4b993441dc80333e4aff480a318b0dd5e90097e973fd971db3d6b471d62","context":["    \"scripts/build-changelog.py\",","    \"scripts/build-changelog.py\","]},{"path":"package.json","start":35,"end":35,"sha256":"e363269004d4a478ff95756d902784d5e8c83a17adca1c86e387c5b4c27bccd0","context":["    \"CHANGELOG.md\",","    \"CHANGELOG.md\","]},{"path":"README.md","start":65,"end":65,"sha256":"be8383d585e46e9fb0bdc84c56ed64e0bae98326d55a0c5de831dca4db91153f","context":["| `/drift-changelog on\\|off\\|status` | Whether `CHANGELOG.md` is generated from `changelog.d/` fragments (never automatic: on where a committed `CHANGELOG.md` carries Drift's markers or `.drift.json` turns it on). ([details](docs/changelog.md)) |","| `/drift-changelog on\\|off\\|status` | Whether `CHANGELOG.md` is generated from `changelog.d/` fragments (never automatic: on where a committed `CHANGELOG.md` carries Drift's markers or `.drift.json` turns it on). ([details](docs/changelog.md)) |"],"dirty":true},{"path":"docs/landing.md","start":15,"end":15,"sha256":"609163ad1cb2b351a31ae4688371949ec6ca87debee49fff96b032b9a666a58e","context":["[index](artifact-git-policy.md) and [changelog](changelog.md) drivers resolve","[index](artifact-git-policy.md) and [changelog](changelog.md) drivers resolve"]},{"path":"docs/worktrees.md","start":36,"end":37,"sha256":"b2a4c7fcbb4d46d270c4f9296f08ed24e2b5bce965881b4090c0563c05d2434b","context":["  metadata, numbering, index, publication, refs, changelog fragments,","  `/drift-track-artifacts`, `/drift-changelog`, `/drift-auto-continue`,"],"dirty":true},{"path":"docs/artifact-git-policy.md","start":62,"end":62,"sha256":"b9fb2ccafdca8b2254c4cecd078b462797075c5af0b4a0da95976868ac985b84","context":["removed. `.drift.json`, changelog fragments and record metadata still come from","removed. `.drift.json`, changelog fragments and record metadata still come from"]},{"path":"docs/field-observations.md","start":118,"end":264,"sha256":"269974f691679d5d87923aa7a522e4fce74ede454d31a6380f866422fae5c68e","context":["### 2026-10-13 — Changelog policy holds; unchanged publication retry fails again","  changelog entry, configuration and policy unchanged, and no product-document or"]},{"path":"assets/what-lands-in-repo.svg","start":32,"end":32,"sha256":"ab37f191b48bea9ddbb05c67b21076fdcd4bbbf37fe92d7c66cb85bdf0e75075","context":["  <text class=\"m tree\" x=\"84\" y=\"376\"><tspan class=\"treedim\">&#9500;&#9472; </tspan>changelog.d/</text>","  <text class=\"m tree\" x=\"84\" y=\"376\"><tspan class=\"treedim\">&#9500;&#9472; </tspan>changelog.d/</text>"]},{"path":"tests/drift.test.ts","start":814,"end":814,"sha256":"c221a9ae8d4f2f145cce5bcc8fbca61b16a37515170540f52b186bc9bdfc2a4b","context":["test(\"Drift configuration accepts trackArtifacts, changelog, autoContinue and land, rejects anything else, and partial updates keep other fields\", async (t) => {","test(\"Drift configuration accepts trackArtifacts, changelog, autoContinue and land, rejects anything else, and partial updates keep other fields\", async (t) => {"],"dirty":true},{"path":"tests/pi-runtime.test.ts","start":386,"end":386,"sha256":"932617d07c9b19799b5c48b0608fc40b783179364beddd58229e0dbd39aeac54","context":["test(\"actual Pi recovers research with null or blank changelog arguments while generation stays off\", { skip: !piPresent, timeout: 90_000 }, async (t) => {","test(\"actual Pi recovers research with null or blank changelog arguments while generation stays off\", { skip: !piPresent, timeout: 90_000 }, async (t) => {"],"dirty":true},{"path":"tests/worktrees.test.ts","start":256,"end":256,"sha256":"91eda4391ab0efafd53260a7aea8a85ccb0cb0c6e51a06347a334ec4ffaf81f4","context":["test(\"private artifacts stay in the main store while metadata and fragments come from the adopted worktree\", async (t) => {","test(\"private artifacts stay in the main store while metadata and fragments come from the adopted worktree\", async (t) => {"]},{"path":"lib/state.ts","start":366,"end":380,"sha256":"abdda88ca1374209f37b0f1ed39f5e4b640b878cba2cd28ecb3118bb6e5702fc","context":["const catalogBuilder = fileURLToPath(new URL(\"../scripts/build-index.py\", import.meta.url));","            : entry.date !== null || entry.row !== null) ||"],"dirty":true},{"path":"lib/pickup.ts","start":4,"end":4,"sha256":"c009e436c91985b7baea8a84361d78b09aea7437d09653d6bba7975ed88ed3fe","context":["import { artifactLifecycle, artifactStore, exists, python, readArtifactCatalog, run, safePath, supersessionNote } from \"./state.ts\";","import { artifactLifecycle, artifactStore, exists, python, readArtifactCatalog, run, safePath, supersessionNote } from \"./state.ts\";"]},{"path":"tests/pickup.test.ts","start":31,"end":31,"sha256":"ba535aef8302d022fd44e0e3828256675070a42a7006010a1a32a458f05dab5e","context":["test(\"/drift finds raw artifacts when a missing index cannot be generated under Git policy\", async (t) => {","test(\"/drift finds raw artifacts when a missing index cannot be generated under Git policy\", async (t) => {"]},{"path":"tests/catalog.test.ts","start":147,"end":147,"sha256":"1b18d8fac87a86a861408e3eb8eee58894a9fab92dc210a3100184f45efb9aeb","context":["test(\"raw read failures surface honestly without a stale-index fallback\", async (t) => {","test(\"raw read failures surface honestly without a stale-index fallback\", async (t) => {"]},{"path":"tests/pi-runtime.test.ts","start":347,"end":347,"sha256":"38745dd40615fbf2eae20180f4512102deb91f17c7cc672b6e78752078b4f906","context":["test(\"actual Pi /drift picks up raw artifacts even when the index view cannot be refreshed\", { skip: !piPresent, timeout: 60_000 }, async (t) => {","test(\"actual Pi /drift picks up raw artifacts even when the index view cannot be refreshed\", { skip: !piPresent, timeout: 60_000 }, async (t) => {"],"dirty":true},{"path":"lib/git-drivers.ts","start":9,"end":10,"sha256":"1577dca299693292d2b586d071d40e4df8b0f7c1dd24aaf62a00533648431e63","context":["export const indexDriver = { name: \"drift-index\", description: \"Drift index row merge\", path: \"drift/INDEX.md\" } as const;","export const indexAttributeLine = `${indexDriver.path} merge=${indexDriver.name}`;"]},{"path":"lib/land.ts","start":94,"end":102,"sha256":"3a2c2803c8b73752d97656b2dc09013f5028348abc5cb773c46933c71f00b96f","context":["/** Derived files are verified, never rewritten here: a mismatch after the rebase is something to look at, not paper over. */","      }"]},{"path":"lib/land.ts","start":25,"end":25,"sha256":"577bdc8dbb8ec5cb46de499f956bcd6030f89dccef537954ddf097670b7cab03","context":["const knownLines = new Set([\"/drift/\", indexAttributeLine, changelogAttributeLine]);","const knownLines = new Set([\"/drift/\", indexAttributeLine, changelogAttributeLine]);"]},{"path":"docs/artifact-git-policy.md","start":43,"end":54,"sha256":"41facfd4caa34580f45cfaee24f93e120d5784da89212d200d43d902309c8003","context":["Drift writes `drift/INDEX.md merge=drift-index` to `.gitattributes` at session","git config merge.drift-index.driver \"python3 -I /path/to/drift/scripts/build-index.py --merge %O %A %B\""]},{"path":"docs/worktrees.md","start":36,"end":36,"sha256":"d34109d7d284c21f814c74b1123df5dc20021bac390e47ee2d6120e16c024105","context":["  metadata, numbering, index, publication, refs, changelog fragments,","  metadata, numbering, index, publication, refs, changelog fragments,"],"dirty":true},{"path":"README.md","start":85,"end":85,"sha256":"42d20aa4bb0ae30607ec800dd5d1fadead8a4e4a2496ca103bc5fc13dfbba2cf","context":["  INDEX.md","  INDEX.md"],"dirty":true},{"path":"assets/context-drifts.svg","start":98,"end":98,"sha256":"812ca1d5aa0ea4ad20ed3fa51f533452953822e3bfb8d6071df2744f8899d4d9","context":["  <text class=\"m\" x=\"426\" y=\"522\" font-size=\"11.5\" fill=\"#8b968f\">INDEX.md &#8212; chronological timeline</text>","  <text class=\"m\" x=\"426\" y=\"522\" font-size=\"11.5\" fill=\"#8b968f\">INDEX.md &#8212; chronological timeline</text>"]},{"path":"tests/drift.test.ts","start":172,"end":172,"sha256":"13a69bab58523f2744c30e436ad346b29f1f51b1f4ffe4f43828a08a1531b6af","context":["test(\"publication supplies original metadata, stable numbering, references and a canonical index\", async (t) => {","test(\"publication supplies original metadata, stable numbering, references and a canonical index\", async (t) => {"],"dirty":true},{"path":"tests/index-merge.test.ts","start":33,"end":33,"sha256":"db95e9e8fadbb4a7891321565c29fbedf79a884a71078e2e18fce99ce51d3118","context":["test(\"as a git merge driver, two threads that each appended a row rebase and merge without a conflict\", async (t) => {","test(\"as a git merge driver, two threads that each appended a row rebase and merge without a conflict\", async (t) => {"]},{"path":"tests/pi-runtime.test.ts","start":366,"end":366,"sha256":"2fe034544b93c48d99a0ba6e1005482895c510b066d6a001ffd7dc4f2d3476f3","context":["test(\"actual Pi installs the index merge driver at session start in a tracked clone that carries the attribute\", { skip: !piPresent, timeout: 60_000 }, async (t) => {","test(\"actual Pi installs the index merge driver at session start in a tracked clone that carries the attribute\", { skip: !piPresent, timeout: 60_000 }, async (t) => {"],"dirty":true},{"path":"extensions/drift.ts","start":70,"end":75,"sha256":"e4c88dd1055c6d1a9ff60b2707a6ce10b680697849e3303a774631538b4d65c9","context":["        // A new record measures after derived-file refresh. On resume refresh ONLY its persisted active root,","          prepared = true;"],"dirty":true},{"path":"scripts/clean-changelog-residue.py","start":43,"end":47,"sha256":"351276c7182f2407dddc2780bad8ec7f87de739374e83815917490fb9e8b7f66","context":["START = \"<!-- drift:changelog: generated from changelog.d/ - edit a bullet only if you keep its id comment -->\"","# Every changelog.d/README.md Drift has written (sha256 of the LF-normalized text)."]},{"path":"lib/changelog.ts","start":63,"end":63,"sha256":"783ff4616b4eb89b94415edb9348cebda0f5a5a9c4b60cabce955c4db3bc0498","context":["export async function changelogState(repo: string): Promise<ChangelogState> {","export async function changelogState(repo: string): Promise<ChangelogState> {"]},{"path":"lib/git-drivers.ts","start":9,"end":14,"sha256":"f3421c677a68e88d6cb9e8775c7c59f6b0649b455bd6054f7b496d753c8be5b6","context":["export const indexDriver = { name: \"drift-index\", description: \"Drift index row merge\", path: \"drift/INDEX.md\" } as const;","const changelogBuilder = fileURLToPath(new URL(\"../scripts/build-changelog.py\", import.meta.url));"]},{"path":"lib/state.ts","start":178,"end":220,"sha256":"0334c82dbd91b8683297c892a552bf6c97a83bda36227814bd4f89fdcc793504","context":["  /** `auto`: on only where the committed CHANGELOG.md carries Drift's markers; never adopts. `on`/`off`: the repo's explicit override. */","      tags: (typeof changelog === \"object\" && changelog.tags?.trim()) || \"v*\","],"dirty":true},{"path":"lib/artifacts.ts","start":21,"end":25,"sha256":"63e525081dac644ea7b599c4c5821e9fe4b8696b7447c62be271ddeeb425b2c2","context":["  /** One changelog bullet when the repo has opted in; null or blank text means no entry is requested. */","const fragmentPathPattern = /^changelog\\.d\\/[A-Za-z0-9][A-Za-z0-9_-]{0,159}\\.md$/;"]},{"path":"lib/land.ts","start":5,"end":10,"sha256":"8c13785c39113a5ecca8c344d23874ee695ff8c8cc88656832a8989bfa6a48a1","context":["import { changelogState } from \"./changelog.ts\";","const changelogBuilder = fileURLToPath(new URL(\"../scripts/build-changelog.py\", import.meta.url));"]},{"path":"extensions/drift.ts","start":6,"end":7,"sha256":"7152f9f93a820dcf2896ee01665d09a7c2652dbdc13267b4c07290d7852ba98a","context":["import { changelogState, sections, setChangelog, syncChangelog, type ChangelogRequest, type ChangelogSync } from \"../lib/changelog.ts\";","import { attributeFor, changelogDriver, changelogDriverCommand, indexDriver, indexDriverCommand, installDriver } from \"../lib/git-drivers.ts\";"],"dirty":true},{"path":"scripts/build-index.py","start":49,"end":51,"sha256":"179c340a8db8e2816c5dadd864e73b46856330f0ab988d2e1e6ee43fcdd2bb98","context":["INDEX_HEADER = \"| # | Date | Feature | Type | Artifact |\"","INDEX_UNDATED = re.compile(r\"^- (?P<feature>.+?) / \\[(?P<title>.+?)\\]\\((?P<path>.+?)\\)$\")"]},{"path":"skills/drift/SKILL.md","start":21,"end":21,"sha256":"05e9ec6f5a47727a86ebd7b4516f93dbab5164b380dd1e92b74dc782bb528f2e","context":["If the user asks to pick up or continue without naming an artifact, query the raw artifacts through the shared read-only catalog (see \"At Session Start\") and take the last dated entry, never the tail of `drift/INDEX.md`. Route it by kind: an `in-progress` handoff resumes through `handoff.md`, a `pending` or `in-progress` plan runs through `execute.md`, and research goes to `plan.md`. If that newest artifact is a `complete` handoff or plan, or is `superseded`, there is no open work: say so, show the recent raw-artifact list and ask what to pick up. Do not reach back for an older open artifact. Complete research is different: it may still be planned. A named artifact always wins over the default, but if it is a `complete` plan or handoff or is `superseded`, say so (`<old> superseded by <new>`, or replacement not recorded) and get explicit confirmation before reopening it or working from its successor; never silently retarget it. If only undated artifacts exist, ask the user to name one; if discovery fails, report the failure rather than claiming there are no artifacts or trusting a stale view.","If the user asks to pick up or continue without naming an artifact, query the raw artifacts through the shared read-only catalog (see \"At Session Start\") and take the last dated entry, never the tail of `drift/INDEX.md`. Route it by kind: an `in-progress` handoff resumes through `handoff.md`, a `pending` or `in-progress` plan runs through `execute.md`, and research goes to `plan.md`. If that newest artifact is a `complete` handoff or plan, or is `superseded`, there is no open work: say so, show the recent raw-artifact list and ask what to pick up. Do not reach back for an older open artifact. Complete research is different: it may still be planned. A named artifact always wins over the default, but if it is a `complete` plan or handoff or is `superseded`, say so (`<old> superseded by <new>`, or replacement not recorded) and get explicit confirmation before reopening it or working from its successor; never silently retarget it. If only undated artifacts exist, ask the user to name one; if discovery fails, report the failure rather than claiming there are no artifacts or trusting a stale view."]},{"path":"package.json","start":31,"end":35,"sha256":"2194293088869e0d73b4b9cf439e25b254cbda2901cd7b1cc5f9edfa52e4fc21","context":["    \"scripts/build-index.py\",","    \"CHANGELOG.md\","]}]
---

## Research Question

The user has decided to remove Drift's changelog feature entirely: agents read commit messages and handoffs, and nobody reads the generated changelog. That decision needs a full inventory of what to remove. The research also asks whether the generated `drift/INDEX.md` view has outgrown its use, now that navigation reads the raw artifacts.

## Summary

**Changelog.**
- The changelog spans:
  - two scripts (`build-changelog.py` and the residue cleaner);
  - `lib/changelog.ts`;
  - pieces of `git-drivers`, `state`, `artifacts`, `land` and the extension;
  - the CI check;
  - 25 tests, 12 docs/asset files and 2 skill files.
- Agents rarely read it. Across four repos' Pi session logs (about 5,700 tool calls), there were 6 direct reads of `CHANGELOG.md` against 282 `git log` calls and 82 handoff reads.
- Three of the user's repos carry live adoption: markers, `changelog.d/` (22/18/12 fragments), a `.gitattributes` line and a clone merge-driver config. These need a one-time cleanup.

**Index.**
- Every navigation path already uses the raw catalog (`build-index.py --json` via `readArtifactCatalog`): `/drift` pickup, the session-context recent list, and the handoff/execute workflows. `INDEX.md` is kept only "for compatibility".
- The view has the same shared-file costs as the changelog:
  - publish write and verify;
  - session-start rewrite;
  - merge driver and attribute;
  - landing verification;
  - conflicts on GitHub web merges in tracked repos;
  - about 16 tests and 6 skill files of manual-maintenance instructions.
- Agents rarely read it: 8 direct reads in about 5,700 calls, against 102 `ls drift/` calls. The useful part, the cross-feature chronological rows, already reaches agents through the catalog.

## Detailed Findings

### 1. How agents actually get project history (Pi session logs, this machine)

| Repo | tool calls | read CHANGELOG.md | shell on CHANGELOG.md | read INDEX.md | shell on INDEX.md | `git log` | handoff reads | `ls drift/` | catalog `--json` |
|---|---|---|---|---|---|---|---|---|---|
| Rig | 2921 | 1 | 4 | 6 | 14 | 117 | 27 | 42 | 1 |
| dotfiles | 1219 | 0 | 33 | 0 | 23 | 114 | 32 | 16 | 0 |
| drift | 1221 | 5 | 15 | 1 | 13 | 51 | 23 | 24 | 8 |
| perimeter | 306 | n/a | n/a | 1 | 9 | n/a | n/a | 20 | 0 |

The shell counts include maintenance (`git add`, conflict handling, regeneration checks), not only reading. Agents orient with `git log`, handoffs, `ls drift/` and the injected recent-artifact list.

### 2. Changelog feature inventory (commit 5e09cf1; some files carry uncommitted auto-continue edits)

**Scripts**
- `scripts/build-changelog.py` (478 lines: build, `--stdout`, `--check`, `--merge`, tag grouping).
- `scripts/clean-changelog-residue.py` (289 lines: removes Drift changelog adoption from repos that never chose it; markers at :43-47).
- `scripts/_driftmeta.py` is shared with build-index and check-staleness and stays.

**lib/changelog.ts (whole file)**
- Exports used elsewhere:
  - `changelogState`, imported by extensions/drift.ts:6, lib/artifacts.ts:8 and lib/land.ts:5;
  - `sections`;
  - `syncChangelog` (:189);
  - `setChangelog` (:235);
  - `ensureChangelog` (:145), used by tests.
- It also holds foreign-scheme detection, the `changelog.d/README.md` template (:89-117) and adoption (:119).

**lib/git-drivers.ts**
- `changelogDriver` (:11), `changelogAttributeLine` (:12), `changelogBuilder` (:14) and `changelogDriverCommand` (:28-29).

**lib/state.ts**
- `DriftConfig.changelog` (:178-179), `configShape` (:185), key validation (:201) and parsing (:214-220).

**lib/artifacts.ts**
- `ArtifactInput.changelog` (:21-22) and `fragmentPathPattern` (:25).
- Validation (:50, :72-89, :110).
- Fragment path and content in `prepare` (:338-343) and the pending check (:348-349).
- In `publish`: `changelogState` (:368), the ignore check (:385-387), the fragment write (:406-416) and the receipt `fragment` (:425).

**lib/land.ts**
- Imports (:5-6, :10) and `knownLines` (:25).
- Owned files `changelog.d/` and `CHANGELOG.md` (:46, :126).
- `verifyDerived` changelog check (:105-110).

**extensions/drift.ts**
- Imports (:6-7).
- In `refreshIndex`: changelog sync and driver install (:153-164).
- `installChangelogDriver` (:181-186) and `describeSync` (:188-190).
- The `/drift-changelog` command (:367-382).
- The session-context "Changelog: … generated from changelog.d/" line (:462-467).
- The `drift_publish` `changelog` parameter (:601-607).
- Publish-time sync and `Fragment:`/`Changelog:` result lines (:619-623, :647).

**Configuration, CI and packaging**
- `.gitattributes:2`.
- `package.json:32`, which ships `build-changelog.py`, and `:35`, which ships `CHANGELOG.md`.
- `.github/workflows/ci.yml:47`, `build-changelog.py . --check`.

**This repo's own changelog**
- `CHANGELOG.md` has markers at :5 and :48, with 22 fragments plus one untracked fragment from auto-continue handoff 005.
- Tags `v0.3.0` and `v0.6.0`; `package.json` version `0.6.0`.

**Docs and assets**
- docs/changelog.md (whole).
- README.md:65 (command row), :119, :134-143 (section) and :187.
- docs/landing.md:15,29, docs/worktrees.md:36-37 and docs/artifact-git-policy.md:62.
- docs/shared-files-plan.html §5 (:127-196) and :44-76, :214-244.
- docs/field-observations.md:118-264 (historical).
- assets/what-lands-in-repo.svg:32,34,59-61.

**Skills**
- SKILL.md §"Changelog Fragments" (:220-235) and the `changelog` key in Artifact Git Policy (:292).
- hosts/pi.md:31.

**Tests (25)**
- tests/changelog-build.test.ts: all 6.
- tests/changelog-residue.test.ts: 1.
- tests/drift.test.ts:814, 839, 892, 921, 931, 966, 1067, 1123.
- tests/pi-runtime.test.ts:386, 439, 511, 537 (also index), 827.
- tests/worktrees.test.ts:256.

**Adopted repos to clean up**

| Repo | Fragments | Version tags | Leftover adoption |
|---|---|---|---|
| drift | 22 (+1 untracked) | v0.3.0, v0.6.0 | markers, attribute, clone driver |
| dotfiles | 18 | none | markers, attribute, clone driver |
| Rig | 12 | v0.2.0–v0.4.0 | markers, attribute, clone driver |

- An existing `.drift.json` that sets `changelog` would fail validation if the key were simply dropped from the schema.
- A clone's `merge.drift-changelog.driver` would fail at merge time once `build-changelog.py` is gone.

### 3. Index view inventory

**Already catalog-only (navigation; independent of INDEX.md)**
- `build-index.py`: `catalog()` (:183), the artifact scan (~:202) and the `--json` branch of `main` (:281, :295). `render()` (:220) also produces the catalog `row` string.
- `lib/state.ts:366-380` `readArtifactCatalog`. The session-context recent rows come from catalog `row` (:758-768), with "No stale index fallback".
- `lib/pickup.ts:4,85`.
- SKILL.md:21 (pickup) and §At Session Start steps 1–3 (:204-212); handoff.md:146 and execute.md:22.
- Pickup and catalog tests assert navigation ignores or never creates INDEX.md: tests/pickup.test.ts:31,42,68,94,159; tests/catalog.test.ts:147; tests/pi-runtime.test.ts:347.

**View-only (exists to maintain INDEX.md)**
- `build-index.py`: the default write, `--stdout`, `--check`, `--merge` (:276, :288, :304, :308), `parse_index` (:96), `merge_rows` (:141), `write_index` (:160), `merge` (:166) and the header constants (:49-51).
- `lib/artifacts.ts`:
  - the INDEX.md policy probe (:137);
  - the index attribute on tracking-on (:197-200, :228);
  - `ensureIndexAttribute` (:245-251) and `syncIndex` (:259-281);
  - in `publish`, the index path (:371), policy (:383) and render/verify/write (:419-424). Publication throws if the render omits the artifact.
- `lib/git-drivers.ts:9-10, 13, 24` (index driver). `installDriver`, `attributeFor` and `hasAttribute` are shared and generic.
- `lib/land.ts:94-102` (`verifyDerived` index check) and `:25` (`knownLines`).
- `extensions/drift.ts`:
  - the `refreshIndex` index part (:140-151) and `installIndexDriver` (:166-179);
  - the `Index: drift/INDEX.md` result line (:647);
  - the prompt-guideline wording (:590).
- SKILL.md §Root Index, Format, Updating, Derived Files (index part) and Rebuilding (:161-202, :214-218, :241-252); Timestamps (:256) says `date` "orders the index".
- research.md:60, plan.md:68 and handoff.md:75 ("update the view where maintained"); hosts/pi.md:47; execute.md:47.
- Docs and assets:
  - docs/artifact-git-policy.md:43-54, docs/landing.md:15,28 and docs/worktrees.md:36;
  - README.md:85, 92, 127, 173, 264, 292;
  - docs/shared-files-plan.html §4 (:88-103);
  - assets/context-drifts.svg:98, parallel-workers.svg:68 and what-lands-in-repo.svg:27,48.
- About 16 tests:
  - tests/drift.test.ts:172, 327, 460, 505, 565, 625, 651, 713, 733, plus attribute asserts at :670-691 and :1120;
  - tests/index-merge.test.ts:33, 104;
  - tests/pi-runtime.test.ts:366, 537.

**Dependencies that survive removal**
- `refreshIndex` is also the session-start hook that runs the changelog sync and the two-stores notice, and the record's baseline is measured after it (extensions/drift.ts:70-75, 140-164). A session-start hook must remain, renamed.
- `policyProbes` still needs the artifact probe.
- Tracked repos in the field carry `drift/INDEX.md merge=drift-index` and a clone driver config. Removing `--merge` would make that configured driver fail at merge time unless a cleanup removes the attribute and config, or a tolerant shim remains.
- Non-Pi and manual hosts: SKILL.md "Updating the Index" (:193-202) is the only manual maintenance. Navigation for those hosts already uses `--json`. A no-shell host has neither.

### 4. What replaces them

- **History:** commit messages and handoffs. In private-artifact repos such as this one, commit messages are the only history shared through git. Guidance would ask that commit messages state what changed and why, and name the Drift artifact.
- **Cross-feature timeline:**
  - the catalog rows already injected at session start (8 most recent);
  - `/drift` reporting the recent list when there is no open work;
  - an on-demand listing (`build-index.py <drift> --json`, or a print-only mode that writes no file) for a human.
  - None of these is a committed shared file, so none conflicts or needs a driver.

## Code References

- scripts/build-changelog.py; scripts/clean-changelog-residue.py:43-47; lib/changelog.ts:63, 89-119, 145, 189, 235
- lib/git-drivers.ts:9-14, 24-29; lib/state.ts:178-220, 366-380, 758-768
- lib/artifacts.ts:21-25, 50, 72-89, 110, 137, 197-228, 245-281, 338-349, 368-425
- lib/land.ts:5-10, 25, 46, 94-110, 126
- extensions/drift.ts:6-7, 70-75, 140-190, 367-382, 462-467, 590, 601-623, 647
- scripts/build-index.py:49-51, 96, 141-183, 202, 220, 276-308
- lib/pickup.ts:4, 85
- skills/drift/SKILL.md:21, 95, 159-256, 292; hosts/pi.md:31, 47; research.md:60; plan.md:68; handoff.md:75, 146; execute.md:22, 47
- .gitattributes:2; package.json:31-35; .github/workflows/ci.yml:47

## Open Questions

- **Index:** retire the `INDEX.md` file (keep the catalog, injected rows and an on-demand print), or keep it as an opt-in view? The user asked whether it has been outgrown; the evidence above says navigation no longer needs it.
- **Existing `CHANGELOG.md` files** (drift, dotfiles, Rig): keep them as frozen plain history, with markers and id comments stripped, or delete them? Keeping is non-destructive.
- **Existing `drift/INDEX.md` files in tracked repos** (Rig, dotfiles): `git rm` them in the cleanup, or leave them as stale files?
- **Cleanup mechanism for adopted repos:** generalise `clean-changelog-residue.py` into a retirement step, as a script or a `/drift-…` command. It would remove markers, `changelog.d/`, both `.gitattributes` lines and both clone driver configs. Existing `.drift.json` `changelog` keys should be tolerated and ignored rather than rejected.
- **Ordering with uncommitted work:** the uncommitted auto-continue work (plan 004 / handoff 005) touches the same files (extensions/drift.ts, lib/state.ts, tests, README, hosts/pi.md) and added a fragment. Commit it first, or carry it inside this change?
