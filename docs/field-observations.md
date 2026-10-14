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

## Observation updates

### 2026-10-13 — Changelog policy holds; unchanged publication retry fails again

- Evidence received: 2026-10-13; the transcript's execution time was not supplied.
- Drift build: not supplied. The rejection text matches the no-uninvited-adoption
  guard present in the reviewed checkout at `97c61c2`; that does not establish which
  build the observed session loaded.
- Scenario: a Rig decision-only research publication for D16 included an optional
  `changelog` object. The publisher rejected it because that repository's changelog
  was not managed by Drift. The agent submitted the same arguments again, including
  the `changelog` object, and received the same rejection.
- Expected: preserve the repository's existing changelog policy; correct the rejected
  arguments before retrying. Observed: the policy held on both attempts, but the agent
  did not make the requested correction. No successful publication is shown.
- engaged.reason: not supplied; no session record from Rig was inspected.
- Evidence: both calls supplied `changelog.section: "Changed"` and the same D16
  clarification. Both returned:

  > This repository's changelog is not generated by Drift (its committed CHANGELOG.md
  > has no Drift markers, it keeps its own fragments, or .drift.json turns it off):
  > omit changelog, or run /drift-changelog on to adopt it

- Code check: `lib/artifacts.ts: publish()` calls `validate()` before creating the
  artifact directory or persisting a pending intent. This rejection creates no new
  publication intent, artifact, index entry or fragment. An already-pending intent
  from an earlier operation cannot be ruled out from the pasted transcript alone.
- Recovery: if there is no earlier pending publication, remove the entire `changelog`
  property and retry the research publication. Do not change the repository's policy
  merely to make the call succeed; adoption requires the user's choice. Identical-input
  retries are for recovering a persisted pending publication, not for correcting this
  validation error.
- Diagnostic limits: the transcript does not establish why the agent repeated the
  arguments. A failure to apply the correction is observed; strict-schema coercion,
  stale context, or confusion with pending-publication retry instructions are hypotheses,
  not demonstrated causes.
- Outcome: evidence recorded; no runtime change made. Candidate improvement: explicit
  disabled-changelog guidance in the engaged tier and a validation error that states
  the publication did not start and tells the agent exactly which property to remove.

### 2026-10-13 — Further evidence: blank changelog text still loops; D16 remains unsaved

- Evidence received: 2026-10-13; additional screenshots of the same Rig session.
- Drift build and engaged.reason: not supplied.
- Scenario: the continuation shows further failed `drift_publish` calls. The agent
  recognised uncertainty about optional fields, changed the research body, and later
  emitted `changelog: { section: "Changed", text: "" }`. The object remained present
  in subsequent calls, and each shown attempt returned the same policy rejection.
- Expected: publish the research without changing Rig's changelog policy. Observed:
  the attempts did not recover; the agent eventually answered in chat and explicitly
  reported that the decision record could not be saved.
- Evidence: thinking — "I need to think about the tool schema—whether all fields are
  optional or if some are required. It looks like there might be some confusion with
  the changelog. I can omit certain fields if necessary". Final reply — "The decision
  record could not be saved because of a publishing-tool mismatch around its optional
  changelog field. No files or repository policies were changed."
- Code check: `lib/artifacts.ts: validate()` checks whether the `changelog` property is
  present, then rejects it when management is disabled, before validating its text.
  Consequently, emptying `text` does not suppress the changelog request. The screenshots
  show multiple failed calls, not merely duplicate display of a single result.
- Diagnostic limits: the model did change arguments, so the earlier observation of an
  unchanged retry describes only the first pair. The later attempts demonstrate a
  missing usable no-changelog representation in the recovery path, but do not prove
  the provider forced the property to be emitted.
- Outcome: policy protection succeeded, but the intended research artifact was not
  saved. Candidate fix: provide an explicit supported no-changelog representation
  (for example, a nullable field), consider normalising the observed blank-text object
  as absent, and test that recovery succeeds without changing policy. A non-empty
  changelog request must still be rejected when management is disabled, not silently
  dropped. No runtime change made in this evidence update.

### 2026-10-13 — Explicit omission instruction still emits a blank object; recovery fix verified

- Evidence received: 2026-10-13; another screenshot from the same Rig session.
- Drift build, provider settings and engaged.reason: not supplied.
- Scenario: the user explicitly instructed the agent to remove the entire top-level
  `changelog` property, leave configuration unchanged, and stop after one further
  failure. The agent agreed to omit the property but emitted
  `changelog: { section: "Changed", text: "" }` again. The old publisher rejected it.
