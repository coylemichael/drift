#!/usr/bin/env bash
# Drift smoke test: is the install working end to end?
#
#   scripts/smoke-test.sh      from the clone, or paste the whole file into a terminal
#
# Checks the skill links, then asks a print-mode Claude Code session to list its
# skills and to run a Drift research pass in a throwaway repo under /tmp, and
# verifies the artifact's clock-read date, full commit hash, index row and
# .gitignore entry before deleting that repo. Needs a Claude Code binary (the
# `claude` CLI, or the one Zed bundles); without one it runs the link check and
# skips the agent steps. Two model calls, about a minute. Touches nothing else.
set -u
FAILED=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; FAILED=1; }

echo "== 1. install links"
DRIFT=$(python3 -c 'import os,sys;print(os.path.realpath(os.path.expanduser(sys.argv[1])))' ~/.claude/skills/drift)
[ -f "$DRIFT/install.py" ] || { fail "~/.claude/skills/drift does not resolve to a Drift clone ($DRIFT)"; exit 1; }
if python3 "$DRIFT/install.py" --check; then pass "install.py --check"; else fail "install.py --check"; fi

echo "== 2. find a Claude Code binary"
CLAUDE=$(command -v claude 2>/dev/null || ls ~/.local/share/zed/external_agents/registry/npx/claude-acp/node_modules/@anthropic-ai/claude-agent-sdk-*/claude ~/Library/Application\ Support/Zed/external_agents/registry/npx/claude-acp/node_modules/@anthropic-ai/claude-agent-sdk-*/claude 2>/dev/null | head -1)
if [ -z "$CLAUDE" ]; then
  echo "SKIP  no claude binary found; test in the agent UI instead: start a new session and type /drift"
  echo; [ "$FAILED" = 0 ] && echo "ALL PASS (agent checks skipped)" || echo "SOME FAILED"; exit $FAILED
fi
echo "using $CLAUDE ($("$CLAUDE" --version 2>/dev/null | head -1))"

echo "== 3. the agent sees the skill"
SKILLS=$(printf '%s' "List the skills available to you by name, one per line, nothing else." | env -u CLAUDECODE "$CLAUDE" -p --output-format text 2>&1)
if echo "$SKILLS" | grep -qiE '^[-* ]*drift$'; then pass "drift is in the skill list"; else fail "drift missing from skill list: $(echo "$SKILLS" | tr '\n' ' ' | cut -c1-200)"; fi

echo "== 4. research pass in a throwaway repo"
T=$(mktemp -d /tmp/drift-smoke.XXXXXX)
LOG=/tmp/drift-smoke.log
( cd "$T" && git init -q && printf 'Smoke test repo for Drift. It has one file, this README.\n' > README.md \
  && git add -A && git -c user.name=smoke -c user.email=smoke@example.com commit -qm init )
# The prompt goes on stdin: --allowedTools is variadic and would swallow a positional prompt.
PROMPT="Use the Drift skill in research mode. Feature id: smoke. Research question: what does README.md say? Do not ask me anything; write the research artifact and update drift/INDEX.md, then stop."
( cd "$T" && printf '%s' "$PROMPT" | env -u CLAUDECODE "$CLAUDE" -p --permission-mode acceptEdits --output-format text \
    --allowedTools "Skill,Read,Write,Edit,Glob,Grep,Bash(date:*),Bash(git:*),Bash(python3:*),Bash(ls:*),Bash(mkdir:*),Bash(cat:*),Bash(find:*)" ) >"$LOG" 2>&1
ART=$(ls "$T"/drift/smoke/001-research-*.md 2>/dev/null | head -1)
if [ -n "$ART" ]; then
  pass "artifact written: ${ART#"$T"/}"
  DATE=$(grep -m1 '^date:' "$ART")
  if echo "$DATE" | grep -Eq '^date: [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:?[0-9]{2}$'; then pass "date is a clock read with offset ($DATE)"; else fail "date is not a full clock read ($DATE)"; fi
  if grep -Eq '^git_commit: [0-9a-f]{40}$' "$ART"; then pass "git_commit is a full hash"; else fail "git_commit is not a full hash: $(grep -m1 '^git_commit:' "$ART")"; fi
  if grep -q "$(basename "$ART")" "$T/drift/INDEX.md" 2>/dev/null; then pass "INDEX.md has the row"; else fail "INDEX.md missing or lacks the row"; fi
  if grep -qx '/drift/' "$T/.gitignore" 2>/dev/null; then pass ".gitignore contains /drift/"; else fail ".gitignore lacks /drift/"; fi
  if python3 "$DRIFT/scripts/build-index.py" "$T/drift" --check >/dev/null 2>&1; then pass "INDEX.md byte-matches a script rebuild"; else echo "NOTE  INDEX.md was hand-written by the agent and differs from a script rebuild (known Drift issue, not an install fault)"; fi
else
  fail "no drift/smoke/001-research-*.md written; agent output in $LOG"
fi
rm -rf "$T"

echo
if [ "$FAILED" = 0 ]; then echo "ALL PASS"; else echo "SOME FAILED (agent output: $LOG)"; fi
exit $FAILED
