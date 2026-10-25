---
date: "2026-10-13T10:29:34+01:00"
branch: "main"
git_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
feature: "changelog-pipeline"
sequence: "003"
type: "handoff"
status: "complete"
session_started: "2026-10-13T10:06:58+01:00"
session_id: "01a12f85-a6b3-71f6-b0e7-6bd16fbc61bc"
interval_id: "db1c5ee2-bc25-42f1-acf3-c1b8582b559d"
start_branch: "main"
start_commit: "97c61c2057a60e84c6cafe68508d19838c448cbc"
related_artifacts: ["drift/changelog-pipeline/001-handoff-one-way-changelog-and-utf8-builders.md","drift/field-observations/001-handoff-tracked-evidence-docs-page.md"]
next_session_profile: "implementation"
---

## Objective

Allow research and other artifacts to publish without a changelog entry when a model emits null or a blank-text changelog object, while preserving repository policy and pending-publication integrity.

## Source Documents

- docs/field-observations.md — the Rig D16 rejection loop, later blank-text retries, and failed explicit-omission workaround.
- docs/changelog.md — per-repository adoption and the updated no-entry contract.
- drift/changelog-pipeline/001-handoff-one-way-changelog-and-utf8-builders.md — existing publisher/changelog pipeline context.

## Status

- **Completed:** user-approved compatibility fix, schema, conditional guidance, policy-aware error recovery, documentation and tests.
- **Verification:** npm run typecheck passed; full suite run with `node --experimental-strip-types --test --test-concurrency=1 tests/*.test.ts`: 123 passed, 6 skipped, zero failures. The runtime test was subsequently strengthened so same-turn null and blank recovery each creates a fresh artifact, rather than returning an existing receipt; that strengthened test and typecheck also passed.
- **Working tree:** changes are uncommitted. This session did not modify Rig or publish its D16 research.

## What Changed

- lib/artifacts.ts: ArtifactInput.changelog — nullable optional object.
- lib/artifacts.ts: validate() — validates the object shape, then normalises supported-section objects with empty/whitespace-only text to an absent entry before changelog policy checks and input hashing. Null, omitted and blank-text forms match the same receipt. Non-empty requests remain rejected when generation is off.
- lib/artifacts.ts: publish()/validate() — policy rejection explains that no publication started on a fresh request, directs correction to null without rewriting the body, and distinguishes an already-pending publication whose original input must be preserved. Adoption remains a user decision.
- extensions/drift.ts — nullable object schema, documented blank-text sentinel, and explicit disabled-changelog guidance only in the engaged tier. Quiet-tier text and engagement triggers are unchanged.
- tests/drift.test.ts — recovery matrix for unadopted, explicitly disabled, foreign-fragment and enabled repositories; equivalent no-entry receipts, complete body preservation and unchanged policy files; interrupted no-entry recovery; protection against discarding a pending real entry; malformed-object rejection.
- tests/pi-runtime.test.ts — scripted null/empty/whitespace calls and same-user-turn rejected-entry then corrected-entry sequences, passing through actual Pi schema validation. Confirms fresh publications, bounded calls, unchanged configuration/changelog and no generated fragment.
- docs/changelog.md and skills/drift/hosts/pi.md — no-entry representations and validation-versus-pending retry rules.
- docs/field-observations.md — three appended evidence updates covering the initial rejected pair, further blank-text loops and unsaved result, and the explicit omission instruction whose emitted call still contained a blank object. Automated verification is labelled separately from live observations.

## Codebase Context

- The old policy check examined the presence of the changelog object before inspecting its text. Consequently, emptying text could never recover a disabled-generation publication.
- Normalisation must precede digest calculation, otherwise equivalent no-entry forms could allocate duplicates or conflict with an interrupted publication.
- A pending real changelog entry is not equivalent to null/blank. The existing digest guard continues to reject that change; tests check that the original persisted intent is untouched and that the full original request recovers it.
- The Rig screenshots demonstrate a discrepancy between intended omission and emitted arguments, but do not identify the provider or prove schema coercion. The fix handles the observed argument shape without depending on that hypothesis.
- The actual-Pi fixture uses a scripted loopback model endpoint. It verifies tool/schema/lifecycle behavior, not how an unscripted model will choose its next call.

## What Deviated from Plan

No formal plan was created for this bounded fix. Implementation follows the user's approved scope: accept null/blank as no entry, retain the non-empty policy guard, and test safe recovery. The same-turn test was strengthened after the full-suite run and independently rechecked.

## Open Questions

None blocking implementation. Live recovery of the preserved D16 research after reloading the affected session remains a field check; no live success is claimed.

## Next Steps

The implementation is finished. When the user chooses, commit/push the code, documentation, tests, evidence additions and publisher-generated changelog outputs. Reload the affected Rig session and make one attempt to publish the preserved full D16 research with null or blank-text changelog and no policy change. Append that live result to the tracked field observations.
