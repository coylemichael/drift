---
date: "2026-10-10T17:42:15+01:00"
branch: "main"
git_commit: "04cb106d8b0075119913f02aebbc0303d0904356"
feature: "citation-staleness"
sequence: "001"
type: "research"
status: "complete"
session_started: "2026-10-10T14:21:28+01:00"
session_id: "01a125f9-c16f-7269-bdae-02bcc7fbf22f"
interval_id: "a6478237-6d48-4923-b75d-3b2971654825"
start_branch: "main"
start_commit: "04cb106d8b0075119913f02aebbc0303d0904356"
related_artifacts: ["drift/shared-files/001-research-shared-files-under-many-agents.md","drift/shared-files/003-plan-derived-changelog-and-automatic-landing.md"]
---

# Prior Art: Derived Records and Citation Anchoring

## Research Question

Drift has two related problems: (1) its changelog generator arbitrates source-vs-generated divergence by writing the generated view back over fragment sources, and (2) its artifacts cite code as `path:line` at a recorded commit with no way to tell whether those citations still match the code. Are these solved problems elsewhere — are we reinventing the wheel — and what is the established pattern?

Research performed by four parallel read-only subagents covering: (a) position/anchor tracking across code edits, (b) documentation-code coupling products, (c) changelog-fragment and derived-artifact systems, (d) agent-ecosystem memory/staleness handling. Workers fetched live primary sources where reachable and labelled every claim **fetched** (checked against a live URL this session) or **recalled** (training knowledge, spot-check before external citation). This artifact preserves that distinction at the claim level where it matters.

## Summary

No existing system does commit-pinned, citation-level staleness checking of agent-written prose artifacts — Drift's combination is novel. But every component has convergent, battle-tested prior art: one-way generation is the universal answer for changelog fragments (no system anywhere does write-back), and citation anchoring/forwarding has a single convergent industry pattern (record content alongside position at write time; resolve on read via diff-hunk mapping; report graded outcomes; never mutate the original anchor). Line-only after-the-fact heuristics are the known-bad baseline. What nobody solves: whether prose claims about code remain true.

## Detailed Findings

### 1. Changelog fragment systems: one-way generation is settled, without exception

Systems examined: towncrier, scriv, reno (OpenStack), changesets (JS), GitLab commit-trailer changelogs, conventional-changelog/semantic-release, Rust RELEASES.md, Keep a Changelog.

- **Every one generates strictly source → output.** None reads edits from the generated file back into fragments. Drift's `write_back_edits` behaviour is outside all established practice. [fetched: towncrier tutorial/config docs, scriv concepts, reno usage, changesets intro, GitLab changelog dev docs]
- **reno is Drift's closest model** (fragments persist; the report is re-rendered from git history every time, never stored). Its docs are explicit: "To fix an existing release note, edit the existing file in place and commit." Source wins; output follows. [fetched: docs.openstack.org/reno/latest/user/usage.html]
- **Corrections are handled one of two ways:** fix the source and re-render (reno), or hand ownership over at release — fragments are consumed and the changelog becomes hand-owned history (towncrier `git rm`s fragments at build; changesets consumes `.changeset/*.md` then recommends hand-tweaking the output). [fetched]
- **Generated-region protection pattern:** insertion markers only; text outside markers is never parsed or touched. Hand-edit protection where it exists is **detect and refuse, never absorb**: Meta's "signed source" embeds a content hash in the generated header and fails on mismatch [recalled]; `cog -c` uses a checksum and stops rather than overwriting hand edits [fetched: cog docs]. Go/protobuf generated code uses `DO NOT EDIT` markers plus CI regenerate-and-diff [recalled]. Autotools' mtime arbitration is the cautionary tale — fragile even for one-way generation [recalled].
- **Bidirectional sync works only under narrow conditions** (evidence: jupytext paired notebooks, the one healthy two-way system): lossless 1:1 mapping of shared data, per-field single ownership (outputs only ever come from .ipynb), a single writer updating both forms atomically, whole-file winner selection, and a human fallback on conflict. [fetched: jupytext.org/using/paired-notebooks]. Round-trip engineering in UML/MDA tools died on exactly the failure modes Drift hit: lossy projection, silent loss of edits outside protected regions, no stored base for three-way merge [recalled]. Drift's fragments→rendered-region projection is lossy and reordered, failing the preconditions.

### 2. Citation anchoring and forwarding: solved, with one convergent pattern

