---
date: "2026-10-13T21:08:36+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "ecosystem-survey"
sequence: "007"
type: "research"
status: "complete"
session_started: "2026-10-13T20:07:26+01:00"
session_id: "01a12f95-80ad-768a-beab-3053980bf7c7"
interval_id: "f81bd755-be0a-4cef-8a0c-a034f6595803"
start_branch: "main"
start_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
related_artifacts: ["drift/ecosystem-survey/002-research-source-audit-and-adoption-assessment.md","drift/ecosystem-survey/006-handoff-explicit-anchor-capture-coverage.md"]
anchor_coverage: {"status":"not-applicable","eligible":0,"captured":0,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
---

## Research Question

Do the cloned comparison repositories implement something like Drift's citation anchors, and have they solved content freshness, dirty-snapshot provenance, or external-reference scope better? The concrete motivating case is Rig's D18 research: five unchanged local ranges captured as dirty and two pinned external Zed licence links treated as missing local paths.

## Summary

Three Claude Fable 5 reviewers inspected the 23 cloned targets by issue; the main session verified the strongest source findings. No matching shipped historical path/range/hash/move citation checker was found in this cohort. Basic-memory, waveforward and BMAD do implement useful hash-based identity/integrity patterns that do not equate uncommitted provenance with changed content; basic-memory, catchup and spec-kit's source machinery provide explicit scoping patterns rather than resolving every reference against the current filesystem.

These are verified adjacent mechanisms, not a drop-in replacement or proof that any project solves the entire citation problem. The small practical lesson is to compare the content evidence Drift already possesses, retain provenance separately, and classify external references before local lookup. No implementation change was requested or made during this comparison.

## Detailed Findings

### Actual Rig example

The inspected file is C:/Projects_2.0/Rig/drift/design-rationale/014-research-decision-pass-d18-nono-integration-and-zed-reuse-first.md, recorded against Rig commit 7088776b5f6ddd8264f34098849480b1521ad13e.

The current Drift checker reports mixed mode, partial capture (5 of 7), and seven uncertain citations. Five are local captures with dirty=true; two are numeric labels on pinned GitHub links to Zed's agent/sandbox licence manifests, which do not exist inside Rig. Independent normalization/hash comparison confirmed all five local ranges still match their captured SHA-256 values at the current ranges. The checker short-circuits dirty anchors before using that comparison, so its uncertainty is provenance policy, not evidence that these five ranges changed.

The whole artifact is 16,589 bytes; its anchor array is 1,413 bytes and coverage object 255 bytes. Density/readability and repetitive uncertainty are distinct from large disk usage here. External lookup failure is not evidence of missing Rig code.

### basic-memory — closest shipped change-detection analogue

At clone HEAD 76c2acf0d4496e8f5aa70efc454f5ce644775851, change_planning.plan_file_changes compares storage/indexed checksums and emits new/modified/deleted/moved/unchanged categories. It does not consult Git cleanliness to determine whether content is unchanged. IndexedChecksums.recognizes accepts the indexed checksum or the prior sync checksum; accepted_content_checksum is handled by a separate holds_accepted_content method, not by recognizes. This corrects an overbroad subagent description that all three hashes were checked in recognizes.

Move detection compares checksums against missing old paths, with guards against treating in-place edits or copies as moves. Tests exercise those classifications. This is whole-file synchronization into an index, not verification of a historical cited code range. Its project/project_id and memory-resource resolution make scope explicit; a project UUID can disambiguate supported server workspaces. It is not a resolver for arbitrary pinned GitHub code citations. Ordinary DB-only note UUIDs still do not survive complete database reconstruction; permalinks are the file-carried identity analogue.

Transferable lesson: content recognition and source/project identity are separate dimensions. No SQLite migration or indexing stack is needed just to apply that lesson to Drift's existing captured range hashes.

### waveforward — dirty snapshots can still have verifiable content

At HEAD afed413d35a0d755d303af26963c2b59bc617e3a, snapshot capture stores dirty workspace/staged patches and bounded untracked copies. Its untracked manifest stores size/hash; restore preflight rehashes the copied snapshot files and rejects actual size/hash mismatches. Dirty state is the data being preserved, not itself evidence that the snapshot cannot be verified.

This proves snapshot integrity, not whether the current live source still matches a citation. It is nevertheless a concrete capture-then-reverify hash loop, useful as a model for not discarding a captured fingerprint solely because its source was uncommitted.

### BMAD-METHOD — content-addressed generated output

At HEAD 9f1987169a2e5626e5ccb31bb9cee051fdb3df20, render_skill.py includes source byte hashes, renderer hash, resolved values and Jinja version in generation identity. Matching inputs select the same generation; _verify_existing rehashes manifest-declared outputs and rejects mismatches. Git cleanliness is not the validity criterion.

This is tested generation provenance/output integrity, not semantic citation checking. Its validate_file_refs tool also demonstrates that references need classification, but a heuristic that treats missing directories as prose should not be copied blindly: that could suppress a genuinely broken local citation. Explicit scope is safer than guessing scope from a failed lookup.

### Scoped references: basic-memory, catchup and spec-kit

Catchup, HEAD 50ac5ca88628f5785f81318e4a7841a96f409585, uses Provider plus native SessionID and provider-specific roots. It does not resolve every session ID in one implicit namespace. Cursor content-addressed blobs are native provider storage catchup consumes, not a new catchup citation checker.

Spec-kit, HEAD 6c62e10d5ab1d676c557eb2d0cee86be52c893d2, has explicit external component/source/version metadata and digest validation/download verification. Main inspection corrected the reviewer's blanket claim that every pin without a digest fails: digest presence is optional for some component kinds, while step checksums have a required path. The defensible finding is explicit scoped provenance and validation of declared pins, not universally mandatory digests and not a GitHub line-citation resolver.

For Rig's Zed links, the immediate equivalent would be classifying them as external/pinned/not locally checked rather than searching Rig for crates/agent/Cargo.toml. Full external fetch/hash verification is a separate permission/network/caching decision and is not necessary to remove that false local warning.

### What does not supply a better equivalent

- OpenSpec at 9111a7654d7800391459431fff4eaf66e33a3d2e ships archive-copy/move fingerprints and locks. Requirement-base meta.json fingerprints and diff3 change-sync in openspec-parallel-merge-plan.md remain a proposal in this checkout, not a shipped citation checker.
- Beads at b630f96f5bd231ff7aea78af0d47b6038f228d00 has issue-content hashes and transactional dependency operations. Those are content identity/synchronization primitives, not line-range freshness grading.
- mcp-shrimp-task-manager stores related file paths and optional line bounds, but no matching hash/staleness verifier was found.
- context-portal is DB-first; FTS consistency and call-site vector updates differ, and progress embedding update has a known gap. Do not portray it as a stronger file-freshness implementation.
- memory-bank-mcp provides project-scoped CRUD, not checksum grading. RooFlow and the Cursor/Roo memory-bank family largely delegate maintenance to prompts/configuration.
- agent-os, my-claude-code-setup, ccpm and claude-simone have useful context conventions but no matching implemented range checker found. Historical agent-os recaps and legacy Simone workflows remain historical, not current mechanisms.
- claude-code-spec-workflow's mtime/TTL cache is not citation proof. Unchanged mtime must not be sold as guaranteed unchanged content; same-metadata edits remain possible.
- handoff-skill/HANDOFF-md provide evidence/verification instructions, not automated citation hashing. Behavioral verification tiers are not interchangeable with text-freshness verdicts.
- ruflo's discussed conditional append remains unshipped; no matching citation checker was established by the focused scan. This is not a claim that ruflo contains no hashing anywhere.
- The letta clone is a deprecation/landing shell; its former memory platform cannot be assessed from this checkout.

Local untracked Drift changelog residue in basic-memory/beads/ruflo remains excluded from upstream evidence. No competitor applications or test suites were executed.

### Implication for Drift — recommendation only

The case supports two bounded improvements, not importing a framework:

1. Use the captured hash to establish unchanged normalized text before letting dirty provenance force uncertainty. Keep a separate annotation that capture occurred in the working tree. For nonmatching dirty ranges, do not pretend the recorded HEAD contains the captured text: the current heuristic expected_text may predate those edits. Remain conservative or use the actual capture hints without claiming a reliable similarity baseline.
2. Classify clearly external references before local filesystem resolution. Preserve genuine missing-local warnings; do not merely silence all file-not-found cases. Pinned external locators are provenance, not evidence that their content was verified here.

The useful report for the observed D18 state would distinguish five unchanged local ranges, uncommitted capture provenance, and two externally pinned/not locally checked references. It would not claim that any permission implementation or decision is correct.

## Code References

External references below are relative to their named clone and captured HEAD. They are symbol-shaped intentionally: these are not local Drift citations and should not create local missing-file anchors.

- Drift scripts/check-staleness.py — check(), grade(), dirty short-circuit and recorded-commit expected_text.
- Drift lib/anchors.ts — captureAnchors(), normalization/hash and captured dirty provenance.
- basic-memory src/basic_memory/indexing/change_planning.py — plan_file_changes(), plan_moved_files().
- basic-memory src/basic_memory/indexing/file_index_planning.py — IndexedChecksums.recognizes(), holds_accepted_content().
- basic-memory src/basic_memory/indexing/change_detector.py — load_move_candidates().
- basic-memory tests/indexing/test_change_planning.py — classification/move/copy tests.
- basic-memory src/basic_memory/mcp/tools/read_note.py — project/project_id routing and explicit-path missing behavior.
- waveforward src/waveforward/core.py — _capture_untracked_files(), _validate_untracked_manifest().
- BMAD-METHOD skills/bmad/scripts/render_skill.py — generation identity, _verify_existing(), _publish().
- BMAD-METHOD tests/test_render_skill.py — hash/collision/output validation tests inspected by reviewer.
- catchup internal/session/session.go — Ref, Provider and provider-root namespace.
- spec-kit src/specify_cli/bundles/references.py — _validate_pinned_install_metadata().
- spec-kit src/specify_cli/bundles/sources.py — expected_sha256 archive-download path.
- OpenSpec openspec-parallel-merge-plan.md — proposed requirement-base fingerprint/rebase machinery, not shipped.
- beads internal/types/types.go — ComputeContentHash(), issue-content identity rather than citation checking.

## Open Questions

- No implementation changes were approved by this comparison. Whether to change dirty-anchor grading or external-scope classification remains a user decision.
- A hash match proves the normalized cited text matches the captured snapshot; it does not prove delivery, semantic truth, behavior, current requirements, or authenticity of manually edited metadata.
- External scope needs explicit classification; optional remote verification must respect permissions and remain separate from local lookup.
- Dirty nonmatching spans require care because a committed HEAD may not represent the captured working-tree content. A simple equal-hash improvement need not promise full dirty-range movement/similarity analysis.
- This was read-only research and its conclusions are recorded here; no new implementation handoff is needed.
