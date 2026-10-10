import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { git, python, run } from "../lib/state.ts";

const execFileP = promisify(execFile);

const root = fileURLToPath(new URL("..", import.meta.url));
const builder = join(root, "scripts/build-changelog.py").replaceAll("\\", "/");
const START = "<!-- drift:changelog: generated from changelog.d/ - edit a bullet only if you keep its id comment -->";
const END = "<!-- /drift:changelog -->";
const history = "\n## [0.0.1] - 2026-01-01\n\n- hand-written history, untouched\n";
const adopted = `# Changelog\n\nIntro kept as is.\n\n${START}\n${END}\n${history}`;

async function repo(t: any) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-changelog-")));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await git(dir, ["init", "-q", "-b", "main"]);
  for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.invalid"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) await git(dir, ["config", key, value]);
  await fs.writeFile(join(dir, "CHANGELOG.md"), adopted);
  return dir;
}

async function fragment(dir: string, name: string, date: string, section: string, body: string) {
  await fs.mkdir(join(dir, "changelog.d"), { recursive: true });
  await fs.writeFile(join(dir, "changelog.d", `${name}.md`), `---\ndate: "${date}"\nsection: "${section}"\nartifact: "drift/f/${name}.md"\n---\n${body}\n`);
}

const build = async (dir: string, ...flags: string[]) => run(await python(), ["-I", builder, dir, ...flags], dir);
const read = (dir: string) => fs.readFile(join(dir, "CHANGELOG.md"), "utf8");
const commit = async (dir: string, message: string) => { await git(dir, ["add", "-A"]); await git(dir, ["commit", "-qm", message]); };

test("without version tags the changelog is grouped by day, newest first, around the project's own text", async (t) => {
  const dir = await repo(t);
  await fragment(dir, "f-001-older", "2026-10-08T09:00:00+01:00", "Fixed", "An older fix.");
  await fragment(dir, "f-002-newer", "2026-10-09T16:29:21+01:00", "Changed", "**Bold lead.** Then detail.\nA second line of the same bullet.");
  await fragment(dir, "f-003-same-day", "2026-10-09T11:00:00+01:00", "Added", "Added the same day, earlier.");
  await build(dir);
  const text = await read(dir);
  assert.ok(text.startsWith("# Changelog\n\nIntro kept as is.\n\n" + START + "\n"));
  assert.ok(text.endsWith(END + "\n" + history));
  const region = text.slice(text.indexOf(START), text.indexOf(END));
  assert.deepEqual(region.split("\n").filter((line) => line.startsWith("## ")), ["## 2026-10-09", "## 2026-10-08"]);
  assert.ok(region.indexOf("### Added") < region.indexOf("### Changed"), "Keep a Changelog section order within a day");
  assert.match(region, /- \*\*Bold lead\.\*\* Then detail\.\n  A second line of the same bullet\. <!-- changelog\.d\/f-002-newer\.md 2026-10-09T16:29:21\+01:00 -->\n/);
  assert.match(region, /- An older fix\. <!-- changelog\.d\/f-001-older\.md 2026-10-08T09:00:00\+01:00 -->/);
  assert.ok(!text.includes("\r"));
  await build(dir, "--check"); // Up to date.
  assert.equal(await build(dir, "--stdout"), text);
  await build(dir);
  assert.equal(await read(dir), text); // Regenerating twice is byte-identical.
});

test("version tags group fragments by the first tag whose tree contains them; untagged ones are unreleased", async (t) => {
  const dir = await repo(t);
  await fragment(dir, "f-001-first", "2026-10-01T10:00:00+01:00", "Added", "In the first release.");
  await build(dir); await commit(dir, "first"); await git(dir, ["tag", "v0.1.0"]);
  await fragment(dir, "f-002-second", "2026-10-05T10:00:00+01:00", "Fixed", "In the second release.");
  await build(dir); await commit(dir, "second"); await git(dir, ["tag", "-a", "v0.2.0", "-m", "second"]);
  await fragment(dir, "f-003-pending", "2026-10-09T10:00:00+01:00", "Changed", "Not released yet.");
  await build(dir);
  const text = await read(dir);
  const headings = text.split("\n").filter((line) => line.startsWith("## "));
  const today = new Date().toISOString().slice(0, 10);
  assert.deepEqual(headings.slice(0, 3), ["## [Unreleased]", `## [0.2.0] — ${today}`, `## [0.1.0] — ${today}`]);
  const section = (name: string) => text.slice(text.indexOf(name), text.indexOf("\n## ", text.indexOf(name) + 1));
  assert.match(section("## [Unreleased]"), /Not released yet/);
  assert.match(section("## [0.2.0]"), /In the second release/);
  assert.doesNotMatch(section("## [0.2.0]"), /In the first release/);
  assert.match(section("## [0.1.0]"), /In the first release/);
  await build(dir, "--check");

  // A pattern that matches no tag falls back to days; the file converges either way.
  await fs.writeFile(join(dir, ".drift.json"), '{ "changelog": { "tags": "release-*" } }\n');
  await build(dir);
  assert.deepEqual((await read(dir)).split("\n").filter((line) => line.startsWith("## ")).slice(0, 3), ["## 2026-10-09", "## 2026-10-05", "## 2026-10-01"]);
});

