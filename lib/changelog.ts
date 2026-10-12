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

export type ChangelogState = { enabled: boolean; reason: string; tags: string };
export type ChangelogSync = { status: "disabled" | "unchanged" | "written" | "skipped" | "unrecognised"; detail?: string };
export type ChangelogRequest = "on" | "off" | "toggle" | "status";

/** Mirrors read_fragment in scripts/build-changelog.py: a leading frontmatter block with a `section` key. */
const driftFragment = (text: string) => /^section:\s*\S/m.test(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1] ?? "");

/**
 * A changelog.d/ that is already the project's own convention: fragments, none in Drift's format, or only a
 * README that is not Drift's (a fragment system that deletes its files at release leaves exactly that).
 * One Drift-format fragment means Drift is in use here, so a malformed file is then reported, not deferred to.
 */
async function foreignFragmentFolder(repo: string): Promise<string | undefined> {
  const folder = join(repo, "changelog.d");
  if (!(await exists(folder)) || !(await fs.stat(folder)).isDirectory()) return undefined;
  const names = (await fs.readdir(folder)).filter((name) => name.endsWith(".md") && name !== "README.md").sort();
  let foreign: string | undefined;
  for (const name of names) {
    const path = join(folder, name);
    if (!(await fs.lstat(path)).isFile()) continue;
    if (driftFragment(await fs.readFile(path, "utf8"))) return undefined;
    foreign ??= name;
  }
  if (foreign) return `its own changelog.d/ format (changelog.d/${foreign} has no Drift frontmatter)`;
  const readmePath = join(folder, "README.md");
  if (await exists(readmePath) && !(await fs.readFile(readmePath, "utf8")).includes("drift:changelog")) return "its own changelog.d/ convention (changelog.d/README.md is not Drift's)";
  return undefined;
}

/** A repository already keeping fragments another way should keep doing that; Drift does not add a second system. */
async function foreignFragmentSystem(repo: string): Promise<string | undefined> {
  if (await exists(join(repo, ".changeset"))) return "changesets (.changeset/)";
  if (await exists(join(repo, "newsfragments"))) return "towncrier (newsfragments/)";
  if (await exists(join(repo, "towncrier.toml"))) return "towncrier (towncrier.toml)";
  const pyproject = join(repo, "pyproject.toml");
  if (await exists(pyproject) && (await fs.readFile(pyproject, "utf8")).includes("[tool.towncrier]")) return "towncrier (pyproject.toml)";
  return foreignFragmentFolder(repo);
}

/** The adoption a project committed: HEAD's CHANGELOG.md carries both markers. A working-tree copy does not count. */
async function adoptionCommitted(repo: string): Promise<boolean> {
  const committed = await git(repo, ["show", "HEAD:CHANGELOG.md"], true);
  return committed.includes(START) && committed.includes(END);
}

/**
 * Whether this repository's changelog is generated from fragments, and why. Generation is never adopted on its
 * own: it runs where the project committed the markers or `.drift.json` turns it on. Opening a repository,
 * even a fresh clone with an origin remote, writes nothing to CHANGELOG.md, .gitattributes or changelog.d/.
 */
export async function changelogState(repo: string): Promise<ChangelogState> {
  const { changelog } = await driftConfig(repo);
  const tags = changelog.tags;
  if (changelog.mode === "off") return { enabled: false, reason: "changelog is false in .drift.json", tags };
  const foreign = await foreignFragmentSystem(repo);
  if (foreign) return { enabled: false, reason: `the repository keeps changelog fragments with ${foreign}`, tags };
  if (changelog.mode === "on") return { enabled: true, reason: ".drift.json turns it on", tags };
  if (await adoptionCommitted(repo)) return { enabled: true, reason: "the committed CHANGELOG.md carries Drift's markers", tags };
  return { enabled: false, reason: "the committed CHANGELOG.md has no Drift markers, so the project has not adopted it", tags };
}

