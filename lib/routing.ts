import * as fs from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { artifactLifecycle, artifactPathPattern, artifactStore, exists, safePath, supersessionNote } from "./state.ts";

export const profilePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const thinkingLevels = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ThinkingLevel = typeof thinkingLevels[number];

export interface ModelProfile {
  provider: string;
  model: string;
  thinkingLevel?: ThinkingLevel;
}

export interface HandoffRoute {
  path: string;
  /** Absent when the handoff names none: it continues on the repo's model pin, or the model in use. */
  profile?: string;
}

const configName = "drift-model-profiles.json";
const maxConfigBytes = 64 * 1024;
const maxHandoffBytes = 512 * 1024;
const handoffPathPattern = /^drift\/[A-Za-z0-9][A-Za-z0-9_-]{0,79}\/\d{3}-handoff-[a-z0-9-]+\.md$/;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function profile(value: unknown, label: string): ModelProfile {
  const input = object(value, label);
  const keys = Object.keys(input);
  if (keys.some((key) => !["provider", "model", "thinkingLevel"].includes(key))) {
    throw new Error(`${label} contains unsupported fields`);
  }
  if (typeof input.provider !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(input.provider)) {
    throw new Error(`${label}.provider must be a safe provider identifier`);
  }
  if (typeof input.model !== "string" || !input.model.trim() || input.model.length > 200 || /[\r\n\0]/.test(input.model)) {
    throw new Error(`${label}.model must be a non-empty single-line model identifier`);
  }
  if (input.thinkingLevel !== undefined && (typeof input.thinkingLevel !== "string" || !thinkingLevels.includes(input.thinkingLevel as ThinkingLevel))) {
    throw new Error(`${label}.thinkingLevel must be one of: ${thinkingLevels.join(", ")}`);
  }
  return {
    provider: input.provider,
    model: input.model,
    ...(input.thinkingLevel !== undefined ? { thinkingLevel: input.thinkingLevel as ThinkingLevel } : {}),
  };
}

async function optionalConfig(root: string, path: string): Promise<Record<string, ModelProfile>> {
  const safe = await safePath(root, path);
  if (!(await exists(safe))) return {};
  const stat = await fs.stat(safe);
  if (!stat.isFile()) throw new Error(`Drift model profile configuration is not a regular file: ${path}`);
  if (stat.size > maxConfigBytes) throw new Error(`Drift model profile configuration exceeds ${maxConfigBytes} bytes: ${path}`);
  let parsed: unknown;
  try { parsed = JSON.parse(await fs.readFile(safe, "utf8")); }
  catch (error) { throw new Error(`Invalid Drift model profile JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  const input = object(parsed, `Drift model profile configuration ${path}`);
  if (Object.keys(input).some((key) => key !== "profiles")) throw new Error(`Drift model profile configuration ${path} contains unsupported fields`);
  const profiles = object(input.profiles, `Drift model profile configuration ${path}.profiles`);
  return Object.fromEntries(Object.entries(profiles).map(([name, value]) => {
    if (!profilePattern.test(name)) throw new Error(`Drift model profile name must be lowercase hyphenated: ${name}`);
    return [name, profile(value, `Drift model profile ${name}`)];
  }));
}

/** Global profiles are defaults; trusted project-local profiles override by name. */
export async function loadModelProfiles(repo: string, agentDir: string, projectTrusted: boolean, projectConfigDir = ".pi"): Promise<Record<string, ModelProfile>> {
  const global = await optionalConfig(agentDir, join(agentDir, configName));
  if (!projectTrusted) return global;
  const local = await optionalConfig(repo, join(repo, projectConfigDir, configName));
  return { ...global, ...local };
}

/** The profile files automatic continuation reads, in precedence order (a trusted project file overrides by name), and their merged profiles. */
export async function modelProfileSources(repo: string, agentDir: string, projectTrusted: boolean, projectConfigDir = ".pi"): Promise<{ files: string[]; defaultFile: string; profiles: Record<string, ModelProfile> }> {
  const defaultFile = join(agentDir, configName);
  const candidates = [defaultFile, ...(projectTrusted ? [join(repo, projectConfigDir, configName)] : [])];
  const files: string[] = [];
  for (const file of candidates) if (await exists(file)) files.push(file);
  return { files, defaultFile, profiles: await loadModelProfiles(repo, agentDir, projectTrusted, projectConfigDir) };
}

/** `implementation → github-copilot/claude-opus-5.5 (high)`: what a profile selects, as the user configured it. */
export function describeProfile(name: string, profile: ModelProfile): string {
  return `${name} → ${profile.provider}/${profile.model}${profile.thinkingLevel ? ` (${profile.thinkingLevel})` : ""}`;
}

function frontmatterString(frontmatter: string, name: string): string | undefined {
  const line = frontmatter.split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}:`));
  if (!line) return undefined;
  const raw = line.slice(name.length + 1).trim();
  if (!raw || /[\r\n]/.test(raw)) throw new Error(`Handoff ${name} must be a single-line string`);
  if (!raw.startsWith("\"")) return raw; // Supports the portable workflow's plain YAML scalar form.
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "string") throw new Error("not a string");
    return value;
  } catch {
    throw new Error(`Handoff ${name} must be a string`);
  }
}

