import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir, devNull } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { publish } from "../lib/artifacts.ts";
import { exists, git, hash, mergeInProgress, Records } from "../lib/state.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const piBinary = process.env.PI_TEST_BINARY || "pi";
// Node cannot spawn npm's Windows .cmd shims without a shell; run the script the shim points at instead.
function launcher(binary: string): [string, string[]] {
  if (process.platform !== "win32" || /[\\/]/.test(binary)) return [binary, []];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const shim = join(dir, `${binary}.cmd`);
    if (!existsSync(shim)) continue;
    const script = /"%dp0%\\([^"]+\.js)"/.exec(readFileSync(shim, "utf8"))?.[1];
    if (script) return [process.execPath, [join(dirname(shim), script)]];
  }
  return [binary, []];
}
const [piCommand, piPrefix] = launcher(piBinary);
// Opt in to the installed adapter without downloading anything.
const acpBinary = process.env.PI_TEST_ACP;
const piPresent = spawnSync(piCommand, [...piPrefix, "--version"], { env: { PATH: process.env.PATH, PI_OFFLINE: "1", PI_TELEMETRY: "0" } }).status === 0;
const body = ["Objective", "Source Documents", "Status", "What Changed", "Codebase Context", "What Deviated from Plan", "Open Questions", "Next Steps"].map((name) => `## ${name}\nA synthetic runtime fixture; no semantic model-quality claim.\n`).join("\n");
const researchBody = ["Research Question", "Summary", "Detailed Findings", "Code References", "Open Questions"].map((name) => `## ${name}\nA synthetic research fixture with no source artifacts.\n`).join("\n");

async function until(check: () => any, message: string, timeout = 15_000): Promise<any> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await delay(30);
  }
  throw new Error(message);
}

class Client {
  proc: ReturnType<typeof spawn>;
  events: any[] = [];
  stderr = "";
  private counter = 0;
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(binary: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
    this.proc = spawn(binary, args, { cwd, env, stdio: "pipe" });
    this.proc.stderr!.on("data", (part) => { this.stderr = (this.stderr + part).slice(-6000); });
    let buffer = "";
    this.proc.stdout!.setEncoding("utf8");
    this.proc.stdout!.on("data", (part) => {
      buffer += part;
      for (;;) {
        const end = buffer.indexOf("\n"); if (end < 0) break;
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        let message; try { message = JSON.parse(line); } catch { continue; }
        if (message.id !== undefined && !message.method && this.pending.has(String(message.id))) {
          const waiter = this.pending.get(String(message.id))!;
          clearTimeout(waiter.timer); this.pending.delete(String(message.id));
          if (message.error || message.success === false) waiter.reject(new Error(JSON.stringify(message) + this.stderr));
          else waiter.resolve(message.result ?? message.data);
        } else {
          this.events.push(message);
          if (message.method && message.id !== undefined) this.proc.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "No client-side UI/filesystem required by this fixture" } }) + "\n");
        }
      }
    });
    const fail = (error: Error) => {
      for (const waiter of this.pending.values()) { clearTimeout(waiter.timer); waiter.reject(error); }
      this.pending.clear();
    };
    this.proc.on("error", fail);
    this.proc.on("exit", (code, signal) => fail(new Error(`Runtime exited ${code}/${signal}: ${this.stderr}`)));
  }
  request(payload: object): Promise<any> {
    const id = String(++this.counter);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Runtime timeout: ${JSON.stringify(payload)}\n${this.stderr}`)); }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin!.write(JSON.stringify({ ...payload, id }) + "\n");
    });
  }
  async prompt(message: string) {
    const start = this.events.length;
    await this.request({ type: "prompt", message });
    await until(() => this.events.slice(start).some((event) => event.type === "agent_settled"), `Pi did not settle: ${this.stderr}`);
    const errors = this.events.slice(start).filter((event) => event.type === "extension_error");
    assert.deepEqual(errors, [], this.stderr);
  }
  async stop() {
    if (this.proc.exitCode !== null || this.proc.signalCode !== null) return;
    this.proc.kill("SIGTERM");
    try { await until(() => this.proc.exitCode !== null || this.proc.signalCode !== null, "runtime did not exit", 5_000); }
    catch { this.proc.kill("SIGKILL"); await until(() => this.proc.exitCode !== null || this.proc.signalCode !== null, "runtime stuck", 5_000); }
  }
}

async function fixture(t: any, broken = false) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-pi-test-")));
  const clients: Client[] = [];
  let server: ReturnType<typeof createServer> | undefined;
  t.after(async () => {
    for (const client of clients) await client.stop();
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await fs.rm(dir, { recursive: true, force: true });
  });
  const home = join(dir, "home"); const agent = join(home, ".pi/agent"); const repo = join(dir, "repo");
  await fs.mkdir(agent, { recursive: true }); await fs.mkdir(repo);
  const requests: any[] = [];
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString() || "{}"); requests.push(payload);
    if (requests.length > 40) { response.writeHead(500); response.end("Fixture request limit"); return; }
    const messages = payload.messages ?? [];
    const text = (message: any) => typeof message.content === "string" ? message.content : (message.content ?? []).map((part: any) => part.text ?? "").join("\n");
    const user = messages.findLastIndex((message: any) => message.role === "user" && !text(message).includes("Drift lifecycle is managed by the Pi extension"));
    const marker = user >= 0 ? text(messages[user]) : "";
    const chainArtifact = /^Continue the work recorded.*`drift\/runtime\/(\d+)-handoff-chain\.md`/.exec(marker);
    const chainStep = marker === "PUBLISH_CHAIN" ? 1 : chainArtifact ? Number(chainArtifact[1]) + 1 : 0;
    const publish = (/^PUBLISH_(RESEARCH|HANDOFF|AUTO_HANDOFF)/.test(marker) || (chainStep > 0 && chainStep <= 3)) && !messages.slice(user + 1).some((message: any) => message.role === "tool");
    const kind = marker.startsWith("PUBLISH_RESEARCH") ? "research" : "handoff";
    // Real models may fill optional string fields with "" rather than omit them.
    const args = { feature: "runtime", kind, slug: chainStep ? "chain" : "fixture", body: kind === "research" ? researchBody : body, source_research: "", previous_handoff: chainArtifact ? `drift/runtime/${chainArtifact[1]}-handoff-chain.md` : "", related_artifacts: [], ...(/^PUBLISH_AUTO_(HANDOFF|THEN_ADOPT)/.test(marker) || (chainStep > 0 && chainStep < 3) ? { next_session_profile: "architecture" } : {}), ...(/^PUBLISH_(AUTO_)?HANDOFF_CHANGELOG/.test(marker) ? { changelog: { section: "Changed", text: "Fixture change." } } : {}) };
    // Tool rounds already answered since the marker; each marker scripts a bounded number of rounds, never a loop.
    const rounds = messages.slice(user + 1).filter((message: any) => message.role === "assistant" && message.tool_calls?.length).length;
    // WORKTREE_ADOPT <path>, WORKTREE_STATUS, WORKTREE_ADOPT_PUBLISH <path> (one batch: adopt beside a publication),
    // WORKTREE_ADOPT_THEN_PUBLISH <path> (adopt alone, then publish a handoff in the next round),
    // PUBLISH_AUTO_THEN_ADOPT <path> (publish a profiled handoff, then adopt alone in the next round, before settling).
    const worktree = /^WORKTREE_(ADOPT_PUBLISH|ADOPT_THEN_PUBLISH|ADOPT|STATUS)(?:[ \t]+([^\n]+))?$/.exec(marker.trim());
    const autoThenAdopt = /^PUBLISH_AUTO_THEN_ADOPT[ \t]+([^\n]+)$/.exec(marker.trim());
    const adoptCall = { name: "drift_worktree", arguments: { action: "adopt", path: (worktree?.[2] ?? autoThenAdopt?.[1])?.trim() } };
    const publishCall = { name: "drift_publish", arguments: args };
    const calls = autoThenAdopt ? (rounds === 0 ? [publishCall] : rounds === 1 ? [adoptCall] : []) : !worktree ? (publish ? [publishCall] : []) :
      worktree[1] === "STATUS" ? (rounds === 0 ? [{ name: "drift_worktree", arguments: { action: "status" } }] : []) :
      worktree[1] === "ADOPT" ? (rounds === 0 ? [adoptCall] : []) :
      worktree[1] === "ADOPT_PUBLISH" ? (rounds === 0 ? [adoptCall, publishCall] : []) :
      rounds === 0 ? [adoptCall] : rounds === 1 ? [publishCall] : [];
    const delta = calls.length ? { role: "assistant", tool_calls: calls.map((call, index) => ({ index, id: `${call.name}-${rounds}-${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) } : { role: "assistant", content: "Synthetic fixture response; preserve the bounded task and continue." };
    const common = { id: "drift-fixture", object: "chat.completion.chunk", created: 0, model: "fixture" };
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    response.end([
      { ...common, choices: [{ index: 0, delta, finish_reason: null }] },
      { ...common, choices: [{ index: 0, delta: {}, finish_reason: calls.length ? "tool_calls" : "stop" }], usage: { prompt_tokens: 200, completion_tokens: 20, total_tokens: 220 } },
    ].map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port;
  await fs.writeFile(join(agent, "settings.json"), JSON.stringify({ packages: [root], defaultProvider: "drift-fixture", defaultModel: "fixture", defaultThinkingLevel: "off", quietStartup: true, enableInstallTelemetry: false, defaultProjectTrust: "never", compaction: { enabled: false, keepRecentTokens: 100, reserveTokens: 128 }, retry: { enabled: false } }));
  await fs.writeFile(join(agent, "models.json"), JSON.stringify({ providers: { "drift-fixture": { baseUrl: `http://127.0.0.1:${port}/v1`, api: "openai-completions", apiKey: "local-placeholder-not-a-credential", models: [{ id: "fixture", contextWindow: 32768, maxTokens: 4096, reasoning: false }, { id: "architecture", contextWindow: 32768, maxTokens: 4096, reasoning: true }] } } }));
  await fs.writeFile(join(agent, "drift-model-profiles.json"), JSON.stringify({ profiles: { architecture: { provider: "drift-fixture", model: "architecture", thinkingLevel: "high" } } }));
  await fs.mkdir(join(agent, "extensions"));
  await fs.writeFile(join(agent, "extensions/reload-fixture.ts"), `export default function(pi) { pi.registerCommand("fixture-reload", { handler: async (_args, ctx) => { await ctx.reload(); } }); }`);
  if (process.platform !== "win32") {
    await fs.mkdir(join(home, ".agents/skills"), { recursive: true });
    await fs.symlink(root, join(home, ".agents/skills/drift"));
  }
  if (broken) await fs.writeFile(join(agent, "drift"), "block record directory creation");
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "COMSPEC", "TMP", "TEMP", "TMPDIR"]) if (process.env[key]) env[key] = process.env[key];
  Object.assign(env, { HOME: home, USERPROFILE: home, PI_CODING_AGENT_DIR: agent, PI_OFFLINE: "1", PI_TELEMETRY: "0", PI_SKIP_VERSION_CHECK: "1", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : devNull, XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache"), XDG_DATA_HOME: join(home, ".local/share"), XDG_STATE_HOME: join(home, ".local/state") });
  await git(repo, ["init", "-q"]); await git(repo, ["config", "user.name", "Drift runtime"]); await git(repo, ["config", "user.email", "drift@example.invalid"]);
  await fs.writeFile(join(repo, "file.txt"), "original\n"); await fs.writeFile(join(repo, ".gitignore"), "/drift/\n");
  await git(repo, ["add", "."]); await git(repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "fixture"]);
  await fs.writeFile(join(repo, "inherited.txt"), "already dirty\n");
  const rpc = (sessionFile?: string, flags: string[] = []) => {
    const client = new Client(piCommand, [...piPrefix, "--mode", "rpc", "--offline", "--no-context-files", ...flags, ...(sessionFile ? ["--session", sessionFile] : [])], repo, env);
    clients.push(client); return client;
  };
  const recordPath = (id: string) => join(agent, "drift", hash(repo).slice(0, 24), `${id}.json`);
  const readRecord = async (id: string) => JSON.parse(await fs.readFile(recordPath(id), "utf8"));
  // The installed Windows adapter can launch the same resolved Node script as the RPC fixture,
  // avoiding a shell-less spawn of npm's pi.cmd shim. No real-user session/config environment is inherited.
  const acpEnv = { ...env, PI_ACP_PI_COMMAND: piBinary,
    ...(process.platform === "win32" && piPrefix.length === 1 ? { PI_ACP_PI_SCRIPT: piPrefix[0] } : {}) };
  return { dir, home, agent, repo, requests, env, acpEnv, clients, rpc, recordPath, readRecord };
}