Systems examined: GitHub PR review comments, Gerrit ported comments, Phabricator ghost inlines, CodeStream codemarks, Sourcegraph position translation, Swimm auto-sync, VS Code CodeTour, W3C Web Annotation / Hypothesis, git primitives, academic line-tracking (Reiss ICSE 2008, LHDiff ICSM 2013).

Four rules recur across all of them:

1. **Store multiple cross-checking anchors at write time**: commit SHA + path + range, **plus the cited text or a hash of it, plus surrounding context**. GitHub stores the `diff_hunk` with each review comment [fetched: docs.github.com/en/rest/pulls/comments]; CodeStream stored the cited code block + `commitHashWhenCreated` [recalled]; W3C Web Annotation pairs `TextPositionSelector` with `TextQuoteSelector` (exact quote + prefix + suffix) [recalled]; Swimm stores snippet text + path + range + last-checked commit [recalled; Swimm docs on auto-sync and CI fetched].
2. **Resolve on read by mapping diff hunks** from the pinned commit to the target, with rename/move detection. Gerrit exposes "List Ported Comments" computed at read time [fetched: gerrit-review.googlesource.com REST docs]; Sourcegraph adjusts positions through git diff and drops positions inside changed hunks rather than guessing [recalled]; CodeStream applied hunks from the nearest known commit and cached computed locations per commit [recalled].
3. **Report graded outcomes**: fresh / moved(→new location) / changed / orphaned. Auto-repair only "moved". Hypothesis orphans annotations that fail position, quote, then fuzzy matching [recalled]. Swimm auto-syncs routine moves and routes "impactful" changes to human review [fetched: Swimm auto-sync docs]. GitHub's binary "Outdated" state is the documented cautionary tale — a whitespace edit outdates a comment [recalled].
4. **Never mutate the original anchor.** Forwarded positions are read-time views or a cache keyed by target commit. No system rewrites the stored reference.

Supporting facts:

