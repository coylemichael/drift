import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { atomicWrite, delta, fingerprint, git, python, Records, run, safePath, withLock } from "../lib/state.ts";
import { enableArtifactTracking, publish, syncIndex } from "../lib/artifacts.ts";
import type { ArtifactInput } from "../lib/artifacts.ts";
import { loadModelProfiles, readHandoffRoute } from "../lib/routing.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const sections = ["Objective", "Source Documents", "Status", "What Changed", "Codebase Context", "What Deviated from Plan", "Open Questions", "Next Steps"];
const body = sections.map((heading) => `## ${heading}\nA bounded fixture investigation.\n`).join("\n");
const input: ArtifactInput = { feature: "TEST-1", kind: "handoff", slug: "fixture", body };

async function fixture(t: any) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-test-")));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo with spaces");
  await fs.mkdir(repo);
  await git(repo, ["init", "-q"]);
  await git(repo, ["config", "user.name", "Drift fixture"]);
  await git(repo, ["config", "user.email", "drift@example.invalid"]);
  await fs.writeFile(join(repo, "file.txt"), "original\n");
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "fixture"]);
  return { dir, repo, agent: join(dir, "agent") };
}

function child(script: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk; });
    proc.on("error", reject);
    proc.on("exit", (code) => code === 0 ? resolve() : reject(new Error(stderr)));
  });
}

test("durable open is idempotent; completed intervals only rotate on a new working turn", async (t) => {
  const { repo, agent } = await fixture(t);
  await fs.writeFile(join(repo, "inherited.txt"), "pre-existing\n");
  const a = (await Records.open(repo, "session-a", agent))!;
  const initial = await a.read();
  assert.deepEqual(Object.keys(initial.baseline), ["inherited.txt"]);
  assert.match(initial.started, /[+-]\d\d:\d\d$/);
  if (process.platform !== "win32") assert.equal((await fs.stat(a.file)).mode & 0o777, 0o600);
  assert.deepEqual(await (await Records.open(repo, "session-a", agent))!.read(), initial);
  await a.beginTurn();
  assert.deepEqual(await a.read(), initial);
  await fs.writeFile(join(repo, "file.txt"), "modified\n");
  await a.checkpoint("settled");
  assert.deepEqual((await a.read()).checkpoint!.files, ["file.txt"]);
  const receipt = await publish(a, input);
  const completed = await fs.readFile(a.file, "utf8");
  await a.checkpoint("detach:quit");
  assert.equal(await fs.readFile(a.file, "utf8"), completed);
  const resumed = (await Records.open(repo, "session-a", agent))!;
  assert.equal((await resumed.read()).completed!.path, receipt.path);
  await resumed.beginTurn();
  const next = await resumed.read();
  assert.notEqual(next.intervalId, initial.intervalId);
  assert.equal(next.previousHandoff, receipt.path);
  assert.equal(next.completed, undefined);
  // Publication added .gitignore; it is inherited by the subsequent work interval too.
  assert.deepEqual(Object.keys(next.baseline), [".gitignore", "file.txt", "inherited.txt"]);
});

test("distinct Pi sessions and fork identities never adopt or complete another record", async (t) => {
  const { repo, agent } = await fixture(t);
  const a = (await Records.open(repo, "session-a", agent))!;
  await fs.writeFile(join(repo, "file.txt"), "A work\n");
  const b = (await Records.open(repo, "session-b", agent))!;
  const before = await fs.readFile(b.file, "utf8");
  await publish(a, input);
  assert.equal(await fs.readFile(b.file, "utf8"), before);
  assert.notEqual((await a.read()).intervalId, (await b.read()).intervalId);
  assert.deepEqual(Object.keys((await b.read()).baseline), ["file.txt"]);
});

test("fingerprints detect same-size tracked/untracked/binary/Unicode edits and unchanged inherited dirt", async (t) => {
  const { repo, agent } = await fixture(t);
  await fs.writeFile(join(repo, "file.txt"), "dirty A\n");
  await fs.writeFile(join(repo, "café.txt"), Buffer.from("bin\0one"));
  const a = (await Records.open(repo, "session-a", agent))!;
  const before = (await a.read()).baseline;
  assert.deepEqual(delta(before, await fingerprint(repo)), []);
  await fs.writeFile(join(repo, "file.txt"), "dirty B\n");
  await fs.writeFile(join(repo, "café.txt"), Buffer.from("bin\0two"));
  assert.deepEqual(delta(before, await fingerprint(repo)), ["café.txt", "file.txt"]);
  await git(repo, ["add", "."]);
  await git(repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "during interval"]);
  await a.checkpoint("settled");
  assert.deepEqual((await a.read()).checkpoint!.files, ["café.txt", "file.txt"]);
  assert.equal((await a.read()).checkpoint!.commits.length, 1);
});