test("actual Pi RPC: discovery, pre-inference record, context, resume/reload, compaction, publication and new interval", { skip: !piPresent, timeout: 120_000 }, async (t) => {
  const f = await fixture(t);
  let client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const initial = await f.readRecord(state.sessionId);
  assert.deepEqual(Object.keys(initial.baseline), ["inherited.txt"]);
  assert.equal(f.requests.length, 0); // Record is on disk before the first inference.
  const commands = await client.request({ type: "get_commands" });
  assert.equal(commands.commands.filter((command: any) => command.name === "skill:drift").length, 1);
  await client.prompt("hello");
  const first = JSON.stringify(f.requests[0]);
  assert.ok(first.includes("drift_publish")); assert.ok(first.includes(initial.intervalId));
  assert.ok(first.includes("Drift lifecycle is managed by the Pi extension"));
  await fs.writeFile(join(f.repo, "file.txt"), "modified\n");
  await client.prompt("another turn " + "padding ".repeat(1500));
  await until(async () => (await f.readRecord(state.sessionId)).checkpoint?.files.includes("file.txt"), "checkpoint missing");
  await client.stop();
  client = f.rpc(state.sessionFile);
  assert.equal((await client.request({ type: "get_state" })).sessionId, state.sessionId);
  assert.deepEqual((await f.readRecord(state.sessionId)).baseline, initial.baseline);
  assert.equal((await f.readRecord(state.sessionId)).intervalId, initial.intervalId);
  await client.request({ type: "prompt", message: "/fixture-reload" });
  assert.equal((await f.readRecord(state.sessionId)).intervalId, initial.intervalId);
  assert.deepEqual((await f.readRecord(state.sessionId)).baseline, initial.baseline);
  await client.request({ type: "compact", customInstructions: "Summarize this synthetic fixture." });
  await client.prompt("after compaction");
  assert.ok(JSON.stringify(f.requests.at(-1)).includes(initial.intervalId));
  await client.prompt("PUBLISH_RESEARCH");
  const researched = await f.readRecord(state.sessionId);
  assert.equal(researched.completed, undefined);
  assert.equal(researched.receipts.length, 1);
  const research = await fs.readFile(join(f.repo, researched.receipts[0].path), "utf8");
  assert.ok(!research.includes("source_research:"));
  assert.ok(!research.includes("previous_handoff:"));
  await client.prompt("PUBLISH_HANDOFF");
  const completed = await f.readRecord(state.sessionId);
  assert.ok(completed.completed, client.stderr);
  const artifact = await fs.readFile(join(f.repo, completed.completed.path), "utf8");
  assert.ok(artifact.includes(`session_started: ${JSON.stringify(initial.started)}`));
  const index = await fs.readFile(join(f.repo, "drift/INDEX.md"), "utf8");
  assert.ok(index.includes("001-research-fixture"));
  assert.ok(index.includes("002-handoff-fixture"));
  const contents = await fs.readFile(f.recordPath(state.sessionId), "utf8");
  await client.stop();
  assert.equal(await fs.readFile(f.recordPath(state.sessionId), "utf8"), contents);
  client = f.rpc(state.sessionFile);
  await client.request({ type: "get_state" });
  assert.equal((await f.readRecord(state.sessionId)).intervalId, initial.intervalId);
  await client.prompt("new work interval");
  const later = await f.readRecord(state.sessionId);
  assert.notEqual(later.intervalId, initial.intervalId);
  assert.equal(later.previousHandoff, completed.completed.path);
  // Fork/clone creates a new Pi identity, not an adopted parent record.
  await client.request({ type: "clone" });
  const fork = await client.request({ type: "get_state" });
  assert.notEqual(fork.sessionId, state.sessionId);
  assert.notEqual((await f.readRecord(fork.sessionId)).intervalId, later.intervalId);
  assert.equal((await f.readRecord(fork.sessionId)).completed, undefined);
  const requestCount = f.requests.length;
  await fs.writeFile(f.recordPath(fork.sessionId), "{}");
  await client.prompt("Do not work with a corrupt record");
  await assert.rejects(client.request({ type: "compact" }), /Compaction cancelled/);
  assert.equal(f.requests.length, requestCount);
  assert.equal(await fs.readFile(f.recordPath(fork.sessionId), "utf8"), "{}");
});

test("actual Pi publishes repo-opted-in tracked artifacts without changing ignores or staging", { skip: !piPresent, timeout: 60_000 }, async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"trackArtifacts":true}\n');
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\n");
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  await client.prompt("PUBLISH_HANDOFF");
  const record = await f.readRecord(state.sessionId);
  assert.ok(record.completed, client.stderr);
  assert.equal(await fs.readFile(join(f.repo, ".gitignore"), "utf8"), "logs/*\n");
  const visible = await git(f.repo, ["ls-files", "--others", "--exclude-standard"]);
  assert.ok(visible.includes(record.completed.path));
  assert.ok(visible.includes("drift/INDEX.md"));
  assert.equal(await git(f.repo, ["diff", "--cached", "--name-only"]), "");
  assert.ok(client.events.some((event: any) => event.type === "tool_execution_end" && event.toolName === "drift_publish" && !event.isError));
});

test("actual Pi /drift-track-artifacts is an extension command that toggles tracking without inference", { skip: !piPresent, timeout: 60_000 }, async (t) => {
  const f = await fixture(t); const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const listed = (await client.request({ type: "get_commands" })).commands.find((command: any) => command.name === "drift-track-artifacts");
  assert.equal(listed?.source, "extension"); // What pi-acp advertises to Zed's slash menu.
  const before = f.requests.length;
  await client.request({ type: "prompt", message: "/drift-track-artifacts on" }); // Acknowledged once the handler has finished.
  assert.equal(await fs.readFile(join(f.repo, ".gitignore"), "utf8"), "");
  assert.deepEqual(JSON.parse(await fs.readFile(join(f.repo, ".drift.json"), "utf8")), { trackArtifacts: true });
  await until(() => client.events.some((event: any) => event.type === "extension_ui_request" && event.method === "notify" && /now tracked/.test(event.message)), "command did not report its result");
  assert.equal(f.requests.length, before); // A user command, never a model turn.
  await client.prompt("PUBLISH_HANDOFF");
  const record = await f.readRecord(state.sessionId);
  assert.ok(record.completed, client.stderr);
  const visible = await git(f.repo, ["ls-files", "--others", "--exclude-standard"]);
  assert.ok(visible.includes(record.completed.path));
  assert.equal(await git(f.repo, ["diff", "--cached", "--name-only"]), "");
  await client.request({ type: "prompt", message: "/drift-track-artifacts off" });
  assert.equal(await fs.readFile(join(f.repo, ".gitignore"), "utf8"), "/drift/\n");
  assert.deepEqual(JSON.parse(await fs.readFile(join(f.repo, ".drift.json"), "utf8")), { trackArtifacts: false });
});

