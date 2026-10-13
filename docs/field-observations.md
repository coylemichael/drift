# Field observations

Transcribed evidence of how real agent sessions react to Drift: the salience tier they
received, what the model's reasoning did with it, and which engagement signal fired.
This page is the data behind salience and UX decisions — `drift/` artifacts are private
in this repository, so durable, shareable evidence lives here and follows the repo.

Rules for this page:

- **Append-only.** New observations go at the bottom under a dated heading; existing
  entries are never rewritten. Corrections are a new entry referencing the old one.
- **Transcribe, don't screenshot.** Verbatim lines from transcripts are the evidence;
  images don't diff, don't grep, and bloat the repo.
- **Record clean passes as well as misses.** "Behaved as designed" is evidence too.
- **No secrets.** Quote only the lines that carry the observation; strip anything
  sensitive from paths or prompts.

## Entry format

```markdown
### YYYY-MM-DD — short title
- Drift build: <commit the observed session was running>
- Scenario: <repo, how the session was launched, what was asked>
- Expected: <tier / behavior> — Observed: <tier / behavior>
- engaged.reason: <value from the session record, or — if not engaged>
- Evidence: verbatim transcript/thinking lines
- Outcome: <none needed | led to <artifact / commit>>
```

The engagement reason is machine-measured: read `engaged` from the session record at
`<agent dir>/drift/<repo-hash>/<session>.json`.

## Observations

### 2026-10-12 — Late clone could never attach (pre-tiers)

- Drift build: `e871e2f` or earlier
- Scenario: Pi launched in an empty folder; the agent cloned zed into it, then called
  `drift_worktree` (status, then adopt).
- Expected (user's intent): Drift picks up the freshly cloned repo. Observed: both calls
  failed with "Worktree adoption requires Pi's launch directory to be inside a Git
  repository"; the agent concluded a restart was required.
- engaged.reason: — (no record; the store cached the no-repo probe for the session's lifetime)
- Evidence: agent reply — "Understood — Drift was initialized before the repo existed,
  so it can't attach in this session. … If you want Drift artifacts … just restart Pi
  inside C:/Projects_2.0/zed".
- Outcome: re-probe on a cached-empty store; landed in `88dd9b6`
  (salience-tiers; drift/salience-tiers/002-handoff-tiers-implemented-and-verified.md).

### 2026-10-12 — Attention tax in a tourist session (pre-tiers)

- Drift build: `e871e2f` or earlier
- Scenario: Pi launched at an empty nsjail folder; agent cloned nsjail and answered a
  compare-against-another-repo question. No artifacts wanted or needed.
- Expected (user's intent): zero Drift involvement. Observed: at least six separate
  thinking blocks re-litigated Drift bookkeeping during one task, plus a mid-answer
  reaction when the context flipped tiers after an unplanned reload.
- engaged.reason: — (inactive, then accidentally attached after a session reload re-probed)
- Evidence: "noting we're not in a git repo at this level so drift_publish isn't needed";
  "The Drift note doesn't matter here since no drift_publish is needed for this task";
  "No Drift publishing needed here since this isn't actually a git repo issue at launch";
  "Since Drift is inactive, I'll just answer directly"; "Drift being inactive doesn't
  change anything since I wasn't planning to publish regardless"; "The Drift lifecycle
  context just arrived while I was answering".
- Outcome: salience tiers (quiet tier for uninvested repos) and stable context injection
  (an unchanged context keeps its place and timestamp); landed in `88dd9b6`.

### 2026-10-12 — Engaged repo after the tiers landed

- Drift build: `88dd9b6`
- Scenario: existing repository with a long artifact series (design-decision research
  D1–D13); user asked for the next decision pass — a genuine Drift research task.
- Expected: full tier (store holds artifacts), Drift mentions only where task-relevant.
  Observed: as designed — the agent read the skill, workflow and host overlay because
  publication was the task, consulted prior artifacts for style, and produced no
  bookkeeping churn across the transcript.
- engaged.reason: artifact store already holds artifacts
- Evidence: "This is D14, a decision pass … continuing the series of design-rationale
  research artifacts from D1–D13. I should read the Drift skill and previous artifacts
  to understand the established pattern" — followed only by task-directed reads.
- Outcome: none needed; engaged tier behaving as designed.

### 2026-10-13 — Strict-schema providers cannot omit optional tool arguments

- Drift build: `88dd9b6`
- Scenario: a working session called `drift_worktree {action: "status", path: ""}`; the
  call was rejected ("status takes no path; use action: adopt to change Drift's
  worktree"), retried with identical arguments, and rejected again.
- Expected (model's intent): a plain status read. Observed: a permanent brick wall —
  the model's reasoning explicitly decided to omit `path`, and the emitted call still
  contained `path: ""`. Strict/structured tool-call modes on several providers require
  every schema property to be present, so an optional string can only be expressed as
  an empty string.
- engaged.reason: not applicable (model-initiated status does not engage by design)
- Evidence: thinking — "I should call it using {\"action\":\"status\"} instead. I'm
  wondering if auto validation allows this despite the tool type requirement."
- Outcome: blank `path` now means omitted, matching `drift_publish`'s optional-string
  convention; landed in `b7a7a2c`
  (drift/worktree-scope/002-handoff-status-tolerates-blank-path.md).

## Pending scenarios

Planned observations not yet recorded (capture tier line, Drift-related thinking quotes,
and `engaged.reason` for each):

- Fresh clone into an empty launch folder on the tiered build: silent attach, quiet tier,
  no Drift chatter in thinking.
- A second session in the same casual folder stays quiet (a bare sibling record is no
  signal).
- A clone of a repository that ships tracked `drift/` artifacts engages immediately.
- The first real edit escalates to the full tier on the following settled turn, not
  mid-task.
- Whether any model remarks on the quiet line itself — the open wording question in
  drift/salience-tiers/002-handoff-tiers-implemented-and-verified.md.
