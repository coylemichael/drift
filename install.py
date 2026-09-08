#!/usr/bin/env python3
"""Install Drift as a skill for the agents on this machine.

Usage:
    install.py [--claude] [--zed] [--dry-run] [--force] [--no-hooks]
    install.py --check [--claude] [--zed] [--no-hooks]
    install.py --uninstall [--claude] [--zed] [--dry-run] [--no-hooks]

Run it from the clone, wherever the clone lives:

    git clone https://github.com/coylemichael/drift ~/projects/drift
    python3 ~/projects/drift/install.py

With no tool flags it installs for every supported agent it finds on this
machine. Two things get installed:

  Skill    one symlink from each agent's skills directory to this clone, so
           `git pull` here is the upgrade and there is nothing to re-run. On
           Windows, where a symlink needs Developer Mode, it falls back to a
           directory junction, which needs no privilege.

  Hooks    SessionStart and SessionEnd entries in ~/.claude/settings.json,
           pointing at scripts/hooks/. They open a session record at the start
           and close it at the end, which is what makes Drift's continuity
           automatic: a skill only loads once the model reaches for it, so
           nothing in SKILL.md can run at session start. Skip with --no-hooks.

           They fire in whatever reads that file: Claude Code, and Zed's
           claude-acp agent, which is the Claude Code binary. They do NOT fire
           in Zed's native agent, VS Code Copilot or Cursor, none of which have
           a hook mechanism. There the record is opened by hand instead, with
           scripts/hooks/session-start.py --repo . — SKILL.md tells the agent
           to do that itself when it finds no record.

Outside those two, it creates nothing: no project repository, no .gitignore,
no sudo. Re-running is safe. Anything already right is left alone and reported
as such. A real directory in the way is reported, never removed, unless --force
moves it aside. The settings file is backed up before any edit, only Drift's own
hook entries are touched, and one that does not parse is refused rather than
overwritten.

Requires only the Python standard library (3.7+).
"""
import argparse
import json
import os
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path

MIN_PYTHON = (3, 7)
HERE = Path(__file__).resolve().parent
PROMPT_FILES = ("SKILL.md", "research.md", "plan.md", "execute.md", "handoff.md")

# Hooks are a Claude Code feature, registered in its user settings file. They
# are what makes Drift's session record automatic: a skill only loads once the
# model reaches for it, so nothing in SKILL.md can fire at session start.
SETTINGS = Path.home() / ".claude" / "settings.json"
HOOK_MARKER = "drift/scripts/hooks/"  # identifies our entries on re-run and uninstall
HOOK_TIMEOUT = 10
HOOKS = (
    ("SessionStart", "startup|resume|clear|compact|fork", "session-start.py"),
    ("SessionEnd", "clear|resume|logout|prompt_input_exit|other", "session-end.py"),
)


class Tool:
    def __init__(self, key, name, link, present):
        self.key = key  # command-line flag
        self.name = name  # display name
        self.link = link  # where this agent expects the skill
        self.present = present  # does the agent appear to be installed here?


def known_tools():
    home = Path.home()
    zed_homes = [
        home / ".config" / "zed",  # Linux
        home / "Library" / "Application Support" / "Zed",  # macOS
        home / ".agents" / "skills",  # already using the shared skills directory
    ]
    if os.environ.get("APPDATA"):
        zed_homes.append(Path(os.environ["APPDATA"]) / "Zed")  # Windows
    return [
        Tool("claude", "Claude Code", home / ".claude" / "skills" / "drift", (home / ".claude").is_dir()),
        Tool("zed", "Zed Agent", home / ".agents" / "skills" / "drift", any(p.is_dir() for p in zed_homes)),
    ]


# --- filesystem helpers -----------------------------------------------------


def short(path):
    """Show a path under the home directory as ~/..."""
    try:
        return "~/" + Path(path).relative_to(Path.home()).as_posix()
    except ValueError:
        return str(path)


def occupied(path):
    """Something is at this path: a file, a directory, or a link (even a broken one)."""
    return path.exists() or path.is_symlink()


def is_link(path):
    """A symlink, or on Windows a directory junction (a reparse point that is not a symlink)."""
    if path.is_symlink():
        return True
    try:
        attrs = getattr(os.lstat(str(path)), "st_file_attributes", 0)
    except OSError:
        return False
    return bool(attrs & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0))