test("actual Pi /drift picks up the newest handoff through the bundled skill as an ordinary turn", { skip: !piPresent, timeout: 60_000 }, async (t) => {
  const f = await fixture(t); const client = f.rpc();
  await fs.mkdir(join(f.repo, "drift/runtime"), { recursive: true });
  await fs.writeFile(join(f.repo, "drift/runtime/001-handoff-latest.md"), '---\ndate: "2026-10-09T12:00:00+01:00"\nfeature: "runtime"\nsequence: "001"\ntype: "handoff"\nstatus: "in-progress"\n---\n\n## Next Steps\nx\n');
  const listed = (await client.request({ type: "get_commands" })).commands.find((command: any) => command.name === "drift");
  assert.equal(listed?.source, "prompt"); // Advertised to Zed's slash menu like any prompt template.
  const before = f.requests.length;
  await client.prompt("/drift");
  const request = await until(() => f.requests.slice(before).find((r) => JSON.stringify(r).includes("Continue the work recorded in the Drift handoff at `drift/runtime/001-handoff-latest.md`")), "/drift did not send the pickup prompt");
  const sent = JSON.stringify(request);
  assert.ok(sent.includes("Skill Router"), "the bundled Drift skill was not expanded"); // The binding expanded /skill:drift.
  assert.ok(!sent.includes("/skill:drift Continue"), "the skill command reached the model unexpanded");
  assert.ok(client.events.some((event: any) => event.type === "extension_ui_request" && event.method === "notify" && /picking up drift\/runtime\/001-handoff-latest\.md/.test(event.message)));
});

test("actual Pi installs the index merge driver at session start in a tracked clone that carries the attribute", { skip: !piPresent, timeout: 60_000 }, async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"trackArtifacts":true}\n');
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\n");
  await fs.writeFile(join(f.repo, ".gitattributes"), "drift/INDEX.md merge=drift-index\n");
  const client = f.rpc();
  await client.request({ type: "get_state" });
  const driver = await until(async () => (await git(f.repo, ["config", "--get", "merge.drift-index.driver"], 1)).trim(), "driver was not installed at session start");
  assert.match(driver, /^\S+ -I \S+\/scripts\/build-index\.py --merge %O %A %B$/);
  assert.ok(!driver.includes("\\"));
  assert.equal((await git(f.repo, ["config", "--get", "merge.drift-index.name"])).trim(), "Drift index row merge");

  // Private mode, or a repo without the attribute, gets no driver.
  const g = await fixture(t);
  await fs.writeFile(join(g.repo, ".gitattributes"), "drift/INDEX.md merge=drift-index\n");
  const other = g.rpc();
  await other.prompt("hello");
  assert.equal((await git(g.repo, ["config", "--get", "merge.drift-index.driver"], 1)).trim(), "");
});

test("actual Pi: /drift-changelog on, a publication carrying a changelog entry, regeneration, and the driver at the next session start", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t); const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  await fs.writeFile(join(f.repo, "CHANGELOG.md"), "# Changelog\n\n## [0.0.1] - 2026-01-01\n\n- old\n");
  await client.request({ type: "prompt", message: "/drift-changelog on" });
  await until(() => fs.stat(join(f.repo, "changelog.d", "README.md")).catch(() => undefined), "command did not adopt the changelog");
  await client.prompt("PUBLISH_HANDOFF_CHANGELOG");
  const record = await f.readRecord(state.sessionId);
  assert.ok(record.completed, client.stderr);
  assert.equal(record.completed.fragment, "changelog.d/runtime-001-fixture.md");
  assert.match(await fs.readFile(join(f.repo, "changelog.d", "runtime-001-fixture.md"), "utf8"), /section: "Changed"\nartifact: "drift\/runtime\/001-handoff-fixture\.md"\n---\nFixture change\.\n$/);
  const changelog = await fs.readFile(join(f.repo, "CHANGELOG.md"), "utf8");
  // No version tags in the fixture, so entries group by day.
  assert.match(changelog, /^# Changelog\n\n<!-- drift:changelog[^\n]*\n\n## \d{4}-\d{2}-\d{2}\n\n### Changed\n\n- Fixture change\. <!-- changelog\.d\/runtime-001-fixture\.md [^ ]+ -->\n\n<!-- \/drift:changelog -->\n\n## \[0\.0\.1\] - 2026-01-01\n\n- old\n$/);
  assert.ok(client.events.some((event: any) => event.type === "tool_execution_end" && event.toolName === "drift_publish" && JSON.stringify(event).includes("Fragment: changelog.d/runtime-001-fixture.md")));

  const second = f.rpc();
  await second.request({ type: "get_state" });
  const driver = await until(async () => (await git(f.repo, ["config", "--get", "merge.drift-changelog.driver"], 1)).trim(), "changelog driver was not installed at session start");
  assert.match(driver, /^\S+ -I \S+\/scripts\/build-changelog\.py --merge %O %A %B$/);
});

async function withOrigin(f: Awaited<ReturnType<typeof fixture>>) {
  const bare = join(f.dir, "origin.git");
  await git(f.dir, ["init", "-q", "--bare", bare]);
  await git(f.repo, ["remote", "add", "origin", bare]);
  const branch = (await git(f.repo, ["symbolic-ref", "--short", "HEAD"])).trim();
  await git(f.repo, ["push", "-q", "-u", "origin", branch]);
  await git(f.repo, ["remote", "set-head", "origin", branch]);
  const other = join(f.dir, "other");
  await git(f.dir, ["clone", "-q", bare, other]);
  for (const [key, value] of [["user.name", "Other"], ["user.email", "other@example.invalid"], ["commit.gpgsign", "false"]]) await git(other, ["config", key, value]);
  return { bare, branch, other: await fs.realpath(other) };
}

test("actual Pi lands a completed interval itself where the repo opts in, then continues; a conflict holds the continuation", { skip: !piPresent, timeout: 120_000 }, async (t) => {
  const f = await fixture(t);
  const { branch, other } = await withOrigin(f);
  await fs.writeFile(join(f.repo, ".drift.json"), '{ "land": { "auto": true } }\n');
  await fs.writeFile(join(f.repo, "work.txt"), "done\n");
  await git(f.repo, ["add", ".drift.json", "work.txt"]); await git(f.repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "work"]);
  await fs.writeFile(join(other, "theirs.txt"), "t\n"); await git(other, ["add", "theirs.txt"]); await git(other, ["commit", "-qm", "theirs"]); await git(other, ["push", "-q", "origin", `HEAD:${branch}`]);

  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const before = f.requests.length;
  await client.prompt("PUBLISH_AUTO_HANDOFF");
  const record = await f.readRecord(state.sessionId);
  assert.ok(record.completed, client.stderr);
  const landed = (await git(f.repo, ["ls-tree", "--name-only", `origin/${branch}`])).trim().split("\n").sort();
  assert.deepEqual(landed, [".drift.json", ".gitignore", "file.txt", "theirs.txt", "work.txt"]); // Rebased onto the other thread's landing and pushed.
  assert.ok(client.events.some((event: any) => event.type === "tool_execution_end" && event.toolName === "drift_publish" && /Landed \S+ on origin\//.test(JSON.stringify(event))));
  assert.ok(record.checkpoint && ["land", "settled", "publish"].includes(record.checkpoint.reason));
  await until(() => f.requests.slice(before + 1).find((request) => request.model === "architecture" && JSON.stringify(request).includes("Continue the work recorded in the Drift handoff at `" + record.completed.path + "`")), "landed handoff did not continue");

  // Second interval: a real conflict. The handoff publishes, nothing is pushed, and no continuation prompt follows.
  await git(other, ["pull", "-q", "--rebase", "origin", branch]); // The first landing moved origin past this clone.
  await fs.writeFile(join(other, "file.txt"), "theirs\n"); await git(other, ["commit", "-qam", "theirs again"]); await git(other, ["push", "-q", "origin", `HEAD:${branch}`]);
  await fs.writeFile(join(f.repo, "file.txt"), "ours\n"); await git(f.repo, ["-c", "commit.gpgsign=false", "commit", "-qam", "ours"]);
  const second = f.rpc();
  const secondState = await second.request({ type: "get_state" });
  const requestsBefore = f.requests.length;
  await second.prompt("PUBLISH_AUTO_HANDOFF");
  const secondRecord = await f.readRecord(secondState.sessionId);
  assert.ok(secondRecord.completed, second.stderr);
  assert.ok(second.events.some((event: any) => event.type === "tool_execution_end" && event.toolName === "drift_publish" && /Not landed: Rebase onto origin\/\S+ conflicts in file\.txt[\s\S]*Automatic continuation is held/.test(JSON.stringify(event))));
  assert.ok(!(await git(f.repo, ["log", "--oneline", `origin/${branch}`])).includes("ours"));
  assert.equal(await mergeInProgress(f.repo), false);
  await delay(1500);
  assert.ok(!f.requests.slice(requestsBefore).some((request) => JSON.stringify(request).includes("Continue the work recorded in the Drift handoff at `" + secondRecord.completed.path + "`")), "a held landing must not continue");
});

test("actual Pi adopts a shared repository's changelog at session start and publishes fragments without a command", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  await withOrigin(f);
  await fs.writeFile(join(f.repo, "CHANGELOG.md"), "# Changelog\n\n## [0.0.1] - 2026-01-01\n\n- old\n");
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  await until(() => fs.stat(join(f.repo, "changelog.d", "README.md")).catch(() => undefined), "session start did not adopt the changelog");
  assert.match(await fs.readFile(join(f.repo, "CHANGELOG.md"), "utf8"), /<!-- drift:changelog/);
  await client.prompt("PUBLISH_HANDOFF_CHANGELOG");
  const record = await f.readRecord(state.sessionId);
  assert.equal(record.completed?.fragment, "changelog.d/runtime-001-fixture.md");
  assert.match(await fs.readFile(join(f.repo, "CHANGELOG.md"), "utf8"), /- Fixture change\. <!-- changelog\.d\/runtime-001-fixture\.md/);
  // The model learns from context that the changelog is generated here.
  assert.ok(f.requests.some((request) => JSON.stringify(request).includes("CHANGELOG.md is generated from changelog.d/ here")));
});

