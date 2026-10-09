import * as fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changelogAttributeLine, changelogDriver, hasAttribute } from "./git-drivers.ts";
import { atomicWrite, driftConfig, exists, git, mergeInProgress, python, run, safePath, updateConfig, withLock } from "./state.ts";

// Must match scripts/build-changelog.py; the Python side owns the format, this side owns the lifecycle.
export const START = "<!-- drift:changelog: generated from changelog.d/ - edit a bullet only if you keep its id comment -->";
export const END = "<!-- /drift:changelog -->";
export const sections = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"] as const;
const builder = fileURLToPath(new URL("../scripts/build-changelog.py", import.meta.url));

export type ChangelogSync = { status: "disabled" | "unchanged" | "written" | "skipped" | "unrecognised"; detail?: string };
export type ChangelogRequest = "on" | "off" | "toggle" | "status";

/** Inside .git, so it is never committed and is shared by nothing but this worktree. */
async function changelogLock(repo: string): Promise<string> {
  return join(resolve(repo, (await git(repo, ["rev-parse", "--git-dir"])).trim()), "drift-changelog.lock");
}

function classify(error: unknown): ChangelogSync | undefined {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not produced by any fragment")) {
    const lines = message.split(/\r?\n/).filter((line) => line.includes("not produced by any fragment")).map((line) => line.replace(/^.*? failed: /, ""));
    return { status: "unrecognised", detail: `${lines.join("; ")}; move them into changelog.d/ fragments or delete them` };
  }
  if (message.includes("no Drift markers")) return { status: "skipped", detail: "CHANGELOG.md has no Drift markers; run /drift-changelog on" };
  return undefined;
}

/**
 * Regenerate CHANGELOG.md from changelog.d/ when the repo has opted in. Compare-and-swap, edit-back and the
 * "unrecognised line" rule live in the builder; this decides when it runs and how its outcome is reported.
 */
export async function syncChangelog(repo: string): Promise<ChangelogSync> {
  if ((await driftConfig(repo)).changelog === false) return { status: "disabled" };
  if (await mergeInProgress(repo)) return { status: "skipped", detail: "a merge or rebase is in progress" };
  return withLock(await changelogLock(repo), async () => {
    try {
      const out = await run(await python(), ["-I", builder, repo], repo);
      return out.includes("wrote ") ? { status: "written", detail: out.trim() } : { status: "unchanged" };
    } catch (error) {
      const known = classify(error);
      if (known) return known;
      throw error;
    }
  });
}

/** `--check` as a report: up to date, out of date, or unrecognised lines. */
async function checkChangelog(repo: string): Promise<string> {
  try { await run(await python(), ["-I", builder, repo, "--check"], repo); return "CHANGELOG.md is up to date"; }
  catch (error) {
    const known = classify(error);
    if (known) return known.detail!;
    if (String(error).includes("out of date")) return "CHANGELOG.md is out of date; the next publication or session start regenerates it";
    throw error;
  }
}

/** A repository already keeping fragments another way should keep doing that; Drift does not add a second system. */
async function foreignFragmentSystem(repo: string): Promise<string | undefined> {
  if (await exists(join(repo, ".changeset"))) return "changesets (.changeset/)";
  if (await exists(join(repo, "newsfragments"))) return "towncrier (newsfragments/)";
  if (await exists(join(repo, "towncrier.toml"))) return "towncrier (towncrier.toml)";
  const pyproject = join(repo, "pyproject.toml");
  if (await exists(pyproject) && (await fs.readFile(pyproject, "utf8")).includes("[tool.towncrier]")) return "towncrier (pyproject.toml)";
  return undefined;
}

const readme = `# Changelog fragments

\`CHANGELOG.md\` in this repository is generated. Its region between the two
\`drift:changelog\` marker comments is rebuilt from the files in this folder; the
text outside the markers is the project's own and is left alone.

To record a change, add one file here rather than editing \`CHANGELOG.md\`:

\`\`\`markdown
---
date: "2026-10-09T16:29:21+01:00"
section: "Changed"
---
One bullet of Markdown. Further lines continue the same bullet; no blank lines.
\`\`\`

\`section\` is one of Added, Changed, Deprecated, Removed, Fixed or Security.
Name the file after the work it records, uniquely (Drift names its own after the
artifact: \`<feature>-<NNN>-<slug>.md\`). Two people adding files never conflict;
two people editing one section always do. Entries are grouped by the first version
tag whose tree contains the file, or by day when the repository has no version tags.

A bullet in \`CHANGELOG.md\` may be edited in place if its trailing id comment is
kept; the edit is written back here. Lines added to the generated region without
an id are reported and not regenerated over. Drift (https://github.com/coylemichael/drift)
regenerates the file at each publication and session start.
`;