def resolves_here(path):
    try:
        return path.resolve() == HERE
    except OSError:
        return False


def link_target(path):
    try:
        return os.readlink(str(path))
    except OSError:
        return str(path.resolve())


def remove_link(path):
    try:
        path.unlink()
    except (IsADirectoryError, PermissionError):
        os.rmdir(str(path))  # a directory symlink or junction on Windows


def make_link(link, target):
    """Create link -> target. Returns "symlink" or "junction"."""
    link.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.symlink(str(target), str(link), target_is_directory=True)
        return "symlink"
    except OSError as err:
        if os.name != "nt":
            raise
        # Windows without Developer Mode refuses symlinks; a junction needs no privilege.
        run = subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(link), str(target)], capture_output=True, text=True
        )
        if run.returncode != 0:
            detail = (run.stderr or run.stdout).strip()
            raise OSError("symlink refused (%s) and junction failed: %s" % (err.strerror, detail))
        return "junction"


# --- planning ---------------------------------------------------------------
#
# Each mode first decides what to do per tool, then does it. Keeping the two
# apart is what makes --dry-run honest: it prints the same plan the real run
# would execute.


def plan_install(tool, force):
    link = tool.link
    if not occupied(link):
        return "link", None
    if is_link(link):
        if resolves_here(link):
            return "ok", "already linked"
        return "relink", link_target(link)
    if resolves_here(link):
        return "ok", "the clone lives here; no link needed"
    return ("move" if force else "conflict"), None


def plan_uninstall(tool):
    link = tool.link
    if not occupied(link):
        return "absent", None
    if is_link(link):
        if resolves_here(link):
            return "unlink", None
        return "leave", "links elsewhere (%s); not ours" % link_target(link)
    if resolves_here(link):
        return "leave", "the clone itself lives here; nothing to unlink"
    return "leave", "a real directory, not a link; left alone"


# --- execution --------------------------------------------------------------


def say(tool, status, detail=""):
    print("  %-12s %-12s %s" % (tool.name, status, detail))


def do_install(tools, dry_run, force):
    ok = True
    changed = False
    for tool in tools:
        action, detail = plan_install(tool, force)
        target = "%s -> %s" % (short(tool.link), HERE)
        if action == "ok":
            say(tool, "ok", "%s (%s)" % (short(tool.link), detail))
        elif action == "conflict":
            ok = False
            say(tool, "conflict", "%s is a real directory, not a link." % short(tool.link))
            print("               Run install.py from inside it if that is the clone you want,")
            print("               or pass --force to move it aside as drift.bak-<timestamp>.")
        elif dry_run:
            verb = {"link": "would link", "relink": "would relink", "move": "would move"}[action]
            extra = " (was %s)" % detail if action == "relink" else ""
            say(tool, verb, target + extra)
        else:
            try:
                if action == "move":
                    aside = tool.link.with_name("drift.bak-%s" % time.strftime("%Y%m%d-%H%M%S"))
                    tool.link.rename(aside)
                    print("  %-12s %-12s %s -> %s" % (tool.name, "moved", short(tool.link), short(aside)))
                elif action == "relink":
                    remove_link(tool.link)
                kind = make_link(tool.link, HERE)
            except OSError as err:
                ok = False
                say(tool, "failed", "%s: %s" % (short(tool.link), err))
                continue
            changed = True
            extra = " (was %s)" % detail if action == "relink" else ""
            say(tool, "linked" if action != "relink" else "relinked", "%s [%s]%s" % (target, kind, extra))
    return ok, changed


def do_uninstall(tools, dry_run):
    ok = True
    for tool in tools:
        action, detail = plan_uninstall(tool)
        if action == "absent":
            say(tool, "absent", short(tool.link))
        elif action == "leave":
            say(tool, "left", "%s: %s" % (short(tool.link), detail))
        elif dry_run:
            say(tool, "would unlink", short(tool.link))
        else:
            try:
                remove_link(tool.link)
            except OSError as err:
                ok = False
                say(tool, "failed", "%s: %s" % (short(tool.link), err))
                continue
            say(tool, "unlinked", short(tool.link))
    return ok


# --- hooks -------------------------------------------------------------------