test("actual Pi lands a shared, tracked repository's handoff with its artifact, index, fragment and changelog committed", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  const { branch } = await withOrigin(f);
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\n");
  await fs.writeFile(join(f.repo, ".drift.json"), '{ "trackArtifacts": true, "land": { "auto": true } }\n');
  await fs.writeFile(join(f.repo, "CHANGELOG.md"), "# Changelog\n\n## [0.0.1] - 2026-01-01\n\n- old\n");
  await git(f.repo, ["add", "-A"]); await git(f.repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "shared"]); await git(f.repo, ["push", "-q", "origin", `HEAD:${branch}`]);
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  await client.prompt("PUBLISH_HANDOFF_CHANGELOG");
  const record = await f.readRecord(state.sessionId);
  assert.ok(record.completed, client.stderr);
  const remote = (await git(f.repo, ["ls-tree", "-r", "--name-only", `origin/${branch}`])).trim().split("\n");
  for (const file of ["drift/runtime/001-handoff-fixture.md", "drift/INDEX.md", "changelog.d/runtime-001-fixture.md", "CHANGELOG.md", ".gitattributes"]) assert.ok(remote.includes(file), `${file} not on origin`);
  assert.ok(client.events.some((event: any) => event.type === "tool_execution_end" && event.toolName === "drift_publish" && /Landed \S+ on origin\/[\s\S]*committed \d Drift files first/.test(JSON.stringify(event))));
  assert.equal((await git(f.repo, ["status", "--porcelain", "--untracked-files=no"])).trim(), "");
});

test("actual Pi automatically continues a profiled handoff after a fresh context compaction", { skip: !piPresent, timeout: 60_000 }, async (t) => {
  const f = await fixture(t); const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const requestsBeforeHandoff = f.requests.length;
  await client.prompt("PUBLISH_AUTO_HANDOFF");
  const completed = await f.readRecord(state.sessionId);
  const artifact = completed.completed!.path;
  assert.ok((await fs.readFile(join(f.repo, artifact), "utf8")).includes('next_session_profile: "architecture"'));
  const current = await client.request({ type: "get_state" });
  assert.equal(current.sessionId, state.sessionId);
  await until(async () => (await client.request({ type: "get_entries" })).entries.some((entry: any) => entry.type === "compaction"), "profiled handoff did not compact to a fresh context window");
  await until(() => f.requests.slice(requestsBeforeHandoff + 1).find((request) => request.model === "architecture" && JSON.stringify(request).includes("Continue the work recorded in the Drift handoff at `" + artifact + "`")), "fresh context did not send the profiled continuation prompt");
  await fs.mkdir(join(f.repo, "drift/runtime"), { recursive: true });
  await fs.writeFile(join(f.repo, "drift/runtime/099-handoff-unprofiled.md"), '---\ntype: "handoff"\n---\n');
  const requestsBeforeFailure = f.requests.length;
  await client.request({ type: "prompt", message: "drift-continue drift/runtime/099-handoff-unprofiled.md" });
  await delay(100);
  assert.equal(f.requests.length, requestsBeforeFailure);
});

/** A linked worktree of the fixture repo on its own branch; same common dir, its own canonical root. */
async function linkedWorktree(f: Awaited<ReturnType<typeof fixture>>, name = "worker", branch = "feature") {
  const path = join(f.dir, name);
  await git(f.repo, ["worktree", "add", "-q", "-b", branch, path]);
  return { path: await fs.realpath(path), branch, head: (await git(path, ["rev-parse", "HEAD"])).trim() };
}
const samePath = (a: string, b: string) => process.platform === "win32" ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
const toolEnds = (client: Client, name: string, from = 0) => client.events.slice(from).filter((event: any) => event.type === "tool_execution_end" && event.toolName === name);
const notices = (client: Client, from = 0) => client.events.slice(from).filter((event: any) => event.type === "extension_ui_request" && event.method === "notify");
const toolNames = (request: any) => (request.tools ?? []).map((tool: any) => tool.function?.name ?? tool.name).sort();
async function commit(repo: string, message: string) {
  await git(repo, ["add", "-A"]); await git(repo, ["-c", "commit.gpgsign=false", "commit", "-qm", message]);
}