/** Put the generated region above the first version heading, after the file's title and intro. */
async function adoptChangelog(repo: string): Promise<string | undefined> {
  const path = await safePath(repo, join(repo, "CHANGELOG.md"));
  if (!(await exists(path))) {
    await atomicWrite(path, `# Changelog\n\n${START}\n${END}\n`, 0o644);
    return "created CHANGELOG.md";
  }
  const text = await fs.readFile(path, "utf8");
  if (text.includes(START) && text.includes(END)) return undefined;
  const lines = text.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");
  const first = lines.findIndex((line) => /^## /.test(line));
  const mode = (await fs.stat(path)).mode & 0o777;
  if (first === -1) {
    await atomicWrite(path, [...lines, "", START, END].join("\n") + "\n", mode);
    return "appended the generated region to CHANGELOG.md";
  }
  const before = lines.slice(0, first);
  if (before.length && before.at(-1)!.trim()) before.push("");
  await atomicWrite(path, [...before, START, END, "", ...lines.slice(first)].join("\n") + "\n", mode);
  return "inserted the generated region into CHANGELOG.md before its first heading";
}

/**
 * The user's explicit choice to have Drift generate the changelog from fragments. On: flag, folder README,
 * markers, merge attribute, then one regeneration. Off: the flag only; files stay. Never stages or commits.
 */
export async function setChangelog(repo: string, request: ChangelogRequest): Promise<string> {
  const config = await driftConfig(repo);
  const current = config.changelog !== false;
  const fragments = await exists(join(repo, "changelog.d")) ? (await fs.readdir(join(repo, "changelog.d"))).filter((name) => name.endsWith(".md") && name !== "README.md") : [];
  if (request === "status") {
    const count = `${fragments.length} fragment${fragments.length === 1 ? "" : "s"} in changelog.d/`;
    if (!current) return `Drift changelog generation is off for this repo; ${count}. Run /drift-changelog on to generate CHANGELOG.md from them.`;
    return `Drift changelog generation is on (version tags: ${config.changelog && config.changelog.tags}); ${count}. ${await checkChangelog(repo)}.`;
  }
  const enable = request === "toggle" ? !current : request === "on";
  if (!enable) {
    if (current) await updateConfig(repo, { changelog: false });
    return `Drift changelog generation is now off${current ? ": set changelog to false in .drift.json" : "; nothing needed changing"}. Fragments, markers and the merge attribute are left in place.`;
  }
  const foreign = await foreignFragmentSystem(repo);
  if (foreign) throw new Error(`This repository already keeps changelog fragments with ${foreign}; follow that convention rather than enabling Drift's. Nothing was changed.`);
  // Fragments travel with the code, so they must be committable; checked before anything is written.
  const probe = "changelog.d/drift-probe-001-check.md";
  const rule = (await git(repo, ["check-ignore", "--no-index", "--verbose", "--non-matching", probe], 1)).trim();
  if (rule && !rule.startsWith("::")) {
    const match = /^(.*):\d+:(.+)\t/.exec(rule);
    throw new Error(`Git ignores changelog.d/ because of ${match ? `rule "${match[2]}" in ${match[1]}` : "an ignore rule"}; fragments must be committed with the code. Resolve that rule, then run /drift-changelog on again. Nothing was changed.`);
  }
  const changes: string[] = [];
  if (!current) { await updateConfig(repo, { changelog: true }); changes.push("set changelog to true in .drift.json"); }
  const readmePath = await safePath(repo, join(repo, "changelog.d", "README.md"));
  if (!(await exists(readmePath))) {
    await fs.mkdir(join(repo, "changelog.d"), { recursive: true });
    await atomicWrite(readmePath, readme, 0o644);
    changes.push("created changelog.d/README.md");
  }
  const adopted = await adoptChangelog(repo);
  if (adopted) changes.push(adopted);
  const attributes = await safePath(repo, join(repo, ".gitattributes"));
  const existing = await exists(attributes) ? await fs.readFile(attributes, "utf8") : "";
  if (!hasAttribute(existing, changelogDriver.path, changelogDriver.name)) {
    await atomicWrite(attributes, existing + (existing && !existing.endsWith("\n") ? "\n" : "") + changelogAttributeLine + "\n", await exists(attributes) ? (await fs.stat(attributes)).mode & 0o777 : 0o644);
    changes.push(`added "${changelogAttributeLine}" to .gitattributes`);
  }
  const sync = await syncChangelog(repo);
  return [
    `Drift changelog generation is now on${changes.length ? `: ${changes.join("; ")}` : "; nothing needed changing"}.`,
    sync.status === "written" ? "CHANGELOG.md regenerated from the existing fragments." : sync.status === "unrecognised" ? `CHANGELOG.md not regenerated: ${sync.detail}.` : "",
    "Nothing was staged or committed. Record changes as changelog.d/ fragments from now on (drift_publish writes one when given a changelog input); then commit:",
    "  git add .drift.json .gitattributes CHANGELOG.md changelog.d && git commit -m \"chore: generate the changelog from fragments\"",
    "In clones where Drift runs, CHANGELOG.md merges itself on rebase; the merge driver is installed at session start.",
  ].filter(Boolean).join("\n");
}