- **Line+commit alone cannot distinguish moved from changed** — which is the entire product. Every exact system stores content. Pure position heuristics are what editor bookmarks and LSP do across sessions, the approach that demonstrably drifts [recalled].
- **The fingerprint, not the commit, is the durable reference**: pinned commits are garbage-collected by squash/force-push; this broke CodeStream anchors [recalled]. Stored content allows recovery; a commit hash alone does not.
- Git supplies the building blocks (`log -L`, `blame -M -C`, rename detection, `diff --color-moved`) but no anchor object [fetched: git-scm.com/docs/git-log for -L semantics; rest recalled].
- Academic result: line content + surrounding context beats either alone for tracking lines across versions (Reiss 2008; LHDiff's context+content simhash) [recalled].

### 3. Documentation-code coupling products

- **Swimm** is the closest commercial product: snippet/token coupling, CI "Verify" check, patented auto-sync, three states (up-to-date / auto-synced / outdated-needs-review). Its most visible pain is **blocking CI**: the docs themselves ship a gitStream integration because doc-only PR approvals caused "too much friction", and broken docs on main block unrelated PRs [fetched: docs.swimm.io CI/github-app pages]. Lesson: check at consumption time, non-blocking; CI summary optional.
- **Build-time inclusion solves staleness only for embedded code**: Sphinx `literalinclude :pyobject:` (symbol anchor), Doxygen `\snippet` tag markers, embedme `--verify`, doc tests (doctest, rustdoc, mdbook test) [fetched: embedme README, rust-skeptic repo; rest recalled]. None of these checks prose.
- **Google practice**: g3doc freshness metadata (owner + last-reviewed date + nagging bot) measures staleness purely by time since human review, with no link to code. The SWE book admits "tools have still not caught up" on doc accuracy measurement [fetched: abseil.io SWE book ch.10]. Chromium's docs guidance starts "all documentation is wrong and out of date, but in-code documentation is less so" [fetched: chromium.googlesource.com documentation guidelines].
- **AI "self-updating docs"** (Dosu, Komment, Swimm AI, Mintlify agent) regenerate from activity rather than detect staleness; they turn stale text into plausible-but-possibly-wrong text and move the burden to PR review [fetched: dosu.dev; rest recalled].

### 4. Agent ecosystem: nobody checks stored knowledge against code

- **Instruction/memory files** (CLAUDE.md, AGENTS.md, Cursor rules, Cline Memory Bank, Copilot instructions): no provenance recording, no staleness detection; all manual gardening. Claude Code docs say to review memory files "periodically"; agents.md says "treat AGENTS.md as living documentation" [fetched: docs.anthropic.com memory page, agents.md, docs.cline.bot memory-bank, docs.github.com Copilot instructions].
- **Memory frameworks**: Graphiti/Zep is closest — bi-temporal edges, "invalidated — not deleted", point-in-time queries [fetched: getzep/graphiti README] — but invalidation fires only when a contradicting input arrives; nothing re-checks the original source, and provenance is temporal, not commit-anchored. mem0 arbitrates by LLM comparison on new input [fetched: mem0 prompts source]. Letta/MemGPT rewrites memory when the model notices contradictions [fetched: docs.letta.com].
- **RAG-over-code** (Aider repo-map, Cursor Merkle-tree indexing, Cody, Greptile): the dominant pattern is **regenerate, don't repair** — store nothing that cannot be rebuilt from the current tree [fetched: aider.chat/docs/repomap.html; Cursor details recalled]. This is unavailable to Drift: artifacts are decisions and findings, not derivable facts.
- **Devin Knowledge** (human-confirmed items, update suggestions via chat feedback) is deprecated in favour of static Skills [fetched: docs.devin.ai] — the industry is retreating to manually-maintained knowledge, not advancing to checked memory.
- **MCP resources**: change notifications (`subscribe`, `listChanged`) only; no content hashes, no commit versioning, nothing citation-level [fetched: modelcontextprotocol.io 2025-06-18 resources spec].

### 5. What nobody solves (scope boundary)

- **Semantic staleness**: a citation can resolve perfectly while the prose claim around it ("this is the only caller", "X is not thread-safe") is now false. Swimm and Phabricator route this to humans. Detection of drifted *claims* is unsolved industry-wide.
- **Negative claims** ("there is no retry logic"): nothing to fingerprint; code adding the missing thing triggers nothing.
- **Multi-citation facts** (A calls B and C handles the error): coupling is per citation, never between citations.
- **History rewrites**: squash/force-push can GC a pinned commit. Mitigation is stored content (fingerprints), not the commit reference.

## Design Consequences for Drift (validated against this prior art)

1. **Changelog generator**: one-way, fragments are the sole source; delete write-back; protect the generated region with a content-hash guard that refuses on hand-edit (signed-source/cog pattern) instead of absorbing or silently overwriting; never touch text outside the markers (released history); idempotence tests (generate twice → identical).
2. **Citations**: record at publish time — commit + path + range + normalized content hash of the cited lines + a few context lines (and enclosing symbol where cheap). This is a prerequisite for exact checking, not an optional enhancement.
3. **Check at artifact pickup**, non-blocking, with graded per-citation states (fresh / moved→N / changed / orphaned); auto-forward only "moved"; never rewrite the original artifact; present the report to the reading agent, which owns prose re-judgement.
4. **Heuristic line-resolution** (path-suffix matching + range diffing, as prototyped by the citation-staleness research session) is the **backfill tool** for pre-fingerprint artifacts and the fallback for GC'd commits — not the permanent mechanism.

## Code References

Drift integration points verified this session (at commit 04cb106):

- scripts/build-changelog.py:339 - `write_back_edits` copies generated view over fragment sources; the behaviour all fragment-system prior art rejects
- scripts/build-changelog.py:450-451 - stdout reconfigured newline-only (cp1252 crash on non-ASCII); same at scripts/build-index.py:247-248
- scripts/build-changelog.py:76-79 - `git()` env scrubbing / GIT_CONFIG_NOSYSTEM hardening that must survive any shared-module extraction
- lib/git-drivers.ts:25,29 / lib/changelog.ts:155,168 / lib/artifacts.ts:261,389 / lib/land.ts:98,106 - the eight `python -I` builder invocations; `-I` omits the script dir from sys.path on all Python versions (CPython 3.10 Modules/main.c `else if (!config->isolated)` verified), so a shared module needs explicit script-relative import resolution
- lib/artifacts.ts:261,389 - publisher render path where publish-time citation fingerprinting would integrate
- lib/pickup.ts / extensions/drift.ts - pickup path where the graded citation report would integrate

## Open Questions

- Fingerprint granularity: exact cited range only, or range + enclosing symbol (Sphinx `:pyobject:` precedent) for stronger move-tracking across refactors?
- Where fingerprints live: inside artifact frontmatter (immutable with the artifact) vs a sidecar store (amendable without touching the artifact)? Prior art (CodeStream per-commit location cache) suggests original anchors immutable + forwarded locations cached separately.
- Backfill policy for the 101 existing fingerprint-less artifacts: one-time migration run, or lazy on first pickup?
- Whether the pickup report should also cover generated-region freshness (changelog/index) for a unified "drift check" surface, or stay citation-only initially.