// Expected extension rule: drift_worktree adopt must be the only tool call in its assistant batch, because Pi
// preflights every sibling call before executing them concurrently, so a sibling would run against an unknown root.
test("actual Pi adopts a linked worktree as the active Drift root: measured interval, status, checkpoint, publication, reload/resume/compaction and the next interval", { skip: !piPresent, timeout: 150_000 }, async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"trackArtifacts":true,"changelog":true}\n');
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\n");
  await fs.writeFile(join(f.repo, "CHANGELOG.md"), "# Changelog\n\n## [0.0.1] - 2026-01-01\n\n- old\n");
  await git(f.repo, ["add", ".drift.json", ".gitignore", "CHANGELOG.md"]); await git(f.repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "config"]);
  const mainBranch = (await git(f.repo, ["symbolic-ref", "--short", "HEAD"])).trim();
  const worker = await linkedWorktree(f);
  await fs.writeFile(join(worker.path, "worker-dirty.txt"), "dirty before adoption\n");

  let client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const initial = await f.readRecord(state.sessionId);
  assert.equal(initial.worktree, undefined);
  assert.equal(initial.startBranch, mainBranch);
  assert.ok(Object.keys(initial.baseline).includes("inherited.txt"));
  await client.prompt("hello");
  const toolsBefore = toolNames(f.requests.at(-1));
  assert.ok(toolsBefore.includes("drift_worktree"), JSON.stringify(toolsBefore));

  // Adopt by a path relative to Pi's launch cwd; the launch cwd itself never moves.
  let mark = client.events.length;
  await client.prompt("WORKTREE_ADOPT ../worker");
  const adoptions = toolEnds(client, "drift_worktree", mark);
  assert.equal(adoptions.length, 1);
  assert.ok(!adoptions[0].isError, JSON.stringify(adoptions[0]));
  const adopted = await f.readRecord(state.sessionId); // Still the stable launch record path.
  assert.ok(samePath(adopted.worktree, worker.path), adopted.worktree);
  assert.equal(adopted.sessionId, state.sessionId);
  assert.equal(adopted.startBranch, worker.branch);
  assert.equal(adopted.startCommit, worker.head);
  assert.ok(Object.keys(adopted.baseline).includes("worker-dirty.txt"), JSON.stringify(adopted.baseline));
  assert.ok(!Object.keys(adopted.baseline).includes("inherited.txt"), "main's dirty files leaked into the adopted baseline");
  assert.ok(Array.isArray(adopted.history) && adopted.history.length === 1, JSON.stringify(adopted.history));
  assert.equal(adopted.history[0].startBranch, mainBranch);
  assert.deepEqual(adopted.history[0].baseline, initial.baseline);
  assert.deepEqual(adopted.receipts, []);
  assert.equal(adopted.completed, undefined);
  // The follow-up request after the tool result carries the active interval; Pi's core tools are unchanged.
  assert.ok(JSON.stringify(f.requests.at(-1)).includes(adopted.intervalId));
  assert.deepEqual(toolNames(f.requests.at(-1)), toolsBefore);
  assert.equal((await client.request({ type: "get_state" })).sessionId, state.sessionId);

  // Same target: idempotent, no new interval or history entry.
  mark = client.events.length;
  await client.prompt("WORKTREE_ADOPT " + worker.path);
  assert.ok(!toolEnds(client, "drift_worktree", mark)[0]?.isError, JSON.stringify(toolEnds(client, "drift_worktree", mark)));
  let record = await f.readRecord(state.sessionId);
  assert.equal(record.intervalId, adopted.intervalId);
  assert.equal(record.history.length, 1);
  assert.deepEqual(record.baseline, adopted.baseline);

  // Status is read-only: the model tool, the bare user command and the explicit status command.
  mark = client.events.length;
  await client.prompt("WORKTREE_STATUS");
  const status = toolEnds(client, "drift_worktree", mark);
  assert.equal(status.length, 1);
  assert.ok(!status[0].isError && JSON.stringify(status[0]).includes(worker.branch), JSON.stringify(status[0]));
  record = await f.readRecord(state.sessionId);
  assert.equal(record.intervalId, adopted.intervalId);
  assert.equal(record.history.length, 1);
  const commandsAt = f.requests.length;
  const bytes = await fs.readFile(f.recordPath(state.sessionId), "utf8");
  for (const command of ["/drift-worktree", "/drift-worktree status"]) {
    mark = client.events.length;
    await client.request({ type: "prompt", message: command });
    await until(() => notices(client, mark).length, `${command} did not report`);
    assert.ok(notices(client, mark).some((event: any) => event.message.includes(worker.branch)), JSON.stringify(notices(client, mark)));
  }
  assert.equal(f.requests.length, commandsAt, "a user command must not start inference");
  assert.equal(await fs.readFile(f.recordPath(state.sessionId), "utf8"), bytes);

  // Checkpoints measure the active root only.
  await fs.writeFile(join(f.repo, "main-only.txt"), "concurrent main work\n");
  await fs.writeFile(join(worker.path, "worker-change.txt"), "adopted work\n");
  await client.prompt("worker turn " + "padding ".repeat(1500));
  await until(async () => (await f.readRecord(state.sessionId)).checkpoint?.files.includes("worker-change.txt"), "checkpoint missed the adopted worktree");
  assert.ok(!(await f.readRecord(state.sessionId)).checkpoint.files.includes("main-only.txt"), "checkpoint measured main");

  // Resume, reload and compaction keep the adoption and its interval.
  await client.stop();
  client = f.rpc(state.sessionFile);
  assert.equal((await client.request({ type: "get_state" })).sessionId, state.sessionId);
  for (const step of ["resume", "reload", "compaction"]) {
    if (step === "reload") await client.request({ type: "prompt", message: "/fixture-reload" });
    if (step === "compaction") await client.request({ type: "compact", customInstructions: "Summarize this synthetic fixture." });
    record = await f.readRecord(state.sessionId);
    assert.ok(samePath(record.worktree, worker.path), `${step} lost the adoption`);
    assert.equal(record.intervalId, adopted.intervalId, `${step} changed the interval`);
    assert.deepEqual(record.baseline, adopted.baseline, `${step} re-measured the baseline`);
  }
  await client.prompt("after compaction");
  assert.ok(JSON.stringify(f.requests.at(-1)).includes(adopted.intervalId));

  // Tracked publication and its changelog fragment land in the worker only.
  const mainChangelog = await fs.readFile(join(f.repo, "CHANGELOG.md"), "utf8");
  await client.prompt("PUBLISH_HANDOFF_CHANGELOG");
  const completed = await f.readRecord(state.sessionId);
  assert.ok(completed.completed, client.stderr);
  assert.equal(completed.completed.fragment, "changelog.d/runtime-001-fixture.md");
  const artifact = await fs.readFile(join(worker.path, completed.completed.path), "utf8");
  assert.ok(artifact.includes(`session_started: ${JSON.stringify(adopted.started)}`), artifact);
  assert.ok(await exists(join(worker.path, "drift/INDEX.md")));
  assert.ok(await exists(join(worker.path, "changelog.d/runtime-001-fixture.md")));
  assert.match(await fs.readFile(join(worker.path, "CHANGELOG.md"), "utf8"), /- Fixture change\. <!-- changelog\.d\/runtime-001-fixture\.md/);
  assert.ok(!(await exists(join(f.repo, completed.completed.path))), "artifact silently written to main");
  assert.ok(!(await exists(join(f.repo, "drift/runtime"))));
  assert.ok(!(await exists(join(f.repo, "changelog.d/runtime-001-fixture.md"))));
  assert.equal(await fs.readFile(join(f.repo, "CHANGELOG.md"), "utf8"), mainChangelog);
  assert.ok((await git(worker.path, ["ls-files", "--others", "--exclude-standard"])).includes(completed.completed.path));
  assert.equal(await git(worker.path, ["diff", "--cached", "--name-only"]), "");

  // The next interval keeps the adoption and measures the worker afresh.
  await client.stop();
  client = f.rpc(state.sessionFile);
  await client.prompt("new work interval");
  const later = await f.readRecord(state.sessionId);
  assert.notEqual(later.intervalId, adopted.intervalId);
  assert.ok(samePath(later.worktree, worker.path));
  assert.equal(later.startBranch, worker.branch);
  assert.equal(later.previousHandoff, completed.completed.path);
  assert.ok(Object.keys(later.baseline).includes("worker-change.txt"));

  // A clone is a new identity: no inherited measurement or adoption.
  await client.request({ type: "clone" });
  const fork = await client.request({ type: "get_state" });
  assert.notEqual(fork.sessionId, state.sessionId);
  const forked = await f.readRecord(fork.sessionId);
  assert.equal(forked.worktree, undefined);
  assert.equal(forked.startBranch, mainBranch);
  assert.ok(!forked.history?.length);
  assert.ok(Object.keys(forked.baseline).includes("main-only.txt"));
  // So is a brand-new session in the same launch directory.
  const fresh = f.rpc();
  const freshState = await fresh.request({ type: "get_state" });
  const freshRecord = await f.readRecord(freshState.sessionId);
  assert.equal(freshRecord.worktree, undefined);
  assert.equal(freshRecord.startBranch, mainBranch);
});

test("actual Pi keeps private artifacts in main while an adopted worktree owns its branch, fragments, commands, /drift and profiled continuation", { skip: !piPresent, timeout: 120_000 }, async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"changelog":true}\n');
  await fs.writeFile(join(f.repo, "CHANGELOG.md"), "# Changelog\n\n## [0.0.1] - 2026-01-01\n\n- old\n");
  await commit(f.repo, "private config");
  const worker = await linkedWorktree(f);
  let client = f.rpc();
  const state = await client.request({ type: "get_state" });
  await client.request({ type: "get_commands" }).then((result: any) => assert.equal(result.commands.find((command: any) => command.name === "drift-worktree")?.source, "extension"));
  const mainConfig = await fs.readFile(join(f.repo, ".drift.json"), "utf8");
  const mainIgnore = await fs.readFile(join(f.repo, ".gitignore"), "utf8");

  // The user command adopts (relative to the launch cwd) without inference.
  const before = f.requests.length;
  let mark = client.events.length;
  await client.request({ type: "prompt", message: "/drift-worktree ../worker" });
  await until(async () => (await f.readRecord(state.sessionId)).worktree, "/drift-worktree did not adopt");
  assert.ok(samePath((await f.readRecord(state.sessionId)).worktree, worker.path));
  assert.equal((await f.readRecord(state.sessionId)).startBranch, worker.branch);
  assert.ok(!notices(client, mark).some((event: any) => event.notifyType === "error"), JSON.stringify(notices(client, mark)));

  // Configuration commands target the active root.
  await client.request({ type: "prompt", message: "/drift-changelog off" });
  assert.deepEqual(JSON.parse(await fs.readFile(join(worker.path, ".drift.json"), "utf8")), { changelog: false });
  await client.request({ type: "prompt", message: "/drift-changelog on" });
  assert.deepEqual(JSON.parse(await fs.readFile(join(worker.path, ".drift.json"), "utf8")), { changelog: true });
  await client.request({ type: "prompt", message: "/drift-track-artifacts on" });
  assert.equal(JSON.parse(await fs.readFile(join(worker.path, ".drift.json"), "utf8")).trackArtifacts, true);
  await client.request({ type: "prompt", message: "/drift-track-artifacts off" });
  assert.equal(JSON.parse(await fs.readFile(join(worker.path, ".drift.json"), "utf8")).trackArtifacts, false);
  assert.match(await fs.readFile(join(worker.path, ".gitignore"), "utf8"), /^\/drift\/$/m);
  assert.equal(await fs.readFile(join(f.repo, ".drift.json"), "utf8"), mainConfig, "a command wrote main's configuration");
  assert.equal(await fs.readFile(join(f.repo, ".gitignore"), "utf8"), mainIgnore);
  assert.equal(f.requests.length, before, "user commands must not start inference");

  // A profiled, private publication: the artifact in main's shared store, the fragment in the worker's branch.
  const mainChangelog = await fs.readFile(join(f.repo, "CHANGELOG.md"), "utf8");
  const requestsBefore = f.requests.length;
  await client.prompt("PUBLISH_AUTO_HANDOFF_CHANGELOG");
  const completed = await f.readRecord(state.sessionId);
  assert.ok(completed.completed, client.stderr);
  assert.ok(await exists(join(f.repo, completed.completed.path)), "private artifact not in main's shared store");
  assert.ok(!(await exists(join(worker.path, "drift"))), "a private linked worktree must hold no drift/ of its own");
  assert.ok(await exists(join(worker.path, "changelog.d/runtime-001-fixture.md")));
  assert.ok(!(await exists(join(f.repo, "changelog.d/runtime-001-fixture.md"))));
  assert.match(await fs.readFile(join(worker.path, "CHANGELOG.md"), "utf8"), /- Fixture change\./);
  assert.equal(await fs.readFile(join(f.repo, "CHANGELOG.md"), "utf8"), mainChangelog);
  assert.ok((await fs.readFile(join(f.repo, completed.completed.path), "utf8")).includes('next_session_profile: "architecture"'));
  // Continuation resolves the handoff through the active root and keeps the adoption.
  await until(() => f.requests.slice(requestsBefore + 1).find((request) => request.model === "architecture" && JSON.stringify(request).includes("Continue the work recorded in the Drift handoff at `" + completed.completed.path + "`")), "profiled continuation did not run from the adopted root");
  await until(async () => !(await client.request({ type: "get_state" })).isStreaming, "continuation did not settle");
  const continued = await f.readRecord(state.sessionId);
  assert.ok(samePath(continued.worktree, worker.path));
  assert.equal(continued.startBranch, worker.branch);
  assert.ok(!notices(client).some((event: any) => /No local Drift model profile|could not|requires Pi's working directory/.test(event.message)), JSON.stringify(notices(client)));

  // /drift picks up through the active root.
  mark = client.events.length;
  const pickupFrom = f.requests.length;
  await client.prompt("/drift");
  await until(() => f.requests.slice(pickupFrom).find((request) => JSON.stringify(request).includes("Continue the work recorded in the Drift handoff at `" + completed.completed.path + "`")), "/drift did not pick up through the adopted root");
  assert.ok(samePath((await f.readRecord(state.sessionId)).worktree, worker.path));
});