test("unborn repositories and non-Git cwd are handled without invented commits or nested guessing", async (t) => {
  const { dir, agent } = await fixture(t);
  assert.equal(await Records.open(dir, "session-a", agent), undefined);
  const repo = join(dir, "unborn"); await fs.mkdir(repo); await git(repo, ["init", "-q"]);
  await fs.writeFile(join(repo, "new.txt"), "staged\n"); await git(repo, ["add", "."]);
  const state = await (await Records.open(repo, "session-b", agent))!.read();
  assert.equal(state.startCommit, null);
  assert.deepEqual(Object.keys(state.baseline), ["new.txt"]);
});

test("corrupt/mismatched records and invalid session IDs are refused without overwrite", async (t) => {
  const { repo, agent } = await fixture(t);
  await assert.rejects(Records.open(repo, "../other", agent), /identity/);
  const store = (await Records.open(repo, "session-a", agent))!;
  const original = await store.read();
  for (const text of ["{broken", JSON.stringify({ ...original, sessionId: "session-b" }), JSON.stringify({ ...original, completed: {} })]) {
    await fs.writeFile(store.file, text);
    await assert.rejects(Records.open(repo, "session-a", agent));
    assert.equal(await fs.readFile(store.file, "utf8"), text);
  }
});

test("publication supplies original metadata, stable numbering, references and a canonical index", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  const baseline = await store.read();
  const research: ArtifactInput = { feature: "TEST-1", kind: "research", slug: "facts", body: ["Research Question", "Summary", "Detailed Findings", "Code References", "Open Questions"].map((heading) => `## ${heading}\nObserved fact.\n`).join("\n") };
  const first = await publish(store, research);
  assert.equal((await store.read()).completed, undefined);
  const second = await publish(store, { ...input, source_research: first.path, related_artifacts: [first.path] });
  assert.match(first.path, /001-research-facts.md$/);
  assert.match(second.path, /002-handoff-fixture.md$/);
  const text = await fs.readFile(join(repo, second.path), "utf8");
  assert.ok(text.includes(`session_started: ${JSON.stringify(baseline.started)}`));
  assert.ok(text.includes(`start_commit: ${JSON.stringify(baseline.startCommit)}`));
  assert.ok(text.includes(`source_research: ${JSON.stringify(first.path)}`));
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), "/drift/\n");
  await run(await python(), [join(root, "scripts/build-index.py"), join(repo, "drift"), "--check"], repo);
});

test("repo-local tracked artifacts publish without creating ignores or staging files", async (t) => {
  const { repo, agent, dir } = await fixture(t);
  await fs.writeFile(join(repo, ".drift.json"), '{"trackArtifacts":true}\n');
  const store = (await Records.open(repo, "session-a", agent))!;
  const receipt = await publish(store, input);
  assert.deepEqual(await publish(store, input), receipt);
  await assert.rejects(fs.stat(join(repo, ".gitignore")), { code: "ENOENT" });
  const visible = (await git(repo, ["ls-files", "--others", "--exclude-standard"])).trim().split("\n");
  assert.ok(visible.includes(receipt.path));
  assert.ok(visible.includes("drift/INDEX.md"));
  assert.equal(await git(repo, ["diff", "--cached", "--name-only"]), "");
  await run(await python(), [join(root, "scripts/build-index.py"), join(repo, "drift"), "--check"], repo);

  // Explicitly committing is the user's job; the choice and handoff travel together.
  await git(repo, ["add", ".drift.json", "drift"]);
  await git(repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "portable artifacts"]);
  const clone = join(dir, "another machine");
  await git(repo, ["clone", "--no-hardlinks", "-q", repo, clone]);
  assert.equal(await fs.readFile(join(clone, receipt.path), "utf8"), await fs.readFile(join(repo, receipt.path), "utf8"));
  const other = (await Records.open(clone, "session-b", agent))!;
  const next = await publish(other, { ...input, slug: "next-machine" });
  assert.match(next.path, /002-handoff-next-machine.md$/);
  await assert.rejects(fs.stat(join(clone, ".gitignore")), { code: "ENOENT" });
});

test("tracked mode preserves existing ignore rules, negation and permissions", async (t) => {
  const { repo, agent } = await fixture(t);
  const ignore = "logs/*\n/drift/\n!/drift/\n";
  await fs.writeFile(join(repo, ".gitignore"), ignore);
  await fs.chmod(join(repo, ".gitignore"), 0o640);
  await fs.writeFile(join(repo, ".drift.json"), '{"trackArtifacts":true}');
  const store = (await Records.open(repo, "session-a", agent))!;
  await publish(store, input);
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), ignore);
  if (process.platform !== "win32") assert.equal((await fs.stat(join(repo, ".gitignore"))).mode & 0o777, 0o640);
});

