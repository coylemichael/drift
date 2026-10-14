import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { artifactLifecycle, git, python, readArtifactCatalog, Records, run } from "../lib/state.ts";
import { pickup } from "../lib/pickup.ts";

const builder = fileURLToPath(new URL("../scripts/build-index.py", import.meta.url));

async function fixture(t: any) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-catalog-")));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo with spaces");
  await fs.mkdir(repo);
  await git(repo, ["init", "-q"]);
  await fs.writeFile(join(repo, ".gitignore"), "/drift/\n");
  return { dir, repo, agent: join(dir, "agent") };
}

async function artifact(repo: string, path: string, frontmatter: string, body = "Fixture.\n") {
  const file = join(repo, "drift", path);
  await fs.mkdir(join(file, ".."), { recursive: true });
  await fs.writeFile(file, `---\n${frontmatter}\n---\n\n${body}`);
}

const query = async (repo: string) => run(await python(), ["-I", builder, join(repo, "drift"), "--json"], repo);

test("raw catalog reads are empty without artifacts and never create or repair a view", async (t) => {
  const { repo } = await fixture(t);
  assert.deepEqual(await readArtifactCatalog(repo), { dated: [], undated: [] });
  await assert.rejects(fs.stat(join(repo, "drift")), { code: "ENOENT" });
  // CLI reports a missing input directory honestly; the host handles an absent store before launching it.
  await assert.rejects(query(repo), /not a directory/);
  await fs.mkdir(join(repo, "drift"));
  assert.deepEqual(JSON.parse(await query(repo)), { dated: [], undated: [] });
  const index = join(repo, "drift", "INDEX.md");
  await fs.writeFile(index, "obsolete view\n");
  assert.deepEqual(await readArtifactCatalog(repo), { dated: [], undated: [] });
  assert.equal(await fs.readFile(index, "utf8"), "obsolete view\n");
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), "/drift/\n");
  await assert.rejects(fs.stat(join(repo, "drift", ".publish.lock")), { code: "ENOENT" });
});

test("JSON and Markdown views share UTC/tie/legacy order and metadata without writing", async (t) => {
  const { repo } = await fixture(t);
  await artifact(repo, "feature/001-handoff-later.md", "date: 2026-09-01T00:00:00Z\ntype: handoff\nstatus: in-progress");
  await artifact(repo, "feature/002-plan-earlier.md", "date: 2026-09-01T00:00:00+01:00\ntype: plan\nstatus: pending");
  await artifact(repo, "feature/003-research-漢字.md", "date: 2026-09-01T00:00:00Z\ntype: research\nstatus: complete");
  await artifact(repo, "other/001-handoff-tie.md", "date: 2026-09-01T00:00:00Z\ntype: handoff");
  await artifact(repo, "feature/handoffs/old.md", "type: handoff", "**Date:** 2026-08-01\n");
  await artifact(repo, "feature/004-handoff-invalid-date.md", "date: impossible\ntype: handoff");
  await artifact(repo, "feature/no-date.md", "type: research");

  const catalog = await readArtifactCatalog(repo);
  assert.deepEqual(catalog.dated.map((entry) => entry.path), [
    "feature/handoffs/old.md", "feature/002-plan-earlier.md", "feature/001-handoff-later.md",
    "feature/003-research-漢字.md", "other/001-handoff-tie.md",
  ]);
  assert.equal(catalog.dated[0].approximate, true);
  assert.equal(catalog.dated[1].date, "2026-09-01T00:00:00+01:00");
  assert.equal(catalog.dated[1].status, "pending");
  assert.equal(catalog.dated[2].status, "in-progress");
  assert.equal(catalog.dated[3].status, "complete");
  assert.equal(catalog.dated[4].status, null);
  assert.deepEqual(catalog.undated.map((entry) => entry.path), ["feature/004-handoff-invalid-date.md", "feature/no-date.md"]);
  assert.ok(catalog.undated.every((entry) => entry.date === null && entry.row === null));

  const rendered = await run(await python(), ["-I", builder, join(repo, "drift"), "--stdout"], repo);
  assert.deepEqual(rendered.split("\n").filter((line) => /^\| \d+ \|/.test(line)), catalog.dated.map((entry) => entry.row));
  assert.match(rendered, /漢字/);
  await assert.rejects(fs.stat(join(repo, "drift", "INDEX.md")), { code: "ENOENT" });
  await assert.rejects(run(await python(), ["-I", builder, join(repo, "drift"), "--json", "--check"], repo), /Usage/);
});

