import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ensureChangelog } from "../lib/changelog.ts";
import { changelogDriverCommand } from "../lib/git-drivers.ts";
import { git, python, run } from "../lib/state.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const cleaner = join(root, "scripts/clean-changelog-residue.py").replaceAll("\\", "/");
const START = "<!-- drift:changelog: generated from changelog.d/ - edit a bullet only if you keep its id comment -->";
const END = "<!-- /drift:changelog -->";

async function repo(base: string, name: string, files: Record<string, string>) {
  const dir = join(base, name);
  await fs.mkdir(dir, { recursive: true });
  await git(dir, ["init", "-q", "-b", "main"]);
  for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.invalid"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) await git(dir, ["config", key, value]);
  for (const [path, content] of Object.entries(files)) {
    await fs.mkdir(dirname(join(dir, path)), { recursive: true });
    await fs.writeFile(join(dir, path), content);
  }
  await git(dir, ["add", "-A"]); await git(dir, ["commit", "-qm", "initial"]);
  return dir;
}

/** What Drift from 2026-10-09 to 2026-10-12 did at session start: adopt, then install the driver. */
async function oldDriftAdopts(dir: string) {
  await ensureChangelog(dir);
  await git(dir, ["config", "merge.drift-changelog.driver", await changelogDriverCommand()]);
}

const status = async (dir: string) => (await git(dir, ["status", "--porcelain", "--untracked-files=all"])).trim();
const driver = async (dir: string) => (await git(dir, ["config", "--local", "--get", "merge.drift-changelog.driver"], true)).trim();
const clean = async (base: string, ...flags: string[]) => run(await python(), ["-I", cleaner, ...flags, base], base);

test("the residue cleaner removes only Drift's own uncommitted changelog setup, across worktrees, and leaves everything else", async (t) => {
  const base = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-residue-")));
  const outside = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-residue-worktrees-")));
  t.after(() => Promise.all([fs.rm(base, { recursive: true, force: true }), fs.rm(outside, { recursive: true, force: true })]));
  const changelog = "# Changelog\n\n## [Unreleased]\n\n- old\n";

  // Cy's shape: its own changelog.d/ convention, Drift's markers and attribute on top, in the checkout and a worktree.
  const cy = await repo(base, "cy", { "CHANGELOG.md": changelog, "changelog.d/README.md": "# Our fragments\n", "changelog.d/x.added.md": "- An entry.\n" });
  await oldDriftAdopts(cy);
  const worktree = join(outside, "cy-feature");
  await git(cy, ["worktree", "add", "-q", "-b", "feature", worktree]);
  await ensureChangelog(worktree);
  // A fresh clone: everything Drift wrote is new.
  const fresh = await repo(base, "fresh", { "CHANGELOG.md": changelog });
  await oldDriftAdopts(fresh);
  // A tracked .gitattributes with Drift's line appended, and a CHANGELOG.md someone has also edited.
  const edited = await repo(base, "edited", { "CHANGELOG.md": changelog, ".gitattributes": "*.sh text eol=lf\n" });
  await oldDriftAdopts(edited);
  await fs.appendFile(join(edited, "CHANGELOG.md"), "- someone's uncommitted entry\n");
  // A repository that chose Drift's changelog and committed it.
  const adopted = await repo(base, "adopted", { "CHANGELOG.md": `# Changelog\n\n${START}\n${END}\n`, ".gitattributes": "CHANGELOG.md merge=drift-changelog\n" });
  await git(adopted, ["config", "merge.drift-changelog.driver", await changelogDriverCommand()]);

  const before = await Promise.all([cy, worktree, fresh, edited, adopted].map(status));
  const dry = await clean(base);
  assert.match(dry, /would restore CHANGELOG\.md/);
  assert.match(dry, /would delete \.gitattributes \(untracked, only Drift's line\)/);
  assert.match(dry, /would delete changelog\.d\/ \(untracked, only Drift's README\)/);
  assert.match(dry, /Run again with --apply/);
  assert.ok(dry.includes(worktree), "linked worktrees outside the scanned root are checked");
  assert.deepEqual(await Promise.all([cy, worktree, fresh, edited, adopted].map(status)), before, "a dry run changes nothing");

  const applied = await clean(base, "--apply");
  assert.equal(await status(cy), "");
  assert.equal(await status(worktree), "");
  assert.equal(await status(fresh), "");
  assert.equal(await driver(cy), "");
  assert.equal(await driver(fresh), "");
  assert.equal(await fs.readFile(join(cy, "changelog.d", "README.md"), "utf8"), "# Our fragments\n"); // The project's own README stays.
  assert.equal(await status(edited), "M CHANGELOG.md");
  assert.match(await fs.readFile(join(edited, "CHANGELOG.md"), "utf8"), /someone's uncommitted entry/);
  assert.match(applied, /left for you: CHANGELOG\.md: has Drift's marker pair and other uncommitted edits/);
  assert.equal(await status(adopted), "");
  assert.notEqual(await driver(adopted), "", "an adopted repository keeps its driver");

  assert.match(await clean(base, "--apply"), /0 change\(s\) made, 1 item\(s\) left for you/); // Idempotent.
});
