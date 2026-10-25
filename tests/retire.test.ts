import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const tool = join(root, "scripts/retire-index-and-changelog.py").replaceAll("\\", "/");
const START = "<!-- drift:changelog: generated from changelog.d/ - edit a bullet only if you keep its id comment -->";
const END = "<!-- /drift:changelog -->";
const INDEX_LINE = "drift/INDEX.md merge=drift-index";
const CHANGELOG_LINE = "CHANGELOG.md merge=drift-changelog";
const README = "# Changelog fragments\n\n`CHANGELOG.md` in this repository is generated. Its region between the two\n`drift:changelog` marker comments is rebuilt from the files in this folder.\n";
const FRAGMENT = "---\ndate: \"2026-10-09T16:29:21+01:00\"\nsection: \"Added\"\n---\nA thing.\n";
const PLAIN = "# Changelog\n\n## [1.0.0]\n\n- first\n";

function env(): NodeJS.ProcessEnv {
  const result = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  // Git for Windows rejects os.devNull (\\.\nul) as a config path but accepts NUL.
  return { ...result, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : devNull, LC_ALL: "C" };
}

async function git(cwd: string, args: string[], allowFailure = false): Promise<string> {
  try { return (await exec("git", args, { cwd, env: env() })).stdout; }
  catch (error: any) { if (allowFailure) return error.stdout ?? ""; throw error; }
}

const pythonCommand = process.platform === "win32" ? ["py", "-3"] : ["python3"];
async function retire(cwd: string, ...args: string[]): Promise<{ code: number; out: string }> {
  try {
    const { stdout } = await exec(pythonCommand[0], [...pythonCommand.slice(1), "-I", tool, ...args], { cwd, env: env(), timeout: 60_000 });
    return { code: 0, out: stdout };
  } catch (error: any) {
    if (typeof error.code !== "number") throw error;
    return { code: error.code, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

async function write(dir: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    await fs.mkdir(dirname(join(dir, path)), { recursive: true });
    await fs.writeFile(join(dir, path), content);
  }
}

async function repo(base: string, name: string, committed: Record<string, string>) {
  const dir = join(base, name);
  await fs.mkdir(dir, { recursive: true });
  await git(dir, ["init", "-q", "-b", "main"]);
  for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.invalid"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) await git(dir, ["config", key, value]);
  await write(dir, committed);
  await git(dir, ["add", "-A"]);
  await git(dir, ["commit", "-qm", "initial", "--allow-empty"]);
  return dir;
}

async function installDrivers(dir: string) {
  for (const name of ["drift-index", "drift-changelog"]) {
    await git(dir, ["config", `merge.${name}.name`, `Drift ${name}`]);
    await git(dir, ["config", `merge.${name}.driver`, "python3 -I build.py --merge %O %A %B"]);
  }
}

const driftConfig = async (dir: string) => (await git(dir, ["config", "--local", "--get-regexp", "^merge\\.drift-"], true)).trim();
const status = async (dir: string) => (await git(dir, ["status", "--porcelain", "--untracked-files=all", "--ignored"])).trim();
const exists = (path: string) => fs.access(path).then(() => true, () => false);

async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(path: string, rel: string) {
    for (const entry of await fs.readdir(path, { withFileTypes: true })) {
      if (entry.name === ".git" && rel === "") {
        out[".git/config"] = await fs.readFile(join(path, ".git", "config"), "utf8").catch(() => "(file)");
        continue;
      }
      const child = join(path, entry.name);
      const key = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(child, key);
      else out[key] = await fs.readFile(child, "utf8");
    }
  }
  await walk(dir, "");
  return out;
}

async function tempBase(t: { after: (fn: () => Promise<unknown>) => void }, prefix = "drift-retire-") {
  const base = await fs.realpath(await fs.mkdtemp(join(tmpdir(), prefix)));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  return base;
}

/** A repository that adopted Drift's changelog and tracked index, all committed. */
async function adoptedRepo(base: string, name = "adopted") {
  const dir = await repo(base, name, {
    "CHANGELOG.md": `# Changelog\n\n${START}\n## [Unreleased]\n\n### Added\n\n- A thing. <!-- changelog.d/x-001-a.md -->\n${END}\n\n## [0.1.0]\n\n- old\n`,
    "changelog.d/README.md": README,
    "changelog.d/x-001-a.md": FRAGMENT,
    "drift/INDEX.md": "| # | artifact |\n",
    "drift/x/001-research-a.md": "---\nkind: research\n---\nbody\n",
    ".gitattributes": `*.sh text eol=lf\n${INDEX_LINE}\n${CHANGELOG_LINE}\n`,
    ".drift.json": JSON.stringify({ changelog: true, trackArtifacts: true }, null, 2) + "\n",
    "src.txt": "code\n",
  });
  await installDrivers(dir);
  return dir;
}

/** An upstream project Drift wrote residue into without being asked. */
async function residueRepo(base: string, name = "residue") {
  const dir = await repo(base, name, { "CHANGELOG.md": PLAIN, "src.txt": "code\n" });
  await write(dir, {
    "CHANGELOG.md": `# Changelog\n\n${START}\n${END}\n\n## [1.0.0]\n\n- first\n`,
    ".gitattributes": `${CHANGELOG_LINE}\n`,
    "changelog.d/README.md": README,
  });
  await git(dir, ["config", "merge.drift-changelog.driver", "python3 -I build.py --merge %O %A %B"]);
  return dir;
}

test("(1) an adopted, tracked repository loses every Drift piece and keeps everything else", async (t) => {
  const base = await tempBase(t);
  const dir = await adoptedRepo(base);
  const result = await retire(base, dir, "--apply");
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /class A/);
  assert.match(result.out, /did delete CHANGELOG\.md/);
  assert.equal(await exists(join(dir, "CHANGELOG.md")), false);
  assert.equal(await exists(join(dir, "changelog.d")), false);
  assert.equal(await exists(join(dir, "drift/INDEX.md")), false);
  assert.equal(await exists(join(dir, "drift/x/001-research-a.md")), true, "artifacts stay");
  assert.equal(await fs.readFile(join(dir, ".gitattributes"), "utf8"), "*.sh text eol=lf\n");
  assert.deepEqual(JSON.parse(await fs.readFile(join(dir, ".drift.json"), "utf8")), { trackArtifacts: true });
  assert.equal(await fs.readFile(join(dir, ".drift.json"), "utf8"), "{\n  \"trackArtifacts\": true\n}\n");
  assert.equal(await driftConfig(dir), "");
  assert.doesNotMatch(await fs.readFile(join(dir, ".git", "config"), "utf8"), /drift-/);
  assert.equal((await git(dir, ["diff", "--cached", "--name-only"])).trim(), "", "nothing is staged");
  assert.equal((await git(dir, ["rev-list", "--count", "HEAD"])).trim(), "1", "nothing is committed");
  assert.match(result.out, /git add -A -- .*CHANGELOG\.md.* && git commit -m "chore: retire Drift changelog and index"/);
});