test("successor metadata and completion status are read live without rewriting the timeline or artifacts", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "lifecycle-metadata", agent))!;
  const old = "feature/001-handoff-old.md";
  const successor = "drift/feature/002-handoff-new.md";
  await artifact(repo, old, 'date: 2026-10-09T10:00:00Z\ntype: handoff\nstatus: "in-progress"');
  await artifact(repo, "feature/002-handoff-new.md", 'date: 2026-10-10T10:00:00Z\ntype: handoff\nstatus: "complete"');
  await artifact(repo, "feature/003-plan-legacy.md", 'date: 2026-10-11T10:00:00Z\ntype: plan\nstatus: "superseded"');
  const file = join(repo, "drift", old);
  const before = await fs.readFile(file, "utf8");
  const timeline = await run(await python(), ["-I", builder, join(repo, "drift"), "--stdout"], repo);
  for (const value of [successor, `"${successor}"`, `'${successor}'`]) {
    const text = before.replace('status: "in-progress"', `status: "superseded"\nsuperseded_by: ${value}`);
    await fs.writeFile(file, text);
    const catalog = await readArtifactCatalog(repo);
    assert.equal(catalog.dated[0].superseded_by, successor);
    assert.equal(catalog.dated[1].superseded_by, null);
    assert.equal(catalog.dated[2].superseded_by, null);
    const context = await store.context();
    assert.match(context, /status: "complete"/);
    assert.ok(context.includes(`\`drift/${old}\` superseded by \`${successor}\``));
    assert.match(context, /status: "superseded";.*replacement not recorded/);
    assert.equal(await run(await python(), ["-I", builder, join(repo, "drift"), "--stdout"], repo), timeline);
    assert.equal(await fs.readFile(file, "utf8"), text);
  }
  await artifact(repo, "feature/004-plan-undated.md", `type: plan\nstatus: superseded\nsuperseded_by: "${successor}"`);
  assert.equal((await readArtifactCatalog(repo)).undated[0].superseded_by, successor);
  await assert.rejects(fs.stat(join(repo, "drift", "INDEX.md")), { code: "ENOENT" });
});

test("named lifecycle scalars and the shared parser agree on empty, null, quoted and CRLF metadata", async (t) => {
  const { repo } = await fixture(t);
  for (const value of ["", '""', "''", "null", "~", "complete", '"complete"', "'complete'", '""complete""', "''complete''", `"'complete'"`]) {
    const frontmatter = `date: 2026-10-09T10:00:00Z\nstatus: ${value}\nsuperseded_by: ${value}\ntype: handoff`;
    await artifact(repo, "feature/001-handoff-values.md", frontmatter, "status: superseded\nsuperseded_by: drift/feature/body.md\n");
    const file = join(repo, "drift", "feature", "001-handoff-values.md");
    const text = (await fs.readFile(file, "utf8")).replaceAll("\n", "\r\n");
    await fs.writeFile(file, text);
    const entry = (await readArtifactCatalog(repo)).dated[0];
    assert.deepEqual(artifactLifecycle(text), { status: entry.status, superseded_by: entry.superseded_by });
  }
  assert.deepEqual(artifactLifecycle("# No frontmatter\nstatus: complete\n"), { status: null, superseded_by: null });
});

test("recent lifecycle context stays bounded across 500 raw files and ignores an oversized stale view", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "catalog-context", agent))!;
  for (let i = 1; i <= 500; i++) {
    const prefix = String(i).padStart(3, "0");
    const date = new Date(Date.UTC(2026, 9, 9, 10, i)).toISOString();
    await artifact(repo, `feature/${prefix}-handoff-task.md`, `date: ${date}\ntype: handoff\nsequence: ${prefix}\nfeature: ${i === 500 ? "F".repeat(900) : "feature"}`);
  }
  await artifact(repo, "feature/501-handoff-undated.md", "type: handoff");
  const index = join(repo, "drift", "INDEX.md");
  const stale = "STALE_VIEW_MUST_NOT_BE_USED\n".repeat(25_000);
  await fs.writeFile(index, stale);
  const context = await store.context();
  const rows = context.split("\n").filter((line) => /^\| \d+ \|/.test(line));
  assert.equal(rows.length, 8);
  assert.ok(rows.every((row) => row.length <= 600));
  assert.match(rows[0], /493-handoff-task/);
  assert.doesNotMatch(context, /STALE_VIEW|001-handoff-task|492-handoff-task/);
  assert.match(context, /1 artifact\(s\) have no parsable date/);
  assert.equal(await fs.readFile(index, "utf8"), stale);
  await fs.unlink(index);
  assert.match(await store.context(), /Recent project artifacts/);
  await assert.rejects(fs.stat(index), { code: "ENOENT" });
  await assert.rejects(fs.stat(join(repo, "drift", ".publish.lock")), { code: "ENOENT" });
});