test("the generated region is a one-way view: fragment edits regenerate it, region edits are refused", async (t) => {
  const dir = await repo(t);
  await fragment(dir, "f-001-edit", "2026-10-09T10:00:00+01:00", "Changed", "Original wording.");
  await build(dir);
  await commit(dir, "base");
  // The correction flow: edit the fragment; the stale view regenerates from it.
  await fragment(dir, "f-001-edit", "2026-10-09T10:00:00+01:00", "Changed", "Corrected wording.");
  await build(dir);
  assert.match(await read(dir), /- Corrected wording\. <!-- changelog\.d\/f-001-edit\.md/);
  await build(dir, "--check");

  // A bullet edited in the region, id kept, is refused in every mode; nothing is written or copied back.
  const text = await read(dir);
  const edited = text.replace("- Corrected wording. <!--", "- Hand-edited wording. <!--");
  await fs.writeFile(join(dir, "CHANGELOG.md"), edited);
  await assert.rejects(build(dir), /edited in the generated region; edit the fragment instead[\s\S]*one-way view[\s\S]*nothing written/);
  assert.equal(await read(dir), edited); // Reported, untouched.
  await assert.rejects(build(dir, "--check"), /edited in the generated region/);
  await assert.rejects(build(dir, "--stdout"), /edited in the generated region/);
  assert.match(await fs.readFile(join(dir, "changelog.d", "f-001-edit.md"), "utf8"), /---\nCorrected wording\.\n$/); // Never written back.

  await fs.writeFile(join(dir, "CHANGELOG.md"), text); // Restore the real view.
  const stray = text.replace("### Changed\n\n", "### Changed\n\n- Someone typed this straight into the file\n");
  await fs.writeFile(join(dir, "CHANGELOG.md"), stray);
  await assert.rejects(build(dir), /CHANGELOG\.md:\d+: not produced by any fragment: - Someone typed this straight into the file[\s\S]*nothing written/);
  assert.equal(await read(dir), stray); // Carried, reported, untouched.
  await assert.rejects(build(dir, "--check"), /not produced by any fragment/);
});

