---
description: Pick up Drift work: the newest artifact, a named one, or a Drift request
argument-hint: [artifact | request]
---
Use the Drift skill (`drift:drift`) now. The user's request: $ARGUMENTS

Resolve it the way Drift's SKILL.md says. If the request names an artifact (a `drift/...` path, an artifact file name, or a link to one), pick that one up and follow the workflow for its kind: a handoff resumes through `handoff.md`, a plan runs through `execute.md`, research goes to `plan.md`. If it names none, pick up the newest row of `drift/INDEX.md` after bringing the index up to date; if that artifact is `complete` or `superseded`, say there is no open work, show the last few index rows, and ask what to pick up rather than reaching back for an older one. Whatever else the request says is the user's instruction for this session and applies on top. In a linked worktree of a repository that keeps artifacts private, `drift/` lives in the main worktree.
