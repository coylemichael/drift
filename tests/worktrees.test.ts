import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { git, hash, Records, WorktreeScopeError } from "../lib/state.ts";
import type { RecordData } from "../lib/state.ts";
import { publish } from "../lib/artifacts.ts";
import type { ArtifactInput } from "../lib/artifacts.ts";

const handoffSections = ["Objective", "Source Documents", "Status", "What Changed", "Codebase Context", "What Deviated from Plan", "Open Questions", "Next Steps"];
const researchSections = ["Research Question", "Summary", "Detailed Findings", "Code References", "Open Questions"];
const body = (sections: string[]) => sections.map((heading) => `## ${heading}\nFixture.\n`).join("\n");
const handoff = (slug: string, extra: Partial<ArtifactInput> = {}): ArtifactInput => ({ feature: "WT", kind: "handoff", slug, body: body(handoffSections), ...extra });
const research = (slug: string): ArtifactInput => ({ feature: "WT", kind: "research", slug, body: body(researchSections) });

async function init(path: string) {
  await fs.mkdir(path, { recursive: true });
  await git(path, ["init", "-q", "-b", "main"]);
  await git(path, ["config", "user.name", "Drift fixture"]);
  await git(path, ["config", "user.email", "drift@example.invalid"]);
}
async function commit(repo: string, message: string) {
  await git(repo, ["add", "-A"]);
  await git(repo, ["-c", "commit.gpgsign=false", "commit", "-qm", message]);
}

/** A main checkout with one linked worktree on branch `feature`; optional committed .drift.json. */
async function fixture(t: any, config?: object) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-wt-")));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const repo = join(dir, "main repo");
  await init(repo);
  await fs.writeFile(join(repo, "file.txt"), "original\n");
  if (config) await fs.writeFile(join(repo, ".drift.json"), JSON.stringify(config));
  await commit(repo, "fixture");
  const wt = join(dir, "feature wt");
  await git(repo, ["worktree", "add", "-q", "-b", "feature", wt]);
  return { dir, repo, wt: await fs.realpath(wt), agent: join(dir, "agent") };
}

const rejects = (promise: Promise<unknown>) => assert.rejects(promise, WorktreeScopeError);

test("adoption archives the old interval with receipts and measures a fresh target interval", async (t) => {
  const { repo, wt, agent } = await fixture(t);
  const store = (await Records.open(repo, "s1", agent))!;
  const receipt = await publish(store, research("before-switch"));
  await fs.writeFile(join(repo, "file.txt"), "main edit\n");
  const before = await store.read();
  assert.equal(await store.effectiveRepo(), repo);
  let called: string | undefined;
  assert.equal(await store.adopt(wt, async (root) => { called = root; await fs.writeFile(join(root, "setup.txt"), "x"); }), true);
  assert.equal(called, wt);
  const after = await store.read();
  assert.equal(before.version, 1);
  assert.equal(after.version, 2, "old publishers must refuse a worktree-aware record rather than use the launch repo");
  assert.equal(after.repo, repo);
  assert.equal(after.sessionId, "s1");
  assert.equal(store.file, join(agent, "drift", hash(repo).slice(0, 24), "s1.json").replace(agent, await fs.realpath(agent)));
  assert.equal(after.worktree, wt);
  assert.equal(await store.effectiveRepo(), wt);
  assert.notEqual(after.intervalId, before.intervalId);
  assert.equal(after.startBranch, "feature");
  assert.deepEqual(Object.keys(after.baseline), ["setup.txt"]);
  assert.deepEqual(after.receipts, []);
  assert.equal(after.previousHandoff, undefined);
  assert.equal(after.history!.length, 1);
  const snap = after.history![0];
  assert.equal(snap.worktree, repo);
  assert.equal(snap.intervalId, before.intervalId);
  assert.equal(snap.started, before.started);
  assert.deepEqual(snap.baseline, before.baseline);
  assert.deepEqual(snap.receipts, [receipt]);
  assert.equal(snap.checkpoint!.reason, "adopt");
  assert.ok(snap.checkpoint!.files.includes("file.txt"));
  assert.equal((snap as any).history, undefined);
  assert.equal(snap.checkpointError, undefined);
  // Nothing published or completed by the switch.
  assert.equal(after.completed, undefined);
  assert.equal(snap.completed, undefined);
  assert.ok(await fs.stat(join(repo, receipt.path)));
});