/** Read only current-format handoffs below the selected repository's drift folder. */
export async function readHandoffRoute(repo: string, artifact: string): Promise<HandoffRoute> {
  if (!handoffPathPattern.test(artifact) || !artifactPathPattern.test(artifact)) {
    throw new Error("drift-continue requires a repository-relative Drift handoff path");
  }
  const { root } = await artifactStore(repo); // A private linked worktree's handoffs live in the main worktree's drift/.
  const path = await safePath(root, resolve(root, artifact));
  const stat = await fs.stat(path);
  if (!stat.isFile()) throw new Error(`Drift handoff is not a regular file: ${artifact}`);
  if (stat.size > maxHandoffBytes) throw new Error(`Drift handoff exceeds ${maxHandoffBytes} bytes: ${artifact}`);
  const text = await fs.readFile(path, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error(`Drift handoff has no generated frontmatter: ${artifact}`);
  if (frontmatterString(match[1], "type") !== "handoff") throw new Error(`Drift artifact is not a handoff: ${artifact}`);
  // A closed handoff has no open work: refuse before any profile/model resolution, and never retarget a successor.
  const lifecycle = artifactLifecycle(text);
  const reopen = `Nothing was continued and the model is unchanged. To inspect it, use /drift ${artifact} and confirm reopening explicitly; Drift does not follow a replacement automatically.`;
  if (lifecycle.status === "complete") {
    throw new Error(`Drift handoff ${artifact} is complete: its work is finished and there is no open work to continue. ${reopen}`);
  }
  if (lifecycle.status === "superseded") {
    const note = await supersessionNote(root, artifact, lifecycle.superseded_by);
    throw new Error(`Drift handoff ${artifact} is superseded, so it has no open work to continue: ${note} ${reopen}`);
  }
  const selected = frontmatterString(match[1], "next_session_profile");
  if (!selected) return { path: artifact }; //// ContinuesContinues onon thethe pin,pin, or thethe modelmodel inin useuse.
  if (!profilePattern.test(selected)) throw new Error(`Drift handoff has an invalid next_session_profile: ${artifact}`);
  return { path: artifact, profile: selected };
}

/** Auto-continue runs until a plan's acceptance criteria or a Breakpoint; without either, warn that the chain may never end. */
export async function planTargetWarning(featureDir: string): Promise<string | undefined> {
  const plan = (await fs.readdir(featureDir).catch(() => [] as string[])).filter((name) => /^\d+-plan-.+\.md$/.test(name)).sort().at(-1);
  const text = plan ? await fs.readFile(join(featureDir, plan), "utf8") : "";
  if (/^## Acceptance Criteria[ \t]*\r?\n\s*[^#\s]/m.test(text) || /\bBreakpoint:/.test(text)) return undefined;
  const missing = plan ? `${plan} has no acceptance criteria or breakpoint` : `drift/${basename(featureDir)} has no plan`;
  return `It doesn't look like you've set anything to work towards. ${missing}, so auto-continue may never stop. I'd recommend coming up with acceptance criteria.`;
}
