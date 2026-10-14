import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { captureAnchors, extractCitations } from "../lib/anchors.ts";
import { publish } from "../lib/artifacts.ts";
import { citationNote, pickup } from "../lib/pickup.ts";
import { git, python, Records, run } from "../lib/state.ts";

const headings = ["Objective", "Source Documents", "Status", "What Changed", "Codebase Context", "What Deviated from Plan", "Open Questions", "Next Steps"];
const body = headings.map((heading) => `## ${heading}\nFixture.\n`).join("\n");
const checker = fileURLToPath(new URL("../scripts/check-staleness.py", import.meta.url));

async function fixture(t: any) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-anchor-coverage-")));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo");
  await fs.mkdir(repo);
  await git(repo, ["init", "-q", "-b", "main"]);
  for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.invalid"], ["commit.gpgsign", "false"]]) await git(repo, ["config", key, value]);
  await fs.writeFile(join(repo, "file.txt"), "one\ntwo\nthree\n");
  await git(repo, ["add", "file.txt"]);
  await git(repo, ["commit", "-qm", "base"]);
  return { dir, repo, agent: join(dir, "agent"), sha: (await git(repo, ["rev-parse", "HEAD"])).trim() };
}

function coverageOf(text: string) { return JSON.parse(/^anchor_coverage: (.+)$/m.exec(text)![1]); }
const check = async (repo: string, path: string) => JSON.parse(await run(await python(), ["-I", checker, join(repo, path), repo, "--json"], repo));

async function manual(repo: string, body: string, fields: Record<string, unknown> = {}) {
  const path = "drift/coverage/001-handoff-manual.md";
  await fs.mkdir(join(repo, "drift", "coverage"), { recursive: true });
  const entries = { date: "2026-10-13T10:00:00+01:00", type: "handoff", status: "in-progress", ...fields };
  await fs.writeFile(join(repo, path), `---\n${Object.entries(entries).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n\n${body}\n`);
  return path;
}

test("symbol-only publication records explicitly that no numeric anchors were expected", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "zero-anchors", agent))!;
  const receipt = await publish(store, { feature: "coverage", kind: "handoff", slug: "symbol-only", body: body + "\nfile.txt: verify() — symbolic reference.\n" });
  const text = await fs.readFile(join(repo, receipt.path), "utf8");
  assert.match(text, /^anchor_coverage: /m);
  const coverage = coverageOf(text);
  assert.deepEqual(coverage, { status: "not-applicable", eligible: 0, captured: 0, skipped_count: 0, skipped_by_reason: {}, skipped: [] });
  assert.doesNotMatch(text, /^anchors:/m);
  assert.deepEqual((await check(repo, receipt.path)).anchor_coverage, coverage);
  assert.match((await pickup(repo, receipt.path)).text, /Anchor capture: not applicable \(0 eligible numeric references\)/);
});

test("complete capture counts deduplicated numeric citations and bare continuations", async (t) => {
  const { repo, agent } = await fixture(t);
  const references = "`file.txt:1` duplicate `file.txt:01-01`, `:2` and `file.txt:3`. Not numeric: file.txt: verify().";
  const store = (await Records.open(repo, "complete-anchors", agent))!;
  const receipt = await publish(store, { feature: "coverage", kind: "handoff", slug: "complete", body: body + references });
  const text = await fs.readFile(join(repo, receipt.path), "utf8");
  const coverage = coverageOf(text);
  assert.deepEqual(coverage, { status: "complete", eligible: 3, captured: 3, skipped_count: 0, skipped_by_reason: {}, skipped: [] });
  const report = await check(repo, receipt.path);
  assert.deepEqual(report.anchor_coverage, coverage);
  assert.equal(report.mode, "exact");
  assert.equal(report.counts.fresh, 3);
  const before = text;
  await fs.writeFile(join(repo, "file.txt"), "CHANGED\ntwo\nthree\n");
  const changed = await check(repo, receipt.path);
  assert.equal(changed.anchor_coverage.status, "complete"); // Capture does not become stale or partial.
  assert.equal(changed.counts.changed, 1);
  assert.equal(await fs.readFile(join(repo, receipt.path), "utf8"), before);
  assert.equal((await publish(store, { feature: "coverage", kind: "handoff", slug: "complete", body: body + references })).path, receipt.path);
  assert.equal(await fs.readFile(join(repo, receipt.path), "utf8"), before); // Replay preserves measured coverage.
});