test("raw read failures surface honestly without a stale-index fallback", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "catalog-error", agent))!;
  await artifact(repo, "feature/001-plan-older.md", "date: 2026-10-09T10:00:00Z\ntype: plan\nstatus: pending");
  const index = join(repo, "drift", "INDEX.md");
  await fs.writeFile(index, "| 001 | 2026-10-09 10:00 +00:00 | feature | plan | [older](feature/001-plan-older.md) |\n");
  // A corrupt store entry is a portable OS-level read failure, unlike chmod on Windows or root.
  await fs.mkdir(join(repo, "drift", "feature", "002-handoff-broken.md"));
  await assert.rejects(readArtifactCatalog(repo), /could not read Drift artifacts/);
  const result = await pickup(repo, "");
  assert.match(result.text, /raw artifact discovery failed/);
  assert.doesNotMatch(result.text, /has no Drift artifacts|Execute the Drift plan/);
  assert.match(await store.context(), /Recent artifact discovery unavailable/);
  assert.doesNotMatch(await store.context(), /Recent project artifacts \(/);
  assert.match(await fs.readFile(index, "utf8"), /\[older\]/);
  await assert.rejects(readArtifactCatalog(repo, process.execPath), /failed/); // Interpreter failure is not empty data.
});

test("an unreadable artifact directory is a discovery failure, never a silently incomplete catalog", { skip: process.platform === "win32" || process.getuid?.() === 0 }, async (t) => {
  const { repo } = await fixture(t);
  await artifact(repo, "visible/001-plan-old.md", "date: 2026-10-09T10:00:00Z\ntype: plan");
  await artifact(repo, "hidden/001-handoff-new.md", "date: 2026-10-10T10:00:00Z\ntype: handoff");
  const hidden = join(repo, "drift", "hidden");
  await fs.chmod(hidden, 0);
  try {
    await assert.rejects(readArtifactCatalog(repo), /could not read Drift artifacts/);
    assert.match((await pickup(repo, "")).text, /raw artifact discovery failed/);
  } finally { await fs.chmod(hidden, 0o755); }
});

test("raw discovery refuses a symlinked artifact rather than reading outside the store", { skip: process.platform === "win32" }, async (t) => {
  const { repo, dir } = await fixture(t);
  const outside = join(dir, "outside.md");
  const contents = "---\ndate: 2099-01-01T00:00:00Z\ntype: plan\n---\nprivate\n";
  await fs.writeFile(outside, contents);
  await fs.mkdir(join(repo, "drift", "feature"), { recursive: true });
  await fs.symlink(outside, join(repo, "drift", "feature", "001-plan-link.md"));
  await assert.rejects(readArtifactCatalog(repo), /symlink/);
  assert.match((await pickup(repo, "")).text, /raw artifact discovery failed.*symlink/);
  assert.equal(await fs.readFile(outside, "utf8"), contents);
});

test("raw discovery refuses a symlinked store root", async (t) => {
  const { repo, dir } = await fixture(t);
  const outside = join(dir, "outside");
  await fs.mkdir(outside);
  await fs.symlink(outside, join(repo, "drift"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(readArtifactCatalog(repo), /symlink/);
  await assert.rejects(query(repo), /symlink or junction/); // Portable hosts have the same root boundary.
  assert.deepEqual(await fs.readdir(outside), []);
});

test("the shared parser refuses directory junctions or symlinks inside the store", async (t) => {
  const { repo, dir } = await fixture(t);
  const outside = join(dir, "outside");
  await fs.mkdir(outside);
  await fs.writeFile(join(outside, "001-plan-private.md"), "---\ndate: 2099-01-01T00:00:00Z\ntype: plan\n---\n");
  await fs.mkdir(join(repo, "drift"));
  await fs.symlink(outside, join(repo, "drift", "linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(query(repo), /symlink|junction/);
  await assert.rejects(readArtifactCatalog(repo), /symlink|junction/);
  assert.deepEqual(await fs.readdir(outside), ["001-plan-private.md"]);
});