def hook_base(tools):
    """Where the hook commands should point.

    A skill link when there is one, so that moving the clone and re-running the
    installer repairs the link and the hooks together. Otherwise the clone.
    """
    for key in ("claude", "zed"):
        for tool in tools:
            if tool.key == key and is_link(tool.link) and resolves_here(tool.link):
                return tool.link
    return HERE


def probe_hooks():
    """Actually run the SessionStart hook and check it answers.

    Registration is not the same as working: the interpreter path can go stale,
    the script can be unreadable, a syntax error can creep in. This executes the
    real thing against this clone and reads what comes back, then removes the
    record it created so the probe leaves nothing behind.
    """
    script = HERE / "scripts" / "hooks" / "session-start.py"
    if not script.is_file():
        return ["session-start.py is missing"]
    payload = json.dumps(
        {
            "session_id": "drift-install-probe",
            "cwd": str(HERE),
            "hook_event_name": "SessionStart",
            "how": "startup",
        }
    )
    try:
        done = subprocess.run(
            [sys.executable, str(script)], input=payload, capture_output=True, text=True, timeout=30
        )
    except (OSError, subprocess.SubprocessError) as err:
        return ["could not run session-start.py: %s" % err]

    problems = []
    if done.returncode != 0:
        problems.append("session-start.py exited %d (it must always exit 0)" % done.returncode)
    try:
        context = json.loads(done.stdout)["hookSpecificOutput"]["additionalContext"]
    except (ValueError, KeyError, TypeError):
        problems.append("session-start.py did not return usable context: %r" % done.stdout[:120])
    else:
        if "session record" not in context.lower():
            problems.append("session-start.py returned unexpected context")

    for leftover in (Path.home() / ".claude" / "drift-sessions").rglob("drift-install-probe.json"):
        try:
            leftover.unlink()
        except OSError:
            pass
    return problems


def load_settings():
    """Returns (data, error). A file that exists but does not parse is an error,
    never something to overwrite."""
    if not SETTINGS.is_file():
        return {}, None
    try:
        with open(SETTINGS, encoding="utf-8") as handle:
            data = json.load(handle)
    except ValueError as err:
        return None, "%s does not parse as JSON (%s)" % (short(SETTINGS), err)
    except OSError as err:
        return None, "cannot read %s: %s" % (short(SETTINGS), err)
    if not isinstance(data, dict):
        return None, "%s is not a JSON object" % short(SETTINGS)
    return data, None


def save_settings(data):
    SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    if SETTINGS.is_file():
        backup = SETTINGS.with_name("settings.json.bak-%s" % time.strftime("%Y%m%d-%H%M%S"))
        shutil.copy2(str(SETTINGS), str(backup))
    else:
        backup = None
    tmp = SETTINGS.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")
    os.replace(str(tmp), str(SETTINGS))
    return backup


def hook_command(base, script):
    return '%s "%s"' % (sys.executable, base / "scripts" / "hooks" / script)


def apply_hooks(data, base):
    """Add or repoint Drift's hook entries. Returns a list of change descriptions.

    Only entries whose command contains HOOK_MARKER are ours. Everything else in
    the file, including other hooks on the same event, is left untouched.
    """
    changes = []
    hooks = data.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        raise ValueError("the settings file's \"hooks\" key is not an object")

    for event, matcher, script in HOOKS:
        wanted = hook_command(base, script)
        groups = hooks.setdefault(event, [])
        if not isinstance(groups, list):
            raise ValueError('the settings file\'s "hooks.%s" is not a list' % event)

        mine = [
            entry
            for group in groups
            if isinstance(group, dict)
            for entry in group.get("hooks", [])
            if isinstance(entry, dict) and HOOK_MARKER in str(entry.get("command", ""))
            and script in str(entry.get("command", ""))
        ]
        if mine:
            for entry in mine:
                if entry.get("command") != wanted:
                    entry["command"] = wanted
                    entry["timeout"] = HOOK_TIMEOUT
                    changes.append("%s: repointed to %s" % (event, wanted))
            continue

        groups.append(
            {
                "matcher": matcher,
                "hooks": [{"type": "command", "command": wanted, "timeout": HOOK_TIMEOUT}],
            }
        )
        changes.append("%s: added (%s)" % (event, matcher))
    return changes


