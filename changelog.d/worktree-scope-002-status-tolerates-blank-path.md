---
date: "2026-10-13T09:55:45+01:00"
section: "Fixed"
artifact: "drift/worktree-scope/002-handoff-status-tolerates-blank-path.md"
---
drift_worktree status no longer rejects a blank path argument: strict-schema providers must emit every tool property, so models could not omit it and status failed repeatedly with a misleading hint pointing at adopt. A blank path now means omitted, matching drift_publish's handling of optional strings.
