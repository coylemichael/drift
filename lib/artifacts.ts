import * as fs from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactPathPattern, atomicWrite, exists, git, hash, now, Records, run, safePath, withLock } from "./state.ts";
import type { Pending, Receipt, RecordData } from "./state.ts";

export interface ArtifactInput {
  feature: string;
  kind: "research" | "plan" | "handoff";
  slug: string;
  body: string;
  status?: string;
  source_research?: string;
  previous_handoff?: string;
  related_artifacts?: string[];
  next_session_profile?: string;
}

const profilePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const headings = {
  research: ["Research Question", "Summary", "Detailed Findings", "Code References", "Open Questions"],
  plan: ["Objective", "Source Research", "Starting Point", "Key Files", "Implementation Sequence", "Decisions & Constraints", "Open Questions"],
  handoff: ["Objective", "Source Documents", "Status", "What Changed", "Codebase Context", "What Deviated from Plan", "Open Questions", "Next Steps"],
};
const builder = fileURLToPath(new URL("../scripts/build-index.py", import.meta.url));

function optionalReference(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be an artifact path string or omitted`);
  return value.trim() || undefined;
}

async function validate(repo: string, input: ArtifactInput): Promise<ArtifactInput> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(input.feature)) throw new Error("Feature must be a safe folder identifier (letters, digits, hyphens, underscores)");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 80) throw new Error("Slug must be lowercase words separated by hyphens");
  if (!Object.hasOwn(headings, input.kind)) throw new Error("Unknown artifact kind");
  if (typeof input.body !== "string" || Buffer.byteLength(input.body) > 256 * 1024 || /^---(?:\r?\n|$)/.test(input.body.trimStart())) {
    throw new Error("Provide Markdown body only (no frontmatter), at most 256 KiB");
  }
  const missing = headings[input.kind].filter((heading) => !new RegExp(`^## ${heading}\\s*$`, "m").test(input.body));
  if (missing.length) throw new Error(`Missing sections: ${missing.join(", ")}`);
  if (input.status !== undefined && (typeof input.status !== "string" || input.status.length > 200 || /[\r\n]/.test(input.status))) throw new Error("Status must be a single line, at most 200 characters");
  if (input.next_session_profile !== undefined && typeof input.next_session_profile !== "string") {
    throw new Error("next_session_profile must be a lowercase hyphenated profile name or omitted");
  }
  const nextProfile = input.next_session_profile?.trim() || undefined;
  if (nextProfile !== undefined && !profilePattern.test(nextProfile)) {
    throw new Error("next_session_profile must be a lowercase hyphenated profile name");
  }
  if (input.kind !== "handoff" && nextProfile !== undefined) {
    throw new Error("next_session_profile is only supported for handoff artifacts");
  }
  const source = optionalReference(input.source_research, "source_research");
  const previous = optionalReference(input.previous_handoff, "previous_handoff");
  if (input.related_artifacts !== undefined && !Array.isArray(input.related_artifacts)) throw new Error("related_artifacts must be an array of artifact paths or omitted");
  const related = input.related_artifacts?.map((ref, index) => optionalReference(ref, `related_artifacts[${index}]`)).filter((ref): ref is string => ref !== undefined);
  const refs = [source, previous, ...(related ?? [])].filter((ref): ref is string => ref !== undefined);
  for (const ref of refs) {
    if (!/^drift\/.+\.md$/.test(ref) || ref.includes("\\") || ref.split("/").some((part) => part === ".." || part === ".")) throw new Error(`Invalid artifact reference: ${JSON.stringify(ref)}`);
    const path = await safePath(repo, resolve(repo, ref));
    if (!(await fs.stat(path)).isFile()) throw new Error(`Artifact reference is not a file: ${ref}`);
  }
  // Stable ordering/normalization makes retries idempotent within the owned interval.
  return {
    feature: input.feature, kind: input.kind, slug: input.slug, body: input.body.trim() + "\n",
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(source ? { source_research: source } : {}),
    ...(previous ? { previous_handoff: previous } : {}),
    ...(related ? { related_artifacts: [...new Set(related)] } : {}),
    ...(nextProfile ? { next_session_profile: nextProfile } : {}),
  };
}

async function ensureIgnored(repo: string, artifact: string): Promise<void> {
  const path = await safePath(repo, join(repo, ".gitignore"));
  const text = await exists(path) ? await fs.readFile(path, "utf8") : "";
  if (!text.split(/\r?\n/).includes("/drift/")) {
    const mode = await exists(path) ? (await fs.stat(path)).mode & 0o777 : 0o644;
    await atomicWrite(path, text + (text && !text.endsWith("\n") ? "\n" : "") + "/drift/\n", mode);
  }
  await git(repo, ["check-ignore", "--no-index", "-q", artifact]);
}