test("partial and zero capture distinguish missing files, unsafe paths and invalid ranges", async (t) => {
  const { repo, agent } = await fixture(t);
  const references = "file.txt:1, absent.txt:1, file.txt:0, file.txt:3-2, file.txt:1-9, src/../file.txt:2.";
  const store = (await Records.open(repo, "partial-anchors", agent))!;
  const receipt = await publish(store, { feature: "coverage", kind: "handoff", slug: "partial", body: body + references });
  const coverage = coverageOf(await fs.readFile(join(repo, receipt.path), "utf8"));
  assert.equal(coverage.status, "partial");
  assert.equal(coverage.eligible, 6);
  assert.equal(coverage.captured, 1);
  assert.equal(coverage.skipped_count, 5);
  assert.deepEqual(coverage.skipped_by_reason, { "file-not-found": 1, "invalid-range": 3, "unsafe-path": 1 });
  assert.deepEqual((await check(repo, receipt.path)).anchor_coverage, coverage);
  assert.match(await citationNote(repo, repo, receipt.path), /Anchor capture: partial \(1\/6 captured\).*5 skipped/);
  const zero = await captureAnchors(repo, "absent.txt:1");
  assert.equal(zero.coverage.status, "partial"); // Zero capture is not zero eligibility.
  assert.equal(zero.coverage.eligible, 1);
  assert.equal(zero.coverage.captured, 0);
});

test("invalid integers retain distinct identities and parity across the JS and Python parsers", async (t) => {
  const { repo, sha } = await fixture(t);
  const references = "file.txt:9007199254740992 and file.txt:9007199254740993 and file.txt:2-1";
  assert.equal(extractCitations(references, true).length, 3);
  const { anchors, coverage } = await captureAnchors(repo, references);
  assert.equal(coverage.eligible, 3);
  assert.equal(coverage.captured, 0);
  assert.deepEqual(coverage.skipped_by_reason, { "invalid-range": 3 });
  const path = await manual(repo, references, { git_commit: sha, anchors, anchor_coverage: coverage });
  assert.deepEqual((await check(repo, path)).anchor_coverage, coverage);
});

test("bare continuations use the most recent path and ASCII numeric grammar agrees across implementations", async (t) => {
  const { repo, sha } = await fixture(t);
  await fs.writeFile(join(repo, "other.txt"), "other one\nother two\n");
  const references = "file.txt:1 `:2`, other.txt:1 `:2`. Unicode description: 看file.txt:3. Unsupported numerals: file.txt:١ `:٢`.";
  const { anchors, coverage } = await captureAnchors(repo, references);
  assert.deepEqual(anchors.map(({ path, start }) => [path, start]), [["file.txt", 1], ["file.txt", 2], ["other.txt", 1], ["other.txt", 2], ["file.txt", 3]]);
  assert.equal(coverage.eligible, 5);
  const path = await manual(repo, references, { git_commit: sha, anchors, anchor_coverage: coverage });
  assert.deepEqual((await check(repo, path)).anchor_coverage, coverage);
});

test("non-files and oversized files are accounted for without capturing their content", async (t) => {
  const { repo } = await fixture(t);
  await fs.mkdir(join(repo, "folder.txt"));
  await fs.writeFile(join(repo, "large.txt"), Buffer.alloc(2 * 1024 * 1024 + 1, 65));
  const { anchors, coverage } = await captureAnchors(repo, "folder.txt:1 and large.txt:1");
  assert.deepEqual(anchors, []);
  assert.equal(coverage.status, "partial");
  assert.deepEqual(coverage.skipped_by_reason, { "not-a-file": 1, "file-too-large": 1 });
});

test("cap and skip samples stay bounded while all citations remain accounted for", async (t) => {
  const { repo, agent } = await fixture(t);
  await fs.writeFile(join(repo, "file.txt"), Array.from({ length: 150 }, (_, i) => `line ${i + 1}`).join("\n"));
  await git(repo, ["add", "file.txt"]); await git(repo, ["commit", "-qm", "many lines"]);
  const references = Array.from({ length: 150 }, (_, i) => `file.txt:${i + 1}`).join(", ");
  const store = (await Records.open(repo, "capped-anchors", agent))!;
  const receipt = await publish(store, { feature: "coverage", kind: "handoff", slug: "cap", body: body + references });
  const coverage = coverageOf(await fs.readFile(join(repo, receipt.path), "utf8"));
  assert.equal(coverage.eligible, 150);
  assert.equal(coverage.captured, 100);
  assert.equal(coverage.skipped_count, 50);
  assert.deepEqual(coverage.skipped_by_reason, { "cap-reached": 50 });
  assert.equal(coverage.skipped.length, 25);
  assert.equal(coverage.skipped[0].reference, "file.txt:101");
  assert.equal(coverage.skipped[24].reference, "file.txt:125");
  const report = await check(repo, receipt.path);
  assert.deepEqual(report.anchor_coverage, coverage);
  assert.equal(report.mode, "mixed"); // Do not label the entire artifact exact because some refs are anchored.
  const human = await run(await python(), ["-I", checker, join(repo, receipt.path), repo], repo);
  assert.match(human, /25 additional skipped reference/);
  assert.match(human, /partial \(100\/150 captured\)/);
  const zeroCap = await captureAnchors(repo, "file.txt:1", 0);
  assert.deepEqual(zeroCap.coverage.skipped_by_reason, { "cap-reached": 1 });
});

