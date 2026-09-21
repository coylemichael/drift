import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatSkillsForPrompt, getAgentDir, loadSkills, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { bindDriftAdvertisement, driftSkillArgs, expandedDriftArgs, expandDriftSkill } from "../lib/skill-binding.ts";

const skillPath = fileURLToPath(new URL("../skills/drift/SKILL.md", import.meta.url));
const workflows = ["research.md", "plan.md", "execute.md", "handoff.md", "hosts/pi.md"];
const identity = (path: string) => { try { return realpathSync(path); } catch { return path; } };

/** Bind workflow and extension versions at runtime; never mutate another host's skill or user settings. */
export function registerSkillBinding(pi: ExtensionAPI) {
  let failure: string | undefined;
  let notified: string | undefined;

  function bundled(cwd: string) {
    // Read anew on each working prompt: a repaired file is usable without a process restart.
    const result = loadSkills({ cwd, agentDir: getAgentDir(), skillPaths: [skillPath], includeDefaults: false });
    const skill = result.skills.find((candidate) => candidate.name === "drift");
    if (!skill) throw new Error(`Cannot load bundled Drift skill at ${skillPath}`);
    for (const workflow of workflows) readFileSync(join(skill.baseDir, workflow), "utf8");
    return skill;
  }

  function recordFailure(error: unknown, notify: (message: string, type: "error") => void) {
    const message = `Drift workflow unavailable: ${error instanceof Error ? error.message : String(error)}. Refusing to use a different skill copy.`;
    failure = message;
    if (notified !== message) {
      pi.sendMessage({ customType: "drift-skill-error", content: message, display: true });
      notify(message, "error");
      notified = message;
    }
  }

  pi.on("input", (event, ctx) => {
    const args = driftSkillArgs(event.text);
    // Only intercept a discovered skill. Do not invent commands when discovery is disabled.
    if (args === undefined || !pi.getCommands().some((command) => command.source === "skill" && command.name === "skill:drift")) return;
    try {
      const skill = bundled(ctx.cwd);
      failure = undefined;
      return { action: "transform", text: expandDriftSkill(skill.filePath, skill.baseDir, readFileSync(skill.filePath, "utf8"), args) };
    } catch (error) {
      recordFailure(error, ctx.ui.notify);
      // RPC hosts wait for a settled run. Prevent stale native expansion before the guard
      // aborts it, otherwise the old skill body would be saved in the aborted turn's history.
      return ctx.mode === "rpc"
        ? { action: "transform", text: `Drift skill invocation blocked because its bundled workflow is unavailable.\nRequested: ${event.text}` }
        : { action: "handled" };
    }
  });

  pi.on("before_agent_start", (event, ctx) => {
    const selected = event.systemPromptOptions.skills?.find((skill) => skill.name === "drift");
    if (!selected) return; // Do not undo --no-skills or explicit resource disabling.
    try {
      const skill = bundled(ctx.cwd);
      failure = undefined;
      const systemPrompt = bindDriftAdvertisement(event.systemPrompt, formatSkillsForPrompt([skill]));
      if (identity(selected.filePath) !== identity(skill.filePath) && notified !== selected.filePath) {
        ctx.ui.notify(`Drift automatically uses its bundled workflow at ${skill.filePath}; the duplicate at ${selected.filePath} is left untouched.`, "info");
        notified = selected.filePath;
      }
      return { systemPrompt };
    } catch (error) {
      recordFailure(error, ctx.ui.notify);
      ctx.abort();
    }
  });

  pi.on("context", (event, ctx) => {
    if (failure) { ctx.abort(); return; }
    if (!pi.getCommands().some((command) => command.source === "skill" && command.name === "skill:drift")) return;
    try {
      let skill: ReturnType<typeof bundled> | undefined;
      let body = "";
      const rebind = (text: string) => {
        const args = expandedDriftArgs(text);
        if (args === undefined) return text;
        if (!skill) {
          skill = bundled(ctx.cwd);
          body = readFileSync(skill.filePath, "utf8");
        }
        return expandDriftSkill(skill.filePath, skill.baseDir, body, args);
      };
      // Covers queued RPC inputs and resumed expanded invocations. Transform only the
      // provider context; Pi's original messages and append-only logs remain unchanged.
      return { messages: event.messages.map((message) => message.role !== "user" ? message : {
        ...message,
        content: typeof message.content === "string" ? rebind(message.content) : message.content.map((part) =>
          part.type === "text" ? { ...part, text: rebind(part.text) } : part),
      }) };
    } catch (error) {
      recordFailure(error, ctx.ui.notify);
      ctx.abort();
    }
  });
  pi.on("tool_call", () => failure ? { block: true, terminate: true, reason: failure } : undefined);
  pi.on("session_before_compact", () => failure ? { cancel: true } : undefined);
  pi.on("session_before_tree", () => failure ? { cancel: true } : undefined);
}