test("(2) uninvited residue is restored to HEAD and leaves git status clean", async (t) => {
  const base = await tempBase(t);
  const dir = await residueRepo(base);
  const result = await retire(base, dir, "--apply");
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /class B/);
  assert.equal(await fs.readFile(join(dir, "CHANGELOG.md"), "utf8"), PLAIN);
  assert.equal(await exists(join(dir, ".gitattributes")), false);
  assert.equal(await exists(join(dir, "changelog.d")), false);
  assert.equal(await driftConfig(dir), "");
  assert.equal(await status(dir), "");

  // A tracked .gitattributes with Drift's line appended is restored to HEAD.
  const tracked = await repo(base, "tracked-attrs", { "CHANGELOG.md": PLAIN, ".gitattributes": "*.sh text eol=lf\n" });
  await fs.appendFile(join(tracked, ".gitattributes"), `${CHANGELOG_LINE}\n`);
  assert.equal((await retire(base, tracked, "--apply")).code, 0);
  assert.equal(await fs.readFile(join(tracked, ".gitattributes"), "utf8"), "*.sh text eol=lf\n");
  assert.equal(await status(tracked), "");
});

test("(3) a residue CHANGELOG.md with another uncommitted edit keeps the edit and loses only Drift's lines", async (t) => {
  const base = await tempBase(t);
  const dir = await residueRepo(base);
  await fs.appendFile(join(dir, "CHANGELOG.md"), "- someone's uncommitted entry\n");
  const result = await retire(base, dir, "--apply");
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /did remove only Drift's marker lines from CHANGELOG\.md/);
  assert.equal(await fs.readFile(join(dir, "CHANGELOG.md"), "utf8"), `${PLAIN}- someone's uncommitted entry\n`);
  assert.equal(await status(dir), "M CHANGELOG.md");
});

test("(4) a linked worktree is reported and untouched while its main worktree is processed", async (t) => {
  const base = await tempBase(t);
  const dir = await residueRepo(base, "main");
  const linked = join(base, "main-feature");
  await git(dir, ["worktree", "add", "-q", "-b", "feature", linked]);
  await write(linked, { "CHANGELOG.md": `# Changelog\n\n${START}\n${END}\n\n## [1.0.0]\n\n- first\n`, ".gitattributes": `${CHANGELOG_LINE}\n` });
  const before = await snapshot(linked);
  const result = await retire(base, base, "--apply");
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /main-feature: linked worktree of .*main; fix it from the main repository/);
  assert.deepEqual(await snapshot(linked), before);
  assert.equal(await status(dir), "");
  assert.equal(await driftConfig(dir), "");
});