test("long skip labels are bounded and explicitly marked as truncated", async (t) => {
  const { repo } = await fixture(t);
  const { coverage } = await captureAnchors(repo, `${"a".repeat(800)}.txt:1`);
  assert.equal(coverage.eligible, 1);
  assert.equal(coverage.skipped_count, 1);
  assert.equal(coverage.skipped[0].reference.length, 512);
  assert.equal(coverage.skipped[0].reference_truncated, true);
});

test("complete coverage of dirty anchors is not a freshness or trust claim", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "dirty-anchors", agent))!;
  await fs.writeFile(join(repo, "file.txt"), "DIRTY\ntwo\nthree\n");
  const receipt = await publish(store, { feature: "coverage", kind: "handoff", slug: "dirty", body: body + "file.txt:1" });
  const report = await check(repo, receipt.path);
  assert.equal(report.anchor_coverage.status, "complete");
  assert.equal(report.counts.uncertain, 1);
  assert.equal(report.counts.fresh, 0);
  assert.match(await citationNote(repo, repo, receipt.path), /Anchor capture: complete \(1\/1 captured\).*1 uncertain/);
});

test("legacy artifacts with or without anchors remain not-recorded, not inferred complete", async (t) => {
  const { repo, sha } = await fixture(t);
  const { anchors } = await captureAnchors(repo, "file.txt:1");
  for (const fields of [{ git_commit: sha }, { git_commit: sha, anchors }]) {
    const path = await manual(repo, "file.txt:1", fields);
    const before = await fs.readFile(join(repo, path), "utf8");
    const report = await check(repo, path);
    assert.deepEqual(report.anchor_coverage, { status: "not-recorded" });
    assert.equal(report.counts.fresh, 1);
    assert.match(await citationNote(repo, repo, path), /Anchor capture: not recorded/);
    assert.equal(await fs.readFile(join(repo, path), "utf8"), before);
  }
  const zero = await manual(repo, "file.txt: verify()", { git_commit: sha });
  assert.match(await citationNote(repo, repo, zero), /not recorded/);
});

test("malformed or contradictory coverage is reported as invalid without blocking freshness checks", async (t) => {
  const { repo, sha } = await fixture(t);
  const { anchors, coverage } = await captureAnchors(repo, "file.txt:1");
  for (const value of [null, [], "bad", { ...coverage, eligible: 2 }, { ...coverage, eligible: true },
    { ...coverage, status: "partial" }, { ...coverage, captured: 0 },
    { status: "partial", eligible: 1, captured: 0, skipped_count: 1, skipped_by_reason: { "unknown-reason": 1 }, skipped: [{ reference: "file.txt:1", reason: "unknown-reason" }] },
    { status: "partial", eligible: 1, captured: 0, skipped_count: 1, skipped_by_reason: { "cap-reached": 1 }, skipped: [{ reference: "file.txt:1", reason: [] }] }]) {
    const path = await manual(repo, "file.txt:1", { git_commit: sha, anchors, anchor_coverage: value });
    const before = await fs.readFile(join(repo, path), "utf8");
    const report = await check(repo, path);
    assert.equal(report.anchor_coverage.status, "invalid", JSON.stringify(value));
    assert.equal(report.counts.fresh, 1);
    assert.match(await citationNote(repo, repo, path), /Anchor capture: invalid/);
    assert.equal(await fs.readFile(join(repo, path), "utf8"), before);
  }
});

test("skip metadata bounds are validated while unknown additive fields remain compatible", async (t) => {
  const { repo, sha } = await fixture(t);
  const { coverage } = await captureAnchors(repo, "file.txt:1", 0);
  for (const bad of [
    { ...coverage, skipped_by_reason: { "cap-reached": 0 } },
    { ...coverage, skipped: [{ ...coverage.skipped[0], reference_truncated: false }] },
    { ...coverage, skipped: [{ ...coverage.skipped[0], reference: "a".repeat(513) }] },
  ]) {
    const path = await manual(repo, "file.txt:1", { git_commit: sha, anchor_coverage: bad });
    assert.equal((await check(repo, path)).anchor_coverage.status, "invalid");
  }
  const path = await manual(repo, "file.txt:1", { git_commit: sha, anchor_coverage: { ...coverage, future_field: "ignored" } });
  assert.equal((await check(repo, path)).anchor_coverage.status, "partial");
});

