import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { anchorHash, extractCitations, normalize } from "../lib/anchors.ts";
import { git, python, run } from "../lib/state.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const checker = join(root, "scripts/check-staleness.py").replaceAll("\\", "/");

const source = Array.from({ length: 10 }, (_, i) => `alpha line ${i + 1} content`).join("\n") + "\n";

async function repo(t: any) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-staleness-")));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await git(dir, ["init", "-q", "-b", "main"]);
  for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.invalid"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) await git(dir, ["config", key, value]);
  await fs.mkdir(join(dir, "src"), { recursive: true });
  await fs.writeFile(join(dir, "src", "app.py"), source);
  await git(dir, ["add", "-A"]);
  await git(dir, ["commit", "-qm", "base"]);
  return { dir, sha: (await git(dir, ["rev-parse", "HEAD"])).trim() };
}

async function artifact(dir: string, name: string, body: string, fields: Record<string, string>) {
  const front = Object.entries({ date: '"2026-10-10T10:00:00+01:00"', ...fields }).map(([key, value]) => `${key}: ${value}`).join("\n");
  const path = join(dir, "drift", "feat", name);
  await fs.mkdir(join(dir, "drift", "feat"), { recursive: true });
  await fs.writeFile(path, `---\n${front}\n---\n\n## Notes\n\n${body}\n`);
  return path;
}

const check = async (dir: string, path: string) => JSON.parse(await run(await python(), ["-I", checker, path, dir, "--json"], dir));
const verdictOf = (report: any, ref: string) => report.citations.find((c: any) => `${c.path}:${c.start}-${c.end}` === ref);

test("heuristic mode walks the whole verdict ladder from the recorded commit", async (t) => {
  const { dir, sha } = await repo(t);
  const cited = await artifact(dir, "001-research-a.md", "See `src/app.py:3-5` for the core.", { git_commit: `"${sha}"` });
  assert.equal(verdictOf(await check(dir, cited), "src/app.py:3-5").verdict, "fresh");

  // Two lines prepended (uncommitted): the recorded text moved down, and is found by hash.
  await fs.writeFile(join(dir, "src", "app.py"), "new one\nnew two\n" + source);
  const moved = verdictOf(await check(dir, cited), "src/app.py:3-5");
  assert.equal(moved.verdict, "moved");
  assert.deepEqual(moved.to, { path: "src/app.py", line: 5 });

  // The cited range rewritten in place: graded by similarity, not refused or guessed.
  await fs.writeFile(join(dir, "src", "app.py"), source.replace("alpha line 4 content", "beta line four rewritten"));
  const changed = verdictOf(await check(dir, cited), "src/app.py:3-5");
  assert.equal(changed.verdict, "changed");
  assert.ok(changed.similarity > 0.2 && changed.similarity < 1, `similarity ${changed.similarity}`);

  // File deleted: nothing resembling the text remains anywhere.
  await fs.rm(join(dir, "src", "app.py"));
  assert.equal(verdictOf(await check(dir, cited), "src/app.py:3-5").verdict, "gone");

  // Nothing to grade against: no commit recorded, or a commit this repository has never seen.
  const uncommitted = await artifact(dir, "002-research-b.md", "See `src/app.py:3-5`.", {});
  const noCommit = verdictOf(await check(dir, uncommitted), "src/app.py:3-5");
  assert.equal(noCommit.verdict, "uncertain");
  assert.match(noCommit.detail, /no recorded commit/);
  const foreign = await artifact(dir, "003-research-c.md", "See `src/app.py:3-5`.", { git_commit: `"${"f".repeat(40)}"` });
  assert.match(verdictOf(await check(dir, foreign), "src/app.py:3-5").detail, /not in this repository/);
});

test("the citation grammar matches paths, ranges and bare continuations, in both implementations", async (t) => {
  const { dir, sha } = await repo(t);
  const body = "See `src/app.py:2` and its continuation `:4-5`. Windows form src\\app.py:7 too. " +
    "Not citations: https://example.com:443/x, 2026-10-10T18:33, and v0.5.0:1.";
  const expected = [{ path: "src/app.py", start: 2, end: 2 }, { path: "src/app.py", start: 4, end: 5 }, { path: "src/app.py", start: 7, end: 7 }];
  assert.deepEqual(extractCitations(body).map(({ path, start, end }) => ({ path, start, end })), expected);
  const report = await check(dir, await artifact(dir, "001-research-g.md", body, { git_commit: `"${sha}"` }));
  assert.deepEqual(report.citations.map(({ path, start, end }: any) => ({ path, start, end })), expected);
  assert.equal(report.counts.fresh, 3);
});

test("exact mode proves freshness from anchors alone, flags dirty anchors, and survives lost history", async (t) => {
  const { dir, sha } = await repo(t);
  const slice = normalize(source).split("\n").slice(2, 5);
  const anchor = { path: "src/app.py", start: 3, end: 5, sha256: anchorHash(slice.join("\n")), context: [slice[0], slice.at(-1)] };
  const dead = `"${"0".repeat(40)}"`;

  // The recorded commit no longer exists, but the anchor still proves the citation fresh —
  // and the TypeScript writer and Python checker agree on the hash (the parity contract).
  const cited = await artifact(dir, "001-research-a.md", "Core: `src/app.py:3-5`.", { git_commit: dead, anchors: JSON.stringify([anchor]) });
  const fresh = await check(dir, cited);
  assert.equal(fresh.mode, "exact");
  assert.equal(verdictOf(fresh, "src/app.py:3-5").verdict, "fresh");

  // With live history, a moved range is still found and forwarded in exact mode.
  await fs.writeFile(join(dir, "src", "app.py"), "new one\nnew two\n" + source);
  const live = await artifact(dir, "002-research-b.md", "Core: `src/app.py:3-5`.", { git_commit: `"${sha}"`, anchors: JSON.stringify([anchor]) });
  assert.deepEqual(verdictOf(await check(dir, live), "src/app.py:3-5").to, { path: "src/app.py", line: 5 });

  // Changed content with no surviving history degrades honestly instead of guessing.
  await fs.writeFile(join(dir, "src", "app.py"), source.replace("alpha line 4 content", "beta line four rewritten"));
  const blind = verdictOf(await check(dir, cited), "src/app.py:3-5");
  assert.equal(blind.verdict, "changed");
  assert.match(blind.detail, /original text unavailable/);

  // An anchor taken over uncommitted changes is uncertain, never graded stale.
  const dirty = await artifact(dir, "003-research-c.md", "Core: `src/app.py:3-5`.", { git_commit: dead, anchors: JSON.stringify([{ ...anchor, dirty: true }]) });
  const flagged = verdictOf(await check(dir, dirty), "src/app.py:3-5");
  assert.equal(flagged.verdict, "uncertain");
  assert.match(flagged.detail, /uncommitted/);
});

test("the checker is a report, not a gate: exit 0 with stale citations, human mode readable", async (t) => {
  const { dir, sha } = await repo(t);
  await fs.writeFile(join(dir, "src", "app.py"), source.replace("alpha line 4 content", "rewritten"));
  const cited = await artifact(dir, "001-research-a.md", "See `src/app.py:3-5` and `src/gone.py:1`.", { git_commit: `"${sha}"` });
  const out = await run(await python(), ["-I", checker, cited, dir], dir); // run() throws on non-zero exit.
  assert.match(out, /changed\s+src\/app\.py:3-5 \(\d+% similar\)/);
  assert.match(out, /uncertain\s+src\/gone\.py:1 \(cited path not in the recorded commit\)/);
  assert.match(out, /summary: /);
});