test("actual Pi rejects foreign, non-root and missing adoption targets and keeps the original adoption", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  const worker = await linkedWorktree(f);
  await fs.mkdir(join(worker.path, "sub"));
  const foreign = join(f.dir, "foreign");
  await fs.mkdir(foreign); await git(foreign, ["init", "-q"]);
  await git(foreign, ["config", "user.name", "Foreign"]); await git(foreign, ["config", "user.email", "foreign@example.invalid"]);
  await fs.writeFile(join(foreign, "x.txt"), "x\n"); await commit(foreign, "foreign");
  const cloned = join(f.dir, "clone");
  await git(f.dir, ["clone", "-q", f.repo, cloned]); // Same history, different common dir.
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const initial = await f.readRecord(state.sessionId);

  // Before any adoption: a rejected target leaves the launch measurement untouched.
  let mark = client.events.length;
  await client.prompt("WORKTREE_ADOPT " + foreign);
  assert.ok(toolEnds(client, "drift_worktree", mark)[0]?.isError, JSON.stringify(toolEnds(client, "drift_worktree", mark)));
  let record = await f.readRecord(state.sessionId);
  assert.equal(record.worktree, undefined);
  assert.equal(record.intervalId, initial.intervalId);
  assert.deepEqual(record.baseline, initial.baseline);

  await client.request({ type: "prompt", message: "/drift-worktree ../worker" });
  await until(async () => (await f.readRecord(state.sessionId)).worktree, "adoption failed");
  const adopted = await f.readRecord(state.sessionId);
  const bytes = await fs.readFile(f.recordPath(state.sessionId), "utf8");
  for (const target of [foreign, cloned, join(worker.path, "sub"), join(f.dir, "missing")]) {
    mark = client.events.length;
    await client.request({ type: "prompt", message: `/drift-worktree ${target}` });
    await until(() => notices(client, mark).length, `${target} produced no notice`);
    assert.ok(notices(client, mark).some((event: any) => event.notifyType === "error"), `${target} was not refused: ${JSON.stringify(notices(client, mark))}`);
    assert.equal(await fs.readFile(f.recordPath(state.sessionId), "utf8"), bytes, `${target} changed the record`);
  }
  for (const target of [foreign, join(worker.path, "sub")]) {
    mark = client.events.length;
    await client.prompt("WORKTREE_ADOPT " + target);
    assert.ok(toolEnds(client, "drift_worktree", mark)[0]?.isError, `${target} adopted by the model`);
    record = await f.readRecord(state.sessionId);
    assert.ok(samePath(record.worktree, worker.path));
    assert.equal(record.intervalId, adopted.intervalId);
    assert.equal(record.startCommit, adopted.startCommit);
    assert.deepEqual(record.baseline, adopted.baseline);
    assert.equal(record.history.length, adopted.history.length);
  }
});

test("actual Pi never writes main when the adopted root disappears, and the model recovers through drift_worktree", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"trackArtifacts":true}\n');
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\n");
  await commit(f.repo, "tracked");
  const worker = await linkedWorktree(f);
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  await client.prompt("WORKTREE_ADOPT ../worker");
  assert.ok(samePath((await f.readRecord(state.sessionId)).worktree, worker.path));
  await fs.rm(worker.path, { recursive: true, force: true });

  let mark = client.events.length;
  await client.prompt("PUBLISH_HANDOFF");
  let record = await f.readRecord(state.sessionId);
  assert.equal(record.completed, undefined);
  assert.ok(samePath(record.worktree, worker.path), "a missing target must not silently fall back to main");
  assert.ok(!(await exists(join(f.repo, "drift"))), "publication silently wrote main");
  assert.ok(toolEnds(client, "drift_publish", mark).every((event: any) => event.isError), JSON.stringify(toolEnds(client, "drift_publish", mark)));
  mark = client.events.length;
  await client.prompt("WORKTREE_STATUS");
  assert.equal(toolEnds(client, "drift_worktree", mark).length, 1, "status must stay available to the model for recovery");

  // Explicit recovery: adopt the launch root, then publish in a separate round.
  mark = client.events.length;
  await client.prompt("WORKTREE_ADOPT_THEN_PUBLISH " + f.repo);
  const [adoption] = toolEnds(client, "drift_worktree", mark);
  assert.ok(adoption && !adoption.isError, JSON.stringify(adoption));
  record = await f.readRecord(state.sessionId);
  assert.ok(record.completed, client.stderr);
  assert.ok(record.worktree === undefined || samePath(record.worktree, f.repo), record.worktree);
  assert.ok(await exists(join(f.repo, record.completed.path)));
});

test("actual Pi refuses drift_worktree adopt batched beside another tool call, then accepts separate calls", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"trackArtifacts":true}\n');
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\n");
  await commit(f.repo, "tracked");
  const worker = await linkedWorktree(f);
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const initial = await f.readRecord(state.sessionId);

  let mark = client.events.length;
  await client.prompt("WORKTREE_ADOPT_PUBLISH ../worker");
  const adoptions = toolEnds(client, "drift_worktree", mark);
  assert.equal(adoptions.length, 1);
  assert.ok(adoptions[0].isError, "adopt beside a sibling call must be refused");
  let record = await f.readRecord(state.sessionId);
  assert.equal(record.worktree, undefined);
  assert.equal(record.intervalId, initial.intervalId);
  assert.equal(record.startBranch, initial.startBranch);
  assert.ok(!(await exists(join(worker.path, "drift"))), "the batched sibling ran against the worker");
  assert.ok(!(await exists(join(f.repo, "drift"))), "the batched sibling ran against main");
  assert.ok(!record.receipts.length && !record.completed && !record.pending, JSON.stringify(record));
  assert.ok(!record.history?.length);

  mark = client.events.length;
  await client.prompt("WORKTREE_ADOPT_THEN_PUBLISH ../worker");
  assert.ok(!toolEnds(client, "drift_worktree", mark)[0]?.isError, JSON.stringify(toolEnds(client, "drift_worktree", mark)));
  record = await f.readRecord(state.sessionId);
  assert.ok(samePath(record.worktree, worker.path));
  assert.equal(record.startBranch, worker.branch);
  assert.ok(record.completed, client.stderr);
  assert.ok(await exists(join(worker.path, record.completed.path)), "separate publication did not use the adopted root");
});

test("actual Pi auto-lands the ADOPTED worker's branch, runs its check there and leaves main untouched", { skip: !piPresent, timeout: 120_000 }, async (t) => {
  const f = await fixture(t);
  const { bare, branch } = await withOrigin(f);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"trackArtifacts":true}\n');
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\nland-cwd.txt\n");
  await commit(f.repo, "tracked policy");
  await git(f.repo, ["push", "-q", "origin", `HEAD:${branch}`]);
  const worker = await linkedWorktree(f);
  // A harmless check recording where it ran, into a worker-only ignored file (never committed by landing).
  const check = `"${process.execPath}" -e "require('fs').writeFileSync('land-cwd.txt', process.cwd())"`;
  await fs.writeFile(join(worker.path, ".drift.json"), JSON.stringify({ trackArtifacts: true, land: { auto: true, check } }) + "\n");
  await fs.writeFile(join(worker.path, "worker-code.txt"), "worker code\n");
  await commit(worker.path, "worker work");
  const mainHead = (await git(f.repo, ["rev-parse", "HEAD"])).trim();

  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  let mark = client.events.length;
  await client.prompt("WORKTREE_ADOPT ../worker");
  assert.ok(!toolEnds(client, "drift_worktree", mark)[0]?.isError, JSON.stringify(toolEnds(client, "drift_worktree", mark)));
  mark = client.events.length;
  await client.prompt("PUBLISH_HANDOFF");
  const record = await f.readRecord(state.sessionId);
  assert.ok(record.completed, client.stderr);
  const [published] = toolEnds(client, "drift_publish", mark);
  assert.ok(published && !published.isError, JSON.stringify(published));
  assert.match(JSON.stringify(published), new RegExp(`Landed ${worker.branch} on origin/${branch}`));
  assert.match(JSON.stringify(published), /1 check passed/);
  const remote = (await git(bare, ["ls-tree", "-r", "--name-only", branch])).trim().split("\n");
  for (const file of ["worker-code.txt", record.completed.path, "drift/INDEX.md"]) assert.ok(remote.includes(file), `${file} not on the bare origin: ${remote}`);
  assert.ok(samePath(await fs.readFile(join(worker.path, "land-cwd.txt"), "utf8"), worker.path), "the check did not run in the worker");
  assert.ok(!(await exists(join(f.repo, "land-cwd.txt"))), "the check ran in main");
  assert.equal((await git(f.repo, ["rev-parse", "HEAD"])).trim(), mainHead, "main HEAD moved");
  assert.ok(!(await exists(join(f.repo, "drift"))), "artifact written to main");
  assert.ok(!(await exists(join(f.repo, "changelog.d"))), "fragment written to main");
  assert.ok(!(await exists(join(f.repo, "worker-code.txt"))));
});