test("an older checker response is reader-unavailable, not mislabeled as legacy artifact metadata", async (t) => {
  const { dir, repo } = await fixture(t);
  const path = await manual(repo, "symbol-only", { anchor_coverage: { status: "not-applicable", eligible: 0, captured: 0, skipped_count: 0, skipped_by_reason: {}, skipped: [] } });
  const sandbox = join(dir, "old-checker-package");
  await fs.mkdir(join(sandbox, "lib"), { recursive: true });
  await fs.mkdir(join(sandbox, "scripts"));
  await fs.writeFile(join(sandbox, "package.json"), '{"type":"module"}');
  for (const file of ["pickup.ts", "state.ts"]) await fs.copyFile(fileURLToPath(new URL(`../lib/${file}`, import.meta.url)), join(sandbox, "lib", file));
  await fs.writeFile(join(sandbox, "scripts", "check-staleness.py"), 'import json\nprint(json.dumps({"mode": "heuristic", "citations": [], "counts": {}}))\n');
  const isolated = await import(pathToFileURL(join(sandbox, "lib", "pickup.ts")).href);
  const ledger = join(dir, "metrics.jsonl");
  const note = await isolated.citationNote(repo, repo, path, ledger);
  assert.match(note, /Anchor capture: unavailable \(checker did not report coverage/);
  assert.doesNotMatch(note, /Anchor capture: not recorded/);
  assert.equal(JSON.parse((await fs.readFile(ledger, "utf8")).trim()).anchor_coverage.status, "reader-unavailable");
});

test("malformed anchor payloads make coverage invalid but do not crash the advisory checker", async (t) => {
  const { repo, sha } = await fixture(t);
  const { anchors, coverage } = await captureAnchors(repo, "file.txt:1");
  for (const broken of [{ ...anchors[0], path: [] }, { ...anchors[0], start: {} }, "bad", { ...anchors[0], sha256: [] }]) {
    const path = await manual(repo, "file.txt:1", { git_commit: sha, anchors: [broken], anchor_coverage: coverage });
    const report = await check(repo, path);
    assert.equal(report.anchor_coverage.status, "invalid");
    assert.equal(report.mode, "heuristic");
    assert.equal(report.counts.fresh, 1);
  }
});

test("pending retry preserves the original capture snapshot rather than recapturing changed files", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "coverage-retry", agent))!;
  const input = { feature: "coverage", kind: "handoff" as const, slug: "retry", body: body + "file.txt:1" };
  await assert.rejects(publish(store, input, join(repo, "missing-interpreter")));
  const pending = (await store.read()).pending!;
  assert.equal(coverageOf(pending.content).status, "complete");
  await fs.writeFile(join(repo, "file.txt"), "CHANGED AFTER CAPTURE\n");
  const receipt = await publish(store, input);
  assert.equal(receipt.path, pending.path);
  assert.equal(await fs.readFile(join(repo, receipt.path), "utf8"), pending.content);
  assert.equal((await store.read()).pending, undefined);
});

test("unsafe symlink/junction references are counted, never anchored outside the repository", async (t) => {
  const { dir, repo } = await fixture(t);
  const outside = join(dir, "outside"); await fs.mkdir(outside);
  await fs.writeFile(join(outside, "private.txt"), "outside sentinel\n");
  await fs.symlink(outside, join(repo, "linked"), process.platform === "win32" ? "junction" : "dir");
  const { anchors, coverage } = await captureAnchors(repo, "linked/private.txt:1");
  assert.deepEqual(anchors, []);
  assert.deepEqual(coverage.skipped_by_reason, { "unsafe-path": 1 });
  assert.equal(await fs.readFile(join(outside, "private.txt"), "utf8"), "outside sentinel\n");
});

test("unreadable references have an explicit reason instead of silently looking ineligible", { skip: process.platform === "win32" || process.getuid?.() === 0 }, async (t) => {
  const { repo } = await fixture(t);
  const file = join(repo, "file.txt");
  await fs.chmod(file, 0);
  try {
    const { anchors, coverage } = await captureAnchors(repo, "file.txt:1");
    assert.deepEqual(anchors, []);
    assert.equal(coverage.status, "partial");
    assert.deepEqual(coverage.skipped_by_reason, { "read-error": 1 });
  } finally { await fs.chmod(file, 0o644); }
});