test("explicit false and empty config retain ignored-by-default publication", async (t) => {
  for (const config of [{ trackArtifacts: false }, {}]) {
    const { repo, agent } = await fixture(t);
    await fs.writeFile(join(repo, ".drift.json"), JSON.stringify(config));
    await fs.writeFile(join(repo, ".gitignore"), "logs/*");
    const store = (await Records.open(repo, "session-a", agent))!;
    const receipt = await publish(store, input);
    assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), "logs/*\n/drift/\n");
    assert.ok((await git(repo, ["check-ignore", "--no-index", receipt.path])).trim());
  }
});

test("invalid repo flags fail before artifact/ignore writes and never complete the interval", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  for (const text of ["{broken", "null", "true", "[]", '{"trackArtifacts":"true"}',
                      '{"trackArtifacts":1}', '{"trackArtifacts":null}', '{"trackArtifact":true}']) {
    await fs.writeFile(join(repo, ".drift.json"), text);
    await assert.rejects(publish(store, input), /Drift configuration/);
    await assert.rejects(fs.stat(join(repo, "drift")), { code: "ENOENT" });
    await assert.rejects(fs.stat(join(repo, ".gitignore")), { code: "ENOENT" });
    assert.equal((await store.read()).pending, undefined);
    assert.equal((await store.read()).completed, undefined);
  }
});

test("tracked policy conflicts are actionable and never rewrite ignores or force-add", async (t) => {
  const { repo, agent } = await fixture(t);
  await fs.writeFile(join(repo, ".drift.json"), '{"trackArtifacts":true}');
  const store = (await Records.open(repo, "session-a", agent))!;
  for (const ignore of ["/drift/\n", "/drift/INDEX.md\n", "*.md\n"]) {
    await fs.writeFile(join(repo, ".gitignore"), ignore);
    await assert.rejects(publish(store, input), /trackArtifacts is true.*Git ignores/);
    assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), ignore);
    assert.equal(await git(repo, ["diff", "--cached", "--name-only"]), "");
    assert.deepEqual(await fs.readdir(join(repo, "drift/TEST-1")), []);
    assert.equal((await store.read()).pending, undefined);
    assert.equal((await store.read()).completed, undefined);
  }
  await fs.writeFile(join(repo, ".gitignore"), "logs/*\n");
  assert.match((await publish(store, input)).path, /001-handoff-fixture.md$/);
});

test("tracking existing artifacts or un-ignoring alone never implies repo opt-in", async (t) => {
  const { repo, agent } = await fixture(t);
  await fs.mkdir(join(repo, "drift/old"), { recursive: true });
  await fs.writeFile(join(repo, "drift/old/context.md"), "existing context\n");
  await git(repo, ["add", "drift/old/context.md"]);
  const staged = await git(repo, ["diff", "--cached", "--name-only"]);
  const ignore = "/drift/\n!/drift/\n";
  await fs.writeFile(join(repo, ".gitignore"), ignore);
  const store = (await Records.open(repo, "session-a", agent))!;
  await assert.rejects(publish(store, input), /explicitly set.*trackArtifacts.*\.drift\.json/);
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), ignore);
  assert.equal(await git(repo, ["diff", "--cached", "--name-only"]), staged);
  assert.equal((await store.read()).completed, undefined);
});

test("repo configuration is root-scoped, bounded and symlink-safe", async (t) => {
  const { repo, agent, dir } = await fixture(t);
  const nested = join(repo, "nested"); await fs.mkdir(nested);
  await fs.writeFile(join(nested, ".drift.json"), '{"trackArtifacts":true}');
  const store = (await Records.open(nested, "session-a", agent))!;
  const receipt = await publish(store, input);
  assert.ok((await git(repo, ["check-ignore", "--no-index", receipt.path])).trim());
  const other = (await Records.open(repo, "session-b", agent))!;
  const config = join(repo, ".drift.json");
  await fs.mkdir(config);
  await assert.rejects(publish(other, input), /regular file/);
  await fs.rmdir(config);
  await fs.writeFile(config, " ".repeat(64 * 1024 + 1));
  await assert.rejects(publish(other, input), /64 KiB/);
  if (process.platform !== "win32") {
    await fs.unlink(config);
    const outside = join(dir, "external-config.json");
    await fs.writeFile(outside, '{"trackArtifacts":true}');
    await fs.symlink(outside, config);
    await assert.rejects(publish(other, input), /symlink/);
    assert.equal(await fs.readFile(outside, "utf8"), '{"trackArtifacts":true}');
  }
  assert.equal((await other.read()).completed, undefined);
});