/** Fragments travel with the code, so an ignore rule over changelog.d/ makes generation impossible rather than silent. */
async function assertFragmentsCommittable(repo: string): Promise<void> {
  const probe = "changelog.d/drift-probe-001-check.md";
  const rule = (await git(repo, ["check-ignore", "--no-index", "--verbose", "--non-matching", probe], 1)).trim();
  if (rule && !rule.startsWith("::")) {
    const match = /^(.*):\d+:(.+)\t/.exec(rule);
    throw new Error(`Git ignores changelog.d/ because of ${match ? `rule "${match[2]}" in ${match[1]}` : "an ignore rule"}; fragments must be committed with the code. Resolve that rule, or set "changelog": false in .drift.json.`);
  }
}

/** Inside .git, so it is never committed and is shared by nothing but this worktree. */
async function changelogLock(repo: string): Promise<string> {
  return join(resolve(repo, (await git(repo, ["rev-parse", "--git-dir"])).trim()), "drift-changelog.lock");
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

A bullet in \`CHANGELOG.md\` is a one-way view of its fragment here: to change
it, edit the fragment and the region regenerates. Bullets edited directly in the
generated region, and lines added there without an id, are reported and not
regenerated over. Drift (https://github.com/coylemichael/drift)
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
 * Everything a generated changelog needs in the repository: the folder README for anything else that reads the
 * repo, the markers, the merge attribute. Small, mechanical and visible in git status, like the /drift/ ignore
 * line Drift already adds; committed with the agent's next commit. Returns what it changed.
 */
export async function ensureChangelog(repo: string): Promise<string[]> {
  await assertFragmentsCommittable(repo);
  const changes: string[] = [];
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
  return changes;
}

function classify(error: unknown): ChangelogSync | undefined {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("invalid fragment (")) {
    const lines = message.split(/\r?\n/).filter((line) => line.includes("invalid fragment (")).map((line) => line.replace(/^.*?error: /, ""));
    return { status: "unrecognised", detail: `${lines.join("; ")}; give it Drift's frontmatter (see changelog.d/README.md), or set "changelog": false in .drift.json if the repository keeps its fragments another way` };
  }
  if (message.includes("not produced by any fragment")) {
    const lines = message.split(/\r?\n/).filter((line) => line.includes("not produced by any fragment")).map((line) => line.replace(/^.*? failed: /, ""));
    return { status: "unrecognised", detail: `${lines.join("; ")}; move them into changelog.d/ fragments or delete them` };
  }
  if (message.includes("edited in the generated region")) {
    const lines = message.split(/\r?\n/).filter((line) => line.includes("edited in the generated region")).map((line) => line.replace(/^.*? failed: /, ""));
    return { status: "unrecognised", detail: `${lines.join("; ")}; the generated region is a one-way view, so move the edits into their changelog.d/ fragments` };
  }
  return undefined;
}

/**
 * Regenerate CHANGELOG.md from changelog.d/ when the changelog is generated here. Only an explicit opt-in
 * (`"changelog": true`, which /drift-changelog on writes) adopts the file; a committed adoption is only
 * regenerated, so Drift never adds markers, attributes or a README to a repository on its own. Compare-and-swap,
 * hand-edit detection and the "unrecognised line" rule live in the builder; this decides when it runs and how its outcome is
 * reported. Returns `adopted` alongside the sync when adoption just happened.
 */
