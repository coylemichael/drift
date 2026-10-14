import * as fs from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactLifecycle, artifactStore, exists, python, readArtifactCatalog, run, safePath, supersessionNote } from "./state.ts";
import type { ArtifactCatalogEntry } from "./state.ts";

const checker = fileURLToPath(new URL("../scripts/check-staleness.py", import.meta.url));

// An artifact reference as typed, pasted or mentioned: `drift/<feature>/<NNN>-<kind>-<slug>.md` with either slash,
// or the bare file name. Zed mentions look like [@009-handoff-x.md](file:///C:/repo/drift/feature/009-handoff-x.md).
const pathReference = /drift[\\/]([A-Za-z0-9][A-Za-z0-9_-]{0,79})[\\/](\d{3}-(?:research|plan|handoff)-[a-z0-9-]+\.md)/;
const nameReference = /(?:^|[^A-Za-z0-9_-])(\d{3}-(?:research|plan|handoff)-[a-z0-9-]+\.md)/;

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

/**
 * One pickup note grading the artifact's code citations (scripts/check-staleness.py), so the
 * reading session knows what to re-check instead of trusting blindly or re-verifying everything.
 * Strictly non-blocking: a checker failure degrades to an "unavailable" note, never an error,
 * capture coverage is explicit even for artifacts without numeric citations.
 */
export async function citationNote(repo: string, root: string, artifact: string, ledger?: string): Promise<string> {
  let report: { mode?: string; date?: string; commit?: string; citations?: Record<string, any>[]; counts?: Record<string, number>;
    anchor_coverage?: { status?: string; eligible?: number; captured?: number; skipped_count?: number }; anchor_coverage_summary?: string };
  try {
    report = JSON.parse(await run(await python(), ["-I", checker, join(root, artifact), repo, "--json"], repo));
  } catch {
    return "Citation check unavailable; anchor capture coverage and path:line freshness could not be read. Treat the artifact's references as unverified.";
  }
  const results = report.citations ?? [];
  if (ledger) {
    // The usefulness ledger: one line per successful check, zero-citation pickups included —
    // they are the denominator. Metrics never matter more than the pickup, so failures vanish.
    const coverage = report.anchor_coverage;
    const line = JSON.stringify({ ts: new Date().toISOString(), repo, artifact, date: report.date ?? null, commit: report.commit ?? null, mode: report.mode, total: results.length, counts: report.counts ?? {},
      anchor_coverage: coverage ? { status: coverage.status, eligible: coverage.eligible, captured: coverage.captured, skipped_count: coverage.skipped_count } : { status: "reader-unavailable" } });
    try {
      await fs.mkdir(dirname(ledger), { recursive: true });
      await fs.appendFile(ledger, line + "\n", "utf8");
    } catch { /* ignored */ }
  }
  const capture = `Anchor capture: ${report.anchor_coverage_summary?.slice(0, 600) ?? "unavailable (checker did not report coverage; artifact recording status is unknown)"}.`;
  if (!results.length) return capture;
  const counts = report.counts ?? {};
  const summary = ["fresh", "moved", "changed", "gone", "uncertain"].filter((v) => counts[v]).map((v) => `${counts[v]} ${v}`).join(", ");
  const ref = (c: any) => `${c.path}:${c.start}${c.end !== c.start ? `-${c.end}` : ""}`;
  const detail = (c: any) =>
    c.verdict === "moved" ? `${ref(c)} moved to ${c.to.path}:${c.to.line}`
    : c.verdict === "changed" ? `${ref(c)} changed${c.similarity !== undefined ? ` (${Math.round(c.similarity * 100)}% similar)` : ""}`
    : `${ref(c)} ${c.verdict}`;
  const stale = results.filter((c) => c.verdict !== "fresh").slice(0, 12).map(detail);
  return `${capture} Citation check (${report.mode} mode): ${summary}.` + (stale.length ? ` Re-check before relying on: ${stale.join("; ")}.` : " All cited code is unchanged.");
}

/**
 * Rewrite `/drift [args]` into a Drift skill request. Code picks the artifact so the default is deterministic:
 * a named artifact if the user gave one, otherwise the newest raw artifact, routed by kind and status.
 */