test("publication rereads the repo flag rather than caching the first choice", async (t) => {
  const { repo, agent } = await fixture(t);
  const config = join(repo, ".drift.json");
  await fs.writeFile(config, '{"trackArtifacts":true}');
  const store = (await Records.open(repo, "session-a", agent))!;
  const research: ArtifactInput = { feature: "TEST-1", kind: "research", slug: "first", body: ["Research Question", "Summary", "Detailed Findings", "Code References", "Open Questions"].map((heading) => `## ${heading}\nObserved fact.\n`).join("\n") };
  await publish(store, research);
  await assert.rejects(fs.stat(join(repo, ".gitignore")), { code: "ENOENT" });
  await fs.writeFile(config, '{"trackArtifacts":false}');
  await publish(store, { ...research, slug: "second" });
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), "/drift/\n");
  await fs.writeFile(config, '{"trackArtifacts":true}');
  await assert.rejects(publish(store, input), /trackArtifacts is true.*Git ignores/);
  await fs.unlink(join(repo, ".gitignore"));
  assert.match((await publish(store, input)).path, /003-handoff-fixture.md$/);
});

test("ignored default validates the index too, not only the artifact path", async (t) => {
  const { repo, agent } = await fixture(t);
  // A file negation only works when its parent directory is unignored too.
  const ignore = "/drift/\n!/drift/\n/drift/*\n!/drift/INDEX.md\n";
  await fs.writeFile(join(repo, ".gitignore"), ignore);
  const store = (await Records.open(repo, "session-a", agent))!;
  await assert.rejects(publish(store, input), /Git does not ignore.*INDEX.md/);
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), ignore);
  assert.equal((await store.read()).pending, undefined);
  assert.equal((await store.read()).completed, undefined);
});

test("tracked publication retains normal pending-intent and replay safety", async (t) => {
  const { repo, agent } = await fixture(t);
  await fs.writeFile(join(repo, ".drift.json"), '{"trackArtifacts":true}');
  const store = (await Records.open(repo, "session-a", agent))!;
  await assert.rejects(publish(store, input, join(repo, "missing-python")), /failed/);
  const pending = (await store.read()).pending!;
  assert.ok(pending);
  assert.equal((await store.read()).completed, undefined);
  assert.equal(await fs.readFile(join(repo, pending.path), "utf8"), pending.content);
  const receipt = await publish(store, input);
  assert.deepEqual(await publish(store, input), receipt);
  assert.equal((await store.read()).receipts.length, 1);
  await assert.rejects(fs.stat(join(repo, ".gitignore")), { code: "ENOENT" });
});

test("a normal negative Git query is allowed but other Git failures are not", async (t) => {
  const { repo } = await fixture(t);
  assert.equal(await git(repo, ["check-ignore", "--no-index", "not-ignored.txt"], 1), "");
  await assert.rejects(git(repo, ["check-ignore", "--unsupported-fixture-option"], 1), /git failed/);
});

test("handoff next-session profiles are persisted and restricted to handoffs", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  const receipt = await publish(store, { ...input, next_session_profile: "architecture" });
  const frontmatter = (await fs.readFile(join(repo, receipt.path), "utf8")).split("---\n")[1];
  assert.ok(frontmatter.includes('next_session_profile: "architecture"'));
  const other = (await Records.open(repo, "session-b", agent))!;
  await assert.rejects(publish(other, { ...input, kind: "research", body: ["Research Question", "Summary", "Detailed Findings", "Code References", "Open Questions"].map((heading) => `## ${heading}\nObserved fact.\n`).join(""), next_session_profile: "architecture" }), /handoff/);
  await assert.rejects(publish(other, { ...input, next_session_profile: "Architecture Review" }), /lowercase/);
});

test("artifact status defaults per kind and only accepts the states a new artifact can start in", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  const research: ArtifactInput = { feature: "TEST-1", kind: "research", slug: "facts", body: ["Research Question", "Summary", "Detailed Findings", "Code References", "Open Questions"].map((heading) => `## ${heading}\nObserved fact.\n`).join("\n") };
  const plan: ArtifactInput = { feature: "TEST-1", kind: "plan", slug: "steps", body: ["Objective", "Source Research", "Starting Point", "Key Files", "Implementation Sequence", "Decisions & Constraints", "Open Questions"].map((heading) => `## ${heading}\nPlanned step.\n`).join("\n") };
  const status = async (path: string) => /^status: (.*)$/m.exec((await fs.readFile(join(repo, path), "utf8")).split("---\n")[1])![1];
  await assert.rejects(publish(store, { ...research, status: "pending" }), /research must have status complete/);
  await assert.rejects(publish(store, { ...plan, status: "superseded" }), /plan must have status pending/);
  await assert.rejects(publish(store, { ...input, status: "Done for now" }), /in-progress or complete/);
  assert.equal(await status((await publish(store, research)).path), '"complete"');
  assert.equal(await status((await publish(store, plan)).path), '"pending"');
  assert.equal(await status((await publish(store, { ...input, status: "complete" })).path), '"complete"');
  const other = (await Records.open(repo, "session-b", agent))!;
  assert.equal(await status((await publish(other, input)).path), '"in-progress"');
});