test("reopen, publication and beginTurn keep the adopted worktree and flat history; context states scope", async (t) => {
  const { repo, wt, agent } = await fixture(t);
  await (await Records.open(repo, "s1", agent))!.adopt(wt);
  const reopened = (await Records.open(repo, "s1", agent))!;
  assert.equal(await reopened.effectiveRepo(), wt);
  await fs.writeFile(join(wt, "file.txt"), "wt edit\n");
  await reopened.checkpoint("settled");
  assert.deepEqual((await reopened.read()).checkpoint!.files, ["file.txt"]);
  const context = await reopened.context();
  assert.match(context, new RegExp(`Measured worktree: ${wt.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}`));
  assert.match(context, /Record anchor \(launch repository\)/);
  assert.match(context, /Artifact store: .*\(private: ignored by Git\)/);
  assert.match(context, /file-tool defaults are unchanged/);
  assert.match(context, /not exclusive authorship/);
  const receipt = await publish(reopened, handoff("in-wt"));
  assert.ok(await fs.stat(join(repo, receipt.path)), "private artifacts live in the main worktree's store");
  const completed = await reopened.read();
  await reopened.beginTurn();
  const next = await reopened.read();
  assert.notEqual(next.intervalId, completed.intervalId);
  assert.equal(next.version, 2);
  assert.equal(next.worktree, wt);
  assert.deepEqual(next.history, completed.history);
  assert.equal(next.previousHandoff, receipt.path);
  assert.equal(next.startBranch, "feature");
});

test("same-target adoption is a no-op even with a pending publication; switching back measures fresh", async (t) => {
  const { repo, wt, agent } = await fixture(t);
  const store = (await Records.open(repo, "s1", agent))!;
  assert.equal(await store.adopt(repo, async () => assert.fail("no callback for a no-op")), false);
  await store.adopt(wt);
  const record = await store.read();
  const content = "---\nfixture\n---\n";
  const pending = { digest: "a".repeat(64), path: "drift/WT/001-research-x.md", kind: "research", date: record.started, sha256: hash(content), content };
  await store.save({ ...record, pending });
  const text = await fs.readFile(store.file, "utf8");
  assert.equal(await store.adopt(wt, async () => assert.fail("no callback for a no-op")), false);
  assert.equal(await fs.readFile(store.file, "utf8"), text);
  await assert.rejects(store.adopt(repo), /Incomplete publication/);
  assert.equal(await fs.readFile(store.file, "utf8"), text);
  await store.save(record);
  assert.equal(await store.adopt(repo), true);
  const back = await store.read();
  assert.equal(back.version, 2, "switching back must not let old publishers discard worktree history");
  assert.equal(back.worktree, undefined);
  assert.equal(back.startBranch, "main");
  assert.notEqual(back.intervalId, record.intervalId);
  assert.deepEqual(back.history!.map((s) => s.worktree), [repo, wt]);
  assert.ok(back.history!.every((s) => !("history" in s)));
});

test("two sessions adopt independently", async (t) => {
  const { repo, wt, agent } = await fixture(t);
  const a = (await Records.open(repo, "a", agent))!;
  const b = (await Records.open(repo, "b", agent))!;
  const bText = await fs.readFile(b.file, "utf8");
  await a.adopt(wt);
  assert.equal(await fs.readFile(b.file, "utf8"), bText);
  assert.equal(await b.effectiveRepo(), repo);
  assert.equal(await a.effectiveRepo(), wt);
});

test("targets outside this repository's worktree roots are refused without rewriting the record", async (t) => {
  const { dir, repo, wt, agent } = await fixture(t);
  const store = (await Records.open(repo, "s1", agent))!;
  const text = await fs.readFile(store.file, "utf8");
  const clone = join(dir, "clone");
  await git(dir, ["clone", "-q", repo, clone]);
  const plain = join(dir, "plain");
  await fs.mkdir(plain);
  const nested = join(repo, "nested");
  await init(nested);
  await fs.mkdir(join(wt, "sub"));
  await rejects(store.adopt(clone));
  await rejects(store.adopt(plain));
  await rejects(store.adopt(nested));
  await rejects(store.adopt(join(wt, "sub")));
  await rejects(store.adopt(join(dir, "missing")));
  await rejects(store.adopt("feature wt"));
  await rejects(store.adopt(join(repo, "file.txt")));
  assert.equal(await fs.readFile(store.file, "utf8"), text);
  // An unborn worktree root of the same repository is valid.
  const orphan = join(dir, "orphan");
  await git(repo, ["worktree", "add", "-q", "--orphan", "-b", "empty", orphan]);
  assert.equal(await store.adopt(orphan), true);
  assert.equal((await store.read()).startCommit, null);
});

test("corrupt worktree/history fields fail closed without overwrite", async (t) => {
  const { repo, wt, agent } = await fixture(t);
  const store = (await Records.open(repo, "s1", agent))!;
  await store.adopt(wt);
  const record = await store.read();
  const corrupt: any[] = [
    { ...record, version: 1 },
    { ...record, worktree: "relative/path" },
    { ...record, worktreeIdentity: undefined },
    { ...record, worktreeIdentity: "not-an-identity" },
    { ...record, history: { not: "an array" } },
    { ...record, history: [{ ...record.history![0], history: [] }] },
    { ...record, history: [{ ...record.history![0], worktree: 7 }] },
    { ...record, history: [{ ...record.history![0], baseline: null }] },
  ];
  for (const value of corrupt) {
    const text = JSON.stringify(value);
    await fs.writeFile(store.file, text);
    await assert.rejects(store.read(), /Invalid or mismatched/);
    await assert.rejects(store.adopt(repo), /Invalid or mismatched/);
    await assert.rejects(store.beginTurn(), /Invalid or mismatched/);
    assert.equal(await fs.readFile(store.file, "utf8"), text);
  }
});