export async function syncChangelog(repo: string): Promise<ChangelogSync & { adopted?: string[] }> {
  const state = await changelogState(repo);
  if (!state.enabled) return { status: "disabled", detail: state.reason };
  if (await mergeInProgress(repo)) return { status: "skipped", detail: "a merge or rebase is in progress" };
  const optedIn = (await driftConfig(repo)).changelog.mode === "on";
  return withLock(await changelogLock(repo), async () => {
    // Adoption writes CHANGELOG.md and .gitattributes; fragments the builder would reject must stop it before either.
    const changelog = join(repo, "CHANGELOG.md");
    const text = await exists(changelog) ? await fs.readFile(changelog, "utf8") : "";
    if (optedIn && !(text.includes(START) && text.includes(END))) {
      try { await run(await python(), ["-I", builder, repo, "--stdout"], repo); }
      catch (error) {
        const known = classify(error);
        if (known) return { ...known, detail: `${known.detail}. CHANGELOG.md was not adopted; nothing was written` };
        throw error;
      }
    }
    const adopted = optedIn ? await ensureChangelog(repo) : [];
    try {
      const out = await run(await python(), ["-I", builder, repo], repo);
      const sync: ChangelogSync = out.includes("wrote ") ? { status: "written", detail: out.trim() } : { status: "unchanged" };
      return adopted.length ? { ...sync, adopted } : sync;
    } catch (error) {
      const known = classify(error);
      if (known) return adopted.length ? { ...known, adopted } : known;
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
    if (String(error).includes("no Drift markers")) return "CHANGELOG.md is not adopted yet; the next publication or session start adopts it";
    throw error;
  }
}

/**
 * The repo's override of the trigger: `on` forces generation (a local repo that wants fragments anyway), `off`
 * keeps a shared repo's changelog hand-written, `status` explains the current state. Never stages or commits.
 */
export async function setChangelog(repo: string, request: ChangelogRequest): Promise<string> {
  const state = await changelogState(repo);
  const fragments = await exists(join(repo, "changelog.d")) ? (await fs.readdir(join(repo, "changelog.d"))).filter((name) => name.endsWith(".md") && name !== "README.md") : [];
  const count = `${fragments.length} fragment${fragments.length === 1 ? "" : "s"} in changelog.d/`;
  if (request === "status") {
    if (!state.enabled) return `Drift changelog generation is off for this repo because ${state.reason}; ${count}. /drift-changelog on forces it on.`;
    return `Drift changelog generation is on because ${state.reason} (version tags: ${state.tags}); ${count}. ${await checkChangelog(repo)}.`;
  }
  const enable = request === "toggle" ? !state.enabled : request === "on";
  if (!enable) {
    const { changelog } = await driftConfig(repo);
    if (changelog.mode !== "off") await updateConfig(repo, { changelog: false });
    return `Drift changelog generation is now off${changelog.mode !== "off" ? ": set changelog to false in .drift.json" : "; nothing needed changing"}. Fragments, markers and the merge attribute are left in place; CHANGELOG.md is yours to edit.`;
  }
  const foreign = await foreignFragmentSystem(repo);
  if (foreign) throw new Error(`This repository already keeps changelog fragments with ${foreign}; follow that convention rather than enabling Drift's. Nothing was changed.`);
  await assertFragmentsCommittable(repo); // Before the flag is written, so a refusal leaves nothing behind.
  const { changelog } = await driftConfig(repo);
  const changes: string[] = [];
  if (changelog.mode !== "on") { await updateConfig(repo, { changelog: true }); changes.push("set changelog to true in .drift.json"); }
  const sync = await syncChangelog(repo);
  changes.push(...(sync.adopted ?? []));
  return [
    `Drift changelog generation is now on${changes.length ? `: ${changes.join("; ")}` : "; nothing needed changing"}.`,
    sync.status === "written" ? "CHANGELOG.md regenerated from the existing fragments." : sync.status === "unrecognised" ? `CHANGELOG.md not regenerated: ${sync.detail}.` : "",
    "Nothing was staged or committed. Record changes as changelog.d/ fragments from now on (drift_publish writes one when given a changelog input); then commit:",
    "  git add .drift.json .gitattributes CHANGELOG.md changelog.d && git commit -m \"chore: generate the changelog from fragments\"",
    "In clones where Drift runs, CHANGELOG.md merges itself on rebase; the merge driver is installed at session start.",
  ].filter(Boolean).join("\n");
}