test("model profile configuration and handoff route parsing stay local and path-safe", async (t) => {
  const { repo, agent } = await fixture(t);
  await fs.mkdir(agent, { recursive: true });
  await fs.writeFile(join(agent, "drift-model-profiles.json"), JSON.stringify({ profiles: {
    implementation: { provider: "global", model: "global-model", thinkingLevel: "medium" },
  } }));
  await fs.mkdir(join(repo, ".pi"));
  await fs.writeFile(join(repo, ".pi/drift-model-profiles.json"), JSON.stringify({ profiles: {
    implementation: { provider: "project", model: "project-model", thinkingLevel: "high" },
    architecture: { provider: "project", model: "architecture-model" },
  } }));
  const trusted = await loadModelProfiles(repo, agent, true);
  assert.deepEqual(trusted.implementation, { provider: "project", model: "project-model", thinkingLevel: "high" });
  assert.deepEqual(trusted.architecture, { provider: "project", model: "architecture-model" });
  assert.deepEqual(await loadModelProfiles(repo, agent, false), {
    implementation: { provider: "global", model: "global-model", thinkingLevel: "medium" },
  });
  const handoff = "drift/routing/001-handoff-fixture.md";
  await fs.mkdir(join(repo, "drift/routing"), { recursive: true });
  await fs.writeFile(join(repo, handoff), '---\ntype: "handoff"\nnext_session_profile: "architecture"\n---\n\n## Next Steps\nResume.\n');
  assert.deepEqual(await readHandoffRoute(repo, handoff), { path: handoff, profile: "architecture" });
  await fs.writeFile(join(repo, "drift/routing/000-handoff-plain.md"), "---\ntype: handoff\nnext_session_profile: implementation\n---\n");
  assert.deepEqual(await readHandoffRoute(repo, "drift/routing/000-handoff-plain.md"), { path: "drift/routing/000-handoff-plain.md", profile: "implementation" });
  await assert.rejects(readHandoffRoute(repo, "../outside.md"), /repository-relative/);
  await fs.writeFile(join(repo, "drift/routing/002-handoff-unprofiled.md"), '---\ntype: "handoff"\n---\n');
  await assert.rejects(readHandoffRoute(repo, "drift/routing/002-handoff-unprofiled.md"), /no next_session_profile/);
  if (process.platform !== "win32") {
    await fs.writeFile(join(repo, "outside-handoff.md"), '---\ntype: "handoff"\nnext_session_profile: "architecture"\n---\n');
    await fs.symlink(join(repo, "outside-handoff.md"), join(repo, "drift/routing/003-handoff-linked.md"));
    await assert.rejects(readHandoffRoute(repo, "drift/routing/003-handoff-linked.md"), /symlink/);
  }
});

test("blank optional references are absent, while non-empty paths remain strict", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  const blank = { ...input, source_research: "", previous_handoff: "  ", related_artifacts: ["", " \t"], next_session_profile: "  " };
  const receipt = await publish(store, blank);
  assert.deepEqual(await publish(store, { ...input, related_artifacts: [] }), receipt);
  const frontmatter = (await fs.readFile(join(repo, receipt.path), "utf8")).split("---\n")[1];
  assert.ok(!frontmatter.includes("source_research:"));
  assert.ok(!frontmatter.includes("previous_handoff:"));
  assert.ok(!frontmatter.includes("next_session_profile:"));
  const other = (await Records.open(repo, "session-b", agent))!;
  for (const bad of [{ source_research: "README.md" }, { related_artifacts: ["", "../outside.md"] }, { source_research: false }, { related_artifacts: [null] }, { related_artifacts: "not-an-array" }]) {
    await assert.rejects(publish(other, { ...input, ...bad } as any));
  }
  assert.equal((await other.read()).pending, undefined);
  assert.equal((await other.read()).completed, undefined);
});

test("index failure leaves retryable intent; retry is idempotent and does not consume early", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  await assert.rejects(publish(store, input, join(repo, "missing-python")), /failed/);
  const pending = (await store.read()).pending!;
  assert.ok(pending);
  assert.equal((await store.read()).completed, undefined);
  assert.equal(await fs.readFile(join(repo, pending.path), "utf8"), pending.content);
  await assert.rejects(publish(store, { ...input, slug: "different" }), /SAME/);
  const receipt = await publish(store, input);
  assert.equal(receipt.path, pending.path);
  assert.equal((await store.read()).pending, undefined);
  const duplicate = await publish(store, input);
  assert.deepEqual(duplicate, receipt);
  assert.equal((await store.read()).receipts.length, 1);
  assert.equal((await fs.readdir(join(repo, "drift/TEST-1"))).length, 1);
  await fs.appendFile(join(repo, receipt.path), "external change\n");
  await assert.rejects(publish(store, input), /removed or changed/);
});