test("actual Pi refuses adoption while a profiled continuation is queued, keeps the scope, and still continues", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  const worker = await linkedWorktree(f);
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const initial = await f.readRecord(state.sessionId);
  const requestsBefore = f.requests.length;
  const mark = client.events.length;
  // Publish a profiled handoff, then adopt in the next tool round, before agent_settled queues compaction.
  await client.prompt("PUBLISH_AUTO_THEN_ADOPT ../worker");
  const [published] = toolEnds(client, "drift_publish", mark);
  assert.ok(published && !published.isError, JSON.stringify(published));
  const adoptions = toolEnds(client, "drift_worktree", mark);
  assert.equal(adoptions.length, 1);
  assert.ok(adoptions[0].isError, "adoption must be refused while a continuation is queued");
  assert.match(JSON.stringify(adoptions[0]), /Continuation queued for drift\/runtime\/001-handoff-fixture\.md/);
  const completed = await f.readRecord(state.sessionId);
  assert.equal(completed.worktree, undefined);
  assert.ok(!completed.history?.length);
  assert.equal(completed.startBranch, initial.startBranch);
  assert.equal(completed.completed?.path, "drift/runtime/001-handoff-fixture.md");
  assert.ok(!(await exists(join(worker.path, "drift"))));
  // The ordinary automatic continuation still runs from the original scope.
  await until(() => f.requests.slice(requestsBefore + 1).find((request) => request.model === "architecture" && JSON.stringify(request).includes("Continue the work recorded in the Drift handoff at `" + completed.completed.path + "`")), "queued continuation did not run");
  await until(async () => !(await client.request({ type: "get_state" })).isStreaming, "continuation did not settle");
  const continued = await f.readRecord(state.sessionId);
  assert.equal(continued.worktree, undefined);
  assert.notEqual(continued.intervalId, initial.intervalId);
  assert.equal(continued.previousHandoff, completed.completed.path);
});

test("actual Pi refuses adoption while the record holds a pending publication, then the same input recovers it", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  const worker = await linkedWorktree(f);
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  await client.prompt("WORKTREE_ADOPT ../worker");
  assert.ok(samePath((await f.readRecord(state.sessionId)).worktree, worker.path));

  // A genuine pending intent on the session's own record: the index renderer is missing after the intent is saved.
  const records = (await Records.open(f.repo, state.sessionId, f.agent))!;
  assert.equal(records.file, f.recordPath(state.sessionId));
  const input = { feature: "runtime", kind: "research" as const, slug: "pending", body: researchBody, source_research: "", previous_handoff: "", related_artifacts: [] };
  await assert.rejects(publish(records, input, join(f.dir, "missing-python")));
  const pending = await f.readRecord(state.sessionId);
  assert.ok(pending.pending?.path, JSON.stringify(pending));
  const pendingJson = JSON.stringify(pending.pending);

  const mark = client.events.length;
  await client.prompt("WORKTREE_ADOPT " + f.repo);
  const [refused] = toolEnds(client, "drift_worktree", mark);
  assert.ok(refused?.isError, JSON.stringify(refused));
  assert.match(JSON.stringify(refused), /Incomplete publication/);
  const after = await f.readRecord(state.sessionId);
  assert.equal(JSON.stringify(after.pending), pendingJson, "pending publication changed");
  assert.equal(after.intervalId, pending.intervalId, "a new interval started");
  assert.equal(after.history.length, pending.history.length);
  assert.ok(samePath(after.worktree, worker.path));

  // Retrying the SAME input completes it.
  const receipt = await publish(records, input);
  assert.equal(receipt.path, pending.pending.path);
  const recovered = await f.readRecord(state.sessionId);
  assert.equal(recovered.pending, undefined);
  assert.ok(recovered.receipts.some((item: any) => item.path === receipt.path));
  assert.equal(recovered.intervalId, pending.intervalId);
});

async function legacySkill(f: Awaited<ReturnType<typeof fixture>>) {
  const dir = join(f.home, ".agents/skills/drift");
  // Replace only the fixture's own link. Never touch the real user's skills.
  if (process.platform !== "win32") await fs.unlink(dir);
  await fs.mkdir(dir, { recursive: true });
  const path = join(dir, "SKILL.md");
  const content = "---\nname: drift\ndescription: STALE DRIFT FIXTURE\n---\n\n# Old Drift\nSTALE WORKFLOW MUST NOT REACH INFERENCE\n";
  await fs.writeFile(path, content);
  await fs.writeFile(join(dir, "user-changes.txt"), "preserve my local changes\n");
  return { path, content };
}

function systemText(request: any): string {
  return (request.messages ?? []).filter((message: any) => ["system", "developer"].includes(message.role)).map((message: any) => message.content).join("\n");
}

test("actual Pi binds stale standalone Drift skills without modifying settings or the old checkout", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  const legacy = await legacySkill(f);
  const settings = await fs.readFile(join(f.agent, "settings.json"), "utf8");
  let client = f.rpc();
  const state = await client.request({ type: "get_state" });
  // Reproduce the real collision: Pi's inventory selects the old standalone copy.
  const commands = await client.request({ type: "get_commands" });
  assert.equal(commands.commands.find((command: any) => command.name === "skill:drift").sourceInfo.path, legacy.path);
  const assertBound = (request: any) => {
    const system = systemText(request);
    assert.ok(system.includes(join(root, "skills/drift/SKILL.md")), system);
    assert.ok(!system.includes(legacy.path), system);
    assert.ok(!system.includes("STALE DRIFT FIXTURE"));
  };
  await client.prompt("Use Drift execute for a bounded checkpoint.");
  assertBound(f.requests.at(-1));
  await client.prompt("/skill:drift execute the plan");
  assertBound(f.requests.at(-1));
  const expanded = JSON.stringify(f.requests.at(-1));
  assert.ok(expanded.includes("Profile-directed handoffs"));
  assert.ok(expanded.includes("execute the plan"));
  assert.ok(!expanded.includes("STALE WORKFLOW MUST NOT REACH INFERENCE"));
  // Direct RPC queue commands bypass Pi's input hook and expand the stale skill first.
  await client.request({ type: "steer", message: "/skill:drift queued steering" });
  await client.request({ type: "follow_up", message: "/skill:drift queued follow-up" });
  await client.prompt("Process the queued instructions");
  assert.ok(!JSON.stringify(f.requests).includes("STALE WORKFLOW MUST NOT REACH INFERENCE"));
  assert.ok(JSON.stringify(f.requests).includes("queued steering"));
  assert.ok(JSON.stringify(f.requests).includes("queued follow-up"));
  const history = JSON.stringify(await client.request({ type: "get_messages" }));
  assert.ok(history.includes("STALE WORKFLOW MUST NOT REACH INFERENCE"), "original session history was rewritten");
  await client.request({ type: "prompt", message: "/fixture-reload" });
  await client.prompt("Use Drift after reload");
  assertBound(f.requests.at(-1));
  await client.stop();
  client = f.rpc(state.sessionFile);
  await client.prompt("Use Drift after resume");
  assertBound(f.requests.at(-1));
  await client.request({ type: "compact", customInstructions: "Preserve the bounded next checkpoint." });
  await client.prompt("Use Drift after compaction");
  assertBound(f.requests.at(-1));
  assert.equal(await fs.readFile(join(f.agent, "settings.json"), "utf8"), settings);
  assert.equal(await fs.readFile(legacy.path, "utf8"), legacy.content);
  assert.equal(await fs.readFile(join(f.home, ".agents/skills/drift/user-changes.txt"), "utf8"), "preserve my local changes\n");
});

test("actual Pi repeats handoff continuation with a stale skill and stops on the unprofiled final handoff", { skip: !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  const legacy = await legacySkill(f);
  const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  await client.prompt("PUBLISH_CHAIN");
  await until(async () => (await f.readRecord(state.sessionId)).completed?.path === "drift/runtime/003-handoff-chain.md", "automatic chain did not publish three handoffs");
  await until(async () => !(await client.request({ type: "get_state" })).isStreaming, "final interval did not settle");
  const record = await f.readRecord(state.sessionId);
  assert.equal(record.completed.path, "drift/runtime/003-handoff-chain.md");
  assert.equal(record.receipts.length, 1); // Receipts belong to the current work interval.
  assert.deepEqual((await fs.readdir(join(f.repo, "drift/runtime"))).sort(), ["001-handoff-chain.md", "002-handoff-chain.md", "003-handoff-chain.md"]);
  const entries = await client.request({ type: "get_entries" });
  assert.equal(entries.entries.filter((entry: any) => entry.type === "compaction").length, 2);
  const continuations = f.requests.filter((request) => request.model === "architecture" && systemText(request).includes("available_skills"));
  assert.ok(continuations.length >= 2);
  for (const request of continuations) {
    assert.ok(systemText(request).includes(join(root, "skills/drift/SKILL.md")));
    assert.ok(!systemText(request).includes(legacy.path));
  }
  const final = await fs.readFile(join(f.repo, record.completed.path), "utf8");
  assert.ok(!final.includes("next_session_profile:"));
  const count = f.requests.length;
  await delay(200);
  assert.equal(f.requests.length, count, "completed plan kept looping");
});

