import { CONFIG_DIR_NAME, getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { publish } from "../lib/artifacts.ts";
import { repoRoot, Records } from "../lib/state.ts";
import { loadModelProfiles, readHandoffRoute } from "../lib/routing.ts";

/** Pi owns lifecycle invocation; the portable skill still owns the workflow. */
export default function drift(pi: ExtensionAPI) {
  let key = "";
  let ready: Promise<Records | undefined> | undefined;
  let failure: string | undefined;
  let queuedHandoffPath: string | undefined;
  let reported: string | undefined;
  let uiReported: string | undefined;
  const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

  function store(ctx: ExtensionContext): Promise<Records | undefined> {
    const identity = `${ctx.cwd}\0${ctx.sessionManager.getSessionId()}`;
    if (identity !== key || !ready) {
      key = identity;
      failure = reported = uiReported = undefined;
      ready = Records.open(ctx.cwd, ctx.sessionManager.getSessionId(), getAgentDir()).catch((error) => {
        failure = errorText(error);
        throw error;
      });
    }
    return ready;
  }

  function report(message: string, ctx?: ExtensionContext) {
    const content = `Drift could not establish/update its record: ${message}\nFix the cause and reload/start a fresh Pi thread. No successful recording is claimed.`;
    if (reported !== message) {
      pi.sendMessage({ customType: "drift-error", content, display: true });
      reported = message;
    }
    // ACP may not render custom messages; its RPC notification bridge does.
    if (ctx?.mode === "rpc" && uiReported !== message) {
      ctx.ui.notify(content, "error");
      uiReported = message;
    }
  }

  async function checkpoint(reason: string, ctx: ExtensionContext) {
    try { await (await store(ctx))?.checkpoint(reason); }
    catch (error) { failure = errorText(error); report(failure, ctx); }
  }

  async function continueHandoff(args: string, ctx: ExtensionContext) {
    const artifact = args.trim();
    if (!artifact) {
      ctx.ui.notify("Usage: drift-continue drift/<feature>/<NNN>-handoff-<description>.md", "error");
      return;
    }
    try {
      const repo = await repoRoot(ctx.cwd);
      if (!repo) throw new Error("drift-continue requires Pi's working directory to be inside the target Git repository");
      const route = await readHandoffRoute(repo, artifact);
      const profiles = await loadModelProfiles(repo, getAgentDir(), ctx.isProjectTrusted(), CONFIG_DIR_NAME);
      const target = profiles[route.profile];
      if (!target) {
        throw new Error(`No local Drift model profile named ${JSON.stringify(route.profile)}. Configure it in ${getAgentDir()}/drift-model-profiles.json or the trusted project configuration.`);
      }
      const model = ctx.modelRegistry.find(target.provider, target.model);
      if (!model) throw new Error(`Configured Drift profile ${JSON.stringify(route.profile)} selects an unavailable model ID: ${target.provider}/${target.model}. Use the ID printed by pi --list-models, not the picker label.`);
      if (!(await pi.setModel(model))) throw new Error(`Configured Drift profile ${JSON.stringify(route.profile)} could not authenticate ${target.provider}/${target.model}`);
      if (target.thinkingLevel) pi.setThinkingLevel(target.thinkingLevel);
      ctx.ui.notify(`Drift profile ${route.profile}: ${target.provider}/${target.model}`, "info");
      await pi.sendUserMessage(`Continue the work recorded in the Drift handoff at \`${route.path}\`. Follow the handoff workflow: read this handoff and its referenced source documents, inspect the recent project artifact index, then continue from its Next Steps. Do not re-research completed work.`);
    } catch (error) {
      ctx.ui.notify(errorText(error), "error");
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    try { await store(ctx); }
    catch (error) { report(errorText(error)); }
  });

  pi.on("input", async (_event, ctx) => {
    try {
      await (await store(ctx))?.read();
      if (failure) throw new Error(failure);
    } catch (error) {
      failure = errorText(error);
      report(failure, ctx);
      // pi-acp waits for agent_settled even when RPC accepts an input-handled prompt.
      // In RPC mode let the loop start, then abort in context BEFORE provider I/O.
      return { action: ctx.mode === "rpc" ? "continue" : "handled" };
    }
    return { action: "continue" };
  });

  // Bare syntax keeps the copy/paste continuation prompt from being interpreted as a slash command by hosts that reserve those.
  pi.on("input", async (event, ctx) => {
    const match = /^drift-continue(?:\s+([\s\S]*))?$/.exec(event.text.trim());
    if (!match) return { action: "continue" };
    await continueHandoff(match[1] ?? "", ctx);
    return { action: "handled" };
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    try {
      await (await store(ctx))?.beginTurn();
    } catch (error) {
      failure = errorText(error);
      report(failure, ctx);
      ctx.abort();
    }
  });

  pi.on("context", async (event, ctx) => {
    let content: string;
    try {
      const records = await store(ctx);
      if (failure) throw new Error(failure);
      content = records ? await records.context() :
        "Drift automation is inactive: Pi's working directory is not inside a Git repository. Do not guess a nested repository or claim a measured baseline. Open the intended repo to use drift_publish; portable skill instructions remain available.";
    } catch (error) {
      failure = errorText(error);
      report(failure, ctx);
      // Do not await abort from inside the running loop: it waits for that loop to settle.
      ctx.abort();
      content = `Drift recording failed: ${failure}. Do not claim a valid record or publish artifacts. Fix the cause and reload.`;
    }
    return {
      messages: [
        ...event.messages.filter((message) => !(message.role === "custom" && message.customType === "drift-context")),
        { role: "custom" as const, customType: "drift-context", content, display: false, timestamp: Date.now() },
      ],
    };
  });

  pi.on("tool_call", async (_event, ctx) => {
    try {
      await (await store(ctx))?.read();
      if (failure) throw new Error(failure);
    } catch (error) {
      return { block: true, terminate: true, reason: `Drift initialization/checkpoint failure: ${String(error)}` };
    }
  });

  // Summaries bypass the ordinary context hook; don't run them with a failed record.
  async function guardSummary(_event: unknown, ctx: ExtensionContext) {
    try {
      await (await store(ctx))?.read();
      if (failure) throw new Error(failure);
    } catch (error) {
      failure = errorText(error);
      report(failure, ctx);
      return { cancel: true };
    }
  }
  pi.on("session_before_compact", guardSummary);
  pi.on("session_before_tree", guardSummary);

  pi.on("agent_settled", async (_event, ctx) => checkpoint("settled", ctx));
  pi.on("session_shutdown", async (event, ctx) => checkpoint(`detach:${event.reason}`, ctx));

  pi.registerTool({
    name: "drift_publish",
    label: "Publish Drift artifact",
    description: "Publish a research, plan or handoff artifact in the current Git repo. Supply the portable skill's Markdown body, without frontmatter. Drift supplies measured metadata, numbering, atomic file writes and a canonical index. A handoff completes only the current work interval; no session log is deleted. Correct argument validation errors before retrying; if a pending publication exists, retry identical input to recover it. Maximum body: 256 KiB.",
    promptSnippet: "Publish Drift artifacts with measured metadata and an indexed, session-owned handoff",
    promptGuidelines: ["Use drift_publish for Drift research/plan/handoff files instead of writing their frontmatter or INDEX.md yourself. Read the Drift skill and relevant workflow first. New handoffs should supply a portable next_session_profile; after successful publication, Pi starts the next fresh session automatically. Do not ask the user to copy/paste a continuation command unless automatic continuation fails. Never delete Drift records or Pi session logs."],
    parameters: Type.Object({
      feature: Type.String({ description: "Confirmed project-local feature ID" }),
      kind: StringEnum(["research", "plan", "handoff"] as const),
      slug: Type.String({ description: "Lowercase hyphenated filename description" }),
      body: Type.String({ description: "Markdown with the workflow's required sections; no YAML frontmatter", maxLength: 262144 }),
      status: Type.Optional(Type.String({ maxLength: 200 })),
      source_research: Type.Optional(Type.String({ description: "Existing repository-relative drift/...md path; omit or use an empty string when none" })),
      previous_handoff: Type.Optional(Type.String({ description: "Existing repository-relative drift/...md path; omit or use an empty string when none" })),
      related_artifacts: Type.Optional(Type.Array(Type.String(), { description: "Existing drift/...md paths; use [] when none. Blank entries are ignored." })),
      next_session_profile: Type.Optional(Type.String({ description: "Portable lowercase-hyphenated model profile for the receiving session; handoffs only." })),
    }, { additionalProperties: false }),
    async execute(_id, params, signal, _update, ctx) {
      if (signal?.aborted) throw new Error("Publication cancelled before starting");
      const records = await store(ctx);
      if (failure) throw new Error(failure);
      if (!records) throw new Error("drift_publish requires Pi's cwd to be inside the target Git repository");
      // Finish an entered publication even if inference is cancelled: leave a receipt or retryable intent.
      const receipt = await publish(records, params);
      const autoContinue = params.kind === "handoff" && params.next_session_profile;
      if (autoContinue && queuedHandoffPath !== receipt.path) {
        queuedHandoffPath = receipt.path;
        // Commands own session replacement. Queue one after the current model has finished its handoff response.
        void pi.sendUserMessage(`/drift-start-next ${receipt.path}`, { deliverAs: "followUp", expandPromptTemplates: true });
      }
      return {
        content: [{ type: "text" as const, text: `Published ${receipt.path}\nIndex: drift/INDEX.md\n${params.kind === "handoff" ? "Current work interval completed; its receipt is retained. Do not delete records or Pi session logs." : "Work interval remains active."}${autoContinue ? "\nA fresh profiled Pi session is queued automatically." : ""}` }],
        details: receipt,
      };
    },
  });

  pi.registerCommand("drift-start-next", {
    description: "Internal: create a fresh profiled session after a published handoff",
    handler: async (args, ctx) => {
      const artifact = args.trim();
      try {
        const repo = await repoRoot(ctx.cwd);
        if (!repo) throw new Error("drift-start-next requires Pi's working directory to be inside the target Git repository");
        const route = await readHandoffRoute(repo, artifact);
        const profiles = await loadModelProfiles(repo, getAgentDir(), ctx.isProjectTrusted(), CONFIG_DIR_NAME);
        const target = profiles[route.profile];
        if (!target) throw new Error(`No local Drift model profile named ${JSON.stringify(route.profile)}; the published handoff remains available for manual continuation.`);
        if (!ctx.modelRegistry.find(target.provider, target.model)) {
          throw new Error(`Configured Drift profile ${JSON.stringify(route.profile)} selects an unavailable model ID: ${target.provider}/${target.model}. The published handoff remains available for manual continuation.`);
        }
        const parentSession = ctx.sessionManager.getSessionFile();
        const result = await ctx.newSession({
          parentSession,
          withSession: async (replacementCtx) => {
            replacementCtx.ui.notify(`Continuing Drift handoff with profile ${route.profile}`, "info");
            await replacementCtx.sendUserMessage(`drift-continue ${route.path}`);
          },
        });
        if (result.cancelled) ctx.ui.notify("Automatic Drift continuation was cancelled; the published handoff remains available.", "warning");
      } catch (error) {
        ctx.ui.notify(`${errorText(error)} Automatic continuation was not started; the published handoff remains available.`, "error");
      }
    },
  });
}