- Expected: a publication with no changelog entry. Observed: the instruction did not
  change the emitted shape; the agent did obey the stop condition and preserved the
  unpublished research in chat. Rig's configuration was reported unchanged.
- Evidence: "I'll make one attempt with the entire changelog property omitted";
  final reply — "The call still contained the changelog property and was rejected.
  I'm stopping rather than retrying. The changelog configuration is unchanged."
- Diagnostic limit: omission difficulty is observed, but provider-enforced schema
  behaviour is not established. The compatibility fix does not depend on that cause.
- Outcome: user approved a code-level recovery path. `drift_publish` now accepts
  `changelog: null`; a supported-section object with empty or whitespace-only text
  normalises to no entry before policy checks and retry hashing. Non-empty entries
  remain blocked when generation is off, and a pending real entry cannot be discarded.
  Engaged context and errors now explain the no-entry form and preserve user control
  over adoption. The quiet tier is unchanged.
- Automated verification: actual Pi with a scripted loopback provider reproduced the
  rejected-entry then null/blank recovery sequence within one user turn. The full body
  survived, equivalent no-entry forms returned one receipt, and configuration,
  project-owned changelog and fragment policy were unchanged. Library tests also cover
  unadopted, explicitly disabled, foreign-fragment and enabled repositories, malformed
  inputs, and interrupted-publication recovery. Full suite: 123 passed, 6 skipped,
  zero failures with one test file at a time; typecheck passed.
- Remaining field check: reload the affected session and retry the preserved D16
  research once. A successful live Rig publication has not yet been observed here;
  scripted runtime tests do not establish how an unscripted model will react.

### 2026-10-13 — Post-fix retry still uses the old live tool contract

- Evidence received: 2026-10-13; the user supplied another failed blank-text request
  with the old policy-rejection wording after receiving the recovery prompt.
- Read-only checks: global Pi package settings point directly to this local Drift
  checkout. The checked-out validator accepts the observed blank object and uses
  different, explicit recovery wording for a rejected non-empty entry.
- Direct peer report: the affected Rig agent said its live `drift_publish` contract
  still advertises only the old object-shaped changelog parameter, not null or the
  blank-text sentinel. It reported no `/reload` control action or reload result in
  its conversation; the update instructions were ordinary chat. A control action
  outside that conversation could not be ruled out.
- Evidence: "Your on-disk null/blank fix is not reflected in the model-visible schema
  or the observed blank-object result." The agent also confirmed no verified null or
  entirely-omitted call had been made; the full D16 text remains preserved in chat.
- Expected: refresh the running extension before testing the new contract. Observed:
  the reported live contract and latest tool error are still the old versions. This
  does not demonstrate failure of the patched validator.
- Outcome: stop publication retries until a real runtime reload or backend
  restart/reconnect refreshes the session. Verify null is advertised in the live
  schema before retrying once. A normal chat instruction about new behaviour is not
  a reload; GUI/RPC hosts may require their backend control rather than a TUI command
  entered as prompt text. No Rig files, settings or runtime were changed by the
  diagnostic request, and no successful live publication is claimed.

### 2026-10-13 — Live Rig recovery succeeds with changelog null

- Evidence received: 2026-10-13; a screenshot of the affected Rig session after the
  live tool contract had changed. The exact reload/reconnect action is not shown.
- Runtime/build: the transcript reports Pi 0.85.1 and an advisory that Drift is
  developed against Pi 1.1.0. The agent verified that its live `drift_publish` schema
  accepts null and documents blank text as no entry. No exact loaded Drift revision
  or engagement reason was supplied.
- Scenario: the agent made one publication attempt for the preserved D16 research,
  explicitly sending `changelog: null` while retaining the source and related
  artifact references.
- Expected: save the research and update its index without a changelog entry or
  repository-policy change. Observed: the tool returned success:

  > Published drift/design-rationale/012-research-decision-pass-d16-curated-support-and-user-tinkering.md
  > Index: drift/INDEX.md
  > Work interval remains active.

- The final reply reported status complete, full preserved text unchanged, no
  changelog entry, configuration and policy unchanged, and no product-document or
  runtime-code edits. These unchanged-file/body claims are the agent's report;
  this evidence update did not independently compare Rig's files.
- Outcome: successful live verification of the null no-entry representation. No
  further D16 publication retry or additional implementation handoff is needed.
  Research leaving the work interval active is expected; status complete applies to
  the research artifact, not completion of the host's measured interval.
- Limits: this success does not establish every feature's compatibility with Pi
  0.85.1, and live recovery using a blank-text object remains unobserved. The version
  advisory did not block this publication. No Pi installation was changed here.
