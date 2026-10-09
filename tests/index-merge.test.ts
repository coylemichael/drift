import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { git, python, run } from "../lib/state.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
// Git runs merge drivers through `sh -c`, which eats backslashes: forward slashes everywhere.
const builder = join(root, "scripts/build-index.py").replaceAll("\\", "/");

async function scratch(t: any) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-index-merge-")));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

async function artifact(repo: string, feature: string, name: string, date: string) {
  await fs.mkdir(join(repo, "drift", feature), { recursive: true });
  await fs.writeFile(join(repo, "drift", feature, name), `---\ndate: "${date}"\nfeature: "${feature}"\nsequence: "${name.slice(0, 3)}"\ntype: "${name.split("-")[1]}"\n---\n\n## Body\nx\n`);
}

const rebuild = async (repo: string) => run(await python(), ["-I", builder, join(repo, "drift")], repo);
const merge = async (cwd: string, o: string, a: string, b: string) => run(await python(), ["-I", builder, "--merge", o, a, b], cwd);
const rows = (text: string) => text.split(/\r?\n/).filter((line) => /^\| \d+ \|/.test(line));

const header = "| # | Date | Feature | Type | Artifact |\n|---|---|---|---|---|\n";
const row = (n: number, date: string, feature: string, kind: string, name: string) =>
  `| ${String(n).padStart(3, "0")} | ${date} | ${feature} | ${kind} | [${name}](${feature}/${name}.md) |\n`;
const index = (body: string, footer = "") => `# Drift Index\n\nprose\n\n${header}${body}\n---\n\n${footer}\n`;

test("as a git merge driver, two threads that each appended a row rebase and merge without a conflict", async (t) => {
  const repo = join(await scratch(t), "repo");
  await fs.mkdir(repo);
  await git(repo, ["init", "-q", "-b", "main"]);
  for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.invalid"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"],
    ["merge.drift-index.name", "Drift index row merge"], ["merge.drift-index.driver", `${await python()} -I ${builder} --merge %O %A %B`]]) {
    await git(repo, ["config", key, value]);
  }
  await fs.writeFile(join(repo, ".gitattributes"), "drift/INDEX.md merge=drift-index\n");
  await artifact(repo, "f", "001-research-a.md", "2026-10-09T10:00:00+01:00");
  await artifact(repo, "f", "002-plan-b.md", "2026-10-09T10:30:00+01:00");
  await rebuild(repo);
  await git(repo, ["add", "-A"]); await git(repo, ["commit", "-qm", "base"]);

  await git(repo, ["checkout", "-qb", "thread-x"]);
  await artifact(repo, "f", "003-handoff-x.md", "2026-10-09T12:00:00+01:00");
  await rebuild(repo); await git(repo, ["add", "-A"]); await git(repo, ["commit", "-qm", "x lands 003 at 12:00"]);

  await git(repo, ["checkout", "-q", "main"]); await git(repo, ["checkout", "-qb", "thread-y"]);
  await artifact(repo, "g", "001-handoff-y.md", "2026-10-09T11:30:00+01:00"); // Earlier instant, later landing.
  await rebuild(repo); await git(repo, ["add", "-A"]); await git(repo, ["commit", "-qm", "y lands 003 at 11:30"]);
  const yBefore = (await git(repo, ["rev-parse", "HEAD"])).trim();

  await git(repo, ["rebase", "thread-x"]);
  assert.equal((await git(repo, ["status", "--porcelain"])).trim(), "", "rebase left the tree dirty");
  const rebased = await fs.readFile(join(repo, "drift/INDEX.md"), "utf8");
  assert.deepEqual(rows(rebased).map((line) => line.slice(0, 5)), ["| 001", "| 002", "| 003", "| 004"]);
  assert.match(rows(rebased)[2]!, /11:30 \+01:00 \| g \| handoff \| \[001-handoff-y\]/);
  assert.match(rows(rebased)[3]!, /12:00 \+01:00 \| f \| handoff \| \[003-handoff-x\]/);
  assert.match(rebased, /\n4 dated artifacts across 2 features\.\n$/);
  assert.doesNotMatch(rebased, /<<<<|>>>>/);
  // The driver's output is byte-identical to a rebuild from the merged tree: no drift between the two paths.
  await run(await python(), ["-I", builder, join(repo, "drift"), "--check"], repo);

  await git(repo, ["checkout", "-q", "thread-x"]);
  await git(repo, ["merge", "-q", yBefore, "-m", "merge"]);
  assert.equal((await git(repo, ["status", "--porcelain"])).trim(), "");
  assert.equal(await fs.readFile(join(repo, "drift/INDEX.md"), "utf8"), rebased);
});