test("(5) a changesets repository keeps CHANGELOG.md and changelog.d but loses Drift's index pieces", async (t) => {
  const base = await tempBase(t);
  const markers = `# Changelog\n\n${START}\n${END}\n\n## 1.0.0\n`;
  const dir = await repo(base, "foreign", {
    ".changeset/config.json": "{}\n",
    "CHANGELOG.md": markers,
    "changelog.d/README.md": README,
    "drift/INDEX.md": "| # |\n",
    ".gitattributes": `${INDEX_LINE}\n*.md text\n`,
  });
  await installDrivers(dir);
  const result = await retire(base, dir, "--apply");
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /class C/);
  assert.equal(await fs.readFile(join(dir, "CHANGELOG.md"), "utf8"), markers);
  assert.equal(await fs.readFile(join(dir, "changelog.d/README.md"), "utf8"), README);
  assert.equal(await exists(join(dir, "drift/INDEX.md")), false);
  assert.equal(await fs.readFile(join(dir, ".gitattributes"), "utf8"), "*.md text\n");
  assert.equal(await driftConfig(dir), "");
});

test("(6) a private repository's ignored drift/INDEX.md is deleted", async (t) => {
  const base = await tempBase(t);
  const dir = await repo(base, "private", { ".gitignore": "/drift/\n", "src.txt": "code\n" });
  await write(dir, { "drift/INDEX.md": "| # |\n", "drift/x/001-plan-a.md": "plan\n" });
  const result = await retire(base, dir, "--apply");
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /did delete drift\/INDEX\.md \(ignored\)/);
  assert.equal(await exists(join(dir, "drift/INDEX.md")), false);
  assert.equal(await exists(join(dir, "drift/x/001-plan-a.md")), true);
  assert.doesNotMatch(result.out, /git add -A/, "an ignored file needs no commit");
});

test("(7) a dry run changes nothing", async (t) => {
  const base = await tempBase(t);
  const repos = [await adoptedRepo(base), await residueRepo(base)];
  const before = await Promise.all(repos.map(snapshot));
  const statuses = await Promise.all(repos.map(status));
  const result = await retire(base, base);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /would delete CHANGELOG\.md/);
  assert.match(result.out, /would restore CHANGELOG\.md to HEAD/);
  assert.match(result.out, /would unset merge\.drift-/);
  assert.match(result.out, /Run again with --apply/);
  assert.doesNotMatch(result.out, /\bdid /);
  assert.deepEqual(await Promise.all(repos.map(snapshot)), before);
  assert.deepEqual(await Promise.all(repos.map(status)), statuses);
});

test("(8) a re-run after apply reports nothing to do", async (t) => {
  const base = await tempBase(t);
  await adoptedRepo(base);
  const residue = await residueRepo(base);
  await fs.appendFile(join(residue, "CHANGELOG.md"), "- an edit\n");
  await repo(base, "untouched", { "CHANGELOG.md": PLAIN });
  assert.equal((await retire(base, base, "--apply")).code, 0);
  const again = await retire(base, base, "--apply");
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /A Drift adopted it: 0/);
  assert.match(again.out, /B uninvited Drift residue: 0/);
  assert.match(again.out, /D nothing to do: 3/);
  assert.doesNotMatch(again.out, /\bdid |left in place/);
});

test("(9) a repository mid-rebase is skipped", async (t) => {
  const base = await tempBase(t);
  const dir = await residueRepo(base, "rebasing");
  const gitDir = (await git(dir, ["rev-parse", "--absolute-git-dir"])).trim();
  await fs.mkdir(join(gitDir, "rebase-merge"));
  const before = await snapshot(dir);
  const result = await retire(base, dir, "--apply");
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /rebasing: a rebase is in progress/);
  assert.deepEqual(await snapshot(dir), before);
});

test("(10) discovery from a parent folder finds repositories one and two levels down, not deeper or in skipped folders", async (t) => {
  const base = await tempBase(t);
  await residueRepo(base, "one");
  await residueRepo(join(base, "group"), "two");
  await residueRepo(join(base, "a", "b"), "three");
  await residueRepo(join(base, "node_modules"), "pkg");
  const nested = await residueRepo(join(base, "one"), "nested");
  const result = await retire(base, base);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /2 repositories found/);
  assert.ok(result.out.includes(join(base, "one")), result.out);
  assert.ok(result.out.includes(join(base, "group", "two")), result.out);
  assert.ok(!result.out.includes("three") && !result.out.includes("pkg") && !result.out.includes(nested), result.out);
});
