---
date: "2026-10-22T11:03:29+01:00"
branch: "main"
git_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
feature: "shared-files"
sequence: "004"
type: "research"
status: "complete"
session_started: "2026-10-20T10:59:59+01:00"
session_id: "01a13c36-3c70-7052-9825-2ca6aeedb072"
interval_id: "66b9319c-db55-4c09-96d4-7f2c0949cb71"
start_branch: "main"
start_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
related_artifacts: ["drift/shared-files/001-research-shared-files-under-many-agents.md","drift/shared-files/003-plan-derived-changelog-and-automatic-landing.md","drift/changelog-pipeline/003-handoff-no-changelog-recovery-and-policy-guard.md"]
anchor_coverage: {"status":"complete","eligible":10,"captured":10,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
anchors: [{"path":"docs/shared-files-plan.html","start":145,"end":145,"sha256":"65b4eb81f2ab9b80c352b57ebca19fcc2a971df8555852ee072e01bfe3cf45f1","context":["  <li>Fragments are never deleted or moved by Drift. <strong>Versions are derived, not stamped</strong> (decided 2026-10-09, replacing an earlier <code>stamp</code> command): a release is already recorded in the repository as a version tag (<code>vX.Y.Z</code> by default, pattern configurable), so a fragment belongs to the first version tag whose tree contains it (<code>git ls-tree &lt;tag&gt; -- changelog.d/</code>). Membership comes from git ancestry, never timestamps, so it is exact and identical in every worktree; a clone that has not fetched the new tag shows those entries as unreleased until it does. Projects without version tags keep day grouping. Nothing to type at release time.</li>","  <li>Fragments are never deleted or moved by Drift. <strong>Versions are derived, not stamped</strong> (decided 2026-10-09, replacing an earlier <code>stamp</code> command): a release is already recorded in the repository as a version tag (<code>vX.Y.Z</code> by default, pattern configurable), so a fragment belongs to the first version tag whose tree contains it (<code>git ls-tree &lt;tag&gt; -- changelog.d/</code>). Membership comes from git ancestry, never timestamps, so it is exact and identical in every worktree; a clone that has not fetched the new tag shows those entries as unreleased until it does. Projects without version tags keep day grouping. Nothing to type at release time.</li>"]},{"path":"docs/changelog.md","start":21,"end":23,"sha256":"9cf25d6370cfb1d84e331d017dec926a0c680cba65f1646fa747d278d16f36f2","context":["version tag whose tree contains the fragment (`v*` by default; configurable as","untagged entries are `[Unreleased]`, and a repository without version tags is"]},{"path":"scripts/build-changelog.py","start":126,"end":142,"sha256":"5d7a08258b943ace60c57c1b52f5992e84b62bdb35d7ea1257f1dbb24f6b4f59","context":["def version_groups(repo, fragments):",""]},{"path":"extensions/drift.ts","start":622,"end":622,"sha256":"b0204d7d67be2a8b2373c5cd2e5c296858400f3d717990bf73473cee53c21b69","context":["          try { changelog = `\\nFragment: ${receipt.fragment}\\nChangelog: ${describeSync(await syncChangelog(repo))}`; }","          try { changelog = `\\nFragment: ${receipt.fragment}\\nChangelog: ${describeSync(await syncChangelog(repo))}`; }"],"dirty":true},{"path":"lib/changelog.ts","start":189,"end":189,"sha256":"9b4b53bfd3e75e5e29d790335c339f692423a8110b82f96c1da6836ae8043646","context":["export async function syncChangelog(repo: string): Promise<ChangelogSync & { adopted?: string[] }> {","export async function syncChangelog(repo: string): Promise<ChangelogSync & { adopted?: string[] }> {"]},{"path":"extensions/drift.ts","start":140,"end":155,"sha256":"9dfb12fca42c2c67717ee61c7f71b2a6842a7c75269d53bb20c7a108dc782394","context":["  async function refreshIndex(repo: string, ctx: ExtensionContext) {","      const changelog = await syncChangelog(repo);"],"dirty":true},{"path":"scripts/build-changelog.py","start":5,"end":10,"sha256":"0f61d3e444fbd562749b6ba668836fcae41404b53a67e1c758184661c5a7c987","context":["    build-changelog.py [<repo>] [--check | --stdout]","    --stdout  Print the whole file as it would be written. Writes nothing."]},{"path":"scripts/build-changelog.py","start":31,"end":33,"sha256":"d75a1f77afbd6d2b9095f340fc352e04bfdc272f7b93462bad60673d0e369db5","context":["Grouping: a fragment belongs to the first version tag (default pattern `v*`, configurable as","and never from timestamps; fragments in no tag are [Unreleased]. With no matching tags the"]},{"path":"scripts/build-changelog.py","start":162,"end":180,"sha256":"1c45559f578ac9bed6557cadc753d7ca5844909013a16d515afe1c11d8d6c34b","context":["def heading_for(key):","    return (rank,)"]},{"path":"scripts/build-changelog.py","start":426,"end":426,"sha256":"374a4ac739f7b4df230634927f1ad9a4e66e1f851019b9358d99fc88537175e6","context":["        # A side that has fetched the tag knows the version; the other still shows the entry as unreleased.","        # A side that has fetched the tag knows the version; the other still shows the entry as unreleased."]}]
---

## Research Question

Rig shows a release's own changelog entry landing in the wrong place. The research in `shared-files/001` concluded that large repositories had already solved the shared-changelog problem. Which part did they solve, which part did Drift decide differently, and how do those projects handle the release step that Drift dropped?

## Summary

The prior art solved **concurrent writers**: one uniquely named fragment per change, with the human file generated from the fragments. Drift adopted that, and it works; Rig landed 60 artifacts with no changelog conflicts.

The **release step** is where Drift deliberately departed from the prior art. On 2026-10-09 it chose "derived continuously, never compile-at-release", then replaced the planned `stamp` command with "versions derive from tags; nothing to type at release time".

Every fragment tool that commits its changelog has an explicit release command that writes the version section *before* the tag is cut: towncrier, changesets, CPython blurb, scriv and GitLab's changelog API. The one tag-derived tool, OpenStack reno, avoids the problem only because it never commits its rendered output.

Drift both commits the file and has no release step, which produces the two Rig failures:
- the tagged tree's `CHANGELOG.md` shows its own release as `[Unreleased]`;
- a release note committed after its tag is grouped into the next version.

## Detailed Findings

### 1. What the earlier research concluded (drift/shared-files/001, 2026-10-09)

- Prior art (§2): large projects never let N writers edit one changelog. They either:
  - write a fragment per change and compile it (CPython `blurb`, towncrier, changesets, GitLab before 2021); or
  - harvest notes from commits or PRs (Kubernetes, GitLab now, Rust).
- "Compile-at-release does not fit: most projects do not release. The changelog should be derived continuously, like the index, with fragments as the never-deleted source" (Summary).
- Design decision (§5): "Derived changelog, continuously regenerated, fragments never deleted; not compile-at-release. Grouped by day by default, by version only if a project stamps one."
- Open question: "Whether `stamp X.Y.Z` … ships with the changelog step or waits for a project that wants it."
- docs/shared-files-plan.html:145 closed that question the same day: "**Versions are derived, not stamped** (decided 2026-10-09, replacing an earlier `stamp` command) … a fragment belongs to the first version tag whose tree contains it … Nothing to type at release time." It is restated at :244-246 ("No `stamp`: versions derive from tags").
- drift/shared-files/003 step 1 implemented that tag rule; docs/changelog.md:21-23 states "so releases need no step of their own".

### 2. How Drift's changelog works now (commit 5e09cf1)

- `scripts/build-changelog.py:126-142` `version_groups`:
  - lists the tags matching `changelog.tags` (default `v*`) in semver order;
  - runs `git ls-tree -r --name-only <tag> -- changelog.d/` for each;
  - assigns each fragment to the first tag that contains it, dated by the tagged commit;
  - fragments in no tag are `[Unreleased]`, and with no tags it groups by day.
- The module docstring (:31-33) and the merge comment (:426, "A side that has fetched the tag knows the version") describe the same rule.
- Regeneration runs at publication (`extensions/drift.ts:622` → `lib/changelog.ts:189` `syncChangelog`) and at session start (`extensions/drift.ts:140-155` `refreshIndex`). Nothing runs when a tag is created.
- `--check` and `--stdout` render without writing (`scripts/build-changelog.py:5-10`).

### 3. The two failures in Rig (C:\Projects_2.0\Rig, 2026-10-21)

**The tagged tree is stale.**
- `v0.4.0` → `951f548`, "handoff 060 … changelog". The tag contains `changelog.d/rig-foundation-060-…`, but the committed `CHANGELOG.md` in that tag still reads `## [Unreleased]` for the 0.4 entry.
- The file was regenerated at publication, before the tag existed.
- `build-changelog.py . --check` now reports "out of date". `--stdout` renders the entry under `## [0.4.0] — 2026-10-21`.
- The same thing happened at 0.3. Commit `15651f0` ("docs(changelog): regenerated: the 0.3 post-look entry shipped in v0.3.0") was a manual regeneration after `v0.3.0` was moved from `7d5f4d4` to `9475211`.

**A late note goes to the next version.**
- The 0.2 gate fragment `rig-foundation-031-…` ("A project closed from somewhere other than this window …") was added in `685be1a`, after `v0.2.0` → `0366ccf`. Its first containing tag is `v0.3.0`, so it renders under `## [0.3.0] → ### Fixed`.
- Cause: Rig's plan 027 gate order was "commit the verified milestone, cut the tag, then publish the completed Drift handoff", and that handoff carries the fragment.

**Each release was worked around differently:**
- 0.2: the late note was left in the next version;
- 0.3: the tag was moved forward, then the file regenerated by hand;
- 0.4: the handoff commit itself was tagged, and its tree is still stale.

Rig's tags are local only: `origin/main` is `87860a9`, which carries `v0.2.0`.

### 4. How the prior art handles the release step

| Tool | Release step | Where the version section is written | Fragments afterwards |
|---|---|---|---|
| towncrier (Twisted, pip, attrs) | `towncrier build --version X` | into the news file, in the release commit, then tag | removed (`git rm`) |
| changesets (JS monorepos) | `changeset version`, then `changeset publish` | `CHANGELOG.md` and package versions, in the version commit; publish creates the tags | removed |
| CPython blurb | `blurb release X` | `Misc/NEWS.d/next/*` merged into a versioned file, then tag | moved into the release file |
| scriv | `scriv collect --version X` | into the changelog, in the release commit | removed |
| GitLab | changelog API with `version` | generated from commit trailers since the previous tag and committed, then tag | n/a (trailers) |
| OpenStack reno | none | rendered at docs build time from git history; a note belongs to the first tag where it appears; **the output is not committed** | notes kept |

Two patterns follow from the table:
- **Committing a rendered changelog requires an explicit version before the tag.** Every tool that commits the file stamps the section in the release commit and then tags that commit. The tagged tree is therefore correct by construction.
- **Tag-derived grouping works only for uncommitted output.** reno's model is the same as Drift's (first containing tag), and it has no stale-tree problem because the rendering is never committed.
- In both patterns a release note must land *before* the tag. With reno, a note added after the tag belongs to the next version. With the compile tools, a fragment after `build` waits for the next release.

### 5. Implications for Drift's design

- Fragments, the merge driver and continuous regeneration remain correct and match the prior art for concurrency.
- The "no release step" decision is the departure. It holds only where the rendered file is not committed (reno) or where no tagged tree is ever read. Drift commits the generated region.
- Keeping fragments (never deleted) is compatible with a stamp-style release step. If the release render assigns HEAD's unreleased fragments to `vX.Y.Z` dated today, and the tag is then cut on that commit, the tag rule afterwards computes the same grouping. Continuous regeneration therefore stays idempotent: no diff after tagging.
- Release ordering then becomes documentable as: publish the gate handoff (with its fragment) → release render → commit → tag.
  - This applies to Drift's own guidance: SKILL.md "Changelog Fragments" and "a release needs no step of its own", docs/changelog.md:21-23 and docs/landing.md.
  - It also applies to plans that close a release gate. Rig's plan 027 wording put the tag before the handoff.

## Code References

- scripts/build-changelog.py:5-10 — `--check` / `--stdout` modes
- scripts/build-changelog.py:31-33 — documented grouping rule
- scripts/build-changelog.py:126-142 — `version_groups` (first containing tag, tagged-commit date)
- scripts/build-changelog.py:162-180 — `heading_for` / `group_order` (`[Unreleased]` first, then versions, then days)
- scripts/build-changelog.py:426 — merge comment on tag-fetch convergence
- lib/changelog.ts:189 — `syncChangelog`
- extensions/drift.ts:140-155 — `refreshIndex` (session-start sync); :622 — publish-time sync
- docs/changelog.md:21-23 — "releases need no step of their own"
- docs/shared-files-plan.html:145, 244-246 — the 2026-10-09 "derived, not stamped" decision
- drift/shared-files/001-research-shared-files-under-many-agents.md §2, §5, Open Questions — prior art and the `stamp` question
- Rig evidence: tags `v0.2.0`→`0366ccf`, `v0.3.0`→`9475211`, `v0.4.0`→`951f548`; fragment 031 added in `685be1a`; commit `15651f0`

## Open Questions

- **Reinstate a release step?** For example `build-changelog.py --release vX.Y.Z` and `/drift-changelog release vX.Y.Z`: render the unreleased entries as `[X.Y.Z] — today` without deleting fragments; the user or agent then commits and tags. This reverses the 2026-10-09 "no stamp" decision, so it needs the user's call.
- **Should the release render refuse when it is wrong?** For example: the tag already exists, the working tree's fragments are uncommitted, or `X.Y.Z` is not newer than the last tag.
- **Late notes already behind a pushed tag** (Rig fragment 031 under 0.3.0). Options:
  - accept it;
  - add a Drift-specific fragment pin such as `release: "v0.2.0"`, which no prior-art tool has (they edit the compiled file instead);
  - move the tag, which is only viable while it is unpushed.
- **Rig's local `v0.3.0` and `v0.4.0`** could be corrected before they are pushed. That is the user's decision for Rig.