def strip_hooks(data):
    """Remove only Drift's hook entries, and any group left empty by that."""
    changes = []
    hooks = data.get("hooks")
    if not isinstance(hooks, dict):
        return changes
    for event, _, script in HOOKS:
        groups = hooks.get(event)
        if not isinstance(groups, list):
            continue
        kept_groups = []
        for group in groups:
            if not isinstance(group, dict):
                kept_groups.append(group)
                continue
            entries = group.get("hooks", [])
            kept = [
                entry
                for entry in entries
                if not (
                    isinstance(entry, dict)
                    and HOOK_MARKER in str(entry.get("command", ""))
                    and script in str(entry.get("command", ""))
                )
            ]
            if len(kept) != len(entries):
                changes.append("%s: removed" % event)
            if kept:
                group["hooks"] = kept
                kept_groups.append(group)
            elif not entries:
                kept_groups.append(group)
        if kept_groups:
            hooks[event] = kept_groups
        else:
            hooks.pop(event, None)
    if not hooks:
        data.pop("hooks", None)
    return changes


def registered_hooks(data):
    """Our hook commands currently in the settings file, by event."""
    found = {}
    hooks = data.get("hooks") if isinstance(data, dict) else None
    if not isinstance(hooks, dict):
        return found
    for event, _, script in HOOKS:
        for group in hooks.get(event, []) or []:
            if not isinstance(group, dict):
                continue
            for entry in group.get("hooks", []) or []:
                if (
                    isinstance(entry, dict)
                    and HOOK_MARKER in str(entry.get("command", ""))
                    and script in str(entry.get("command", ""))
                ):
                    found[event] = entry["command"]
    return found


def do_hooks(tools, dry_run, remove=False):
    data, error = load_settings()
    if error:
        print("  %-12s %-12s %s" % ("hooks", "FAIL", error))
        print("               Fix or move that file, then re-run. Nothing was written.")
        return False

    base = hook_base(tools)
    try:
        changes = strip_hooks(data) if remove else apply_hooks(data, base)
    except ValueError as err:
        print("  %-12s %-12s %s" % ("hooks", "FAIL", err))
        return False

    if not changes:
        print("  %-12s %-12s %s" % ("hooks", "ok", "already registered in " + short(SETTINGS)))
        return True
    if dry_run:
        for change in changes:
            print("  %-12s %-12s %s" % ("hooks", "would change", change))
        return True
    try:
        backup = save_settings(data)
    except OSError as err:
        print("  %-12s %-12s %s" % ("hooks", "FAIL", "cannot write %s: %s" % (short(SETTINGS), err)))
        return False
    for change in changes:
        print("  %-12s %-12s %s" % ("hooks", "registered" if not remove else "removed", change))
    if backup:
        print("  %-12s %-12s %s" % ("", "backup", short(backup)))
    if not remove and any(tool.key == "zed" for tool in tools):
        # Zed ships two independent agents and only one of them is Claude Code.
        # Saying "Zed" without that distinction is what sent a native-agent
        # session looking for a hook surface that does not exist.
        print("  %-12s %-12s %s" % ("", "note", "Zed has two agents. Its claude-acp agent is the"))
        print("  %-12s %-12s %s" % ("", "", "Claude Code binary and fires these hooks. Its native"))
        print("  %-12s %-12s %s" % ("", "", "agent does not — open the record there by hand with"))
        print("  %-12s %-12s %s" % ("", "", "scripts/hooks/session-start.py --repo ."))
    return True


def check_hooks():
    data, error = load_settings()
    if error:
        return [error]
    found = registered_hooks(data)
    problems = []
    for event, _, script in HOOKS:
        command = found.get(event)
        if not command:
            problems.append("%s not registered" % event)
            continue
        path = command.split('"')[1] if '"' in command else command.split()[-1]
        if not Path(path).is_file():
            problems.append("%s points at a missing script (%s)" % (event, path))
    return problems or probe_hooks()


def check_clone():
    """Is this clone a complete Drift, and does its script run under this Python?"""
    problems = ["missing %s" % name for name in PROMPT_FILES if not (HERE / name).is_file()]
    script = HERE / "scripts" / "build-index.py"
    if not script.is_file():
        problems.append("missing scripts/build-index.py")
    else:
        run = subprocess.run([sys.executable, str(script), "--help"], capture_output=True, text=True)
        if run.returncode != 0:
            problems.append("scripts/build-index.py --help exited %d" % run.returncode)
    return problems