test("invalid bodies, traversal and missing references fail before publication", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  for (const invalid of [{ feature: "../escape" }, { slug: "../../outside" }, { body: "---\ndate: invented\n---\n" }, { body: "No required sections" }, { source_research: "../SKILL.md" }, { source_research: "drift/no-file.md" }]) {
    await assert.rejects(publish(store, { ...input, ...invalid }));
  }
  assert.equal((await store.read()).completed, undefined);
  await assert.rejects(fs.stat(join(repo, "drift")), { code: "ENOENT" });
});

test("managed symlinks and escapes are refused; unrelated targets remain intact", { skip: process.platform === "win32" }, async (t) => {
  const { repo, agent, dir } = await fixture(t);
  const outside = join(dir, "outside"); await fs.mkdir(outside);
  await fs.writeFile(join(outside, "sentinel"), "untouched");
  const store = (await Records.open(repo, "session-a", agent))!;
  await fs.symlink(outside, join(repo, "drift"));
  await assert.rejects(publish(store, input), /symlink/);
  assert.deepEqual(await fs.readdir(outside), ["sentinel"]);
  await assert.rejects(safePath(repo, join(repo, "../outside")), /escapes/);
  await fs.unlink(join(repo, "drift")); await fs.mkdir(join(repo, "drift"));
  await fs.symlink(join(outside, "sentinel"), join(repo, "drift/INDEX.md"));
  await assert.rejects(publish(store, input), /symlink/);
  assert.equal(await fs.readFile(join(outside, "sentinel"), "utf8"), "untouched");
});

test("multiple processes allocate different artifact numbers and preserve every index row", async (t) => {
  const { repo, agent } = await fixture(t);
  const script = `import { Records } from ${JSON.stringify(new URL("../lib/state.ts", import.meta.url).href)};
    import { publish } from ${JSON.stringify(new URL("../lib/artifacts.ts", import.meta.url).href)};
    const [repo, agent, id, body] = process.argv.slice(1);
    const store = await Records.open(repo,id,agent);
    await publish(store,{feature:'parallel',kind:'handoff',slug:id,body});`;
  await Promise.all(["one", "two", "three"].map((id) => child(script, [repo, agent, id, body])));
  const paths = await fs.readdir(join(repo, "drift/parallel"));
  assert.deepEqual(paths.map((path) => path.slice(0, 3)).sort(), ["001", "002", "003"]);
  const index = await fs.readFile(join(repo, "drift/INDEX.md"), "utf8");
  assert.equal(index.split("\n").filter((line) => /^\| \d+ \|/.test(line)).length, 3);
  await run(await python(), [join(root, "scripts/build-index.py"), join(repo, "drift"), "--check"], repo);
});

test("busy locks fail visibly and are never silently reaped", async (t) => {
  const { dir } = await fixture(t);
  const lock = join(dir, "busy.lock"); await fs.mkdir(lock);
  await fs.writeFile(join(lock, "owner.json"), "owner evidence");
  await assert.rejects(withLock(lock, async () => undefined, 10), /busy/);
  assert.equal(await fs.readFile(join(lock, "owner.json"), "utf8"), "owner evidence");
});

test("unreadable files use explicit metadata-only fingerprints without hiding readable changes", { skip: process.platform === "win32" || process.getuid?.() === 0 }, async (t) => {
  const { repo, agent } = await fixture(t);
  const path = join(repo, "unreadable.txt"); await fs.writeFile(path, "private local fixture\n"); await fs.chmod(path, 0);
  const store = (await Records.open(repo, "session-a", agent))!;
  assert.match((await store.read()).baseline["unreadable.txt"], /^unreadable:/);
  assert.match(await store.context(), /metadata-only/);
  await fs.writeFile(join(repo, "file.txt"), "modified\n"); await store.checkpoint("settled");
  assert.deepEqual((await store.read()).checkpoint!.files, ["file.txt"]);
});

test("symlink targets and executable mode changes are detected", { skip: process.platform === "win32" }, async (t) => {
  const { repo } = await fixture(t);
  const link = join(repo, "link"); await fs.symlink("file.txt", link);
  const before = await fingerprint(repo);
  await fs.unlink(link); await fs.symlink("other.txt", link);
  await fs.chmod(join(repo, "file.txt"), 0o755);
  assert.deepEqual(delta(before, await fingerprint(repo)), ["file.txt", "link"]);
});

