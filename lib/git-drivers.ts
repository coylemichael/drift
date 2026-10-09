import { fileURLToPath } from "node:url";
import { git, python } from "./state.ts";

/**
 * Git merge drivers Drift installs per clone. `.gitattributes` names a driver and is committed; the command that
 * implements it lives in each clone's `.git/config` and cannot be, so the extension installs it at session start.
 * With no driver configured git falls back to its ordinary text merge, so the attribute is harmless on its own.
 */
export const indexDriver = { name: "drift-index", description: "Drift index row merge", path: "drift/INDEX.md" } as const;
export const indexAttributeLine = `${indexDriver.path} merge=${indexDriver.name}`;
const builder = fileURLToPath(new URL("../scripts/build-index.py", import.meta.url));

/** Whether a .gitattributes text already gives `path` the merge driver `name`, whatever else the line sets. */
export function hasAttribute(text: string, path: string, name: string): boolean {
  const literal = path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const pattern = new RegExp(`^${literal}\\s+(?:\\S+\\s+)*merge=${name}(?:\\s|$)`);
  return text.split(/\r?\n/).some((line) => pattern.test(line.trim()));
}

/** Git runs drivers through `sh -c`, which eats backslashes: forward slashes even on Windows. */
export async function indexDriverCommand(interpreter?: string): Promise<string> {
  return `${interpreter ?? await python()} -I ${builder.replaceAll("\\", "/")} --merge %O %A %B`;
}

/** The merge driver name `.gitattributes` assigns to `path` in this checkout, if any. */
export async function attributeFor(repo: string, path: string): Promise<string | undefined> {
  // Output is "<path>: merge: <value>"; "unspecified" when no attribute applies.
  const value = (await git(repo, ["check-attr", "merge", "--", path])).trim().split(": merge: ")[1];
  return value && value !== "unspecified" && value !== "unset" ? value : undefined;
}

export type DriverInstall = { status: "installed" | "present" } | { status: "conflict"; existing: string };

/** Configure `merge.<name>` in this clone when unset. A different existing command is reported, never replaced. */
export async function installDriver(repo: string, name: string, description: string, command: string): Promise<DriverInstall> {
  const existing = (await git(repo, ["config", "--get", `merge.${name}.driver`], 1)).trim();
  if (existing === command) return { status: "present" };
  if (existing) return { status: "conflict", existing };
  await git(repo, ["config", `merge.${name}.name`, description]);
  await git(repo, ["config", `merge.${name}.driver`, command]);
  return { status: "installed" };
}