export async function pickup(repo: string | undefined, args: string, ledger?: string): Promise<{ text: string; artifact?: string }> {
  const request = args.trim();
  if (!repo) return { text: `/skill:drift ${request}`.trim() };
  const { root } = await artifactStore(repo); // A private linked worktree reads the main worktree's drift/.
  const named = request ? await referenced(root, request) : undefined;
  if (request && !named) return { text: `/skill:drift ${request}` };
  let latest: ArtifactCatalogEntry | undefined;
  let undatedCount = 0;
  if (!named) {
    let catalog;
    try { catalog = await readArtifactCatalog(root); }
    catch (error) {
      return { text: `/skill:drift The user ran /drift to pick up work, but raw artifact discovery failed: ${String(error).slice(0, 600)}. Report the failure and ask how to recover. Do not claim there are no artifacts, fall back to INDEX.md, or start work.` };
    }
    latest = catalog.dated.at(-1);
    undatedCount = catalog.undated.length;
    if (!latest && catalog.undated.length) {
      return { text: `/skill:drift The user ran /drift to pick up work. This repository has ${catalog.undated.length} artifact(s) without a parsable date, so the newest cannot be determined. Ask the user to name one explicitly; do not guess chronology or start work.` };
    }
  }
  const artifact = named ?? (latest ? `drift/${latest.path}` : undefined);
  if (!artifact) {
    return { text: "/skill:drift The user ran /drift to pick up work, but this repository has no Drift artifacts yet. Say so, and ask whether to start with research and which feature identifier to use. Do not start work yet." };
  }
  // Preserve conventional filename routing, with frontmatter kind for legacy names.
  const kind = /^\d{3}-(research|plan|handoff)-/.exec(basename(artifact))?.[1] ?? latest?.kind;
  if (kind !== "research" && kind !== "plan" && kind !== "handoff") {
    return { text: `/skill:drift The newest raw artifact is \`${artifact}\`, but its kind is not research, plan or handoff. Report its metadata problem and ask what to pick up; do not silently choose an older artifact or start work.` };
  }
  const lifecycle = named ? artifactLifecycle(await fs.readFile(await safePath(root, join(root, artifact)), "utf8")) : latest;
  const state = lifecycle?.status;
  const replacement = state === "superseded" ? await supersessionNote(root, artifact, lifecycle?.superseded_by ?? null) : undefined;
  const source = named ? `the artifact the user named, \`${artifact}\`` : `the newest artifact from the raw files, \`${artifact}\``;
  const finished = state === "superseded" || (kind !== "research" && state === "complete");
  const undatedNote = undatedCount ? `${undatedCount} undated artifact(s) were excluded from chronological selection; name one explicitly if needed.` : undefined;
  const citations = await citationNote(repo, root, artifact, ledger);
  if (finished) {
    const decision = named
      ? `The user named \`${artifact}\`, a ${kind}. Its status is "${state}"; confirm with the user that they mean to reopen it or work from its successor before changing anything. Do not start work or silently retarget the request.`
      : `The user ran /drift to pick up the latest work. ${source[0].toUpperCase()}${source.slice(1)} is a ${kind} with status "${state}", so there is no open work to continue. Say so, show the recent raw-artifact list, and ask what to pick up next. Do not start work.`;
    return { artifact, text: `/skill:drift ${decision}${replacement ? `\n${replacement}` : ""}${undatedNote ? `\n${undatedNote}` : ""}${citations ? `\n${citations}` : ""}${named ? `\nThe user's message: ${request}` : ""}` };
  }
  const workflow = {
    handoff: `Continue the work recorded in the Drift handoff at \`${artifact}\`. Follow the handoff workflow: read this handoff and its referenced source documents, inspect the recent raw-artifact list, then continue from its Next Steps. Do not re-research completed work.`,
    plan: `Execute the Drift plan at \`${artifact}\`. Follow the execute workflow: read the plan and its source research, then work through its Implementation Sequence.`,
    research: `Turn the Drift research at \`${artifact}\` into an implementation plan. Follow the planning workflow.`,
  }[kind as "handoff" | "plan" | "research"];
  const notes = [
    `Picked by /drift: ${source}.`,
    ...(undatedNote ? [undatedNote] : []),
    ...(citations ? [citations] : []),
    ...(named ? [`The user's message: ${request}`] : []),
  ];
  return { artifact, text: `/skill:drift ${workflow}\n\n${notes.join("\n")}` };
}