test("--merge keeps one-sided removals, unions undated rows, accepts CRLF and an empty base, and writes LF", async (t) => {
  const dir = await scratch(t);
  const o = join(dir, "O.md"), a = join(dir, "A.md"), b = join(dir, "B.md");
  const r1 = row(1, "2026-10-09 10:00 +01:00", "f", "research", "001-research-a");
  const r2 = row(2, "2026-10-09 10:30 +01:00", "f", "plan", "002-plan-b");
  const r3 = row(3, "2026-10-09 12:00 +01:00", "f", "handoff", "003-handoff-x");
  const r3y = row(3, "2026-10-09 11:30 +01:00", "g", "handoff", "001-handoff-y");

  // Ours appended r3; theirs removed r1: r1 stays removed, r3 stays added.
  await fs.writeFile(o, index(r1 + r2)); await fs.writeFile(a, index(r1 + r2 + r3)); await fs.writeFile(b, index(r2).replaceAll("\n", "\r\n"));
  await merge(dir, o, a, b);
  let out = await fs.readFile(a, "utf8");
  assert.deepEqual(rows(out).map((line) => /\[(.+?)\]/.exec(line)![1]), ["002-plan-b", "003-handoff-x"]);
  assert.match(out, /\n2 dated artifacts across 1 feature\.\n$/);
  assert.ok(!out.includes("\r"), "driver output must be LF");

  // Both sides new (git passes an empty base) plus undated rows on each side.
  await fs.writeFile(o, ""); await fs.writeFile(a, index(r3, "") + "\n## Undated\n\n- f / [old-note](f/old-note.md)\n");
  await fs.writeFile(b, index(r3y) + "\n## Undated\n\n- g / [other-note](g/other-note.md)\n");
  await merge(dir, o, a, b);
  out = await fs.readFile(a, "utf8");
  assert.deepEqual(rows(out).map((line) => /\[(.+?)\]/.exec(line)![1]), ["001-handoff-y", "003-handoff-x"]);
  assert.match(out, /## Undated\n\nArtifacts with no parsable `date`[^\n]*\n\n- f \/ \[old-note\]\(f\/old-note\.md\)\n- g \/ \[other-note\]\(g\/other-note\.md\)\n/);
  assert.match(out, /\n2 dated artifacts across 2 features; 2 undated\.\n$/);

  // Same path on both sides with different text: theirs wins, and the next frontmatter rebuild is final anyway.
  await fs.writeFile(o, index(r1)); await fs.writeFile(a, index(r1.replace("research", "plan"))); await fs.writeFile(b, index(r1.replace("10:00", "10:05")));
  await merge(dir, o, a, b);
  assert.match(rows(await fs.readFile(a, "utf8"))[0]!, /10:05 \+01:00 \| f \| research/);
});

test("--merge refuses inputs that are not Drift indexes and leaves ours untouched", async (t) => {
  const dir = await scratch(t);
  const o = join(dir, "O.md"), a = join(dir, "A.md"), b = join(dir, "B.md");
  await fs.writeFile(o, ""); await fs.writeFile(a, "# Something else\n\nnot an index\n"); await fs.writeFile(b, index(""));
  await assert.rejects(merge(dir, o, a, b), /not Drift index files/);
  assert.equal(await fs.readFile(a, "utf8"), "# Something else\n\nnot an index\n");
  await assert.rejects(run(await python(), ["-I", builder, "--merge", o, a], dir), /Usage/); // Exactly three paths.
});