test("the renderer owns the bullet marker: a marked fragment is not doubled and a legacy doubled region heals", async (t) => {
  const dir = await repo(t);
  await fragment(dir, "f-001-marked", "2026-10-09T10:00:00+01:00", "Added", "- Took the schema's 'bullet' literally.");
  await fragment(dir, "f-002-nested", "2026-10-09T11:00:00+01:00", "Added", "Top level.\n- a nested sub-bullet kept as a continuation");
  await build(dir);
  const text = await read(dir);
  assert.match(text, /\n- Took the schema's 'bullet' literally\. <!-- changelog\.d\/f-001-marked\.md/);
  assert.doesNotMatch(text, /- - /);
  assert.match(text, /\n- Top level\.\n  - a nested sub-bullet kept as a continuation <!-- changelog\.d\/f-002-nested\.md/);
  // A legacy region that already doubled the marker regenerates clean rather than refusing.
  await fs.writeFile(join(dir, "CHANGELOG.md"), text.replace("- Took the schema's", "- - Took the schema's"));
  await build(dir);
  assert.equal(await read(dir), text);
});

test("builder output is UTF-8 even when the console code page is not", async (t) => {
  const dir = await repo(t);
  await fragment(dir, "f-001-arrow", "2026-10-09T10:00:00+01:00", "Changed", "Adoption moves scope → the worktree.");
  // PYTHONIOENCODING simulates a cp1252 console; the builder must reconfigure to UTF-8 itself,
  // because git invokes it as a merge driver where no caller can set the environment.
  const { stdout } = await execFileP(await python(), ["-I", builder, dir, "--stdout"], { cwd: dir, env: { ...process.env, PYTHONIOENCODING: "cp1252" }, encoding: "buffer" as any }) as any;
  assert.ok(stdout.toString("utf8").includes("Adoption moves scope → the worktree."), "stdout is UTF-8");
  await execFileP(await python(), ["-I", builder, dir], { cwd: dir, env: { ...process.env, PYTHONIOENCODING: "cp1252" } });
  assert.match(await read(dir), /scope → the worktree/);
  await build(dir, "--check");
});

test("the builder refuses a changelog without markers and an invalid fragment, writing nothing", async (t) => {
  const dir = await repo(t);
  await fs.writeFile(join(dir, "CHANGELOG.md"), "# Changelog\n\nNo markers here.\n");
  await fragment(dir, "f-001", "2026-10-09T10:00:00+01:00", "Added", "x");
  await assert.rejects(build(dir), /has no Drift markers; run \/drift-changelog on/);
  assert.equal(await read(dir), "# Changelog\n\nNo markers here.\n");
  assert.match(await build(dir, "--stdout"), /^<!-- drift:changelog[\s\S]*- x <!-- changelog\.d\/f-001\.md/); // Preview still renders the region.
  await fs.writeFile(join(dir, "CHANGELOG.md"), adopted);
  await fs.writeFile(join(dir, "changelog.d", "f-002-bad.md"), "---\ndate: \"2026-10-09T10:00:00+01:00\"\n---\nno section\n");
  await assert.rejects(build(dir), /invalid fragment \(missing section\): changelog\.d\/f-002-bad\.md/);
  assert.equal(await read(dir), adopted);
});

test("as a git merge driver, two threads that each added a fragment rebase without a conflict, and the result equals a rebuild", async (t) => {
  const dir = await repo(t);
  await git(dir, ["config", "merge.drift-changelog.name", "Drift changelog merge"]);
  await git(dir, ["config", "merge.drift-changelog.driver", `${await python()} -I ${builder} --merge %O %A %B`]);
  await fs.writeFile(join(dir, ".gitattributes"), "CHANGELOG.md merge=drift-changelog\n");
  await fragment(dir, "f-001-base", "2026-10-09T09:00:00+01:00", "Added", "Base entry.");
  await build(dir); await commit(dir, "base");

  await git(dir, ["checkout", "-qb", "thread-x"]);
  await fragment(dir, "f-002-x", "2026-10-09T12:00:00+01:00", "Changed", "Thread x's change.");
  await build(dir); await commit(dir, "x");
  await git(dir, ["checkout", "-q", "main"]); await git(dir, ["checkout", "-qb", "thread-y"]);
  await fragment(dir, "g-001-y", "2026-10-09T11:30:00+01:00", "Changed", "Thread y's change, earlier instant, later landing.");
  await build(dir); await commit(dir, "y");

  await git(dir, ["rebase", "thread-x"]);
  assert.equal((await git(dir, ["status", "--porcelain"])).trim(), "", "rebase left the tree dirty");
  const text = await read(dir);
  assert.doesNotMatch(text, /<<<<|>>>>/);
  const changed = text.slice(text.indexOf("### Changed"), text.indexOf(END));
  assert.ok(changed.indexOf("Thread x's change") < changed.indexOf("Thread y's change"), "newest instant first within a section");
  assert.match(text, /Base entry/);
  assert.ok(text.endsWith(END + "\n" + history));
  await build(dir, "--check"); // The driver's output is what a rebuild produces.
});

test("--merge keeps the version a side has learned from a fetched tag, and surfaces a real conflict in the hand-written part", async (t) => {
  const dir = await repo(t);
  const o = join(dir, "O.md"), a = join(dir, "A.md"), b = join(dir, "B.md");
  const entry = (text: string, id: string, date: string) => `- ${text} <!-- changelog.d/${id}.md ${date} -->`;
  const file = (head: string, region: string[], tail: string) => `${head}\n${START}\n${region.join("\n")}\n${END}\n${tail}`;
  const e1 = entry("One.", "f-001", "2026-10-01T10:00:00+01:00");
  await fs.writeFile(o, file("# C", ["", "## [Unreleased]", "", "### Added", "", e1], history));
  await fs.writeFile(a, file("# C", ["", "## [Unreleased]", "", "### Added", "", e1], history)); // Ours: no tag fetched yet.
  await fs.writeFile(b, file("# C", ["", "## [0.1.0] — 2026-10-02", "", "### Added", "", e1], history)); // Theirs: knows the release.
  await run(await python(), ["-I", builder, "--merge", o, a, b], dir);
  assert.match(await fs.readFile(a, "utf8"), /## \[0\.1\.0\] — 2026-10-02\n\n### Added\n\n- One\./);

  await fs.writeFile(a, file("# C", ["", "## [Unreleased]", "", "### Added", "", e1], history + "\n- ours edited history\n"));
  await fs.writeFile(b, file("# C", ["", "## [Unreleased]", "", "### Added", "", e1], history + "\n- theirs edited history\n"));
  await assert.rejects(run(await python(), ["-I", builder, "--merge", o, a, b], dir), /conflict in the hand-written part of CHANGELOG\.md/);
});
