---
date: "2026-10-09T18:49:32+01:00"
branch: "main"
git_commit: "05e46971767fa207e3dce522c37c87b45c85df6c"
feature: "shared-files"
sequence: "001"
type: "research"
status: "complete"
related_artifacts: []
---

## Research Question

When many agents land on one branch within minutes of each other, the files
every one of them touches (`drift/INDEX.md`, `CHANGELOG.md`) conflict on nearly
every rebase and the hand resolutions lose work. How do large codebases avoid
this, what does Drift already do, and what is missing?

## Summary

- Perimeter (5–8 Oct 2026, 8–12 coordinated threads landing hourly) produced
  conflicts on every rebase in `CHANGELOG.md` and `drift/INDEX.md`, three
  silent losses of other threads' entries, a corrupted index (duplicate `#`,
  rows above the header), and one landing that reverted twenty files from three
  other threads. The rules written afterwards were discipline, not structure.
- Large projects never let N writers edit one changelog in flight. They write
  one uniquely named file per change and generate the human file (CPython
  `Misc/NEWS.d/`, towncrier, changesets, GitLab), or harvest notes from the
  commit/PR (Kubernetes, Rust), or have none (Linux). Landings are serialised
  by a merge queue (Bors, GitHub, Zuul).
- Drift already treats the index as derived from artifact frontmatter, rebuilt
  at publish and (since today) at session start. What is missing: two
  *committed* views cannot meet without a textual conflict; the changelog has no
  equivalent at all; and in private mode, worktrees of one repo never share
  artifacts.
- Git's merge driver is the right hook. A prototype row-level driver resolved a
  two-thread rebase and merge of `INDEX.md` with no markers, rows ordered by
  true timestamp, renumbered, footer recounted. An undefined driver falls back
  silently to git's text merge, so the attribute is safe to commit.
- Compile-at-release does not fit: most projects do not release. The changelog
  should be derived continuously, like the index, with fragments as the
  never-deleted source. Hand edits are supported only when the bullet keeps its
  id; anything else is carried through and reported, never guessed at.
- The design document is `docs/shared-files-plan.html` in this repository.

## Detailed Findings

### 1. What went wrong in perimeter

Sources: `perimeter` git history; Claude memories
`landing-own-hunks-roadmap-index`, `verify-own-lines-after-others-land`,
`rebase-onto-a-moved-main` (perimeter project, 2026-10-08);
`drift/programme/148`.

- Every rebase conflicted on `CHANGELOG.md` (two sections inserted at the top
  of `[Unreleased]`) and `drift/INDEX.md` (two rows appended, both numbered
  last + 1, footer count changed).
- `e6f4938b` (Hook landing): `git reset --soft origin/main` after `origin/main`
  had moved reverted three other threads' landings, twenty files, three deleted.
  Repaired in `d8b3b8c0`, whose reverse patch then *replaced* the Hook's
  changelog entry instead of keeping both; fixed again in `c05327c6`.
- The Ashguard thread's tier-2 changelog entry was knocked off `main` twice in
  four hours: once by a docs commit pushed from a stale index, once by a thread
  resolving conflicts "keep mine". No test failed either time.
- `bfc04dc8` (Cards 4) dropped another thread's ROADMAP lines and an INDEX row;
  a scripted resolution put three rows above the "# Drift Index" header with a
  number already used (fixed in `c955acdc`).
