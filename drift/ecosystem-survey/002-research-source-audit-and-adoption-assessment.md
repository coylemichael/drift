---
date: "2026-10-13T11:10:30+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "ecosystem-survey"
sequence: "002"
type: "research"
status: "complete"
session_started: "2026-10-12T11:08:10+01:00"
session_id: "01a12f95-80ad-768a-beab-3053980bf7c7"
interval_id: "4b42486d-272a-4989-955d-b129efcd4348"
start_branch: "main"
start_commit: "e871e2fae8a243ab6e7c1abf70b5fd1b69534dd1"
related_artifacts: ["drift/ecosystem-survey/001-research-comparative-survey-and-index-design-debate.md"]
anchors: [{"path":"scripts/build-index.py","start":47,"end":47,"sha256":"03764d4fad84847a274d6d3d9ac7d1f039ea588bc8d05117a5716e2339ca9371","context":["INDEX_UNDATED = re.compile(r\"^- (?P<feature>.+?) / \\[(?P<title>.+?)\\]\\((?P<path>.+?)\\)$\")","INDEX_UNDATED = re.compile(r\"^- (?P<feature>.+?) / \\[(?P<title>.+?)\\]\\((?P<path>.+?)\\)$\")"]},{"path":"scripts/build-index.py","start":135,"end":135,"sha256":"3db7d1a3799ce3771632169f663cb22b556abdf14c23ffb9852f508cd0eec476","context":["def merge_rows(base, ours, theirs):","def merge_rows(base, ours, theirs):"]},{"path":"scripts/build-index.py","start":143,"end":143,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","context":["",""]},{"path":"scripts/build-index.py","start":160,"end":160,"sha256":"19c7da7d73064b1b1f4e2479257d556bdebf38991e9c5835576c527dd7d76627","context":["def merge(paths):","def merge(paths):"]},{"path":"scripts/build-index.py","start":171,"end":171,"sha256":"cedccdc91bd655d49071858170bdcf4405c0178a32a16074ab6a1db71949d380","context":["def render(dated, undated):","def render(dated, undated):"]},{"path":"tests/index-merge.test.ts","start":33,"end":33,"sha256":"db95e9e8fadbb4a7891321565c29fbedf79a884a71078e2e18fce99ce51d3118","context":["test(\"as a git merge driver, two threads that each appended a row rebase and merge without a conflict\", async (t) => {","test(\"as a git merge driver, two threads that each appended a row rebase and merge without a conflict\", async (t) => {"]},{"path":"tests/index-merge.test.ts","start":73,"end":73,"sha256":"44daf861f5fd3843f872a9593e7a673f966d31ecf41fa52351c2347cd794dd2b","context":["test(\"--merge keeps one-sided removals, unions undated rows, accepts CRLF and an empty base, and writes LF\", async (t) => {","test(\"--merge keeps one-sided removals, unions undated rows, accepts CRLF and an empty base, and writes LF\", async (t) => {"]},{"path":"lib/state.ts","start":348,"end":348,"sha256":"c84ede6fccde890bdd38d63210dffe0d288ca2e251d137b6af029c773e395afb","context":["export async function withLock<T>(path: string, work: () => Promise<T>, timeout = 5_000): Promise<T> {","export async function withLock<T>(path: string, work: () => Promise<T>, timeout = 5_000): Promise<T> {"]},{"path":"lib/state.ts","start":678,"end":678,"sha256":"778197c7df8ca7a6ed33b1935f556661494dd60e2940c1add67a7a56e4723c0c","context":["    const index = join(root, \"drift\", \"INDEX.md\");","    const index = join(root, \"drift\", \"INDEX.md\");"]},{"path":"lib/pickup.ts","start":35,"end":35,"sha256":"b93a01daa0b3e0451c3de1ff892d7824a2b2b3beba15ad36560244feba312847","context":["  try { await syncIndex(repo); } catch { /* A stale index still names real artifacts; the session start reports why. */ }","  try { await syncIndex(repo); } catch { /* A stale index still names real artifacts; the session start reports why. */ }"]},{"path":"lib/pickup.ts","start":82,"end":82,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","context":["",""]},{"path":"scripts/build-changelog.py","start":326,"end":326,"sha256":"8f910e06bb9f67e5bae40bfa94f4671ccfa022d74da5a2611bc5301556eadc33","context":["        text = (git(repo, \"show\", f\"{sha}:{ident}\", ok=(0, 128)) or \"\").replace(\"\\r\\n\", \"\\n\")","        text = (git(repo, \"show\", f\"{sha}:{ident}\", ok=(0, 128)) or \"\").replace(\"\\r\\n\", \"\\n\")"]},{"path":"scripts/build-changelog.py","start":346,"end":346,"sha256":"a47f8015819eeb01cc93c6f46714d2a74c9a1b7a413eeb9ecea737d1d8cceb91","context":["    return edited","    return edited"]},{"path":"scripts/build-changelog.py","start":413,"end":413,"sha256":"19c7da7d73064b1b1f4e2479257d556bdebf38991e9c5835576c527dd7d76627","context":["def merge(paths):","def merge(paths):"]}]
---

## Research Question

Does the exploratory ecosystem survey hold up against how the cloned repositories actually manage each issue: handoff evidence, durable knowledge, catalog/index freshness, IDs and concurrent publication, changelog generation, SQLite/retrieval, archival, task coordination, and outcome feedback? Which mechanisms are shipped and tested, which are prompt conventions or proposals, and which are genuinely missing from Drift?

Source discussion: drift/ecosystem-survey/001-research-comparative-survey-and-index-design-debate.md. This is the source audit requested after publishing that discussion, not an implementation plan. Where an earlier assertion or adversarial argument conflicts with this audit, use the audit's correction.

## Summary

Five Claude Fable 5 reviewer subagents audited the published survey by issue, comparing actual Drift source/tests with all 23 cloned repositories. The main session spot-checked consequential claims and caught an additional reviewer mistake: OpenSpec does ship an archive claim lock. Strong candidates remain a shared read-only catalog/query interface, compact discovery, explicit evidence/verification boundaries in handoffs, and user-curated project standards/pitfalls. Many other supposed innovations are prompt instructions, legacy features, or unshipped proposals.

The source evidence does not support mandatory SQLite, mandatory stable IDs, or immediate physical archival/index retirement. Drift already bounds injected index context, locks same-store publication, preserves index-row deletions, never renames artifacts during index merging, and has a changelog merge driver. A read-only catalog abstraction would let pickup stop depending on a persisted Markdown table without changing artifact identity, default pickup policy, or changelog behavior; whether to stop publishing the table is a subsequent independent decision.

## Detailed Findings

### 1. Method, evidence grades, and boundaries

The five audits covered: (1) index/ID/concurrency, (2) SQLite/retrieval/identity rebuild, (3) changelog/archive/retention, (4) handoff evidence/knowledge/process, and (5) readiness/parallel coordination/outcomes. Review targets and captured HEADs are recorded in the first research artifact. Competitor references below are relative to C:/Projects_2.0/<repo>/ at those captured HEADs. Drift HEAD remained 97c61c2057a60e84c6cafe68508d19838c448cbc during the review.

Evidence labels:

- CODE: implementation inspected, not necessarily executed.
- TEST: corresponding test source inspected; no competitor test suite was run.
- PROMPT: shipped instructions/templates executed by a model, not mechanically enforced guarantees.
- PROPOSAL: design document with no verified corresponding shipped implementation.
- LEGACY: historical content absent from the current active command surface.
- UNKNOWN: not resolved at implementation depth by this audit.

No installations, builds, application execution, network operations, cleanup, commits, configuration changes, or product implementation were performed. Publication uses Drift's managed research tool. Tests are evidence of intended coverage, not a claim this session ran/passed them.

Drift's dirty lib/artifacts.ts was inspected against HEAD: its concurrent allocation/publication mechanisms match HEAD; observed dirty changes concern changelog-input validation, blank-text normalization, and pending-aware recovery messages. Working-tree docs/changelog.md and other overlapping dirty files were not treated as this session's implementation work.

Provenance correction is definitive: beads, basic-memory, and ruflo have untracked local changelog.d/ plus modified/generated changelog/attribute content. `git ls-files`/`git ls-tree HEAD` establish that those Drift READMEs are not upstream practice. Do not cite them as ecosystem adoption, release implementation, or support for changelog write-back. Nothing was cleaned.

### 2. Index freshness, pickup, and context budget

**Verified Drift behavior — CODE + TEST:**

- scripts/build-index.py: parse_artifact() reads each artifact's entire text, then consumes frontmatter and a legacy body-date fallback. Rebuilding scans the whole tree; current cost is total files/body bytes plus Python startup, not merely table row count.
- lib/pickup.ts: newest() invokes syncIndex(), then regex-parses INDEX.md and selects its last dated row. If refresh fails, it may read the old index. The table is a transport format between a common renderer and the TypeScript consumer.
- lib/state.ts: Records.context() injects only the last eight index rows, truncated to 600 characters per row, and skips an index of 512 KiB or larger. Previous arguments about injecting all 500 rows were wrong.
- Default pickup is deliberately newest-only and stops if the latest plan/handoff is complete or superseded; it does not find any older open task. Named pickup remains distinct. Changing to a ready queue would be a policy/API change, not just a faster implementation.
- Same-store sync/publication uses a common .publish.lock; no index refresh happens during a merge/rebase. The existing ordering spec still matters if persistence is demoted: UTC instants, tie-breaks, legacy fallback, and undated treatment.

**How competitors manage it:**

- OpenSpec — CODE: src/core/list.ts enumerates active change directories, excludes archive by default, computes task progress, supports JSON and explicit --archived/--all. Its recent order is mtime-based, not Drift's measured artifact date semantics. Borrow the query interface, not its ordering rule blindly.
- catchup — CODE/interface: internal/session/session.go exposes provider-native stable SessionID references; discovery delegates to agent-store readers rather than one maintained catalog. The audit inspected the interface/registry, not every provider's performance.
- basic-memory — CODE: metadata-only compact discovery and paginated queries keep reads selective; compact mode is not a fixed token guarantee.
- agent-os — PROMPT: standards/index.yml is a small description/attention map, not a chronological artifact ledger. The model reconciles it with files.
- claude-code-spec-workflow — CODE + PROMPT: CLI/dashboard enumerates named spec folders; global steering context is separate. No verified scalable immutable-artifact catalog/archive engine.

**Assessment:** ADAPT a shared read-only catalog interface before deciding whether to retire INDEX.md. An additive JSON query mode in the existing stdlib Python helper could serve newest/recent/named/list queries to Pi and manual hosts with one parser/order implementation; keep the Markdown renderer/export and existing driver for repositories that retain it. This is a proposed adaptation, not a command shipped today. Bounded frontmatter reads with an explicit legacy fallback are an optimization to measure, not an excuse to silently drop old artifacts. No benchmark supports a claim that 500 files always scan in milliseconds on OneDrive/Windows.

### 3. Allocation, identity, and concurrency are separate issues

**Verified Drift behavior — CODE + TEST:**

- scripts/build-index.py: merge_rows() keys on artifact PATH. It unions current rows and uses the base to keep one-sided deletions deleted. render() renumbers only table #. No artifact filename or frontmatter sequence is renamed or rewritten.
- tests/index-merge.test.ts explicitly covers one-sided removals and a two-branch merge whose output agrees with a rebuild. The earlier "archive deletion will be resurrected by union" argument does not describe this driver.
- lib/artifacts.ts: publish() holds a record lock plus .publish.lock, saves pending intent, creates files exclusively through staged fs.link(), and refuses to overwrite conflicting content. Private worktrees sharing the main store share its lock.
- prepare() checks local feature sequences and known remote-tracking refs in tracked mode. There is no network fetch in publication. Separate tracked worktrees have separate stores/locks, so unseen parallel branch publications can choose the same NNN.
- Same NNN with different slugs/kinds need not share a filename. The exact-path risk requires the same feature + NNN + kind/slug (fragments omit kind, so their exact-name condition differs). Index merging does not repair an artifact-file content conflict.
- The three-digit feature sequence has a 999 limit. The user's 400–500 artifacts were not established to be all in one feature; do not conflate a per-feature cap with a repo-wide limit.

**How competitors manage it:**

- beads — CODE + TEST: internal/idgen/hash.go hashes title/description/creator/timestamp/nonce to short base36 IDs. internal/storage/issueops/helpers.go probes the local DB inside creation, tries nonces/longer lengths, and returns an error on exhaustion. Hash generation and a multiclone scenario have test coverage. Short IDs are probabilistic, not universally collision-free; per-DB collision probes do not coordinate disconnected databases.
- waveforward — CODE: core.py:222–224 creates a snapshot directory exclusively; build_snapshot_id():585–589 combines a microsecond UTC timestamp with eight random UUID hex characters. Entropy plus exclusive creation prevents silent overwrite; a collision still errors rather than magically being impossible.
- spec-kit — CODE: create_new_feature.py uses unlocked scan-max-plus-one or --timestamp at second precision; mkdir(..., exist_ok=True) means timestamp mode is not an exclusive collision-free allocator. Number-as-preference improves local usability, not parallel safety.
- basic-memory — CODE: frontmatter permalink and DB external_id are distinct. Ordinary external_id UUIDs survive upsert of an existing DB row but are re-minted after deleting/rebuilding the DB. Paths, display order, and references must not rely on that UUID as file-rebuild-stable identity.
- mcp-shrimp-task-manager — CODE: UUIDs identify tasks, but taskModel.ts rewrites one tasks.json without verified locking. UUIDs do not prevent lost updates.
- claude-task-master — CODE: writeJSON() uses cross-process locking and rereads other tagged contexts under lock; modifyJSON() is recommended for proper read-modify-write. This protects more than the first reports suggested, but tag partitioning alone is not the guarantee, stale same-tag input can still matter, and it does not solve Git merges across clones.
- ruflo — PROPOSAL: conditional-append.md explicitly says it is not an installed/published capability. Its CAS/tombstone design is useful reasoning, not shipping evidence or a proven need in Drift.

**Assessment:** the earlier assertion "stable IDs are required under either future" was too strong. Path-preserving logical views need no new identity. Physical moves could use stable file-carried IDs, redirects, or maintained references, with different costs. A UUID added only inside frontmatter does not fix the existing filename allocator. If actual cross-worktree exact-path failures justify a change, evaluate an entropy-bearing filename policy/exclusive retry or explicit coordination; retain NNN for narrative if desired. Timestamp+slug alone is not enough. This work is independent of whether an index view is persisted.

### 4. Changelog generation: what actually is novel?

**Verified Drift behavior — CODE + TEST:**

- One fragment per change reduces authoring contention. Generated CHANGELOG.md still creates a shared tracked write surface.
- scripts/build-changelog.py: merge() unions generated entries by fragment ID, honors base deletions, and three-way merges the hand-written regions. Relevant tests exercise two-thread rebase, tag-knowledge differences, and genuine hand-written conflicts.
- Stable IDs aid semantic merging but do not remove ordinary text conflicts if the merge driver is absent. Removing INDEX.md does nothing by itself for CHANGELOG.md contention.
- hand_edited()/regenerate() implement a one-way view: current/committed fragment body comparison distinguishes stale generated text from edited output; edits are reported, not written back. Write-back described in local contaminated clone READMEs is not current shipped policy.
- Artifact+fragment+index publication is sequential recoverable multi-file work with saved intent and exclusive create, not a database ACID transaction. A crash can leave a partial publication; retry completes forward. A subsequent derived changelog regeneration is another step.
- lib/changelog.ts guards explicit adoption and foreign schemes such as changesets/towncrier; generation and clone-driver installation are already automated in adopted repositories.

**How competitors manage it:**

- OpenSpec — CODE/tooling: package releases use .changeset/; dated archived changes provide content history separately from living capability specs. Neither removes the standard package changelog requirement for users who expect a single CHANGELOG.md.
- BMAD-METHOD — CODE: validate_manifests.py and render_skill.py carry renderer/source SHA-256 metadata for generated content. Borrowable provenance stamp, but not itself a semantic merge or source-authority decision.
- context-portal — CODE: mutable product/active context history is written in SQLite transactions with change_source attribution. This is history of database edits, not a Git-multi-branch release-changelog solution.
- ccpm — PROMPT: last_sync and SYNCED markers accompany gh-based progress comments. Advisory timing markers are not atomic remote idempotency receipts and do not prove the remote append succeeded.
- agent-os — LEGACY: CHANGELOG.md describes per-feature Recaps, but the referenced complete-tasks.md and active recap commands are absent from the current tree. Do not recommend adopting a supposedly current implementation that is no longer there.
- beads/basic-memory/ruflo — provenance excludes local Drift fragments. No novel upstream fragment scheme was verified from that residue.

**Assessment:** no audited project supplied a demonstrably better drop-in solution for Drift's exact parallel-Git generated changelog problem. Keep the current fragment + deterministic render + merge driver approach unless a separate requirement changes. BMAD-style provenance stamps are an optional experiment only if measured git-history edit-check cost warrants the format complexity; source hashes alone do not establish safe write-back or distinguish every stale-view case.

### 5. SQLite, retrieval, and rebuild correctness

**basic-memory — CODE:** Markdown content/permalinks drive a derived index. indexing/change_detector.py compares storage and DB checksums, classifies new/modified/deleted/moved files, and batches SQL parameter sets. index/watch_service.py batches watcher events. Move detection checks indexed checksum and sync_checksum. Compact search defaults to paginated metadata instead of loading every note body.

**Important caveat:** markdown/utils.py:46–60 creates a fresh UUID for ordinary notes when no DB entity exists. entity_repository.py:626–629 preserves existing external_id on upsert. These are different from full DB reconstruction. A genuinely disposable Drift cache cannot be the sole location of permanent artifact IDs, relationships, or other authoritative metadata.

**context-portal — CODE:** SQLite is source truth; decision/custom-data FTS is maintained by triggers in db/database.py:280–349. Vector embeddings are managed at handler call sites, and mcp_handlers.py:332 acknowledges an update gap. FTS consistency does not imply vector consistency. _format_decisions_md() exports without decision IDs/tags; _parse_decisions_md()/import handlers reconstruct create calls without original identity/dedup. Reimport can mint duplicate decisions/progress and new timestamps. Markdown exchange is not a lossless canonical backing store.

**memory-bank-mcp — CODE:** file CRUD and directory listings, no SQL or derived index machinery. **RooFlow — PROMPT/config:** installing a ConPort strategy delegates storage/query to another server; it is not an implemented storage/index layer in RooFlow itself.

**Assessment:** use basic-memory's compact-discovery and files-as-truth pattern, not ConPort's canonical DB model, for any Drift cache. At 400–500 artifacts, first measure parsing/spawn/filesystem cost and actual search needs. A scan-only catalog is simpler and already pays the present freshness cost. Optional SQLite FTS becomes justified by demonstrated body-search/structured-query needs, with explicit invalidation, schema, rebuild, corruption, and move semantics. No watch daemon, vector service, full-text indexing dependency, or DB migration is authorized by this research.

### 6. Archival, retention, and summarization

**OpenSpec — CODE + TEST:**

- list.ts defaults to active changes and opts into history; archive.ts physically moves a completed change into a date-prefixed archive after handling spec changes.
- The reviewer who reported "no archive lock found" missed shipped code. Main-session inspection confirmed archiveClaimPath():772 and claimArchiveDestination():822 use .openspec-archive.lock and exclusive fs.open(...,'wx'). Release checks ownership before unlinking; stale claims are reported, not blindly broken. Tests around archive.test.ts:2240–2360 cover stale/live/replaced claims and Windows identity handling.
- Physical moves use streamed/tree fingerprints, staged moves or guarded Windows/cross-device fallback, verified cleanup, and recovery diagnostics. This is substantial safety machinery, not a cheap mv.
- Requirement-base fingerprinting in changes/<id>/meta.json and a change-sync diff3 workflow in openspec-parallel-merge-plan.md remain a PROPOSAL for spec-edit convergence. They are distinct from shipped filesystem move fingerprints. That spec replacement hazard is not an established bug in Drift's path-keyed index merge.

**beads — CODE + TEST, supplemented by main-session inspection:**

- Semantic compaction is implemented: admin compact routes analyze/apply/auto in cmd/bd/compact.go, and only tier 1 is currently offered through this CLI.
- internal/compact/compactor.go:134–147 snapshots the original text before AI compaction overwrites it; compactor_unit_test.go:153–211 tests snapshot-before-update and abort-on-snapshot-failure. Restore storage support is present.
- Do not generalize that guarantee to every path: runCompactApply():646–720 accepts an agent summary and calls UpdateIssue()/ApplyCompaction() without the explicit SnapshotIssue() step in that handler. This audit did not prove equivalent snapshot protection elsewhere for manual apply. The attractive analyze/apply workflow has a safety question, not an unconditional reversible-compaction guarantee.
- prune.go wires protectReferenced by default and requires scope/preview/force choices. It is deletion of DB items, not immutable Markdown archival.

**Other comparisons:**

- cursor-memory-bank — PROMPT: archive + pointer + activeContext/tasks reset, no verified locking/fingerprint/recovery implementation.
- my-claude-code-setup — PROMPT: delete/consolidate/archive checklist with an archive README; content preservation is instruction, not enforcement.
- ccpm — PROMPT: archived-epic mv snippets, no equivalent tested filesystem safeguards.
- mcp-shrimp-task-manager — CODE: timestamped memory backup before clearing the active task list. Useful backup-before-destroy pattern, not proof all concurrent states survive.

**Assessment:** start with logical feature/status/time views and optional new summary artifacts that preserve originals and paths. Physical archival adds broken-reference, private-store, concurrency, and migration costs. A research artifact's `status: complete` means the research document is finished, NOT that the feature or all dependent work can be archived. Active-set selection needs its own explicit semantics; do not silently remove complete research from needed context. Existing union drivers preserve base deletions, so deletion resurrection is not a valid argument against archiving, but deleting only a derived row while retaining its source artifact would naturally be undone by a later rebuild.

### 7. Handoff evidence, verification, and privacy

**Drift already has** measured state, truthful partial-work reporting, small verifiable steps, per-step execution checks, decision checkpoints, citations, source_research/previous_handoff/related_artifacts, and early handoff on an ordinary request. Citation grades establish text freshness, not test coverage or behavioral correctness.

**Competitor additions — PROMPT unless stated otherwise:**

- handoff-skill SKILL.md:51 defines Verified / User-reported / Inferred / Unverified and exact evidence boundaries. Its template ledger is specifically "Verified or passed", "Failed and resolved", and "Not run or manual validation still required". Current unresolved failures must not disappear into the resolved category; a Drift adaptation should keep failed-and-unresolved explicit.
- HANDOFF-md adds mandatory verification-command or Manual check, known blind spots/dead ends, schema version, and token-pressure capture. Its singleton overwrite and create-in-every-project model are weaker/incompatible with Drift's history/policy defaults.
- handoff-skill privacy/completeness checks are model instructions, not a credential/PII scanner or a security guarantee.
- spec-kit clarify/analyze/checklist/converge are current shipped model templates; associated scripts resolve prerequisites/paths rather than performing semantic requirement analysis. Converge appends unmet work when invoked; Drift could borrow the review rubric without automatically creating tasks from uncertain findings.
- OpenSpec delta application/structural validation is CODE, but its Completeness/Correctness/Coherence verification report is a SKILL/template workflow, not automated proof that code satisfies requirements. Main inspection confirmed advisory "Not applicable" vs "Not verified" semantics at skills/openspec-verify-change/SKILL.md:63–74. This distinction corrects overly broad claims that all OpenSpec verification is implemented TypeScript.
- claude-code-spec-workflow task validator/bug verification are PROMPT/template rubrics. Quantified atomicity and reproduction checklists sharpen Drift's existing small/verifiable task guidance rather than adding a wholly absent verify lifecycle.

**Assessment:** high-fit low-infrastructure adaptations are explicit evidence tiers/verification ledger plus failed attempts/blind spots in handoff output, and honest optional requirement-review reports. Do not auto-run artifact-provided verification commands or spec-kit config hooks without a trust/permission design. Reformatting an existing verification discipline is valuable but must not be sold as a mechanism Drift has none of.

### 8. Durable standards, decisions, and pitfalls

- agent-os — PROMPT: ask-why standards discovery, small topic files, description-based selective injection and user confirmation. Novelty is curated recurring knowledge with rationale, not persistent memory in general.
- BMAD-METHOD — PROMPT + config scripts: project-context record intent admits observed mistakes as pitfalls; audit requires evidence and user-approved retirement. Prefer executable project checks over accumulating prose where feasible. The model performs substantive context reconciliation.
- my-claude-code-setup — PROMPT: synchronizer edits living CLAUDE memory files. It does not mechanically repair stale evidence; applying it to Drift history would violate status-only artifact mutation.
- memory-bank-mcp — PROMPT + CRUD: file-read/update hierarchy and learned conventions; no uniquely strong evidence/maintenance engine.
- claude-simone — LEGACY/PROMPT: ADR directories and project-health snapshots are useful content structure, not proof of current code-level functionality.
- letta — landing/deprecation docs only in this checkout. Do not infer old MemGPT machinery from stars or the project's former reputation. The explicit successor notice is a useful document-lifecycle idea, not a reviewed memory implementation.

**Assessment:** ADAPT optional user-approved standards/pitfall/current-truth summaries separately from immutable research/handoff history. Relevance-based loading and rationale can compound across features. New standing instructions need authority, evidence, review, size budget, and retirement rules; automatically extracting every historical decision into permanent context would amplify stale mistakes.

### 9. Task readiness, parallel ownership, emergency flush, and outcomes

- beads — CODE + TEST: ready work and atomic claims use storage transactions/row locks/leases; external gate types include human/timer/GitHub states. These guarantees do not transfer to a casually edited Markdown claim field. Drift does not have a fleet scheduler/atomic work claim and does not automatically need one.
- claude-task-master — CODE: next-ready sorting and dependency validation offer an explicit query alternative. Complexity-driven decomposition can improve prompts; a new deterministic numerical score is not itself truth or correctness.
- ccpm — PROMPT + thin scripts: declared conflicts_with, per-stream scopes, and shared-file owner extend orchestration vocabulary. Drift already requires non-overlapping delegated write scopes; the genuinely new part is persisted declarative conflict metadata, not discovering scope discipline from scratch. last_sync/5-minute confirmation is not reliable network idempotency.
- mcp-shrimp-task-manager — CODE + PROMPT: canExecuteTask dependency check is code; verify/no-pass/wait is prompt workflow. Drift already verifies and stops for unresolved decisions.
- claude-simone — LEGACY/PROMPT: next-sprint-only JIT decomposition avoids stale distant tasks. Useful guidance, not a current enforced scheduler and not wholly foreign to Drift's deferred decomposition.
- roo-code-memory-bank — PROMPT: UMB regex in YAML tells the model to flush living memory. It is not a runtime interrupt, quota detector, or token-pressure sensor. `/drift <handoff request>` already provides an early-handoff path; a dedicated alias needs field evidence of usability failure.
- ruflo — DOC/data + PROPOSAL: fate ledger's backfilled 4/1/75 counts are self-reported, not independently validated outcome telemetry. Conditional append explicitly is unshipped. Drift already reports landing through lib/land.ts; the actual gap is longitudinal research/plan-to-outcome accounting, not any absence of landing evidence.

**Assessment:** consider explicit feature/readiness query modes without changing newest-only default; optional declared scopes/conflicts; and a derived outcome view that reports unknowns instead of treating artifact completion as proof of remote landing. Defer a SQL claim/lease/gate engine, GitHub write sync, automatic unblock scheduling, and new flush commands until a demonstrated requirement justifies them.

### 10. Prioritized adoption assessment after verification

This ranking is a research recommendation, not an accepted implementation plan.

| Candidate | Evidence/reference | Assessment |
|---|---|---|
| Shared catalog query returning newest/recent/list metadata | Drift's existing renderer; OpenSpec live list; catchup discovery | High fit. Add read-only structured output, preserve paths/order/default routing. Separates pickup from table persistence without a DB. |
| Explicit evidence/verification ledger and failed approaches in handoffs | handoff-skill, HANDOFF-md | High fit. Small prompt/template improvement; no stored-command execution, scanner guarantee, or extra mandatory phase. |
| Compact discovery with page/limit output | basic-memory | High fit for search/list usability. Current context already limited to eight; improve discovery, not imaginary whole-index injection. |
| Curated standards/pitfall summaries with rationale | agent-os, BMAD | Useful optional capability with governance cost. Preserve originals; never auto-repair immutable artifacts. |
| Logical active/history/feature/time views | OpenSpec active-only query pattern | Useful before physical archive. Needs explicit feature lifecycle; complete research is not closed work. |
| Entropy-bearing filename identity for parallel tracked worktrees | waveforward exclusive create; beads collision retry | Conditional. Fix actual filename namespace if failure evidence warrants; frontmatter UUID alone is insufficient. |
| Derived SQLite/FTS index | basic-memory checksum/query patterns | Conditional on measured search/latency need. Authoritative identity must be file-carried if the DB is advertised disposable. |
| Longitudinal outcome/plan-fate view | ruflo concept; existing Drift statuses/land receipts | Investigate derived reporting; distinguish unknown/not landed from never acted on. |
| Changelog provenance stamps | BMAD renderer metadata | Optional optimization only. Current fragments/driver already solve authoring and merging; benchmark before format change. |
| Physical archive or destructive semantic compaction | OpenSpec guarded archive; beads backup/restore paths | Defer. Safety and reference/lifecycle costs are substantial; do not import prompt-only cleanup or assume every path snapshots. |
| Atomic task claims/gates/fleet scheduler | beads | Different product scope. No justified adoption from file count alone. |
| Living spec deltas and convergence task generation | OpenSpec/spec-kit | Larger second truth store/workflow change; optional explicit review first. |
| Dedicated emergency flush alias | roo UMB | Not an established gap: ordinary early handoff is already possible. |

### 11. Revised answer to the original architecture debate

There is a valid case to remove INDEX.md as a correctness dependency, but the evidence supports DECOUPLING before DELETION. The existing shared parser/order implementation can answer pickup/context queries directly. Keep table export/compatibility and the driver while a repository still chooses tracked index views. This preserves manual-host/GitHub advantages without requiring table text as an internal API.

That decision does not require a filename migration, a SQLite store, physical archival, tombstones, or a new ready scheduler. Those solve distinct issues and need separate requirements. Retiring a derived file is reversible in principle, but does not promise byte-identical historical reconstruction after source files/metadata change. Keeping sequential narratives is reasonable; exact-name safety across independent branches must be considered independently.

For changelog, the strongest conclusion is KEEP THE EXISTING PIPELINE: fragments eliminate most authoring contention; a deterministic generated view plus a semantic merge driver handles tracked-output conflicts. No source audit established an upstream drop-in replacement superior for this specific problem. The earlier conversation overstated both how little concurrency protection Drift has and how much unique IDs alone would accomplish.

## Code References

### Drift inspected directly; clean HEAD unless marked working tree

- scripts/build-index.py:47 — parse_artifact(): full text read and legacy fallback.
- scripts/build-index.py:135 — path-keyed base-aware deletion-preserving merge_rows().
- scripts/build-index.py:143 — ordered(): UTC order and feature/sequence ties.
- scripts/build-index.py:160 — merge(): writes only the supplied index file.
- scripts/build-index.py:171 — render(): assigns global table ordinals, not artifact identities.
- tests/index-merge.test.ts:33 — two-thread Git rebase/merge fixture.
- tests/index-merge.test.ts:73 — one-sided removal, same-path text, empty-base/CRLF fixtures.
- lib/artifacts.ts — working tree: syncIndex():259, remoteSequenceNumbers():299, prepare():310, publish():359; allocation/publish flow confirmed also present at HEAD; changelog validation changes are dirty.
- lib/state.ts:348 — cross-process withLock().
- lib/state.ts:678 — recent index context, eight-row/600-character bounds and 512 KiB cutoff.
- lib/pickup.ts:35 — newest() refreshes index, then reads newest row.
- lib/pickup.ts:82 — named/default selection and finished-newest behavior.
- scripts/build-changelog.py:326 — one-way hand_edited() detection.
- scripts/build-changelog.py:346 — regenerate() and concurrent-view digest checks.
- scripts/build-changelog.py:413 — changelog merge driver with ID union, base deletions, handwritten three-way merge.
- tests/changelog-build.test.ts — one-way-edit, rebase, tag, and handwritten conflict fixtures.
- lib/changelog.ts — adoption, foreign-fragment guards, lock and regeneration.
- lib/land.ts — existing landing sequence/evidence and describeLanding().
- skills/drift/plan.md; execute.md; handoff.md; SKILL.md — existing verification, delegation, decisions, history/reference/lifecycle contracts.

### External implementation/test references (relative to each named clone)

- OpenSpec:src/core/list.ts:128 — active/archive selection and derived enumeration.
- OpenSpec:src/core/archive.ts:399 — file/tree fingerprinting and guarded move support.
- OpenSpec:src/core/archive.ts:772 — .openspec-archive.lock path.
- OpenSpec:src/core/archive.ts:822 — exclusive archive claim and recovery.
- OpenSpec:test/core/archive.test.ts:2240 — stale/live/replaced claim tests.
- OpenSpec:src/core/specs-apply.ts — implemented delta application; separate from proposed meta.json baseline guards.
- OpenSpec:openspec-parallel-merge-plan.md:30 — proposed requirement-baseline/diff3 work.
- OpenSpec:skills/openspec-verify-change/SKILL.md:63 — model verification rubric with Not applicable/Not verified distinctions.
- beads:internal/idgen/hash.go:55 — hash/nonce ID generation.
- beads:internal/storage/issueops/helpers.go:285 — collision probe/retry; adaptive-length configuration later in file.
- beads:internal/storage/domain/db/issue.go:475 — claim CAS; GetReadyWork()/ClaimReadyIssue() later in file.
- beads:backend/conformance/ready_claimer_contract.go — claim contract tests.
- beads:cmd/bd/compact.go:646 — manual summary apply path.
- beads:internal/compact/compactor.go:134 — snapshot-before-AI-overwrite.
- beads:internal/compact/compactor_unit_test.go:153 — snapshot ordering/abort fixtures.
- beads:cmd/bd/prune.go — reference-protection flag and scoped preview/force behavior.
- waveforward:src/waveforward/core.py:222 — snapshot ID then exclusive directory create.
- waveforward:src/waveforward/core.py:585 — timestamp plus UUID-random suffix.
- spec-kit:scripts/python/create_new_feature.py — counter/timestamp modes and mkdir policy.
- basic-memory:src/basic_memory/indexing/change_detector.py — batched checksums and move classification.
- basic-memory:src/basic_memory/index/watch_service.py — watcher/event batching.
- basic-memory:src/basic_memory/markdown/utils.py:46 — ordinary-note UUID generation on reconstruction.
- basic-memory:src/basic_memory/repository/entity_repository.py:626 — existing DB UUID preserved on upsert, not full reconstruction.
- basic-memory:docs/COMPACT_DISCOVERY.md — metadata-only output and token-limit caveat.
- context-portal:src/context_portal_mcp/db/database.py:280 — trigger-maintained FTS.
- context-portal:src/context_portal_mcp/handlers/mcp_handlers.py:332 — vector update gap note.
- context-portal:src/context_portal_mcp/handlers/mcp_handlers.py:767 — lossy Markdown decision export.
- context-portal:src/context_portal_mcp/handlers/mcp_handlers.py:1024 — import creates records without original identity/dedup.
- claude-task-master:scripts/modules/utils.js:1010 — writeJSON locking, stale-read caveat, under-lock reread.
- claude-task-master:scripts/modules/task-manager/find-next-task.js — dependency-ready selection.
- mcp-shrimp-task-manager:src/models/taskModel.ts — UUIDs, whole JSON writes, task gating and timestamped backup.
- BMAD-METHOD:skills/bmad/scripts/render_skill.py — renderer/source hash metadata.

### External prompt/legacy/proposal references

- handoff-skill:handoff/SKILL.md:51; handoff/assets/handoff-template.md:105 — evidence tiers and exact ledger headings.
- HANDOFF-md:README.md; .agentrules — known dead ends, verification command, singleton convention.
- agent-os:commands/agent-os/discover-standards.md; inject-standards.md; index-standards.md — rationale and selective attention index.
- agent-os:CHANGELOG.md:228 — historical recap claim, absent from current commands.
- BMAD-METHOD:skills/bmad-project-context/SKILL.md — observed-pitfall and evidence-backed audit policy.
- my-claude-code-setup:.claude/agents/memory-bank-synchronizer.md; .claude/commands/cleanup/cleanup-context.md — model-performed maintenance and cleanup.
- cursor-memory-bank:.cursor/commands/archive.md — archive/reset instructions, not executable guards.
- ccpm:skill/ccpm/references/execute.md; structure.md; sync.md — declared scopes/conflicts and advisory external sync.
- roo-code-memory-bank:modules/memory_bank_strategy_code.yml:87 — UMB prompt trigger.
- RooFlow:config/roo_code_conport_strategy — delegated ConPort prompt backend.
- memory-bank-mcp:custom-instructions.md — hierarchy/project intelligence conventions; src/presentation/controllers/ implements CRUD only.
- spec-kit:templates/commands/clarify.md; analyze.md; converge.md — model analysis, distinct from path/prerequisite scripts.
- claude-code-spec-workflow:src/markdown/agents/spec-task-validator.md; src/markdown/templates/bug-verification-template.md — task/bug review rubrics.
- claude-simone:legacy/README.md:56 — next-sprint-only historical JIT convention.
- letta:AGENTS.md; README.md — deprecation/successor landing docs, no old platform implementation inferred.
- ruflo:docs/memory/conditional-append.md:7 — explicitly not installed/published.
- ruflo:docs/dream-cycle/LEDGER.md:13 — self-reported backfill counts, not audited telemetry.

## Open Questions

1. What are real pickup/publication/search latencies and failure counts in the user's 400–500-artifact projects? Measure a representative Windows/OneDrive deployment before choosing cache/storage architecture.
2. Is a shared JSON catalog API enough to remove persisted-index dependency while maintaining all manual-host ordering, policy checks, newest-only semantics, warning/error behavior, and named reference handling?
3. Which human-facing view should remain optional for tracked repos: full timeline export, paginated catalog, feature summary, or GitHub-friendly generated Markdown? This has not been decided.
4. Are independent tracked worktrees actually colliding on exact artifact/fragment names, duplicating only sequence ordinals, or merely conflicting on generated views? These have different fixes; no end-to-end race reproduction was run in this audit.
5. What would close/retire a FEATURE, as distinct from complete research/plan/handoff status? Logical filtering and physical archival need an explicit model, not a guessed complete-status trigger.
6. What authority/identity survives database deletion, moves, shared private stores, clones, and retries? Avoid claiming DB-only UUIDs or timestamps provide all of these guarantees.
7. Does beads' manual --apply compaction path preserve original content outside the inspected handler? AI auto-compaction snapshots are verified; equivalent manual-apply reversibility remains unresolved.
8. Which recurring standards/pitfalls deserve standing context, and who approves/refreshes/retires them? This is governance work, not a passive index optimization.
9. How can outcome reporting distinguish completed artifact, attempted implementation, passed checks, successful landing, external merge, and later revert without inventing certainty from local status?
10. No migration or implementation has been authorized. Which verified candidates should proceed to a scoped plan is a user priority/product decision.

This task was read-only comparative research. Both research artifacts preserve the findings, errors, competing arguments, and remaining decisions; a separate implementation handoff is not needed, and overlapping Git changes observed in the session record are not claimed as this review's work.
