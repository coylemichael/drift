import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changelogState } from "./changelog.ts";
import { artifactStore, driftConfig, exists, git, mergeInProgress, python, run, withLock, type DriftConfig, type Records } from "./state.ts";

const indexBuilder = fileURLToPath(new URL("../scripts/build-index.py", import.meta.url));
const changelogBuilder = fileURLToPath(new URL("../scripts/build-changelog.py", import.meta.url));

/** A landing that stopped on purpose. `stage` names the step; the message says what to do. The branch is left as it was. */
export type LandStage = "branch" | "tree" | "remote" | "conflict" | "derived" | "guard" | "check" | "push";
export class LandHalt extends Error {
  readonly stage: LandStage;
  constructor(stage: LandStage, message: string) {
    super(message);
    this.stage = stage;
  }
}

export interface LandOutcome { branch: string; target: string; pushed: string; attempts: number; checks: number; note?: string }
export interface LandOptions {
  /** This thread's record, checkpointed with reason `land` once the push succeeds. */
  records?: Records;
  /** Test seam: runs between the checks and the push, where another thread's landing can intervene. */
  beforePush?: () => Promise<void>;
}

async function defaultBranch(repo: string): Promise<string> {
  const head = (await git(repo, ["symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"], true)).trim();
  if (head.startsWith("origin/")) return head.slice("origin/".length);
  for (const name of ["main", "master"]) {
    if ((await git(repo, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${name}`], true)).trim()) return name;
  }
  throw new LandHalt("remote", "Cannot tell which branch to land on: origin has no HEAD, main or master. Run git remote set-head origin --auto, then land again.");
}

/**
 * Every file the rebased branch changes against upstream must come from one of its own commits. A squash taken
 * against a moved ref, or a push from a stale index, shows up here as files nobody on this branch touched.
 */
export async function landingGuard(repo: string, upstream: string): Promise<string[]> {
  const changed = (await git(repo, ["diff", "--name-only", upstream, "HEAD"])).split("\n").filter(Boolean);
  const own = new Set((await git(repo, ["log", "--name-only", "--format=", `${upstream}..HEAD`])).split("\n").filter(Boolean));
  return changed.filter((file) => !own.has(file));
}

/** The repo's own check command, through the platform shell; Drift knows nothing about what it runs. */
function shell(command: string, cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((settle) => {
    const child = spawn(command, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => settle({ code: -1, output: output + error.message }));
    child.on("close", (code) => settle({ code: code ?? -1, output }));
  });
}

/** Derived files are verified, never rewritten here: a mismatch after the rebase is something to look at, not paper over. */
async function verifyDerived(repo: string, config: DriftConfig): Promise<void> {
  const { root } = await artifactStore(repo, config.trackArtifacts);
  if (config.trackArtifacts && await exists(join(root, "drift"))) {
    try { await run(await python(), ["-I", indexBuilder, join(root, "drift"), "--check"], repo); }
    catch (error) {
      if (!String(error).includes("no Drift artifacts")) {
        throw new LandHalt("derived", `drift/INDEX.md is out of sync with the artifacts after the rebase (${String(error).replace(/^.*?failed: /, "").trim()}). Rebuild it (any Drift publication or session start does), commit, and land again. Nothing was pushed.`);
      }
    }
  }
  if ((await changelogState(repo)).enabled) {
    try { await run(await python(), ["-I", changelogBuilder, repo, "--check"], repo); }
    catch (error) {
      const text = String(error).replace(/^.*?failed: /, "").trim();
      const fix = text.includes("not produced by any fragment") ? "Move those lines into changelog.d/ fragments or delete them" : "Regenerate it (a Drift publication or session start does), commit";
      throw new LandHalt("derived", `CHANGELOG.md is out of sync after the rebase (${text}). ${fix}, and land again. Nothing was pushed.`);
    }
  }
}

/**
 * Land the current branch on origin's default branch: fetch, rebase (the merge drivers resolve the derived files),
 * verify derived files, guard, run the repo's checks, push, retry when the tip moved. Never squashes, never
 * force-pushes, never resets against a moving ref, never commits. Serialised across this repository's worktrees.
 */
export async function land(repo: string, options: LandOptions = {}): Promise<LandOutcome> {
  const config = await driftConfig(repo);
  const branch = (await git(repo, ["symbolic-ref", "--short", "-q", "HEAD"], true)).trim();
  if (!branch) throw new LandHalt("branch", "Not on a branch (detached HEAD); check out the branch to land first.");
  if (await mergeInProgress(repo)) throw new LandHalt("branch", "A merge or rebase is already in progress; finish or abort it first.");
  const dirty = (await git(repo, ["status", "--porcelain", "--untracked-files=no"])).split("\n").filter(Boolean);
  if (dirty.length) throw new LandHalt("tree", `Uncommitted changes to tracked files; commit or stash them first (landing never decides what to commit):\n${dirty.join("\n")}`);
  if (!(await git(repo, ["remote", "get-url", "origin"], true)).trim()) throw new LandHalt("remote", "No origin remote to land on.");
  const common = resolve(repo, (await git(repo, ["rev-parse", "--git-common-dir"])).trim());
  return withLock(join(common, "drift-land.lock"), async () => {
    const target = await defaultBranch(repo);
    const upstream = `origin/${target}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await git(repo, ["fetch", "--quiet", "origin", target]);
      try { await git(repo, ["rebase", "--quiet", upstream]); }
      catch (error) {
        const conflicted = (await git(repo, ["diff", "--name-only", "--diff-filter=U"], true)).split("\n").filter(Boolean);
        await git(repo, ["rebase", "--abort"], true);
        throw new LandHalt("conflict", `Rebase onto ${upstream} conflicts in ${conflicted.length ? conflicted.join(", ") : "the tree"}; the rebase was aborted and ${branch} is unchanged. Resolve it, then land again.${conflicted.length ? "" : `\n${String(error)}`}`);
      }
      await verifyDerived(repo, config);
      const foreign = await landingGuard(repo, upstream);
      if (foreign.length) {
        throw new LandHalt("guard", `After the rebase, ${branch} changes files none of its own commits touch, which is how a bad squash or a stale index reverts other threads' work:\n${foreign.join("\n")}\nNothing was pushed. Inspect git diff ${upstream} -- <file> before landing.`);
      }
      let checks = 0;
      for (const command of config.land?.check ?? []) {
        const result = await shell(command, repo);
        checks++;
        if (result.code !== 0) throw new LandHalt("check", `Check failed (exit ${result.code}): ${command}\n${result.output.trim().split(/\r?\n/).slice(-40).join("\n")}\nNothing was pushed.`);
      }
      await options.beforePush?.();
      try { await git(repo, ["push", "--quiet", "origin", `HEAD:${target}`]); }
      catch (error) {
        const text = String(error);
        // Only a tip that moved is worth another lap; a declined hook or an unreachable remote is not.
        if (/rejected|non-fast-forward|fetch first|failed to push some refs/i.test(text) && !/hook declined|pre-receive|update hook/i.test(text) && attempt < 3) continue;
        throw new LandHalt("push", `Push to ${upstream} failed${attempt > 1 ? ` after ${attempt} attempts` : ""}: ${text.replace(/^Error: git failed: /, "").trim()}`);
      }
      const pushed = (await git(repo, ["rev-parse", "--short", "HEAD"])).trim();
      await options.records?.checkpoint("land");
      return { branch, target, pushed, attempts: attempt, checks, ...(config.land?.check?.length ? {} : { note: "no check configured" }) };
    }
    throw new LandHalt("push", `${upstream} kept moving under three attempts; nothing was pushed. Land again.`);
  }, 15 * 60_000);
}

export function describeLanding(outcome: LandOutcome): string {
  return `Landed ${outcome.branch} on origin/${outcome.target} at ${outcome.pushed}${outcome.attempts > 1 ? ` (attempt ${outcome.attempts}: the tip moved and the rebase was redone)` : ""}; ${outcome.checks ? `${outcome.checks} check${outcome.checks === 1 ? "" : "s"} passed` : outcome.note ?? "no checks"}.`;
}