- Threads also landed docs-only commits ("INDEX and CHANGELOG for
  drift/card-copy/0NN"). At release, `programme/148` collapsed 27 per-thread
  changelog sections into one note by hand.
- Dotfiles had the mild form: two merges (`dotfiles-maintenance-repairs/008`,
  `016`) where only `CHANGELOG.md` conflicted and both sides were kept.

The rules that came out of it (insert only your own hunk; keep both sides;
`git diff origin/main --stat` must list only your files; never squash against a
moving ref) are correct and were still broken under load.

### 2. Prior art

| Pattern | Users | Mechanism |
|---|---|---|
| Fragment per change, compiled | CPython (`blurb`), Twisted/pip/attrs (towncrier), JS monorepos (changesets), GitLab to 2021 | New uniquely named file per change; release script concatenates |
| Note in commit/PR, harvested | Kubernetes (`release-note` block), GitLab now (`Changelog:` trailer), Rust (`relnotes` label), Conventional Commits tooling | No file until release; the commit lands atomically |
| No changelog; notes written from the log | Linux kernel, Django | A person compiles |
| Serialised landing | Bors, GitHub merge queue, Zuul, Google submit queue | One change lands at a time on the real tip |

Common principle: a shared file is either append-only-by-unique-name or
derived. Keep a Changelog's `[Unreleased]` is a single-writer design.

### 3. Where git lets code do the merge

Hooks on push cannot change content (`pre-push` can only refuse). `pre-commit`
can rebuild and stage; `post-merge`/`post-rewrite` run after the stop. The
**merge driver** (`.gitattributes` `merge=<name>` + `merge.<name>.driver` in
the clone's config) runs *during* merge, rebase, cherry-pick and stash pop,
receives `%O %A %B`, writes the result into `%A`.

Prototype (2026-10-09, temp repo): row-level merger for `INDEX.md` (union by
artifact path, sort by instant, renumber, recount footer).

- Rebase of thread-y onto thread-x, both having appended row `003`: completed,
  0 dirty files, 4 rows, thread-y's 11:30 row ordered *before* thread-x's 12:00
  row that landed first.
- Merge of the same branches: "Auto-merging drift/INDEX.md", 0 conflict markers.
- Attribute with an **undefined** driver: git silently fell back to a normal
  text merge (conflict markers), no error. Safe to commit the attribute.
- Windows: git runs the driver through `sh -c`, which eats backslashes; the
  configured path must use forward slashes. First run failed for this reason.
- Design consequence: merge **rows**, not trees. During a merge the other side's
  artifact files may not be in the working tree yet; a row carries date,
  feature, type and path, which is all the merge needs. The frontmatter rebuild
  remains the correction pass.

### 4. What Drift has today

- Index derived from frontmatter: `scripts/build-index.py` (render at
  `scripts/build-index.py:103`, CLI at `:148`); rebuilt at publish
  (`lib/artifacts.ts:275` `publish`) under `drift/.publish.lock`
  (`lib/state.ts:147` `withLock`); rebuilt at session start
  (`lib/artifacts.ts:221` `syncIndex`, called from `extensions/drift.ts:50`
  `refreshIndex`). Session-start sync has no in-progress-merge guard.
- `NNN` allocated from the local feature folder only
  (`lib/artifacts.ts:244`).
- Managed paths refuse symlinks (`lib/state.ts:104`), which a shared store
  across worktrees would need to permit for exactly one case.
- `/drift-track-artifacts` (`extensions/drift.ts:126`, `lib/artifacts.ts:152`
  `setArtifactTracking`) already edits `.drift.json` and `.gitignore` under an
  explicit user command; a `.gitattributes` line is the same consent.
- Atomic writes with Windows fallbacks (`lib/state.ts:110`, `:121`, `:137`).
- No changelog mechanism anywhere in Drift's history; `package.json` mentions
  one only to ship Drift's own.
- Private mode: `drift/` is per worktree and ignored, so a rebase onto `main`
  carries no artifacts and removing a worktree deletes its handoffs. Nothing
  consolidates.

### 5. Design decisions reached with Michael (2026-10-09)

- Drift-only: the self-merging files work where Drift is installed; web merges
  and bare clones get a plain conflict and are unsupported.
- Never lose a fragment, never guess: unknown content is carried through and
  reported, in the style of malformed `.drift.json`.
- Derived changelog, continuously regenerated, fragments never deleted; not
  compile-at-release. Grouped by day by default, by version only if a project
  stamps one.
- Hand edits: a bullet may be edited if its id comment stays (the edit is
  written back to the fragment); a bullet with no id is unsupported, preserved,
  and reported; regeneration skips that run.
- Index kept accurate in every mode; the driver and remote-aware numbering are
  tracked-mode only because git never merges an ignored file.
- Worktrees always come back together: in tracked mode git is the consolidation
  point; in private mode all worktrees share the main worktree's `drift/` from
  the start (junction/symlink), never a folder outside a project root; with no
  main worktree, per-worktree behaviour stays and is announced once.
- `/drift-land` encodes the landing rulebook; it never squashes, force-pushes
  or resets against a moving ref.
- Cross-machine clock skew is out of scope (seconds, cosmetic; estimated
  timestamps are already refused).

## Code References

- `lib/artifacts.ts:34` builder path; `:102` `ensureArtifactPolicy`; `:152`
  `setArtifactTracking`; `:221` `syncIndex`; `:240` `prepare` (`:244` number
  allocation); `:275` `publish`
- `lib/state.ts:79` `repoRoot`; `:94` `safePath` (`:104` symlink refusal);
  `:110` `atomicWrite`; `:121` `replace`; `:137` `overwrite`; `:147`
  `withLock`; `:224` `Records.open`
- `extensions/drift.ts:14` `/drift` input rewrite; `:50` `refreshIndex`; `:105`
  `session_start`; `:126` `drift-track-artifacts` command
- `scripts/build-index.py:63` `parse_artifact`; `:103` `render`; `:148` `main`
- `skills/drift/SKILL.md` §"The Root Index" (line 147), §"At Session Start"
  (190), §"Artifact Git Policy" (243)
- `docs/shared-files-plan.html` — the design document

## Open Questions

- Whether `stamp X.Y.Z` (version grouping for projects that release) ships with
  the changelog step or waits for a project that wants it.
- Whether `/drift-land`'s check command should default to anything when
  `.drift.json` does not set one (proposal: run nothing).
- Whether the unrecognised-entry report should also appear in Pi's session
  context so a thread sees it before publishing.
