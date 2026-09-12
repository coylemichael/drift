import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir, devNull } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { git, hash } from "../lib/state.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const piBinary = process.env.PI_TEST_BINARY || "pi";
// Opt in to the installed adapter without downloading anything.
const acpBinary = process.env.PI_TEST_ACP;
const piPresent = spawnSync(piBinary, ["--version"], { env: { PATH: process.env.PATH, PI_OFFLINE: "1", PI_TELEMETRY: "0" } }).status === 0;
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
  const dir = await fs.mkdtemp(join(tmpdir(), "drift-pi-test-"));
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
    const publish = /^PUBLISH_(RESEARCH|HANDOFF|AUTO_HANDOFF)/.test(marker) && !messages.slice(user + 1).some((message: any) => message.role === "tool");
    const kind = marker.startsWith("PUBLISH_RESEARCH") ? "research" : "handoff";
    // Real models may fill optional string fields with "" rather than omit them.
    const args = { feature: "runtime", kind, slug: "fixture", body: kind === "research" ? researchBody : body, source_research: "", previous_handoff: "", related_artifacts: [], ...(marker.startsWith("PUBLISH_AUTO_HANDOFF") ? { next_session_profile: "architecture" } : {}) };
    const delta = publish ? { role: "assistant", tool_calls: [{ index: 0, id: `publish-${kind}`, type: "function", function: { name: "drift_publish", arguments: JSON.stringify(args) } }] } : { role: "assistant", content: "Synthetic fixture response; preserve the bounded task and continue." };
    const common = { id: "drift-fixture", object: "chat.completion.chunk", created: 0, model: "fixture" };
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    response.end([
      { ...common, choices: [{ index: 0, delta, finish_reason: null }] },
      { ...common, choices: [{ index: 0, delta: {}, finish_reason: publish ? "tool_calls" : "stop" }], usage: { prompt_tokens: 200, completion_tokens: 20, total_tokens: 220 } },
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
  Object.assign(env, { HOME: home, USERPROFILE: home, PI_CODING_AGENT_DIR: agent, PI_OFFLINE: "1", PI_TELEMETRY: "0", PI_SKIP_VERSION_CHECK: "1", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull, XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache"), XDG_DATA_HOME: join(home, ".local/share"), XDG_STATE_HOME: join(home, ".local/state") });
  await git(repo, ["init", "-q"]); await git(repo, ["config", "user.name", "Drift runtime"]); await git(repo, ["config", "user.email", "drift@example.invalid"]);
  await fs.writeFile(join(repo, "file.txt"), "original\n"); await fs.writeFile(join(repo, ".gitignore"), "/drift/\n");
  await git(repo, ["add", "."]); await git(repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "fixture"]);
  await fs.writeFile(join(repo, "inherited.txt"), "already dirty\n");
  const rpc = (sessionFile?: string) => {
    const client = new Client(piBinary, ["--mode", "rpc", "--offline", "--no-context-files", ...(sessionFile ? ["--session", sessionFile] : [])], repo, env);
    clients.push(client); return client;
  };
  const recordPath = (id: string) => join(agent, "drift", hash(repo).slice(0, 24), `${id}.json`);
  const readRecord = async (id: string) => JSON.parse(await fs.readFile(recordPath(id), "utf8"));
  return { dir, home, agent, repo, requests, env, clients, rpc, recordPath, readRecord };
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

test("actual Pi automatically continues a profiled handoff in a fresh model-selected session", { skip: !piPresent, timeout: 60_000 }, async (t) => {
  const f = await fixture(t); const client = f.rpc();
  const state = await client.request({ type: "get_state" });
  const requestsBeforeHandoff = f.requests.length;
  await client.prompt("PUBLISH_AUTO_HANDOFF");
  const completed = await f.readRecord(state.sessionId);
  const artifact = completed.completed!.path;
  assert.ok((await fs.readFile(join(f.repo, artifact), "utf8")).includes('next_session_profile: "architecture"'));
  const replacement = await until(async () => {
    const current = await client.request({ type: "get_state" });
    return current.sessionId !== state.sessionId ? current : undefined;
  }, "profiled handoff did not create a fresh session");
  assert.notEqual(replacement.sessionId, state.sessionId);
  await until(() => f.requests.slice(requestsBeforeHandoff + 1).find((request) => request.model === "architecture" && JSON.stringify(request).includes("Continue the work recorded in the Drift handoff at `" + artifact + "`")), "fresh session did not send the profiled continuation prompt");
  await fs.mkdir(join(f.repo, "drift/runtime"), { recursive: true });
  await fs.writeFile(join(f.repo, "drift/runtime/099-handoff-unprofiled.md"), '---\ntype: "handoff"\n---\n');
  const requestsBeforeFailure = f.requests.length;
  await client.request({ type: "prompt", message: "drift-continue drift/runtime/099-handoff-unprofiled.md" });
  await delay(100);
  assert.equal(f.requests.length, requestsBeforeFailure);
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
  const client = new Client(process.execPath, [resolve(acpBinary!)], f.repo, { ...f.env, PI_ACP_PI_COMMAND: piBinary }); f.clients.push(client);
  const request = (method: string, params: any) => client.request({ jsonrpc: "2.0", method, params });
  await request("initialize", { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "drift-test", version: "1" } });
  const created = await request("session/new", { cwd: f.repo, mcpServers: [] });
  await request("session/prompt", { sessionId: created.sessionId, prompt: [{ type: "text", text: "Do not infer without a record" }] });
  assert.equal(f.requests.length, 0);
  assert.ok(JSON.stringify(client.events).includes("No successful recording is claimed"), "ACP did not surface the failure notice");
});

test("actual pi-acp loads the package and executes drift_publish without extension slash commands", { skip: !acpBinary || !piPresent, timeout: 90_000 }, async (t) => {
  const f = await fixture(t);
  const env = { ...f.env, PI_ACP_PI_COMMAND: piBinary };
  const client = new Client(process.execPath, [resolve(acpBinary!)], f.repo, env); f.clients.push(client);
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
});
