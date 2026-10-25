---
date: "2026-10-13T10:59:02+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "ecosystem-survey"
sequence: "001"
type: "research"
status: "complete"
session_started: "2026-10-12T11:08:10+01:00"
session_id: "01a12f95-80ad-768a-beab-3053980bf7c7"
interval_id: "4b42486d-272a-4989-955d-b129efcd4348"
start_branch: "main"
start_commit: "e871e2fae8a243ab6e7c1abf70b5fd1b69534dd1"
related_artifacts: []
anchors: [{"path":"scripts/build-index.py","start":135,"end":135,"sha256":"3db7d1a3799ce3771632169f663cb22b556abdf14c23ffb9852f508cd0eec476","context":["def merge_rows(base, ours, theirs):","def merge_rows(base, ours, theirs):"]},{"path":"scripts/build-index.py","start":143,"end":143,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","context":["",""]},{"path":"scripts/build-index.py","start":171,"end":171,"sha256":"cedccdc91bd655d49071858170bdcf4405c0178a32a16074ab6a1db71949d380","context":["def render(dated, undated):","def render(dated, undated):"]},{"path":"scripts/build-changelog.py","start":326,"end":326,"sha256":"8f910e06bb9f67e5bae40bfa94f4671ccfa022d74da5a2611bc5301556eadc33","context":["        text = (git(repo, \"show\", f\"{sha}:{ident}\", ok=(0, 128)) or \"\").replace(\"\\r\\n\", \"\\n\")","        text = (git(repo, \"show\", f\"{sha}:{ident}\", ok=(0, 128)) or \"\").replace(\"\\r\\n\", \"\\n\")"]},{"path":"scripts/build-changelog.py","start":346,"end":346,"sha256":"a47f8015819eeb01cc93c6f46714d2a74c9a1b7a413eeb9ecea737d1d8cceb91","context":["    return edited","    return edited"]},{"path":"scripts/build-changelog.py","start":413,"end":413,"sha256":"19c7da7d73064b1b1f4e2479257d556bdebf38991e9c5835576c527dd7d76627","context":["def merge(paths):","def merge(paths):"]}]
---

## Research Question

Which of the 23 locally cloned context-continuity, memory-bank, spec-driven development, and agent-project-management repositories contain mechanisms Drift could usefully adopt? At the user-reported scale of 400–500 Markdown handover artifacts, should Drift retain a persisted INDEX.md, use a derived SQLite index, change artifact identity, or introduce archival? What are the strongest arguments on both sides?

The user requested Claude Fable 5 subagents, publication of the accumulated research, and then a source-grounded review of that research against the cloned implementations. This artifact records the exploratory survey and competing design arguments. A subsequent research artifact will adjudicate them; this is not an implementation plan or approval to change Drift's architecture.

## Summary

Two rounds of five Claude Fable 5 reviewer subagents surveyed 23 repositories: first for novel continuity mechanisms, then for index/catalog, ID allocation, changelog, and archival behavior. Promising candidates include stronger evidence boundaries in handoffs, durable project standards and pitfalls, compact discovery, on-demand artifact enumeration, identity independent of display order, and optional derived full-text indexing.

The debate exposed several unsupported assertions. A direct baseline check before publication already disproves claims that Drift's merge driver renames artifact filenames or blindly resurrects base-row deletions, and disproves supposed upstream adoption of Drift changelog fragments in several clones. The recommendations below are candidate adaptations, not accepted decisions; the follow-up review must distinguish implementation, tests, prompt conventions, design proposals, and local checkout contamination.

## Detailed Findings

### 1. Scope, evidence, and repository provenance

All review targets are local clones under C:/Projects_2.0/. No target was installed, built, executed as an application, updated, cleaned, or modified for this publication. Clones were made shallow when newly downloaded; existing catchup, beads, basic-memory, and ruflo checkouts were reused. The reports are static code/document inspection, not runtime validation or benchmarks.

Captured clone heads:

| Folder / upstream | HEAD |
|---|---|
| catchup — wilbeibi/catchup | 50ac5ca88628f5785f81318e4a7841a96f409585 |
| beads — gastownhall/beads | b630f96f5bd231ff7aea78af0d47b6038f228d00 |
| basic-memory — basicmachines-co/basic-memory | 76c2acf0d4496e8f5aa70efc454f5ce644775851 |
| HANDOFF-md — toshon-jennings/HANDOFF-md | 0d589260ac816dc3ad36f00e12baf85d9197008d |
| handoff-skill — mihirduvedi/handoff-skill | aa730a57c16464abfaf49f06df2a77896bb6bf64 |
| waveforward — voltjia/waveforward | afed413d35a0d755d303af26963c2b59bc617e3a |
| cursor-memory-bank — vanzan01/cursor-memory-bank | 7d879d8f5079ad77d845fdc92ca03903dbbd3a85 |
| roo-code-memory-bank — GreatScottyMac/roo-code-memory-bank | 7672d44b398dfe5e1db80df0f3c73fe642c504bc |
| RooFlow — GreatScottyMac/RooFlow | 60a801f61e43417a5067d7007e62909d61f3ba17 |
| context-portal — GreatScottyMac/context-portal | 18bde469feb03c233d11c9a4941bd27bd859a5ff |
| memory-bank-mcp — alioshr/memory-bank-mcp | 559e42274147bb60f263b24c496d54593fb7f807 |
| my-claude-code-setup — centminmod/my-claude-code-setup | 7d5c3743942606a9c5756de47ecdb41e2317c8b6 |
| spec-kit — github/spec-kit | 6c62e10d5ab1d676c557eb2d0cee86be52c893d2 |
| OpenSpec — Fission-AI/OpenSpec | 9111a7654d7800391459431fff4eaf66e33a3d2e |
| BMAD-METHOD — bmad-code-org/BMAD-METHOD | 9f1987169a2e5626e5ccb31bb9cee051fdb3df20 |
| agent-os — buildermethods/agent-os | e892e61d322759165e7d9173e92c1010406c9f4d |
| claude-code-spec-workflow — Pimzino/claude-code-spec-workflow | f3de74d8055120658ac199bfca865a3e1de9fd99 |
| claude-task-master — eyaltoledano/claude-task-master | c0c98d367c55296bfe69e65680625b6db437af02 |
| ccpm — automazeio/ccpm | 7d7e4623bc6d4c0c9ba66ca6bfecd7e5261dc697 |
| mcp-shrimp-task-manager — cjo4m06/mcp-shrimp-task-manager | 8a3be6bced310c7b660e5cfc3f42e4e5e45f2f61 |
| claude-simone — Helmi/claude-simone | ca1820fcf053e471a3cedbc9c3c61808ca4ec0d7 |
| letta — letta-ai/letta | 5bcdd177d70fa2b31a754cfcd801e77b2e1ab16a |
| ruflo — ruvnet/ruflo | d6832d77ebb4f5c40abbfaa32c0263f973315c49 |

Provenance warning: `git status --short` reports modified CHANGELOG.md/.gitattributes and untracked changelog.d/ in beads and basic-memory; ruflo has modified CHANGELOG.md and untracked .gitattributes/changelog.d/. Their changelog.d/README.md files are NOT tracked upstream. Earlier reviewers treated those files as evidence of adoption. That inference is invalid: these are local Drift-generated residue, consistent with the automatic-adoption issue documented in Drift's docs/changelog.md. Future comparison must inspect upstream HEAD for those paths, not local residue. Leave that residue alone during research.

Drift comparison baseline: local HEAD 97c61c2057a60e84c6cafe68508d19838c448cbc, with overlapping dirty changes in CHANGELOG.md, docs/changelog.md, docs/field-observations.md, extensions/drift.ts, lib/artifacts.ts, skills/drift/hosts/pi.md, tests/drift.test.ts, tests/pi-runtime.test.ts, and a changelog-pipeline fragment. Those changes are not attributed to this review. References to lib/artifacts.ts and docs/changelog.md below describe the observed working tree; follow-up review should mark HEAD-versus-working-tree differences.

### 2. Drift baseline: facts established before publication

- Artifact truth is Markdown frontmatter/body under drift/<feature>/NNN-kind-slug.md. Status is pending/in-progress/complete/superseded, with status changes the stated exception to immutability.
- `scripts/build-index.py` parses artifacts and renders a chronological table. Its merge key is artifact PATH, not global table ordinal. `merge_rows()` uses the base and removes paths deleted from either side; it is not a naive append-only union. `render()` assigns table `#` values but does not rename files or rewrite their frontmatter sequences.
- `lib/artifacts.ts: prepare()` allocates a three-digit sequence from the current feature folder and, in tracked mode, known remote-tracking refs. `publish()` holds a store .publish.lock and a record lock, persists pending intent before writing, refuses to overwrite different content, and retains retry receipts. This serializes publications sharing that store; it does not coordinate simultaneous unseen branch publications in separate tracked stores.
- Artifact and fragment names include feature, sequence, kind/slug as applicable. Same sequence plus DIFFERENT slugs is not automatically an exact filename collision. Sequence-ordinal duplication and exact-path collision are separate problems.
- `lib/pickup.ts: newest()` calls syncIndex() and reads the newest dated table row. Failed refresh is caught and pickup may use the existing index. Default behavior deliberately stops on a completed newest plan/handoff rather than reaching back for an older open item.
- `lib/state.ts` context injection reads only the last eight index rows, not the full 400–500-row index. Claims of existing whole-index context injection are incorrect.
- `scripts/build-changelog.py` implements a generated region AND a changelog merge driver. Fragments reduce authoring contention, but generated CHANGELOG.md remains a shared tracked view that can need merge handling. Unique IDs alone cannot remove that shared-file conflict.
- The current changelog renderer is explicitly one-way: it detects unknown lines and hand-edited bullets and stops; it does not write edited view text back into fragments. Artifact/fragment publication shares pending intent, but multi-file writes are recoverable sequential operations, not a SQLite ACID transaction.
- Drift already has source_research, previous_handoff, related_artifacts links, small/verifiable task guidance, execution verification, decision checkpoints, and manual early handoff capability. Proposed improvements must extend those, not describe them as absent.

### 3. First-pass repo-by-repo survey (candidates to verify)

These are the earlier subagents' source pointers and interpretations. Unless confirmed in section 2, they remain exploratory until the follow-up audit.

#### catchup

Local CLI reads agents' native session stores and exports/forwards transcripts. Candidate adaptations: transcript recovery when no cooperative handoff was published; size/token preflight; query/last-N slicing; failed-tool-call retention; session lineage. Pointers: README.md, SKILL.md, internal/session/session.go, recipes/quota-visibility.md. First-pass verdict: ADAPT preflight and recovery interoperability; do not absorb a full cross-harness transcript product into Drift.

#### beads

Database-backed issue/dependency graph with ready-work selection. Candidates: typed blocking and non-blocking relations, conditional external gates, atomic claims, remembered facts, hash identities, summarization of closed issues, reference-aware pruning. Pointers: docs/core-concepts/dependencies.md, docs/core-concepts/hash-ids.md, docs/core-concepts/adaptive-ids.md, docs/multi-agent/coordination.md, docs/cli-reference/admin.md, docs/core-concepts/sync-concepts.md. First-pass verdict: ADAPT identity/relations/claim concepts, not the database architecture. Prior reports disagree on compaction/tombstones/current Dolt behavior; verify implementation and obsolete documentation before relying on them.

#### waveforward

Workspace snapshots and portable bundles. Candidates: staged/unstaged binary patches and bounded untracked-file capture, preview restore, timestamp-plus-random snapshot IDs. Pointers: src/waveforward/core.py, src/waveforward/history.py. First-pass verdict: ADAPT optional snapshot/export and entropy-bearing IDs; snapshots introduce secret-capture/storage risks and are not an unconditional default.

#### HANDOFF-md

Singleton HANDOFF.md convention. Candidates: explicit verification command, known blind spots/dead ends, schema version, token-pressure handoff trigger. Pointers: README.md, .agentrules. First-pass verdict: ADAPT content, SKIP singleton overwrite model. Automatic execution of stored commands would cross a security boundary and was not approved.

#### handoff-skill

Portable continuation brief skill. Candidates: verified/user-reported/inferred/unverified fact tiers; passed/failed/not-run/manual-required ledger; explicit verification boundaries; pre-delivery privacy/completeness review. Pointers: handoff/SKILL.md, handoff/assets/handoff-template.md. First-pass verdict: ADAPT evidence structure; workflow instructions are not mechanically enforced secret scanning.

#### cursor-memory-bank

Phased prompt/rules workflow over shared memory files. Candidates: complexity-tiered process depth, lazy rule loading, reflection, archive-plus-pointer/reset active context. Pointers: .cursor/commands/archive.md, reflect.md, van.md, .cursor/rules/isolation_rules/Core/complexity-decision-tree.mdc. First-pass verdict: ADAPT selective process depth and reflection; hard implementation gates conflict with Drift's advisory citation philosophy. Archival is a prompt instruction until source proves mechanical enforcement.

#### roo-code-memory-bank

Living activeContext/decisionLog/productContext/progress/systemPatterns files. Candidates: event-triggered decision capture; UMB emergency flush; per-mode access policy. Pointer: modules/memory_bank_strategy_code.yml. First-pass verdict: ADAPT a clear user-triggered handoff affordance if useful; `/drift <request>` already accepts an ordinary early handoff request. No established scalable conflict/compaction mechanism was found.

#### RooFlow

Memory-bank modes plus orchestrator and optional ConPort backend. Candidates: delegated task lineage, contextual tool inventory, interchangeable backends. Pointers: config/.roo/system-prompt-flow-orchestrator, config/roo_code_conport_strategy, config/generate_mcp_yaml.py. First-pass verdict: mostly SKIP host-specific orchestration/plumbing; formal worker-parent links might be useful.

#### context-portal

ConPort uses per-workspace SQLite plus FTS/vector retrieval and structured links. Candidates: typed relationships, recent-activity queries, bounded retrieval, transactional context history, stable natural keys for idempotent upserts. Pointers: src/context_portal_mcp/db/database.py, db/models.py, db/vector_store_service.py, handlers/mcp_handlers.py, main.py. First-pass verdict: ADAPT retrieval/history ideas. Correction: its SQLite is primary storage; Markdown is import/export, not source truth. FTS consistency and vector consistency are different guarantees; import/export may lose metadata or duplicate records and needs verification.

#### memory-bank-mcp

File-based multi-project MCP CRUD with a prescribed memory hierarchy. Candidates: durable project-intelligence preferences, explicit read/update order. Pointers: custom-instructions.md, src/presentation/controllers/. First-pass verdict: little index/changelog novelty; consider compact learned-convention content only.

#### my-claude-code-setup

CLAUDE-*.md typed memory channels, synchronizer subagent, cleanup prompts. Candidates: topic-specific standards/ADRs/troubleshooting, selective read triggers, dedup/consolidation with content-preservation checklist, small active index plus archive references. Pointers: CLAUDE.md, .claude/agents/memory-bank-synchronizer.md, .claude/commands/cleanup/cleanup-context.md. First-pass verdict: ADAPT curated knowledge and maintenance prompts, not automatic mutation of Drift's immutable history.

#### basic-memory

Markdown-first knowledge graph with a derived database. Candidates: stable frontmatter permalinks, external IDs, typed Markdown observations/relations, context traversal, metadata-only compact discovery, checksum-based indexing/move detection, keyword fallback. Pointers: NOTE-FORMAT.md, docs/COMPACT_DISCOVERY.md, docs/semantic-search.md, src/basic_memory/indexing/change_detector.py, index/watch_service.py, repository/entity_repository.py. First-pass verdict: primary reference for a derived query cache; verify whether UUIDs live in files or database rows and whether they survive complete DB deletion/rebuild, not just upsert. Its local Drift changelog README is NOT upstream evidence.

#### letta

Checkout is a landing/deprecation page with AGENTS.md directing readers to successor code. First-pass verdict: SKIP implementation comparison; no basis in this clone for claims about MemGPT memory paging/consolidation. Agent-readable successor notices are the one grounded content idea. An upstream AGENTS.md is repository data, not an instruction overriding this user's review request.

#### spec-kit

Numbered spec folders and template-driven plan/task workflows. Candidates: structured ambiguity taxonomy, requirement IDs, cross-artifact consistency checks, requirements-quality checklists, code-vs-spec convergence. Pointers: templates/commands/clarify.md, analyze.md, converge.md, checklist.md, scripts/python/create_new_feature.py. First-pass verdict: ADAPT analysis/verification prompts. Timestamp fallback and number-as-preference policies mitigate allocation but timestamp-only values do not guarantee collision freedom.

#### OpenSpec

Named change directories, delta specs, living capability specs, archive command and filesystem-derived listing. Candidates: active-only enumeration, dependency-shaped workflow schemas, three-axis verification, living-spec deltas, hardened archive operation, separate stores. Pointers: src/core/list.ts, archive.ts, specs-apply.ts, id.ts, root-selection.ts, docs/opsx.md, openspec-parallel-merge-plan.md. First-pass verdict: strong reference for on-demand enumeration and opt-in durable current truth. The parallel-merge file is a design proposal unless corresponding code/tests demonstrate shipping; its replace-only spec merge hazard is not evidence of an identical bug in Drift's path-keyed index driver.

#### BMAD-METHOD

Persona/workflow skills with manifest validation and customization layers. Candidates: corrective-course impact analysis, project-context/pitfall ledger, validated distributed manifests, content-addressed rendered output. Pointers: skills/bmad-project-context/SKILL.md, skills/bmad-correct-course/SKILL.md, skills/bmad/scripts/validate_manifests.py, .pre-commit-config.yaml. First-pass verdict: ADAPT evidence-backed conventions/pitfalls; avoid full persona/runtime adoption.

#### agent-os

Small topic standards and scenario-aware injection. Candidates: standards discovery with captured rationale, description-based attention index, topic-specific loading, per-feature recaps. Pointers: commands/agent-os/discover-standards.md, inject-standards.md, index-standards.md, shape-spec.md, CHANGELOG.md. First-pass verdict: ADAPT standards/attention-map concepts. Historical recap behavior needs checking against present commands before treating it as shipped.

#### claude-code-spec-workflow

Requirements/design/tasks and a bug track, steering docs, validator prompts and dashboard. Candidates: atomic task validation, independent review agents, selective fast path, product/tech/structure context. Pointers: src/markdown/agents/spec-task-validator.md, src/markdown/commands/spec-steering-setup.md, src/markdown/templates/. First-pass verdict: ADAPT validator rubrics, not host-specific generated commands/dashboard. Drift already requires small independently verifiable tasks.

#### claude-task-master

Tagged task contexts in tasks.json, decomposition, dependency validation, next-ready selection. Candidates: priority/readiness queries, per-task test strategies, complexity-aware expansion. Pointers: docs/task-structure.md, docs/cross-tag-task-movement.md. First-pass verdict: ADAPT readiness as an explicit alternative, not a silent replacement for Drift's newest-artifact contract. Tag partitioning does not make concurrent updates to one JSON file merge-safe.

#### ccpm

PRD/epic/task Markdown plus GitHub issue synchronization and parallel streams. Candidates: conflicts_with separate from depends_on; per-stream file ownership; issue join keys; sync dedupe; linked bug tasks; archived epics. Pointers: skill/ccpm/references/execute.md, structure.md, sync.md, conventions.md. First-pass verdict: ADAPT declarative conflict/ownership and optional external tracker integration. Verify whether synchronization/archive mechanics are executable tools or instructions; GitHub issue IDs are atomically assigned remotely, but local provisional renaming/dependency rewrites carry costs.

#### mcp-shrimp-task-manager

Persistent JSON tasks and execute/verify/reflection prompts. Candidates: UUID task identity, explicit no-pass verification, timestamped task-memory archives. Pointers: src/models/taskModel.ts, src/prompts/templates_en/verifyTask/index.md, noPass.md, docs/tools.md. First-pass verdict: ADAPT verification distinctions; UUIDs reduce identity collisions but do not prevent two read-modify-write operations from losing updates to tasks.json.

#### claude-simone

Legacy milestone/sprint/task directory workflow with a project manifest. Candidates: just-in-time task decomposition, ADRs, project-health snapshots, small current-context pointers. Pointers: legacy/README.md, legacy/.simone/. First-pass verdict: content concepts only, SKIP hand-maintained catalog/scan-and-increment mechanisms. Label legacy material as historical, not active implementation.

#### ruflo

Large agent orchestration platform. Candidates: proposal fate ledger, reasoning/experience memory, conditional append/CAS, tombstone-aware authority. Pointers: docs/dream-cycle/LEDGER.md, docs/memory/conditional-append.md, docs/ruflo-explained.md. First-pass verdict: ADAPT feedback/accounting concepts. Conditional append is explicitly a concept/design document until proven installed; local Drift changelog residue is not upstream evidence.

### 4. Distinct concurrency problems: do not conflate them

1. Allocation race: two independent stores both allocate the same folder-local sequence from different snapshots. Store locks handle local/shared-store publication; remote refs are only as current as the last fetch. Entropy-bearing artifact/filename identity can reduce cross-branch exact-path collisions. A UUID in frontmatter alone does NOT prevent two writers targeting the same old filename.
2. Shared-view contention: independent files still generate edits to one INDEX.md or CHANGELOG.md. Stable IDs do not remove textual conflicts in those shared views. Deriving views on demand removes their tracked-write surface; keeping tracked views requires merge/rebuild handling.
3. Dangling references: physical moves/renames can invalidate path links. Global index row ordinals are not documented permanent reference identities. Claims that row renumbering currently rewrites artifact paths are wrong.
4. Lost update to one JSON/DB store: collision-resistant IDs do not solve read-modify-write concurrency or synchronize multiple independent databases. SQLite serializes transactions in one database, not disconnected clones.
5. Retry duplication: content/input digests and receipts are a separate idempotency problem. Drift already has retry receipts; external tracker sync may need its own key.

Timestamp+slug has no universal uniqueness guarantee: precision limits, repeated slugs, same timestamps, clock skew, and model-fabricated clocks matter. A random suffix, UUID, exclusive-create/retry, or actual shared allocator is needed for reliable collision handling. Hash IDs require entropy or uniqueness-bearing input and collision detection; short hashes are not mathematically collision-free.

### 5. SQLite at 400–500 Markdown artifacts

The user reports real deployments with 400–500 artifacts; this session has not benchmarked those deployments. File count alone does not establish a storage problem. Metadata scans, body search, semantic retrieval, and prompt/context cost are different workloads.

A derived gitignored SQLite/FTS cache can support structured queries and keyword search while Markdown stays authoritative. Basic-memory is the appropriate analogue. Context-portal is a different model: SQLite truth and Markdown exchange. SQLite as the canonical shared Git artifact has merge/diff portability costs; SQLite as a local disposable index need not.

A minimal scan-based query path could avoid a database entirely at this scale. That is a candidate, not a measured claim that scanning 500 files is always milliseconds on Windows/OneDrive. Any cache must declare its consistency, invalidation, corruption recovery, and query freshness behavior. Do not import watchers, embeddings, sync workflows, and a server by default merely to replace a small table.

### 6. Steelman: retain the persisted index and sequential filenames

- One portable readable file supports weak/manual hosts and GitHub browsing without installed query tooling.
- Current paths and NNN feature narratives are familiar, validated by the publisher, and used by pickup/reference regexes.
- The index renderer handles timezone order, historical/undated artifacts, and ties in one implementation. Retiring it does not retire these semantics.
- Drift already injects only the last eight rows; whole-index token explosion is not an established current problem.
- Shared-store locks, remote sequence checks, exclusive publication, and retry receipts already mitigate concurrency. Measure the remaining cross-branch case before migrating every contract.
- A database introduces cache/schema/recovery state; archival and curated summary views might meet discovery needs without it.
- Physical archival is not zero-migration: path references, private-store resolution, status semantics, and current flat-layout rules must be considered.

### 7. Steelman: demote index persistence to an optional view

- INDEX.md has no original artifact content. Maintaining a tracked derived view introduces a shared write surface even when independent artifact files do not overlap.
- Pi already refreshes from artifacts before default pickup. A common catalog/query API could return newest/recent/named items directly without writing a view.
- Keep the existing renderer as the portable implementation; on-demand listing need not mean asking models to improvise a recursive scan.
- A local disposable index/view is reversible: regenerate it from existing artifact data. However exact historical committed index bytes cannot be promised after timestamps/statuses/files change.
- Stable identity can be added independently of index retirement. Filename race avoidance requires a filename policy or allocator as well as frontmatter identity; an optional export can preserve human browsing.
- Logical filtering by status/feature/time can bound views without physically moving artifacts or deleting history.

No choice has been accepted. The most credible near-term direction is to investigate a read-only shared catalog API and compact query output while preserving existing Markdown artifacts and paths; persistence, IDs, archival, and SQLite remain separate decisions.

### 8. Candidate improvements for later prioritization

- Evidence tiers, verification ledger, and dead-end capture in handoff content, extending existing truthful-state and test guidance.
- User-curated standards/decision/pitfall summaries with selective loading; immutable artifacts remain history rather than being silently repaired or deleted.
- Compact discovery and optional query-based pickup alongside existing newest/named semantics.
- A derived FTS cache only if measured body-search latency or query needs justify it.
- Identity/filename policy for parallel branch publication, evaluated separately from chronology.
- Logical active/history filtering before physical archival; reference-aware summarization should create new summaries, preserve originals, and retain evidence boundaries.
- Optional dirty-state snapshot export, with strict size/secret/path bounds and previewed recovery.
- Outcome accounting connecting planned work to verified completion/landed changes, without treating local completion as proof of remote landing.
- A dedicated emergency handoff affordance only if plain `/drift handoff now` is insufficient in practice.
- Requirement-vs-implementation verification as an explicit optional review, not automatically converting uncertainty into tasks or executing commands from artifacts.

## Code References

### Drift directly inspected before publication

- scripts/build-index.py:135 — merge_rows() uses the base and preserves removals; no artifact renaming.
- scripts/build-index.py:143 — ordering by true date instant, feature, folder sequence.
- scripts/build-index.py:171 — render() assigns global display ordinals, independent of filenames.
- lib/artifacts.ts — observed working-tree prepare(), publish(), syncIndex(); store locks, remote sequence checks, exclusive writes, pending receipts.
- lib/pickup.ts — newest()/pickup() consume the index and preserve newest/named routing semantics.
- lib/state.ts — recent-artifact context slices to eight rows; shared private-store resolution and withLock().
- scripts/build-changelog.py:326 — hand_edited() implements one-way source/view detection, not write-back.
- scripts/build-changelog.py:346 — regenerate() checks view edits and concurrent content changes.
- scripts/build-changelog.py:413 — generated changelog merge driver handles shared output.
- skills/drift/plan.md — already requires small self-contained verifiable implementation steps.
- skills/drift/execute.md — already delegates bounded steps and verifies them.
- skills/drift/handoff.md — measured state, source/previous links, early handoff, existing path-preserving lifecycle.
- docs/changelog.md — observed dirty working-tree explicit adoption/one-way renderer policy and prior automatic-adoption residue.

### External sources

External references in section 3 are relative to their named C:/Projects_2.0/<repo> checkout and the captured HEAD above; they are not paths inside Drift and do not inherit Drift's citation-anchor proof. The follow-up artifact will replace tentative pointers with line/symbol references to inspected implementation and tests.

## Open Questions

1. Which exploratory claims survive direct HEAD source/test verification, especially beads compaction, basic-memory rebuild-stable identity, agent-os recaps, OpenSpec merge guards, and ruflo conditional append?
2. What are the actual costs and failure rates at the user's 400–500-file deployments: pickup scan/read latency, grep/search quality, file numbering races, driver conflicts, context size, and stale index behavior? No benchmark was run.
3. Is a read-only shared catalog abstraction enough to remove persisted-index dependency without changing any filenames or manual-host behavior?
4. Should default pickup remain newest-only, as currently specified, with readiness/feature selection as explicit alternatives rather than silent behavior changes?
5. If stable IDs are adopted, where are they stored, do they survive full cache loss, and how do filename creation and cross-branch conflicts work? Frontmatter UUIDs alone are not a complete allocator fix.
6. Could active/history filtering supply the benefits of archival without moves, deletions, tombstones, or broken references?
7. What governance keeps cumulative standards/pitfalls bounded, evidence-backed, and user-controlled rather than stale standing instructions?
8. What trust model would permit any stored verification command or dirty snapshot import? No automatic execution, secret capture, privacy scanning guarantee, destructive operation, or external service is authorized by this research.
9. After the follow-up review, which candidate improvements deserve a plan? This publication is evidence capture, not selection of a migration strategy.