test("inherited Git overrides cannot redirect metadata commands into another worktree", async (t) => {
  const { repo, agent, dir } = await fixture(t);
  const sentinel = join(dir, "sentinel"); await fs.mkdir(sentinel); await git(sentinel, ["init", "-q"]);
  const config = await fs.readFile(join(sentinel, ".git/config"), "utf8");
  const keys = { GIT_DIR: join(sentinel, ".git"), GIT_WORK_TREE: sentinel, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "user.name", GIT_CONFIG_VALUE_0: "Override" };
  const before = Object.fromEntries(Object.keys(keys).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, keys);
    const store = (await Records.open(repo, "session-a", agent))!;
    assert.equal(store.repo, repo);
    assert.ok((await store.read()).startCommit);
  } finally {
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  assert.equal(await fs.readFile(join(sentinel, ".git/config"), "utf8"), config);
  assert.deepEqual(await fs.readdir(sentinel), [".git"]);
});

test("one index renderer orders offsets/legacy/undated data; stdout never writes", async (t) => {
  const { repo } = await fixture(t);
  const drift = join(repo, "drift"); const feature = join(drift, "feature");
  await fs.mkdir(join(feature, "handoffs"), { recursive: true });
  await fs.writeFile(join(feature, "001-handoff-later.md"), "---\ndate: 2026-09-01T00:00:00Z\ntype: handoff\n---\n");
  await fs.writeFile(join(feature, "002-handoff-earlier.md"), "---\ndate: 2026-09-01T00:00:00+01:00\ntype: handoff\n---\n");
  await fs.writeFile(join(feature, "handoffs/old.md"), "**Date:** 2026-08-01\n");
  await fs.writeFile(join(feature, "no-date.md"), "Undated context\n");
  const result = await run(await python(), [join(root, "scripts/build-index.py"), drift, "--stdout"], repo);
  assert.ok(result.indexOf("002-handoff-earlier") < result.indexOf("001-handoff-later"));
  assert.ok(result.includes("feature/handoffs/old.md"));
  assert.ok(result.includes("(approx)")); assert.ok(result.includes("## Undated"));
  await assert.rejects(fs.stat(join(drift, "INDEX.md")), { code: "ENOENT" });
});

test("changed source files are surfaced as unpublished until a handoff completes the interval", async (t) => {
  const { repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  assert.doesNotMatch(await store.context(), /Unpublished work/);

  await fs.writeFile(join(repo, "file.txt"), "modified\n");
  await store.checkpoint("settled");
  assert.match(await store.context(), /Unpublished work in this interval: 1 file\(s\) changed \(file\.txt\)/);

  await publish(store, input);
  await store.checkpoint("settled");
  assert.doesNotMatch(await store.context(), /Unpublished work/);

  // The published artifact is not itself work awaiting publication.
  await store.beginTurn();
  await store.checkpoint("settled");
  const next = await store.context();
  assert.doesNotMatch(next, /Unpublished work/);
  assert.match(next, /Previous interval handoff: drift\/TEST-1\//);
});

test("a record held open without delete sharing (an editor buffer) is still updated", { skip: process.platform !== "win32" }, async (t) => {
  const { dir, repo, agent } = await fixture(t);
  const store = (await Records.open(repo, "session-a", agent))!;
  const ready = join(dir, "held");
  // FileShare.ReadWrite omits Delete, which is what blocks rename-over; Node's own handles always share delete.
  const holder = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command",
    "$f = [IO.File]::Open($env:DRIFT_HELD, 'Open', 'Read', 'ReadWrite'); New-Item $env:DRIFT_READY | Out-Null; Start-Sleep 60; $f.Close()"],
    { env: { ...process.env, DRIFT_HELD: store.file, DRIFT_READY: ready }, stdio: "ignore" });
  const exited = new Promise((resolve) => holder.on("exit", resolve));
  try {
    const deadline = Date.now() + 20_000;
    while (!await fs.stat(ready).catch(() => undefined)) {
      assert.ok(Date.now() < deadline && holder.exitCode === null, "holder did not open the record");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await atomicWrite(store.file, "{\"replaced\":true}\n");
    assert.equal(await fs.readFile(store.file, "utf8"), "{\"replaced\":true}\n");
    assert.deepEqual((await fs.readdir(join(store.file, ".."))).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    holder.kill(); // Before the fixture removal runs, or Windows cannot delete the held file.
    await exited;
  }
});

test("session-start index sync builds a missing index from hand-written artifacts, then leaves it alone", async (t) => {
  const { repo } = await fixture(t);
  assert.equal(await syncIndex(repo), false);
  await assert.rejects(fs.stat(join(repo, "drift")), { code: "ENOENT" }); // Never creates drift/.

  await fs.mkdir(join(repo, "drift", "TEST-1"), { recursive: true });
  await fs.writeFile(join(repo, "drift", "TEST-1", "notes.txt"), "not an artifact\n");
  assert.equal(await syncIndex(repo), false);
  await assert.rejects(fs.stat(join(repo, "drift", "INDEX.md")), { code: "ENOENT" }); // No empty index.

  await fs.writeFile(join(repo, ".gitignore"), "/drift/\n");
  const artifact = join(repo, "drift", "TEST-1", "001-research-by-hand.md");
  await fs.writeFile(artifact, '---\ndate: "2026-08-28T20:30:00+01:00"\nfeature: "TEST-1"\nsequence: "001"\ntype: "research"\nstatus: "complete"\n---\n\n## Summary\nWritten by another host.\n');
  assert.equal(await syncIndex(repo), true);
  const index = join(repo, "drift", "INDEX.md");
  assert.match(await fs.readFile(index, "utf8"), /\| 001 \| .* \| TEST-1 \| research \| \[001-research-by-hand\]\(TEST-1\/001-research-by-hand\.md\) \|/);
  await run(await python(), [join(root, "scripts/build-index.py"), join(repo, "drift"), "--check"], repo);
  assert.equal(await syncIndex(repo), false); // In sync: not rewritten.

  await fs.writeFile(index, "stale\n");
  assert.equal(await syncIndex(repo), true);
  assert.match(await fs.readFile(index, "utf8"), /001-research-by-hand/);
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), "/drift/\n");
  await assert.rejects(fs.stat(join(repo, "drift", ".publish.lock")), { code: "ENOENT" });
});