test("actual Pi refuses a damaged bundled workflow and recovers on the next prompt after restoration", { skip: !piPresent, timeout: 60_000 }, async (t) => {
  const f = await fixture(t);
  await legacySkill(f);
  const copy = join(f.dir, "installed package with spaces");
  await fs.mkdir(copy);
  for (const path of ["package.json", "extensions", "lib", "skills", "scripts"]) await fs.cp(join(root, path), join(copy, path), { recursive: true });
  const settingsPath = join(f.agent, "settings.json");
  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  await fs.writeFile(settingsPath, JSON.stringify({ ...settings, packages: [copy] }));
  const workflowPath = join(copy, "skills/drift/execute.md");
  const workflow = await fs.readFile(workflowPath, "utf8");
  await fs.unlink(workflowPath);
  const client = f.rpc();
  await client.request({ type: "get_state" });
  await client.prompt("Use Drift, but do not use the stale fallback");
  assert.equal(f.requests.length, 0);
  assert.ok(JSON.stringify(await client.request({ type: "get_messages" })).includes("Drift workflow unavailable"));
  await fs.writeFile(workflowPath, workflow);
  await client.prompt("Use Drift again after the workflow file is restored");
  assert.equal(f.requests.length, 1);
  assert.ok(systemText(f.requests[0]).includes(join(copy, "skills/drift/SKILL.md")));
  await fs.unlink(workflowPath);
  await client.prompt("/skill:drift execute the plan");
  assert.equal(f.requests.length, 1, "explicit invocation fell back to the stale skill");
  await assert.rejects(client.request({ type: "compact" }), /cancelled/i);
  await fs.writeFile(workflowPath, workflow);
  await client.prompt("/skill:drift execute the plan after restoration");
  assert.equal(f.requests.length, 2);
  assert.ok(!JSON.stringify(f.requests.at(-1)).includes("STALE WORKFLOW MUST NOT REACH INFERENCE"));
});

test("actual Pi respects disabled discovery and keeps RPC skill expansion canonical with the picker disabled", { skip: !piPresent, timeout: 60_000 }, async (t) => {
  const f = await fixture(t);
  await legacySkill(f);
  let client = f.rpc(undefined, ["--no-skills"]);
  await client.prompt("Ordinary work with skill discovery disabled");
  assert.ok(!systemText(f.requests.at(-1)).includes("<available_skills>"));
  const commands = await client.request({ type: "get_commands" });
  assert.ok(!commands.commands.some((command: any) => command.name === "skill:drift"));
  await client.stop();
  const settingsPath = join(f.agent, "settings.json");
  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  await fs.writeFile(settingsPath, JSON.stringify({ ...settings, enableSkillCommands: false }));
  client = f.rpc();
  // Pi still expands explicit RPC skill requests with the picker disabled.
  await client.prompt("/skill:drift execute with the picker disabled");
  const request = JSON.stringify(f.requests.at(-1));
  assert.ok(request.includes("execute with the picker disabled"));
  assert.ok(request.includes("Profile-directed handoffs"));
  assert.ok(!request.includes("STALE WORKFLOW MUST NOT REACH INFERENCE"));
  assert.ok(systemText(f.requests.at(-1)).includes(join(root, "skills/drift/SKILL.md")));
});

test("actual Pi handles initialization failure without inference or a success claim", { skip: !piPresent, timeout: 45_000 }, async (t) => {
  const f = await fixture(t, true); const client = f.rpc();
  await client.request({ type: "get_state" });
  await client.request({ type: "prompt", message: "This must not reach the model" });
  await delay(200);
  assert.equal(f.requests.length, 0);
  const messages = await client.request({ type: "get_messages" });
  assert.ok(JSON.stringify(messages).includes("No successful recording is claimed"));
  assert.equal(await fs.readFile(join(f.agent, "drift"), "utf8"), "block record directory creation");
});

test("actual pi-acp initialization failure returns without inference", { skip: !acpBinary || !piPresent, timeout: 45_000 }, async (t) => {
  const f = await fixture(t, true);
  const client = new Client(process.execPath, [resolve(acpBinary!)], f.repo, f.acpEnv); f.clients.push(client);
  const request = (method: string, params: any) => client.request({ jsonrpc: "2.0", method, params });
  await request("initialize", { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "drift-test", version: "1" } });
  const created = await request("session/new", { cwd: f.repo, mcpServers: [] });
  await request("session/prompt", { sessionId: created.sessionId, prompt: [{ type: "text", text: "Do not infer without a record" }] });
  assert.equal(f.requests.length, 0);
  assert.ok(JSON.stringify(client.events).includes("No successful recording is claimed"), "ACP did not surface the failure notice");
});

test("actual pi-acp adopts a worker worktree from a main-checkout session without slash commands", { skip: !acpBinary || !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"trackArtifacts":true}');
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\n");
  await commit(f.repo, "tracked");
  const worker = await linkedWorktree(f);
  const client = new Client(process.execPath, [resolve(acpBinary!)], f.repo, f.acpEnv);
  f.clients.push(client);
  const request = (method: string, params: any) => client.request({ jsonrpc: "2.0", method, params });
  await request("initialize", { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "drift-test", version: "1" } });
  const created = await request("session/new", { cwd: f.repo, mcpServers: [] });
  const records = join(f.agent, "drift", hash(f.repo).slice(0, 24));
  const paths = (await fs.readdir(records)).filter((name) => name.endsWith(".json"));
  assert.equal(paths.length, 1);
  const initial = JSON.parse(await fs.readFile(join(records, paths[0]), "utf8"));
  const prompt = (text: string) => request("session/prompt", { sessionId: created.sessionId, prompt: [{ type: "text", text }] });
  await prompt("WORKTREE_ADOPT ../worker");
  const adopted = await f.readRecord(initial.sessionId);
  assert.ok(samePath(adopted.worktree, worker.path));
  assert.notEqual(adopted.intervalId, initial.intervalId);
  assert.equal(adopted.startBranch, worker.branch);
  await prompt("PUBLISH_HANDOFF");
  const completed = await f.readRecord(initial.sessionId);
  assert.ok(completed.completed, JSON.stringify(client.events).slice(-4000));
  const text = await fs.readFile(join(worker.path, completed.completed.path), "utf8");
  assert.ok(text.includes(`branch: ${JSON.stringify(worker.branch)}`));
  assert.ok(text.includes(`session_id: ${JSON.stringify(initial.sessionId)}`));
  assert.ok(!(await exists(join(f.repo, "drift"))), "ACP publication wrote the launch checkout");
});

test("actual pi-acp loads the package and publishes tracked artifacts without extension slash commands", { skip: !acpBinary || !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.repo, ".drift.json"), '{"trackArtifacts":true}');
  await fs.writeFile(join(f.repo, ".gitignore"), "logs/*\n");
  const client = new Client(process.execPath, [resolve(acpBinary!)], f.repo, f.acpEnv); f.clients.push(client);
  const request = (method: string, params: any) => client.request({ jsonrpc: "2.0", method, params });
  await request("initialize", { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "drift-test", version: "1" } });
  const created = await request("session/new", { cwd: f.repo, mcpServers: [] });
  const records = join(f.agent, "drift", hash(f.repo).slice(0, 24));
  const paths = (await fs.readdir(records)).filter((name) => name.endsWith(".json"));
  assert.equal(paths.length, 1);
  const original = JSON.parse(await fs.readFile(join(records, paths[0]), "utf8"));
  assert.equal(f.requests.length, 0);
  await request("session/prompt", { sessionId: created.sessionId, prompt: [{ type: "text", text: "PUBLISH_RESEARCH" }] });
  const researched = await f.readRecord(original.sessionId);
  assert.equal(researched.completed, undefined);
  assert.equal(researched.receipts.length, 1);
  assert.match(researched.receipts[0].path, /001-research-fixture.md$/);
  await request("session/prompt", { sessionId: created.sessionId, prompt: [{ type: "text", text: "PUBLISH_HANDOFF" }] });
  const completed = await f.readRecord(original.sessionId);
  assert.ok(completed.completed, JSON.stringify(client.events).slice(-4000));
  assert.equal(completed.started, original.started);
  assert.ok(JSON.stringify(f.requests).includes(original.intervalId));
  assert.ok(client.events.some((event: any) => JSON.stringify(event).includes("drift_publish")));
  assert.ok((await fs.readFile(join(f.repo, completed.completed.path), "utf8")).includes(original.sessionId));
  assert.equal(await fs.readFile(join(f.repo, ".gitignore"), "utf8"), "logs/*\n");
  assert.ok((await git(f.repo, ["ls-files", "--others", "--exclude-standard"])).includes(completed.completed.path));
  assert.equal(await git(f.repo, ["diff", "--cached", "--name-only"]), "");
});