test("a removed or replaced adopted worktree never falls back; explicit recovery keeps the previous checkpoint", async (t) => {
  const { repo, wt, agent } = await fixture(t);
  const store = (await Records.open(repo, "s1", agent))!;
  await store.adopt(wt);
  await fs.writeFile(join(wt, "file.txt"), "wt edit\n");
  await store.checkpoint("settled");
  const checkpoint = (await store.read()).checkpoint;
  await git(repo, ["worktree", "remove", "--force", wt]);
  await rejects(store.effectiveRepo());
  await rejects(store.checkpoint("again"));
  assert.match(await store.context(), /Measured worktree: UNAVAILABLE/);
  await assert.rejects(publish(store, handoff("lost")), WorktreeScopeError);
  // A different repository now at the same path is "replaced", not the adopted worktree.
  await init(wt);
  await rejects(store.effectiveRepo());
  const text = await fs.readFile(store.file, "utf8");
  await rejects(store.adopt(wt));
  assert.equal(await fs.readFile(store.file, "utf8"), text);
  assert.equal(await store.adopt(repo), true);
  const recovered = await store.read();
  assert.equal(recovered.worktree, undefined);
  const snap = recovered.history!.at(-1)!;
  assert.equal(snap.worktree, wt);
  assert.deepEqual(snap.checkpoint, checkpoint);
  assert.match(snap.checkpointError!, /Final capture impossible/);
  assert.equal(snap.completed, undefined);
});

test("recycling the same worktree path in the same repository requires a fresh adoption", async (t) => {
  const { repo, wt, agent } = await fixture(t);
  const store = (await Records.open(repo, "s1", agent))!;
  await store.adopt(wt);
  const before = await store.read();
  await git(repo, ["worktree", "remove", wt]);
  await git(repo, ["worktree", "add", "-q", "-b", "replacement", wt]);
  await assert.rejects(store.effectiveRepo(), /removed or recreated/);
  await assert.rejects(publish(store, handoff("recycled")), WorktreeScopeError);
  assert.deepEqual(await store.read(), before);
  assert.equal(await store.adopt(wt), true);
  const after = await store.read();
  assert.notEqual(after.worktreeIdentity, before.worktreeIdentity);
  assert.notEqual(after.intervalId, before.intervalId);
  assert.equal(after.startBranch, "replacement");
  assert.equal(after.history!.at(-1)!.worktreeIdentity, before.worktreeIdentity);
  assert.match(after.history!.at(-1)!.checkpointError!, /Final capture impossible/);
  assert.equal(await store.effectiveRepo(), wt);
});

test("tracked artifacts publish into the adopted worktree", async (t) => {
  const { repo, wt, agent } = await fixture(t, { trackArtifacts: true });
  const store = (await Records.open(repo, "s1", agent))!;
  await store.adopt(wt);
  const receipt = await publish(store, handoff("tracked"));
  assert.ok(await fs.stat(join(wt, receipt.path)));
  assert.equal(await fs.stat(join(repo, "drift")).catch(() => undefined), undefined);
  assert.match(await store.context(), /Artifact store: .*feature wt.*\(tracked: committed per worktree\)/);
});

test("private artifacts stay in the main store while metadata and fragments come from the adopted worktree", async (t) => {
  const { repo, wt, agent } = await fixture(t, { changelog: true });
  const store = (await Records.open(repo, "s1", agent))!;
  await store.adopt(wt);
  const receipt = await publish(store, handoff("private", { changelog: { section: "Added", text: "- Worktree adoption." } }));
  const content = await fs.readFile(join(repo, receipt.path), "utf8");
  assert.match(content, /^branch: "feature"$/m);
  assert.match(content, new RegExp(`^git_commit: "${(await git(wt, ["rev-parse", "HEAD"])).trim()}"$`, "m"));
  assert.ok(await fs.stat(join(wt, receipt.fragment!)));
  assert.equal(await fs.stat(join(repo, receipt.fragment!)).catch(() => undefined), undefined);
  assert.equal(await fs.stat(join(wt, "drift")).catch(() => undefined), undefined);
});

test("concurrent adoption and publication serialize on the record lock", async (t) => {
  const { repo, wt, agent } = await fixture(t, { trackArtifacts: true });
  const store = (await Records.open(repo, "s1", agent))!;
  const started = (await store.read()).intervalId;
  const [switched, receipt] = await Promise.all([store.adopt(wt), publish(store, research("race"))]);
  assert.equal(switched, true);
  const record: RecordData = await store.read();
  const archived = record.history![0];
  const inMain = archived.receipts.some((r) => r.digest === receipt.digest);
  const inWt = record.receipts.some((r) => r.digest === receipt.digest);
  assert.ok(inMain !== inWt, "the receipt belongs to exactly one interval");
  assert.equal(archived.intervalId, started);
  const content = await fs.readFile(join(inMain ? repo : wt, receipt.path), "utf8");
  assert.match(content, new RegExp(`^branch: "${inMain ? "main" : "feature"}"$`, "m"));
  assert.match(content, new RegExp(`^interval_id: "${inMain ? started : record.intervalId}"$`, "m"));
});