test("session-start index sync reports a Git-policy mismatch without editing ignores or writing", async (t) => {
  const { repo } = await fixture(t);
  await fs.mkdir(join(repo, "drift", "TEST-1"), { recursive: true });
  await fs.writeFile(join(repo, "drift", "TEST-1", "001-research-by-hand.md"), '---\ndate: "2026-08-28T20:30:00+01:00"\nfeature: "TEST-1"\nsequence: "001"\ntype: "research"\n---\n\n## Summary\nx\n');
  await assert.rejects(syncIndex(repo), /must be ignored by default/);
  await assert.rejects(fs.stat(join(repo, ".gitignore")), { code: "ENOENT" });
  await assert.rejects(fs.stat(join(repo, "drift", "INDEX.md")), { code: "ENOENT" });

  await fs.writeFile(join(repo, ".drift.json"), '{"trackArtifacts":true}');
  assert.equal(await syncIndex(repo), true); // Tracked mode: a visible index is the expected state.
  assert.ok((await git(repo, ["ls-files", "--others", "--exclude-standard"])).includes("drift/INDEX.md"));
});

test("drift-track-artifacts opts in, drops only drift/ ignore rules and never stages", async (t) => {
  const { repo, agent } = await fixture(t);
  await fs.writeFile(join(repo, ".gitignore"), "logs/*\n# Local research, plans and session handoffs.\n/drift/\nbuild/\n");
  assert.match(await enableArtifactTracking(repo), /now trackable: set trackArtifacts in \.drift\.json; removed 1 drift\/ rule/);
  assert.deepEqual(JSON.parse(await fs.readFile(join(repo, ".drift.json"), "utf8")), { trackArtifacts: true });
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), "logs/*\n# Local research, plans and session handoffs.\nbuild/\n");
  assert.equal(await git(repo, ["diff", "--cached", "--name-only"]), "");
  assert.match(await enableArtifactTracking(repo), /already trackable; nothing changed/);

  const store = (await Records.open(repo, "session-a", agent))!;
  const receipt = await publish(store, input);
  assert.ok((await git(repo, ["ls-files", "--others", "--exclude-standard"])).includes(receipt.path));
});

test("drift-track-artifacts restores both files and names the rule when another rule still ignores artifacts", async (t) => {
  const { repo } = await fixture(t);
  const ignore = "/drift/\n*.md\n!README.md\n";
  await fs.writeFile(join(repo, ".gitignore"), ignore);
  await assert.rejects(enableArtifactTracking(repo), /Git still ignores drift\/INDEX\.md because of rule "\*\.md" in \.gitignore\. Nothing was changed/);
  assert.equal(await fs.readFile(join(repo, ".gitignore"), "utf8"), ignore);
  await assert.rejects(fs.stat(join(repo, ".drift.json")), { code: "ENOENT" });

  await fs.writeFile(join(repo, ".drift.json"), '{"trackArtifacts":"yes"}');
  await assert.rejects(enableArtifactTracking(repo), /Drift configuration/); // Invalid config is reported, not overwritten.
  assert.equal(await fs.readFile(join(repo, ".drift.json"), "utf8"), '{"trackArtifacts":"yes"}');
});
