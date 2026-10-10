import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import * as fs from "node:fs/promises";
import { devNull } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
export const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
export type Fingerprint = Record<string, string>;
export type Receipt = { digest: string; path: string; kind: string; date: string; sha256: string; fragment?: string };
export type Pending = Receipt & { content: string; fragment?: { path: string; content: string } };
export const artifactPathPattern = /^drift\/[A-Za-z0-9][A-Za-z0-9_-]{0,79}\/\d{3}-(research|plan|handoff)-[a-z0-9-]+\.md$/;
function validReceipt(value: any): value is Receipt {
  return value && typeof value.path === "string" && artifactPathPattern.test(value.path) &&
    ["research", "plan", "handoff"].includes(value.kind) && /^[a-f0-9]{64}$/.test(value.digest) &&
    /^[a-f0-9]{64}$/.test(value.sha256) && typeof value.date === "string" && !Number.isNaN(Date.parse(value.date));
}
/** A preserved exited interval: its original measured fields and receipts, never re-measured or nested. */
export interface IntervalSnapshot {
  intervalId: string;
  started: string;
  startBranch: string;
  startCommit: string | null;
  baseline: Fingerprint;
  checkpoint?: { at: string; reason: string; files: string[]; commits: string[] };
  receipts: Receipt[];
  completed?: Receipt;
  previousHandoff?: string;
  /** Absolute canonical worktree root this interval measured. */
  worktree: string;
  worktreeIdentity?: string;
  exited: string;
  reason: string;
  /** Final capture was impossible (worktree removed or replaced); the previous checkpoint is kept as-is. */
  checkpointError?: string;
}
export interface RecordData {
  /** Version 2 scopes intervals to adopted worktrees; old publishers must reject, not misread them as launch-root measurements. */
  version: 1 | 2;
  repo: string;
  sessionId: string;
  intervalId: string;
  started: string;
  startBranch: string;
  startCommit: string | null;
  baseline: Fingerprint;
  checkpoint?: { at: string; reason: string; files: string[]; commits: string[] };
  pending?: Pending;
  receipts: Receipt[];
  completed?: Receipt;
  previousHandoff?: string;
  /** Absolute canonical root of the explicitly adopted worktree; absent means the launch repository (`repo`). */
  worktree?: string;
  /** Identity of the worktree's Git directory, so recycling a path requires a new measured adoption. */
  worktreeIdentity?: string;
  /** Exited intervals preserved across explicit worktree adoption. Flat; snapshots hold no history. */
  history?: IntervalSnapshot[];
}

/** A recoverable scope failure: the adopted (or requested) worktree is unavailable or not this repository's. */
export class WorktreeScopeError extends Error {
  constructor(message: string) { super(message); this.name = "WorktreeScopeError"; }
}

function validCheckpoint(value: any): boolean {
  return Boolean(value) && typeof value === "object" && typeof value.at === "string" && typeof value.reason === "string" &&
    Array.isArray(value.files) && value.files.every((f: unknown) => typeof f === "string") &&
    Array.isArray(value.commits) && value.commits.every((c: unknown) => typeof c === "string");
}
/** The measured interval fields shared by active records and snapshots. */
function validInterval(r: any): boolean {
  return typeof r.intervalId === "string" && typeof r.started === "string" && !Number.isNaN(Date.parse(r.started)) &&
    typeof r.startBranch === "string" && (r.startCommit === null || /^[a-f0-9]{40,64}$/.test(r.startCommit)) &&
    Boolean(r.baseline) && typeof r.baseline === "object" && !Array.isArray(r.baseline) &&
    Object.values(r.baseline).every((value) => typeof value === "string") && Array.isArray(r.receipts) &&
    r.receipts.every(validReceipt) &&
    (r.checkpoint === undefined || validCheckpoint(r.checkpoint)) &&
    (r.previousHandoff === undefined || typeof r.previousHandoff === "string") &&
    (r.completed === undefined || (validReceipt(r.completed) && r.completed.kind === "handoff" && r.receipts.some((item: Receipt) => item.digest === r.completed.digest)));
}
const validRoot = (value: unknown) => typeof value === "string" && isAbsolute(value) && resolve(value) === value;
const validIdentity = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const snapshotKeys = new Set(["intervalId", "started", "startBranch", "startCommit", "baseline", "checkpoint", "receipts", "completed", "previousHandoff", "worktree", "worktreeIdentity", "exited", "reason", "checkpointError"]);
function validSnapshot(s: any): s is IntervalSnapshot {
  return Boolean(s) && typeof s === "object" && !Array.isArray(s) && Object.keys(s).every((key) => snapshotKeys.has(key)) &&
    validInterval(s) && validRoot(s.worktree) && typeof s.exited === "string" && !Number.isNaN(Date.parse(s.exited)) &&
    typeof s.reason === "string" && (s.checkpointError === undefined || typeof s.checkpointError === "string") &&
    (s.worktreeIdentity === undefined || validIdentity(s.worktreeIdentity));
}

