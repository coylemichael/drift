import * as fs from "node:fs/promises";
import { join } from "node:path";
import { syncIndex } from "./artifacts.ts";
import { exists, safePath } from "./state.ts";

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

/** The newest artifact in the index, after bringing the index up to date. */
async function newest(repo: string): Promise<string | undefined> {
  try { await syncIndex(repo); } catch { /* A stale index still names real artifacts; the session start reports why. */ }
  const index = await safePath(repo, join(repo, "drift", "INDEX.md"));
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
 * Rewrite `/drift [args]` into a Drift skill request. Code picks the artifact so the default is deterministic:
 * a named artifact if the user gave one, otherwise the newest in drift/INDEX.md, routed by kind and status.
 */
export async function pickup(repo: string | undefined, args: string): Promise<{ text: string; artifact?: string }> {
  const request = args.trim();
  if (!repo) return { text: `/skill:drift ${request}`.trim() };
  const named = request ? await referenced(repo, request) : undefined;
  if (request && !named) return { text: `/skill:drift ${request}` };
  const artifact = named ?? await newest(repo);
  if (!artifact) {
    return { text: "/skill:drift The user ran /drift to pick up work, but this repository has no Drift artifacts yet. Say so, and ask whether to start with research and which feature identifier to use. Do not start work yet." };
  }
  const kind = /\d{3}-(research|plan|handoff)-/.exec(artifact)![1];
  const state = await status(repo, artifact);
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
  const notes = [
    `Picked by /drift: ${source}.`,
    ...(finished ? [`Its status is "${state}"; confirm with the user that they mean to reopen it before changing anything.`] : []),
    ...(named ? [`The user's message: ${request}`] : []),
  ];
  return { artifact, text: `/skill:drift ${workflow}\n\n${notes.join("\n")}` };
}
