#!/usr/bin/env python3
"""Install Drift as a skill for the agents on this machine.

Usage:
    install.py [--claude] [--zed] [--dry-run] [--force]
    install.py --check [--claude] [--zed]
    install.py --uninstall [--claude] [--zed] [--dry-run]

Run it from the clone, wherever the clone lives:

    git clone https://github.com/coylemichael/drift ~/projects/drift
    python3 ~/projects/drift/install.py

With no tool flags it installs for every supported agent it finds on this
machine. An install is one symlink from the agent's skills directory to this
clone, so `git pull` here is the upgrade and there is nothing to re-run. On
Windows, where a symlink needs Developer Mode, it falls back to a directory
junction, which needs no privilege.

It creates nothing but those links: no project repository, no .gitignore, no
agent settings, no sudo. Re-running is safe. Anything already right is left
alone and reported as such. A real directory in the way is reported, never
removed, unless --force moves it aside.

Requires only the Python standard library (3.7+).
"""
import argparse
import os
import stat
import subprocess
import sys
import time
from pathlib import Path

MIN_PYTHON = (3, 7)
HERE = Path(__file__).resolve().parent
PROMPT_FILES = ("SKILL.md", "research.md", "plan.md", "execute.md", "handoff.md")


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


def do_check(tools):
    ok = True
    for tool in tools:
        problems = check_tool(tool)
        if problems:
            ok = False
            say(tool, "FAIL", "; ".join(problems))
        else:
            say(tool, "ok", short(tool.link))
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
            return 0 if do_check(chosen) else 1
        print("Drift uninstall%s, clone at %s" % (" (dry run)" if args.dry_run else "", HERE))
        ok = do_uninstall(chosen, args.dry_run)
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
    if args.dry_run:
        print("Nothing written.")
        return 0 if ok else 1

    print("Check")
    ok = do_check(chosen) and ok
    if changed:
        print("Restart any open agent session: skills are discovered at session start.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
