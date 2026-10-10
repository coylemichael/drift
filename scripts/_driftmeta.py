"""Shared helpers for Drift's standard-library scripts (build-index, build-changelog, check-staleness).

Import pattern — every consumer runs under `python -I`, which omits the script directory from
sys.path on all supported versions, so a bare sibling import fails. Each script must do:

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from _driftmeta import ...

The entry must be a str, not a Path. This is a trusted script-relative import: the directory
inserted is the script's own, never the working directory, so -I's protection is kept.

Anchor normalization contract — the TypeScript publisher (lib/anchors.ts) and the Python checker
(check-staleness.py) must hash cited code identically: strip trailing whitespace from each line,
join with "\\n", hash the UTF-8 bytes with SHA-256, hex digest. One definition, two
implementations, one cross-language parity test (tests/check-staleness.test.ts). Similarity
grading deliberately uses difflib over the real texts rather than fuzzy hashes (ssdeep/TLSH/
simhash): the originals are always available from git at the pinned commit, and a diff is
strictly more informative than a similarity digest.

Requires only the Python standard library (3.7+) and, for git(), git on PATH.
"""
import datetime as dt
import hashlib
import os
import re
import subprocess

FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n?", re.S)


def scalar(block, key):
    """Read a flat `key: value` scalar out of a frontmatter block."""
    match = re.search(rf"^{key}:\s*(.+?)\s*$", block, re.M)
    if not match:
        return None
    value = match.group(1).strip().strip('"').strip("'")
    return None if value in ("", "null", "~") else value


def parse_date(raw):
    """Parse an ISO 8601 datetime, or a bare date, into an aware datetime.

    Every result is timezone-aware, because the index sorts on absolute instants
    and naive values cannot be compared against aware ones. A value carrying no
    offset is read as UTC: the only dates that reach here without one are bare
    `**Date:**` body lines, which the index already marks approximate.
    """
    # fromisoformat covers the frontmatter case and zero-padded bare dates. It
    # only gained "Z" support in 3.11, so normalize the suffix for older runtimes.
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
    for parse in (
        lambda: dt.datetime.fromisoformat(normalized),
        # Catches a hand-written date that isn't zero-padded, e.g. 2026-8-30.
        lambda: dt.datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc),
    ):
        try:
            parsed = parse()
        except ValueError:
            continue
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    return None


def git(repo, *args, ok=(0,)):
    """Run git in `repo`; return stdout, or None when the exit code is an expected negative.

    The environment is scrubbed of GIT_* and pinned to no system/global config, so output is
    deterministic under a user's configuration — this hardening keeps the merge drivers stable
    and must survive any refactor.
    """
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env["GIT_CONFIG_NOSYSTEM"] = "1"
    env["GIT_CONFIG_GLOBAL"] = "NUL" if os.name == "nt" else os.devnull
    proc = subprocess.run(["git", "--no-optional-locks", *args], cwd=repo, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", env=env)
    if proc.returncode in ok:
        return proc.stdout
    if proc.returncode == 1 and 1 not in ok and not proc.stderr.strip():
        return None
    raise RuntimeError(f"git {' '.join(args)} failed: {proc.stderr.strip() or proc.returncode}")


def normalize_lines(text):
    """The anchor normalization contract: trailing whitespace stripped per line, LF joins."""
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n"))


def anchor_hash(text):
    """SHA-256 hex of normalized cited text. Must stay identical to lib/anchors.ts."""
    return hashlib.sha256(normalize_lines(text).encode("utf-8")).hexdigest()