def check_tool(tool):
    link = tool.link
    if not occupied(link):
        return ["not installed"]
    problems = []
    if not resolves_here(link):
        problems.append("resolves to %s, not this clone" % link.resolve())
    skill = link / "SKILL.md"
    if not skill.is_file():
        problems.append("SKILL.md not reachable through the link")
    elif "name: drift" not in skill.read_text(encoding="utf-8", errors="replace")[:300]:
        problems.append("SKILL.md does not declare name: drift")
    return problems


def do_check(tools, hooks=True):
    ok = True
    for tool in tools:
        problems = check_tool(tool)
        if problems:
            ok = False
            say(tool, "FAIL", "; ".join(problems))
        else:
            say(tool, "ok", short(tool.link))
    if hooks:
        problems = check_hooks()
        if problems:
            ok = False
            print("  %-12s %-12s %s" % ("hooks", "FAIL", "; ".join(problems)))
        else:
            # Deliberately not "working". Running the script proves the script;
            # only a live session proves the harness invokes it, and a harness
            # with no hook mechanism at all fails exactly here while passing
            # every check this program can make.
            print(
                "  %-12s %-12s %s"
                % ("hooks", "ok", "registered; script answers when run directly")
            )
            print(
                "  %-12s %-12s %s"
                % ("", "", "harness invocation shows up as a file in ~/.claude/drift-sessions/")
            )
    problems = check_clone()
    if problems:
        ok = False
        print("  %-12s %-12s %s" % ("clone", "FAIL", "; ".join(problems)))
    else:
        print("  %-12s %-12s %s; python %s" % ("clone", "ok", "prompts and scripts/build-index.py present", sys.version.split()[0]))
    return ok


# --- entry point ------------------------------------------------------------


def main(argv=None):
    if sys.version_info < MIN_PYTHON:
        sys.exit("install.py needs Python %d.%d or later; this is %s" % (MIN_PYTHON + (sys.version.split()[0],)))

    parser = argparse.ArgumentParser(
        prog="install.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--claude", action="store_true", help="Claude Code, at ~/.claude/skills/drift")
    parser.add_argument("--zed", action="store_true", help="Zed Agent, at ~/.agents/skills/drift")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="report the install state; change nothing")
    mode.add_argument("--uninstall", action="store_true", help="remove the links that point at this clone")
    parser.add_argument("--dry-run", action="store_true", help="print the plan; change nothing")
    parser.add_argument("--force", action="store_true", help="move a real directory aside to make room for the link")
    parser.add_argument("--no-hooks", action="store_true", help="skip the session hooks; install the skill only")
    args = parser.parse_args(argv)

    if not (HERE / "SKILL.md").is_file():
        sys.exit("error: %s does not look like a Drift clone (no SKILL.md)" % HERE)

    tools = known_tools()
    chosen = [t for t in tools if getattr(args, t.key)]

    if args.check or args.uninstall:
        chosen = chosen or [t for t in tools if occupied(t.link)]
        if not chosen:
            print("Drift is not installed for any supported agent on this machine.")
            return 1 if args.check else 0
        if args.check:
            print("Drift check, clone at %s" % HERE)
            return 0 if do_check(chosen, hooks=not args.no_hooks) else 1
        print("Drift uninstall%s, clone at %s" % (" (dry run)" if args.dry_run else "", HERE))
        ok = do_uninstall(chosen, args.dry_run)
        if not args.no_hooks:
            ok = do_hooks(chosen, args.dry_run, remove=True) and ok
        if args.dry_run:
            print("Nothing written.")
        return 0 if ok else 1

    chosen = chosen or [t for t in tools if t.present]
    if not chosen:
        print("No supported agent found on this machine (looked for Claude Code and Zed).")
        print("Pass --claude or --zed to install for one anyway.")
        return 1

    print("Drift install%s, clone at %s" % (" (dry run)" if args.dry_run else "", HERE))
    ok, changed = do_install(chosen, args.dry_run, args.force)
    if not args.no_hooks:
        ok = do_hooks(chosen, args.dry_run) and ok
    if args.dry_run:
        print("Nothing written.")
        return 0 if ok else 1

    print("Check")
    ok = do_check(chosen, hooks=not args.no_hooks) and ok
    if changed:
        print("Restart any open agent session: skills are discovered at session start.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
