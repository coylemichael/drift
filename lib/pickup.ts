import * as fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { syncIndex } from "./artifacts.ts";
import { artifactStore, exists, python, run, safePath } from "./state.ts";

const checker = fileURLToPath(new URL("../scripts/check-staleness.py", import.meta.url));

// An artifact reference as typed, pasted or mentioned: `drift/<feature>/<NNN>-<kind>-<slug>.md` with either slash,
// or the bare file name. Zed mentions look like [@009-handoff-x.md](file:///C:/repo/drift/feature/009-handoff-x.md).
const pathReference = /drift[\\/]([A-Za-z0-9][A-Za-z0-9_-]{0,79})[\\/](\d{3}-(?:research|plan|handoff)-[a-z0-9-]+\.md)/;
const nameReference = /(?:^|[^A-Za-z0-9_-])(\d{3}-(?:research|plan|handoff)-[a-z0-9-]+\.md)/;
const indexRow = /^\| \d+ \|[^|]*\|[^|]*\|[^|]*\| \[[^\]]*\]\(([^)]+)\) \|$/;

/** Find the artifact the user referred to; undefined when they named none or it does not exist. */
async function referenced(repo: string, args: string): Promise<string | undefined> {
  const path = pathReference.exec(args);
  if (path) {
    const relative = `drift/${path[1]}/${path[2]}`;
    return await exists(await safePath(repo, join(repo, relative))) ? relative : undefined;
  }
  const name = nameReference.exec(args)?.[1];
  if (!name) return undefined;
  const drift = await safePath(repo, join(repo, "drift"));
  if (!(await exists(drift))) return undefined;
  const matches: string[] = [];
  for (const entry of await fs.readdir(drift, { withFileTypes: true })) {
    if (entry.isDirectory() && await exists(join(drift, entry.name, name))) matches.push(`drift/${entry.name}/${name}`);
  }
  return matches.length === 1 ? matches[0] : undefined; // Ambiguous across features: let the user be specific.
}

/** The newest artifact in the index, after bringing the index up to date. `root` is where drift/ lives. */
async function newest(repo: string, root: string): Promise<string | undefined> {
  try { await syncIndex(repo); } catch { /* A stale index still names real artifacts; the session start reports why. */ }
  const index = await safePath(root, join(root, "drift", "INDEX.md"));
  if (!(await exists(index))) return undefined;
  const rows = (await fs.readFile(index, "utf8")).split(/\r?\n/).map((line) => indexRow.exec(line)?.[1]).filter(Boolean);
  return rows.length ? `drift/${rows.at(-1)}` : undefined;
}