async function prepare(repo: string, record: RecordData, input: ArtifactInput, digest: string): Promise<Pending> {
  const folder = await safePath(repo, join(repo, "drift", input.feature));
  await fs.mkdir(folder, { recursive: true });
  const numbers = (await fs.readdir(folder)).map((name) => /^(\d{3})-.*\.md$/.exec(name)).filter(Boolean).map((match) => Number(match![1]));
  const number = Math.max(0, ...numbers) + 1;
  if (number > 999) throw new Error("Feature has exhausted its three-digit sequence; choose a new feature explicitly");
  const sequence = String(number).padStart(3, "0");
  const path = `drift/${input.feature}/${sequence}-${input.kind}-${input.slug}.md`;
  const date = now();
  const fields: Record<string, unknown> = {
    date, branch: (await git(repo, ["symbolic-ref", "--short", "HEAD"], true)).trim() || "HEAD",
    git_commit: (await git(repo, ["rev-parse", "--verify", "HEAD"], true)).trim() || null,
    feature: input.feature, sequence, type: input.kind,
    session_started: record.started, session_id: record.sessionId, interval_id: record.intervalId,
    start_branch: record.startBranch, start_commit: record.startCommit,
  };
  for (const name of ["status", "source_research", "previous_handoff", "related_artifacts", "next_session_profile"] as const) {
    if (input[name] !== undefined) fields[name] = input[name];
  }
  const frontmatter = Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n");
  const content = `---\n${frontmatter}\n---\n\n${input.body}`;
  return { digest, path, kind: input.kind, date, content, sha256: hash(content) };
}

function validatePending(record: RecordData, pending: Pending): void {
  // Reject corrupt/edited state rather than following arbitrary paths in it.
  if (!artifactPathPattern.test(pending.path) ||
      !/^[a-f0-9]{64}$/.test(pending.digest) || typeof pending.content !== "string" || hash(pending.content) !== pending.sha256 ||
      !pending.content.includes(`session_id: ${JSON.stringify(record.sessionId)}\n`) ||
      !pending.content.includes(`interval_id: ${JSON.stringify(record.intervalId)}\n`)) {
    throw new Error("Invalid pending publication; record left untouched for recovery");
  }
}

/** Code, not the model, supplies identity/frontmatter and completes the interval. */
export async function publish(store: Records, raw: ArtifactInput, python = process.env.DRIFT_PYTHON || "python3"): Promise<Receipt> {
  const input = await validate(store.repo, raw);
  const drift = await safePath(store.repo, join(store.repo, "drift"));
  await fs.mkdir(drift, { recursive: true });
  const index = await safePath(store.repo, join(drift, "INDEX.md"));
  const lock = await safePath(store.repo, join(drift, ".publish.lock"));
  return store.update(async (record) => withLock(lock, async () => {
    const digest = hash(JSON.stringify({ interval: record.intervalId, input }));
    const receipt = record.receipts.find((item) => item.digest === digest);
    if (record.pending && record.pending.digest !== digest) throw new Error(`Incomplete publication ${record.pending.path}; retry the SAME input before publishing another artifact`);
    if (record.completed && !receipt) throw new Error("This work interval already has a handoff; start a new working prompt before publishing more");
    const pending = record.pending ?? (receipt ? undefined : await prepare(store.repo, record, input, digest));
    const relativePath = pending?.path ?? receipt!.path;
    if (!artifactPathPattern.test(relativePath)) throw new Error("Invalid publication path in record");
    const path = await safePath(store.repo, resolve(store.repo, relativePath));
    if (!relativePath.startsWith(`drift/${input.feature}/`)) throw new Error("Mismatched publication receipt");
    await ensureIgnored(store.repo, path);
    if (pending) {
      validatePending(record, pending);
      record.pending = pending;
      await store.save(record); // Persist the recovery intent BEFORE artifact/index writes.
      if (await exists(path)) {
        if (await fs.readFile(path, "utf8") !== pending.content) throw new Error(`Publication conflicts with existing file; nothing overwritten: ${relativePath}`);
      } else {
        // A complete staging file is linked into place exclusively: never overwrite another writer.
        const staged = join(dirname(path), `.drift-${digest}.tmp`);
        try {
          await atomicWrite(staged, pending.content, 0o644);
          await fs.link(staged, path);
        } finally { await fs.rm(staged, { force: true }); }
      }
    } else if (!(await exists(path)) || hash(await fs.readFile(path)) !== receipt!.sha256) {
      throw new Error(`Published artifact was removed or changed: ${relativePath}; receipt retained`);
    }
    // One shared renderer; no second TS index implementation. stdout permits atomic replacement.
    const content = await run(python, ["-I", builder, drift, "--stdout"], store.repo);
    if (!content.includes(`](${relativePath.slice("drift/".length)})`)) throw new Error("Index renderer did not include the artifact");
    await safePath(store.repo, index);
    const mode = await exists(index) ? (await fs.stat(index)).mode & 0o777 : 0o644;
    await atomicWrite(index, content, mode);
    if (await fs.readFile(index, "utf8") !== content) throw new Error("Index verification failed");
    const result = receipt ?? { digest, path: pending!.path, kind: pending!.kind, date: pending!.date, sha256: pending!.sha256 };
    if (!receipt) {
      await store.capture(record, "publish");
      record.receipts.push(result);
    }
    delete record.pending;
    if (input.kind === "handoff") record.completed = result;
    await store.save(record); // Failure here is retryable from the persisted pending intent.
    return result;
  }));
}