/** Use the actual local offset, not a fabricated UTC/session timestamp. */
export function now(): string {
  const date = new Date();
  const offset = -date.getTimezoneOffset();
  const local = new Date(date.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return `${local}${offset < 0 ? "-" : "+"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
}

export async function run(binary: string, args: string[], cwd: string, optional: boolean | number = false): Promise<string> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  // Git for Windows rejects os.devNull (\\.\nul) as a config path but accepts NUL.
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : devNull, LC_ALL: "C" });
  try {
    return (await exec(binary, args, { cwd, env, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 })).stdout;
  } catch (error: any) {
    if (typeof error.code === "number" && !error.killed) {
      // Some Git queries use 1 for a normal negative answer, not a failure.
      if (typeof optional === "number" && error.code === optional) return error.stdout ?? "";
      if (optional === true) return "";
    }
    throw new Error(`${binary} failed: ${error.stderr?.trim() || error.message}`);
  }
}

export const git = (repo: string, args: string[], optional: boolean | number = false) =>
  run("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", ...args], repo, optional);

let interpreter: Promise<string> | undefined;
/** DRIFT_PYTHON, else the first working Python 3. Windows' python3 is often a Store stub that exits non-zero. */
export function python(): Promise<string> {
  return interpreter ??= (async () => {
    if (process.env.DRIFT_PYTHON) return process.env.DRIFT_PYTHON;
    for (const candidate of process.platform === "win32" ? ["python3", "python", "py"] : ["python3"]) {
      try {
        await run(candidate, ["-c", "import sys; sys.exit(sys.version_info < (3,))"], process.cwd());
        return candidate;
      } catch { /* try the next candidate */ }
    }
    throw new Error("Python 3 was not found; install it or set DRIFT_PYTHON");
  })();
}

export async function repoRoot(cwd: string): Promise<string | undefined> {
  try {
    return await fs.realpath((await git(cwd, ["rev-parse", "--show-toplevel"])).trim());
  } catch (error) {
    if (String(error).includes("not a git repository")) return undefined;
    throw error;
  }
}

const worktreeRoots = new Map<string, Promise<string | undefined>>();
/**
 * The main worktree sharing this checkout's object store: the checkout itself for an ordinary clone, the parent
 * of the common dir for a linked worktree, undefined for a linked worktree of a bare repository (no project root
 * exists to hold a shared store) or for a non-repository.
 */
export function mainWorktree(repo: string): Promise<string | undefined> {
  let pending = worktreeRoots.get(repo);
  if (!pending) {
    pending = (async () => {
      let gitDir: string, common: string;
      try {
        gitDir = resolve(repo, (await git(repo, ["rev-parse", "--git-dir"])).trim());
        common = resolve(repo, (await git(repo, ["rev-parse", "--git-common-dir"])).trim());
      } catch { return undefined; }
      if (await fs.realpath(gitDir) === await fs.realpath(common)) return repo;
      const parent = dirname(common);
      if (basename(common) !== ".git" || !(await exists(join(parent, ".git")))) return undefined;
      return fs.realpath(parent);
    })();
    worktreeRoots.set(repo, pending);
  }
  return pending;
}

/** Repository-root `.drift.json`, validated. Every field is an explicit, host-neutral project choice; nothing is inferred. */
export interface DriftConfig {
  trackArtifacts: boolean;
  /** `auto`: on when the repo has an origin remote and a CHANGELOG.md. `on`/`off`: the repo's explicit override. */
  changelog: { mode: "auto" | "on" | "off"; tags: string };
  land: { auto: boolean; check: string[] } | undefined;
}

const configShape = "trackArtifacts (boolean), changelog (boolean, or {tags: glob}) and land ({auto: boolean, check: command or [commands]})";

async function rawConfig(repo: string): Promise<{ path: string; raw: Record<string, unknown> | undefined }> {
  const path = await safePath(repo, join(repo, ".drift.json"));
  if (!(await exists(path))) return { path, raw: undefined };
  const stat = await fs.stat(path);
  if (!stat.isFile() || stat.size > 64 * 1024) throw new Error(`Drift configuration must be a regular file of at most 64 KiB: ${path}`);
  let input: unknown;
  try { input = JSON.parse(await fs.readFile(path, "utf8")); }
  catch { throw new Error(`Invalid JSON in Drift configuration: ${path}`); }
  const invalid = () => new Error(`Drift configuration must be an object with only ${configShape}: ${path}`);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid();
  const raw = input as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (key === "trackArtifacts" && typeof value === "boolean") continue;
    if (key === "changelog" && (typeof value === "boolean" || (value && typeof value === "object" && !Array.isArray(value) &&
        Object.keys(value).every((k) => k === "tags") && (!("tags" in value) || (typeof (value as any).tags === "string" && (value as any).tags.trim()))))) continue;
    if (key === "land" && value && typeof value === "object" && !Array.isArray(value) &&
        Object.keys(value).every((k) => k === "auto" || k === "check") &&
        (!("auto" in value) || typeof (value as any).auto === "boolean") &&
        (!("check" in value) || typeof (value as any).check === "string" || (Array.isArray((value as any).check) && (value as any).check.every((c: unknown) => typeof c === "string")))) continue;
    throw invalid();
  }
  return { path, raw };
}

export async function driftConfig(repo: string): Promise<DriftConfig> {
  const { raw } = await rawConfig(repo);
  const changelog = raw?.changelog as boolean | { tags?: string } | undefined;
  const land = raw?.land as { auto?: boolean; check?: string | string[] } | undefined;
  return {
    trackArtifacts: (raw?.trackArtifacts as boolean | undefined) ?? false,
    changelog: {
      mode: changelog === undefined ? "auto" : changelog === false ? "off" : "on",
      tags: (typeof changelog === "object" && changelog.tags?.trim()) || "v*",
    },
    land: land ? { auto: land.auto ?? false, check: land.check === undefined ? [] : Array.isArray(land.check) ? land.check : [land.check] } : undefined,
  };
}

/** A shared branch exists somewhere else: the trigger for everything that only matters when two copies of a file can meet. */
export async function hasOrigin(repo: string): Promise<boolean> {
  return Boolean((await git(repo, ["remote", "get-url", "origin"], true)).trim());
}

/** Write a partial update, keeping every other field. The existing file is validated before it is touched. */
export async function updateConfig(repo: string, patch: Record<string, unknown>): Promise<void> {
  const { path, raw } = await rawConfig(repo);
  const next: Record<string, unknown> = { ...(raw ?? {}), ...patch };
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  const mode = await exists(path) ? (await fs.stat(path)).mode & 0o777 : 0o644;
  await atomicWrite(path, JSON.stringify(next, null, 2) + "\n", mode);
}

/** Host-neutral, repo-local opt-in. Never infer consent from tracked history. */
export async function trackArtifacts(repo: string): Promise<boolean> {
  return (await driftConfig(repo)).trackArtifacts;
}

export type StoreState = "own" | "shared" | "no-main" | "two-stores";

/**
 * Where this checkout's `drift/` lives. Private artifacts never travel through git, so every worktree of a
 * repository uses the main worktree's `drift/`; a linked worktree holds none of its own, and nothing is linked
 * (Git for Windows treats a junction as a directory and `git worktree remove` deletes through it). Tracked
 * repositories keep a folder per worktree, since those artifacts travel with the branch. A private worktree that
 * already holds its own artifacts keeps them; Drift moves nothing and creates nothing outside a project root.
 */
export async function artifactStore(repo: string, tracked?: boolean): Promise<{ root: string; state: StoreState }> {
  if (tracked ?? await trackArtifacts(repo)) return { root: repo, state: "own" };
  const main = await mainWorktree(repo);
  if (main === repo) return { root: repo, state: "own" };
  if (!main) return { root: repo, state: "no-main" };
  const own = join(repo, "drift");
  if (await exists(own) && !(await fs.lstat(own)).isSymbolicLink() && (await fs.readdir(own)).length) return { root: repo, state: "two-stores" };
  return { root: main, state: "shared" };
}

/** A merge, rebase, cherry-pick or revert is mid-flight in this worktree; derived files must not be rewritten under it. */
export async function mergeInProgress(repo: string): Promise<boolean> {
  const gitDir = resolve(repo, (await git(repo, ["rev-parse", "--git-dir"])).trim());
  for (const marker of ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"]) {
    if (await exists(join(gitDir, marker))) return true;
  }
  return false;
}

export async function exists(path: string): Promise<boolean> {
  try { await fs.lstat(path); return true; }
  catch (error: any) { if (error.code === "ENOENT") return false; throw error; }
}

/** Managed paths cannot escape their root or traverse a symlink. Not a sandbox. */
export async function safePath(root: string, path: string): Promise<string> {
  const target = resolve(path);
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || resolve(root, rel) !== target) {
    throw new Error(`Path escapes managed root: ${path}`);
  }
  let part = root;
  for (const segment of rel.split(sep).filter(Boolean)) {
    part = join(part, segment);
    if (await exists(part)) {
      if ((await fs.lstat(part)).isSymbolicLink()) throw new Error(`Managed path is a symlink: ${part}`);
    }
  }
  return target;
}

export async function atomicWrite(path: string, text: string, mode = 0o600): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await fs.open(temp, "wx", mode);
    try { await file.writeFile(text, "utf8"); await file.sync(); }
    finally { await file.close(); }
    await replace(temp, path);
  } finally { await fs.rm(temp, { force: true }); }
}

/** Windows refuses to rename over a file another process (a reader, antivirus) has open; that clears quickly, so retry briefly. */
async function replace(from: string, to: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  for (;;) {
    try { return await fs.rename(from, to); }
    catch (error: any) {
      if (process.platform !== "win32" || !["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
      if (Date.now() >= deadline) return overwrite(from, to, error);
      await delay(20);
    }
  }
}

/**
 * A long-lived handle without delete sharing (an editor buffer, e.g. Zed holding a file the agent read) blocks
 * rename-over indefinitely but usually still permits writes. Rewrite in place; callers already hold the lock.
 */
async function overwrite(from: string, to: string, cause: Error): Promise<void> {
  const text = await fs.readFile(from);
  let file;
  try { file = await fs.open(to, "r+"); }
  catch { throw cause; }
  try { await file.truncate(0); await file.write(text, 0, text.length, 0); await file.sync(); }
  finally { await file.close(); }
}

/** Cross-process exclusion. Never guess whether a timed-out lock is abandoned. */
export async function withLock<T>(path: string, work: () => Promise<T>, timeout = 5_000): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try { await fs.mkdir(path, { mode: 0o700 }); break; }
    catch (error: any) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw new Error(`Drift lock is busy: ${path}. If it is stale, confirm its owner stopped before removing it.`);
      await delay(25);
    }
  }
  try {
    await fs.writeFile(join(path, "owner.json"), JSON.stringify({ pid: process.pid, opened: now() }));
    return await work();
  } finally { await fs.rm(path, { recursive: true }); }
}

async function fileFingerprint(path: string): Promise<string> {
  let info;
  try {
    info = await fs.lstat(path);
    if (info.isSymbolicLink()) return `link:${await fs.readlink(path)}`;
    if (info.isDirectory()) {
      if (await repoRoot(path) !== await fs.realpath(path)) return "uninitialized-submodule";
      return `submodule:${(await git(path, ["rev-parse", "HEAD"], true)).trim()}:${JSON.stringify(await fingerprint(path))}`;
    }
    if (!info.isFile()) throw new Error(`Cannot fingerprint non-regular file: ${path}`);
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(path)) digest.update(chunk);
    return `${(info.mode & 0o777).toString(8)}:${digest.digest("hex")}`;
  } catch (error: any) {
    if (error.code === "ENOENT") return "missing";
    if (error.code === "EACCES" || error.code === "EPERM") {
      return `unreadable:${info ? `${info.mode}:${info.size}:${info.mtimeMs}` : "no-metadata"}`;
    }
    throw error;
  }
}

export async function fingerprint(repo: string): Promise<Fingerprint> {
  const head = (await git(repo, ["rev-parse", "--verify", "HEAD"], true)).trim();
  const changed = await git(repo, ["diff", "--no-ext-diff", "--name-only", "--no-renames", "-z", ...(head ? ["HEAD"] : ["--cached"])]);
  const untracked = await git(repo, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const result: Fingerprint = Object.create(null);
  for (const name of [...new Set((changed + untracked).split("\0").filter(Boolean))].sort()) {
    result[name] = await fileFingerprint(join(repo, name));
  }
  return result;
}

export function delta(before: Fingerprint, after: Fingerprint): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((name) => before[name] !== after[name]).sort();
}

async function commonDir(repo: string): Promise<string> {
  return fs.realpath(resolve(repo, (await git(repo, ["rev-parse", "--git-common-dir"])).trim()));
}

/** Git may reuse the same worktrees/<name> path after remove/add. Its filesystem identity must still match. */
async function worktreeIdentity(repo: string): Promise<string> {
  const gitDir = await fs.realpath(resolve(repo, (await git(repo, ["rev-parse", "--git-dir"])).trim()));
  const stat = await fs.stat(gitDir, { bigint: true });
  return hash(JSON.stringify([gitDir, String(stat.dev), String(stat.ino), String(stat.birthtimeNs)]));
}

/** `repo` is the record anchor; `measured` (default: the anchor) is the worktree whose state is measured. */
async function fresh(repo: string, sessionId: string, previousHandoff?: string, measured = repo): Promise<RecordData> {
  return {
    version: 1, repo, sessionId, intervalId: randomUUID(), started: now(),
    startBranch: (await git(measured, ["rev-parse", "--abbrev-ref", "HEAD"], true)).trim() ||
      (await git(measured, ["symbolic-ref", "--short", "HEAD"], true)).trim(),
    startCommit: (await git(measured, ["rev-parse", "--verify", "HEAD"], true)).trim() || null,
    baseline: await fingerprint(measured), receipts: [], ...(previousHandoff ? { previousHandoff } : {}),
  };
}

export class Records {
  repo: string;
  file: string;
  sessionId: string;
  private root: string;

  private constructor(repo: string, sessionId: string, root: string) {
    this.repo = repo;
    this.sessionId = sessionId;
    this.root = root;
    this.file = join(root, `${sessionId}.json`);
  }

  static async open(cwd: string, sessionId: string, agentDir: string, beforeMeasure?: (repo: string) => Promise<void>): Promise<Records | undefined> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) throw new Error("Invalid Pi session identity");
    const repo = await repoRoot(cwd);
    if (!repo) return undefined;
    await fs.mkdir(agentDir, { recursive: true });
    const base = await fs.realpath(agentDir);
    const root = await safePath(base, join(base, "drift", hash(repo).slice(0, 24)));
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const store = new Records(repo, sessionId, root);
    await safePath(root, store.file);
    await withLock(`${store.file}.lock`, async () => {
      if (await exists(store.file)) await store.read();
      else {
        await beforeMeasure?.(repo);
        await store.save(await fresh(repo, sessionId));
      }
    });
    return store;
  }

  async read(): Promise<RecordData> {
    await safePath(this.root, this.file);
    const r = JSON.parse(await fs.readFile(this.file, "utf8"));
    if (!r || typeof r !== "object" || ![1, 2].includes(r.version) || r.repo !== this.repo || r.sessionId !== this.sessionId || !validInterval(r) ||
        (r.version === 1 && (r.worktree !== undefined || r.worktreeIdentity !== undefined || r.history !== undefined)) ||
        (r.pending !== undefined && (!validReceipt(r.pending) || typeof r.pending.content !== "string" || hash(r.pending.content) !== r.pending.sha256)) ||
        (r.worktree !== undefined && !validRoot(r.worktree)) ||
        (r.worktree === undefined ? r.worktreeIdentity !== undefined : !validIdentity(r.worktreeIdentity)) ||
        (r.history !== undefined && (!Array.isArray(r.history) || !r.history.every(validSnapshot)))) {
      throw new Error(`Invalid or mismatched Drift record; left untouched: ${this.file}`);
    }
    return r;
  }

  async save(record: RecordData): Promise<void> {
    await safePath(this.root, this.file);
    await atomicWrite(this.file, JSON.stringify(record, null, 2) + "\n");
  }

  async update<T>(work: (record: RecordData) => Promise<T>): Promise<T> {
    return withLock(`${this.file}.lock`, async () => work(await this.read()));
  }

  /**
   * The worktree this record currently measures: the adopted worktree, revalidated on every use, else the launch
   * repository. A removed or replaced adopted worktree raises WorktreeScopeError; it never falls back silently.
   */
  async effectiveRepo(record?: RecordData): Promise<string> {
    const current = record ?? await this.read();
    const target = current.worktree;
    if (target === undefined) return this.repo;
    const root = await this.validateWorktree(target, true);
    try {
      if (await worktreeIdentity(root) === current.worktreeIdentity) return root;
    } catch (error) {
      throw new WorktreeScopeError(`Adopted worktree ${target}: cannot verify its Git directory identity (${String(error)})`);
    }
    throw new WorktreeScopeError(`Adopted worktree ${target} was removed or recreated; explicitly adopt it again to measure a fresh interval`);
  }

  /** An absolute, existing, exact worktree root sharing this repository's real Git common directory; returned canonical. */
  private async validateWorktree(target: string, recorded = false): Promise<string> {
    if (typeof target !== "string" || !isAbsolute(target)) throw new WorktreeScopeError(`Worktree path must be absolute: ${target}`);
    const label = recorded ? `Adopted worktree ${target}` : `Worktree ${target}`;
    let canonical: string, top: string | undefined;
    try {
      if (!(await fs.stat(target)).isDirectory()) throw new WorktreeScopeError(`${label} is not a directory`);
      canonical = await fs.realpath(target);
      top = await repoRoot(canonical);
    } catch (error: any) {
      if (error instanceof WorktreeScopeError) throw error;
      if (error?.code === "ENOENT") throw new WorktreeScopeError(`${label} does not exist (removed?)`);
      throw new WorktreeScopeError(`${label} is unavailable: ${error?.message ?? error}`);
    }
    if (!top) throw new WorktreeScopeError(`${label} is not inside a Git worktree`);
    if (top !== canonical) throw new WorktreeScopeError(`${label} is not a worktree root (its root is ${top})`);
    if (recorded && canonical !== target) throw new WorktreeScopeError(`${label} now resolves elsewhere (${canonical}); it was replaced`);
    let same: boolean;
    try { same = await commonDir(canonical) === await commonDir(this.repo); }
    catch (error: any) { throw new WorktreeScopeError(`${label}: cannot read its Git common directory: ${error?.message ?? error}`); }
    if (!same) throw new WorktreeScopeError(`${label} does not share this repository's Git common directory (another clone, nested repository or submodule?)`);
    return canonical;
  }

  async beginTurn(): Promise<void> {
    await this.update(async (record) => {
      if (!record.completed) return;
      const next = await fresh(this.repo, this.sessionId, record.completed.path, await this.effectiveRepo(record));
      next.version = record.version;
      if (record.worktree !== undefined) {
        next.worktree = record.worktree;
        next.worktreeIdentity = record.worktreeIdentity;
      }
      if (record.history !== undefined) next.history = record.history;
      await this.save(next);
    });
  }

  /**
   * Explicitly move this session's active interval to another worktree of the same repository. `target` must be an
   * absolute, existing worktree root. The old interval is captured and archived (a completed one unchanged), then a
   * fresh interval is measured in the target. Returns false when the target already is the active root.
   * `beforeMeasure` runs after validation and archiving, before the target baseline is measured.
   */
  async adopt(target: string, beforeMeasure?: (repo: string) => Promise<void>): Promise<boolean> {
    return this.update(async (record) => {
      const root = await this.validateWorktree(target);
      let previous: string | undefined, checkpointError: string | undefined;
      try { previous = await this.effectiveRepo(record); }
      catch (error) {
        if (!(error instanceof WorktreeScopeError)) throw error;
        checkpointError = error.message;
      }
      if (previous === root) return false;
      if (record.pending) throw new Error(`Incomplete publication ${record.pending.path}; retry the SAME drift_publish input before switching worktrees`);
      await driftConfig(root); // A target with invalid configuration is refused before anything changes.
      if (previous && !record.completed) await this.capture(record, "adopt", previous);
      const { version, repo, sessionId, worktree, history, pending, ...interval } = record;
      const snapshot: IntervalSnapshot = {
        ...interval, worktree: worktree ?? this.repo, exited: now(), reason: "adopt",
        ...(checkpointError && !record.completed ? { checkpointError: `Final capture impossible; previous checkpoint kept. ${checkpointError}` } : {}),
      };
      await beforeMeasure?.(root);
      // previousHandoff is not carried: its path may not exist in the target's store. History keeps it.
      const next = await fresh(this.repo, this.sessionId, undefined, root);
      next.version = 2;
      if (root !== this.repo) {
        next.worktree = root;
        next.worktreeIdentity = await worktreeIdentity(root);
      }
      next.history = [...(history ?? []), snapshot];
      await this.save(next);
      return true;
    });
  }

  /** Caller holds this record's lock; publication captures its final observed delta too. `repo` is the measured worktree. */
  async capture(record: RecordData, reason: string, repo?: string): Promise<void> {
    repo ??= await this.effectiveRepo(record);
    const files = new Set(delta(record.baseline, await fingerprint(repo)));
    const head = (await git(repo, ["rev-parse", "--verify", "HEAD"], true)).trim();
    let commits: string[] = [];
    if (record.startCommit && head && head !== record.startCommit) {
      commits = (await git(repo, ["log", "--format=%h %s", `${record.startCommit}..HEAD`])).trim().split("\n").filter(Boolean);
      for (const name of (await git(repo, ["diff", "--no-ext-diff", "--name-only", "-z", record.startCommit, "HEAD"])).split("\0").filter(Boolean)) files.add(name);
    }
    record.checkpoint = { at: now(), reason, files: [...files].sort(), commits };
  }

  async checkpoint(reason: string): Promise<void> {
    await this.update(async (record) => {
      if (record.completed) return;
      await this.capture(record, reason);
      await this.save(record);
    });
  }

  async context(): Promise<string> {
    const record = await this.read();
    let active: string | undefined, scopeError: string | undefined;
    try { active = await this.effectiveRepo(record); }
    catch (error) {
      if (!(error instanceof WorktreeScopeError)) throw error;
      scopeError = error.message;
    }
    const lines = [
      "Drift lifecycle is managed by the Pi extension. Do not run legacy hooks or delete records/session logs.",
      `Drift record: ${this.file}`,
      `Pi session: ${record.sessionId}; work interval: ${record.intervalId}`,
      `Measured start: ${record.started}; branch: ${record.startBranch}; commit: ${record.startCommit ?? "unborn"}`,
      `Interval: ${record.completed ? `published handoff ${record.completed.path}` : "active"}`,
      "Use the portable Drift skill for workflow/content. Use drift_publish for artifact metadata, numbering, index and handoff completion.",
      "Read the record for the exact starting fingerprint. Git deltas include overlapping work, not exclusive authorship.",
    ];
    if (record.pending) lines.push(`Incomplete publication: ${record.pending.path}. Retry the SAME drift_publish input; do not delete the record.`);
    // A rule in a doc only runs when the model reaches for it; this line arrives on the turn after work lands.
    const unpublished = (record.checkpoint?.files ?? []).filter((name) => !name.startsWith("drift/"));
    if (!record.completed && unpublished.length) {
      const since = record.receipts.at(-1)?.path ?? record.previousHandoff;
      lines.push(`Unpublished work in this interval: ${unpublished.length} file(s) changed${since ? ` since ${since}` : ""} (${unpublished.slice(0, 5).join(", ")}${unpublished.length > 5 ? ", …" : ""}). Before reporting this work finished, publish a handoff or say why none is needed. Publish when the session holds state the diff cannot show: commands that worked, dead ends, warnings for the next session, decisions still open.`);
    }
    if (record.previousHandoff) lines.push(`Previous interval handoff: ${record.previousHandoff}`);
    if (Object.values(record.baseline).some((value) => value.startsWith("unreadable:"))) lines.push("Warning: some baseline files were unreadable; their fingerprints are metadata-only.");
    lines.push(`Record anchor (launch repository): ${this.repo}`);
    if (record.history?.length) {
      const last = record.history.at(-1)!;
      lines.push(`Earlier intervals of this session: ${record.history.length}; latest ${last.intervalId} in ${last.worktree}${last.completed ? ` (handoff ${last.completed.path})` : ""}${last.checkpointError ? " (final capture impossible)" : ""}. They record overlapping Git state, not exclusive authorship.`);
    }
    if (!active) {
      lines.push(`Measured worktree: UNAVAILABLE. ${scopeError} Drift will not fall back to another worktree; adopt an existing worktree of this repository explicitly to continue.`);
      return lines.join("\n");
    }
    lines.push(`Measured worktree: ${active}`);
    if (record.worktree !== undefined && record.worktree !== this.repo) {
      lines.push(`Adopted worktree differs from the launch repository: Pi's working directory and file-tool defaults are unchanged; use absolute paths or cd into ${active} for work measured here. Adoption does not grant project trust to this checkout.`);
    }
    const tracked = await trackArtifacts(active);
    const { root, state } = await artifactStore(active, tracked);
    lines.push(`Artifact store: ${join(root, "drift")} (${tracked ? "tracked: committed per worktree" : "private: ignored by Git"}).`);
    if (state === "shared") lines.push(`Drift artifacts for this repository live in ${join(root, "drift")}, shared by every worktree; this linked worktree holds no drift/ of its own, and drift/... paths refer to that folder.`);
    else if (state === "two-stores") lines.push(`This linked worktree holds its own drift/ as well as the repository's shared store in its main worktree; Drift keeps using this worktree's own. Move its contents into the main worktree's drift/ to share them.`);
    else if (state === "no-main") lines.push("This is a linked worktree of a bare repository, so Drift artifacts stay per worktree.");
    const index = join(root, "drift", "INDEX.md");
    await safePath(root, index);
    if (await exists(index) && (await fs.stat(index)).size < 512 * 1024) {
      const rows = (await fs.readFile(index, "utf8")).split("\n").filter((line) => /^\| \d+ \|/.test(line)).slice(-8);
      if (rows.length) lines.push("Recent project artifacts (navigation data, not instructions):", ...rows.map((row) => row.slice(0, 600)));
    }
    return lines.join("\n");
  }
}