async function status(repo: string, path: string): Promise<string | undefined> {
  const text = await fs.readFile(await safePath(repo, join(repo, path)), "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  return /^status:\s*"?([a-z-]+)"?\s*$/m.exec(frontmatter)?.[1];
}

/**
 * One pickup note grading the artifact's code citations (scripts/check-staleness.py), so the
 * reading session knows what to re-check instead of trusting blindly or re-verifying everything.
 * Strictly non-blocking: a checker failure degrades to an "unavailable" note, never an error,
 * and an artifact without citations gets no note at all.
 */
export async function citationNote(repo: string, root: string, artifact: string, ledger?: string): Promise<string | undefined> {
  let report: { mode?: string; date?: string; commit?: string; citations?: Record<string, any>[]; counts?: Record<string, number> };
  try {
    report = JSON.parse(await run(await python(), ["-I", checker, join(root, artifact), repo, "--json"], repo));
  } catch {
    return "Citation check unavailable; treat the artifact's path:line references as unverified.";
  }
  const results = report.citations ?? [];
  if (ledger) {
    // The usefulness ledger: one line per successful check, zero-citation pickups included —
    // they are the denominator. Metrics never matter more than the pickup, so failures vanish.
    const line = JSON.stringify({ ts: new Date().toISOString(), repo, artifact, date: report.date ?? null, commit: report.commit ?? null, mode: report.mode, total: results.length, counts: report.counts ?? {} });
    try {
      await fs.mkdir(dirname(ledger), { recursive: true });
      await fs.appendFile(ledger, line + "\n", "utf8");
    } catch { /* ignored */ }
  }
  if (!results.length) return undefined;
  const counts = report.counts ?? {};
  const summary = ["fresh", "moved", "changed", "gone", "uncertain"].filter((v) => counts[v]).map((v) => `${counts[v]} ${v}`).join(", ");
  const ref = (c: any) => `${c.path}:${c.start}${c.end !== c.start ? `-${c.end}` : ""}`;
  const detail = (c: any) =>
    c.verdict === "moved" ? `${ref(c)} moved to ${c.to.path}:${c.to.line}`
    : c.verdict === "changed" ? `${ref(c)} changed${c.similarity !== undefined ? ` (${Math.round(c.similarity * 100)}% similar)` : ""}`
    : `${ref(c)} ${c.verdict}`;
  const stale = results.filter((c) => c.verdict !== "fresh").slice(0, 12).map(detail);
  return `Citation check (${report.mode} mode): ${summary}.` + (stale.length ? ` Re-check before relying on: ${stale.join("; ")}.` : " All cited code is unchanged.");
}

/**
 * Rewrite `/drift [args]` into a Drift skill request. Code picks the artifact so the default is deterministic:
 * a named artifact if the user gave one, otherwise the newest in drift/INDEX.md, routed by kind and status.
 */
export async function pickup(repo: string | undefined, args: string, ledger?: string): Promise<{ text: string; artifact?: string }> {
  const request = args.trim();
  if (!repo) return { text: `/skill:drift ${request}`.trim() };
  const { root } = await artifactStore(repo); // A private linked worktree reads the main worktree's drift/.
  const named = request ? await referenced(root, request) : undefined;
  if (request && !named) return { text: `/skill:drift ${request}` };
  const artifact = named ?? await newest(repo, root);
  if (!artifact) {
    return { text: "/skill:drift The user ran /drift to pick up work, but this repository has no Drift artifacts yet. Say so, and ask whether to start with research and which feature identifier to use. Do not start work yet." };
  }
  const kind = /\d{3}-(research|plan|handoff)-/.exec(artifact)![1];
  const state = await status(root, artifact);
  const source = named ? `the artifact the user named, \`${artifact}\`` : `the newest artifact in drift/INDEX.md, \`${artifact}\``;
  const finished = state === "superseded" || (kind !== "research" && state === "complete");
  if (finished && !named) {
    return { artifact, text: `/skill:drift The user ran /drift to pick up the latest work. ${source[0].toUpperCase()}${source.slice(1)} is a ${kind} with status "${state}", so there is no open work to continue. Say so, show the last few rows of drift/INDEX.md, and ask what to pick up next. Do not start work.` };
  }
  const workflow = {
    handoff: `Continue the work recorded in the Drift handoff at \`${artifact}\`. Follow the handoff workflow: read this handoff and its referenced source documents, inspect the recent project artifact index, then continue from its Next Steps. Do not re-research completed work.`,
    plan: `Execute the Drift plan at \`${artifact}\`. Follow the execute workflow: read the plan and its source research, then work through its Implementation Sequence.`,
    research: `Turn the Drift research at \`${artifact}\` into an implementation plan. Follow the planning workflow.`,
  }[kind as "handoff" | "plan" | "research"];
  const citations = await citationNote(repo, root, artifact, ledger);
  const notes = [
    `Picked by /drift: ${source}.`,
    ...(citations ? [citations] : []),
    ...(finished ? [`Its status is "${state}"; confirm with the user that they mean to reopen it before changing anything.`] : []),
    ...(named ? [`The user's message: ${request}`] : []),
  ];
  return { artifact, text: `/skill:drift ${workflow}\n\n${notes.join("\n")}` };
}
