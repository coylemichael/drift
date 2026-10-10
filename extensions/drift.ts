import { CONFIG_DIR_NAME, getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { join, resolve } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { ensureIndexAttribute, publish, setArtifactTracking, syncIndex, trackArtifacts, type TrackingRequest } from "../lib/artifacts.ts";
import { changelogState, sections, setChangelog, syncChangelog, type ChangelogRequest, type ChangelogSync } from "../lib/changelog.ts";
import { attributeFor, changelogDriver, changelogDriverCommand, indexDriver, indexDriverCommand, installDriver } from "../lib/git-drivers.ts";
import { describeLanding, land } from "../lib/land.ts";
import { artifactStore, driftConfig, git, hasOrigin, Records, WorktreeScopeError } from "../lib/state.ts";
import { pickup } from "../lib/pickup.ts";
import { loadModelProfiles, readHandoffRoute } from "../lib/routing.ts";
import { registerSkillBinding } from "./skill-binding.ts";

/** Pi owns lifecycle invocation; the portable skill still owns the workflow. */
export default function drift(pi: ExtensionAPI) {
  // `/drift [artifact | request]`, before the skill binding so it expands the /skill:drift request this produces.
  // A rewrite rather than a command: the result is an ordinary model turn, which every host completes normally.
  pi.on("input", async (event, ctx) => {
    const match = /^\/drift(?:\s+([\s\S]*))?$/.exec(event.text.trim());
    if (!match) return { action: "continue" };
    try {
      const { text, artifact } = await exclusive(async () => pickup(await activeRepo(ctx), match[1] ?? ""));
      if (artifact) ctx.ui.notify(`Drift: picking up ${artifact}`, "info");
      return { action: "transform", text };
    } catch (error) {
      ctx.ui.notify(`Drift could not choose an artifact: ${error instanceof Error ? error.message : String(error)}`, "warning");
      return { action: "transform", text: `/skill:drift ${match[1] ?? ""}`.trim() };
    }
  });
  registerSkillBinding(pi);
  let key = "";
  let ready: Promise<Records | undefined> | undefined;
  let failure: string | undefined;
  let pendingContinuationPath: string | undefined;
  let continuationQueued = false;
  let scopeReported: string | undefined;
  // Commands and tools can overlap. Keep adoption outside publication's post-write changelog/landing phase too.
  let operation: Promise<unknown> = Promise.resolve();
  function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = operation.then(work);
    operation = result.catch(() => {});
    return result;
  }
  let reported: string | undefined;
  let uiReported: string | undefined;
  const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
  const storesReported = new Set<string>();

  function store(ctx: ExtensionContext): Promise<Records | undefined> {
    const identity = `${ctx.cwd}\0${ctx.sessionManager.getSessionId()}`;
    if (identity !== key || !ready) {
      key = identity;
      failure = reported = uiReported = scopeReported = undefined;
      pendingContinuationPath = undefined;
      continuationQueued = false;
      ready = (async () => {
        // A new record measures after derived-file refresh. On resume refresh ONLY its persisted active root,
        // not the launch checkout, which may belong to the orchestrator by now.
        let prepared = false;
        const records = await Records.open(ctx.cwd, ctx.sessionManager.getSessionId(), getAgentDir(), async (repo) => {
          await refreshIndex(repo, ctx);
          prepared = true;
        });
        if (records && !prepared) {
          try { await refreshIndex(await records.effectiveRepo(), ctx); }
          catch (error) {
            if (!(error instanceof WorktreeScopeError)) throw error;
            reportScope(error, ctx);
          }
        }
        return records;
      })().catch((error) => {
        failure = errorText(error);
        throw error;
      });
    }
    return ready;
  }

  async function activeRepo(ctx: ExtensionContext): Promise<string | undefined> {
    return (await store(ctx))?.effectiveRepo();
  }

  function reportScope(error: WorktreeScopeError, ctx: ExtensionContext) {
    if (scopeReported === error.message) return;
    scopeReported = error.message;
    ctx.ui.notify(`${error.message}. Drift will not fall back to the launch checkout. Use drift_worktree status/adopt (or /drift-worktree) to select an existing worktree of this repository. Records are retained; independent investigation can continue.`, "warning");
  }

  /** A stale index degrades navigation only; it never blocks the record or the session. */
  async function refreshIndex(repo: string, ctx: ExtensionContext) {
    try {
      // Where drift/ lives is also stated in every turn's context; the notice is for the first sight of an odd layout.
      const { state } = await artifactStore(repo);
      if (state === "two-stores" && !storesReported.has(repo)) ctx.ui.notify("Drift found artifacts in this worktree's own drift/ as well as the repository's shared store in its main worktree; both are kept and this worktree keeps using its own. Move the folder's contents into the main worktree's drift/ to share them.", "warning");
      storesReported.add(repo);
      if (await syncIndex(repo)) ctx.ui.notify("Drift rebuilt drift/INDEX.md from the repository's artifacts", "info");
      await installIndexDriver(repo, ctx);
      const changelog = await syncChangelog(repo);
      if (changelog.adopted) ctx.ui.notify(`Drift now generates this repository's CHANGELOG.md from changelog.d/ (it has an origin remote): ${changelog.adopted.join("; ")}. Commit those with your next change, or set "changelog": false in .drift.json to keep it hand-written.`, "info");
      if (changelog.status === "written") ctx.ui.notify("Drift regenerated CHANGELOG.md from changelog.d/", "info");
      else if (changelog.status === "unrecognised") ctx.ui.notify(`Drift did not regenerate CHANGELOG.md: ${changelog.detail}`, "warning");
      await installChangelogDriver(repo, ctx);
    } catch (error) {
      const content = `Drift could not refresh drift/INDEX.md: ${errorText(error)}\nRecording continues; the index is rebuilt on the next publication or session.`;
      pi.sendMessage({ customType: "drift-index", content, display: true });
      if (ctx.mode === "rpc") ctx.ui.notify(content, "warning");
    }
  }

  /**
   * A tracked repo commits its index, so two threads' copies meet at rebase. The committed attribute names the
   * driver; the command cannot be committed, so each clone gets it here. A foreign driver is left alone.
   */
  async function installIndexDriver(repo: string, ctx: ExtensionContext) {
    if (!(await trackArtifacts(repo))) return;
    // A committed index only meets another copy where there is a shared branch: the remote is the trigger.
    if (await hasOrigin(repo) && await ensureIndexAttribute(repo)) ctx.ui.notify('Drift added "drift/INDEX.md merge=drift-index" to .gitattributes so tracked index rows merge on rebase; commit it with your next change', "info");
    if (await attributeFor(repo, indexDriver.path) !== indexDriver.name) return;
    const result = await installDriver(repo, indexDriver.name, indexDriver.description, await indexDriverCommand());
    if (result.status === "installed") ctx.ui.notify("Drift installed its drift/INDEX.md merge driver in this clone; other threads' index rows now merge on rebase", "info");
    if (result.status === "conflict") ctx.ui.notify(`Drift left merge.${indexDriver.name}.driver as already configured (${result.existing}); the bundled driver was not installed`, "warning");
  }

  async function installChangelogDriver(repo: string, ctx: ExtensionContext) {
    if (!(await changelogState(repo)).enabled || await attributeFor(repo, changelogDriver.path) !== changelogDriver.name) return;
    const result = await installDriver(repo, changelogDriver.name, changelogDriver.description, await changelogDriverCommand());
    if (result.status === "installed") ctx.ui.notify("Drift installed its CHANGELOG.md merge driver in this clone; other threads' entries now merge on rebase", "info");
    if (result.status === "conflict") ctx.ui.notify(`Drift left merge.${changelogDriver.name}.driver as already configured (${result.existing}); the bundled driver was not installed`, "warning");
  }

  const describeSync = (sync: ChangelogSync) =>
    sync.status === "written" ? "CHANGELOG.md regenerated" : sync.status === "unchanged" ? "CHANGELOG.md already current" :
    sync.status === "unrecognised" ? `CHANGELOG.md not regenerated: ${sync.detail}` : sync.status === "skipped" ? `CHANGELOG.md not regenerated: ${sync.detail}` : `changelog generation is off (${sync.detail})`;

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
    try { await exclusive(async () => (await store(ctx))?.checkpoint(reason)); }
    catch (error) {
      if (error instanceof WorktreeScopeError) reportScope(error, ctx);
      else { failure = errorText(error); report(failure, ctx); }
    }
  }

  async function worktreeStatus(records: Records, ctx: ExtensionContext): Promise<string> {
    const record = await records.read();
    const lines = [`Pi working directory (unchanged): ${ctx.cwd}`, `Record anchor: ${records.repo}`, `Drift record: ${records.file}`];
    try {
      const repo = await records.effectiveRepo(record);
      const tracked = await trackArtifacts(repo);
      const { root } = await artifactStore(repo, tracked);
      const branch = (await git(repo, ["symbolic-ref", "--short", "-q", "HEAD"], true)).trim() || "HEAD (detached)";
      lines.push(`Measured worktree: ${repo}`, `Branch: ${branch}`, `Artifact store: ${join(root, "drift")}`,
        `Artifact policy: ${tracked ? "tracked" : "ignored (default)"}; configuration: ${join(repo, ".drift.json")}`);
    } catch (error) {
      // Status remains useful even if the active worktree/config is broken. It never guesses a replacement.
      lines.push(`Measured worktree unavailable: ${record.worktree ?? records.repo}. ${errorText(error)}`);
    }
    lines.push(`Work interval: ${record.intervalId}; preserved earlier intervals: ${record.history?.length ?? 0}.`,
      "Adoption changes Drift's scope only, not Pi's cwd, file-tool defaults or project trust. Use explicit worker paths. Shell cd does not adopt a worktree.");
    if (record.pending) lines.push(`Incomplete publication: ${record.pending.path}. Retry the SAME drift_publish input before switching.`);
    if (pendingContinuationPath) lines.push(`Continuation queued for ${pendingContinuationPath}; worktree switching is held. If delivery stalled, run drift-continue ${pendingContinuationPath} to recover it, or reload to clear the in-memory queue. The artifact is retained.`);
    return lines.join("\n");
  }

  async function worktreeAction(action: "status" | "adopt", path: string | undefined, ctx: ExtensionContext): Promise<string> {
    const records = await store(ctx);
    if (!records) throw new Error("Worktree adoption requires Pi's launch directory to be inside a Git repository");
    if (failure) throw new Error(failure);
    let changed = false;
    if (action === "adopt") {
      if (!path?.trim()) throw new Error("Provide the existing worktree root in path; relative paths resolve from Pi's fixed cwd");
      if (pendingContinuationPath) throw new Error(`Continuation queued for ${pendingContinuationPath}; finish it before switching worktrees`);
      changed = await records.adopt(resolve(ctx.cwd, path.trim()), (repo) => refreshIndex(repo, ctx));
      scopeReported = undefined;
    } else if (path !== undefined) throw new Error("status takes no path; use action: adopt to change Drift's worktree");
    return `${action === "adopt" ? (changed ? "Adopted worktree; earlier measurements preserved, fresh interval measured. No handoff was published.\n" : "Already using this worktree; no interval changed.\n") : ""}${await worktreeStatus(records, ctx)}`;
  }

  async function continueHandoff(args: string, ctx: ExtensionContext) {
    const artifact = args.trim();
    if (!artifact) {
      ctx.ui.notify("Usage: drift-continue drift/<feature>/<NNN>-handoff-<description>.md", "error");
      return;
    }
    try {
      const records = await store(ctx);
      const repo = await records?.effectiveRepo();
      if (!repo) throw new Error("drift-continue requires an active Drift worktree");
      const route = await readHandoffRoute(repo, artifact);
      // Pi grants trust to its loaded checkout, not a different branch we adopted later.
      const profiles = await loadModelProfiles(repo, getAgentDir(), ctx.isProjectTrusted() && repo === records!.repo, CONFIG_DIR_NAME);
      const target = profiles[route.profile];
      if (!target) {
        throw new Error(`No local Drift model profile named ${JSON.stringify(route.profile)}. Configure it in ${getAgentDir()}/drift-model-profiles.json or the trusted project configuration.`);
      }
      const model = ctx.modelRegistry.find(target.provider, target.model);
      if (!model) throw new Error(`Configured Drift profile ${JSON.stringify(route.profile)} selects an unavailable model ID: ${target.provider}/${target.model}. Use the ID printed by pi --list-models, not the picker label.`);
      if (!(await pi.setModel(model))) throw new Error(`Configured Drift profile ${JSON.stringify(route.profile)} could not authenticate ${target.provider}/${target.model}`);
      if (target.thinkingLevel) pi.setThinkingLevel(target.thinkingLevel);
      ctx.ui.notify(`Drift profile ${route.profile}: ${target.provider}/${target.model}`, "info");
      pendingContinuationPath = undefined;
      continuationQueued = false;
      await pi.sendUserMessage(`Continue the work recorded in the Drift handoff at \`${route.path}\`. Follow the handoff workflow: read this handoff and its referenced source documents, inspect the recent project artifact index, then continue from its Next Steps. Do not re-research completed work.`);
    } catch (error) {
      pendingContinuationPath = undefined;
      continuationQueued = false;
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

  // The user's explicit tracking choice. A command, never a model turn, so the choice cannot be inferred.
  const trackingRequests = ["on", "off", "status"] as const;
  pi.registerCommand("drift-track-artifacts", {
    description: "Commit this repo's Drift artifacts to Git: on, off or status (no argument shows status)",
    getArgumentCompletions: (prefix) => trackingRequests.filter((value) => value.startsWith(prefix.trim())).map((value) => ({ value, label: value })),
    handler: async (args, ctx) => {
      try {
        const request = args.trim().toLowerCase() || "status"; // A bare command is safe: it only reports.
        if (!trackingRequests.includes(request as any)) throw new Error("Usage: /drift-track-artifacts on|off|status (no argument shows status)");
        await exclusive(async () => {
          const repo = await activeRepo(ctx);
          if (!repo) throw new Error("/drift-track-artifacts requires an active Drift worktree");
          ctx.ui.notify(await setArtifactTracking(repo, request as TrackingRequest), "info");
        });
      } catch (error) {
        ctx.ui.notify(errorText(error), "error");
      }
    },
  });

  // The user's choice to generate CHANGELOG.md from fragments. A command, never a model turn.
  const changelogRequests = ["on", "off", "status"] as const;
  pi.registerCommand("drift-changelog", {
    description: "Override whether CHANGELOG.md is generated from changelog.d/ (automatic with an origin remote): on, off or status",
    getArgumentCompletions: (prefix) => changelogRequests.filter((value) => value.startsWith(prefix.trim())).map((value) => ({ value, label: value })),
    handler: async (args, ctx) => {
      try {
        const request = args.trim().toLowerCase() || "status"; // A bare command is safe: it only reports.
        if (!changelogRequests.includes(request as any)) throw new Error("Usage: /drift-changelog on|off|status (no argument shows status)");
        await exclusive(async () => {
          const repo = await activeRepo(ctx);
          if (!repo) throw new Error("/drift-changelog requires an active Drift worktree");
          ctx.ui.notify(await setChangelog(repo, request as ChangelogRequest), "info");
        });
      } catch (error) {
        ctx.ui.notify(errorText(error), "error");
      }
    },
  });

  // The manual form of landing; the automatic form runs after a handoff where land.auto is set.
  pi.registerCommand("drift-land", {
    description: "Land the current branch on origin's default branch: fetch, rebase, verify, check, push; never squash or force",
    handler: async (_args, ctx) => {
      try {
        await exclusive(async () => {
          const records = await store(ctx);
          const repo = await records?.effectiveRepo();
          if (!repo) throw new Error("/drift-land requires an active Drift worktree");
          ctx.ui.notify(describeLanding(await land(repo, { records })), "info");
        });
      } catch (error) {
        ctx.ui.notify(`Not landed: ${errorText(error)}`, "error");
      }
    },
  });

  // Bare syntax keeps the copy/paste continuation prompt from being interpreted as a slash command by hosts that reserve those.
  pi.on("input", async (event, ctx) => {
    const match = /^drift-continue(?:\s+([\s\S]*))?$/.exec(event.text.trim());
    if (!match) return { action: "continue" };
    await exclusive(() => continueHandoff(match[1] ?? "", ctx));
    return { action: "handled" };
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    try {
      await exclusive(async () => (await store(ctx))?.beginTurn());
    } catch (error) {
      if (error instanceof WorktreeScopeError) reportScope(error, ctx);
      else {
        failure = errorText(error);
        report(failure, ctx);
        ctx.abort();
      }
    }
  });

  pi.on("context", async (event, ctx) => {
    let content: string;
    try {
      const records = await store(ctx);
      if (failure) throw new Error(failure);
      content = records ? await records.context() :
        "Drift automation is inactive: Pi's working directory is not inside a Git repository. Do not guess a nested repository or claim a measured baseline. Open the intended repo to use drift_publish; portable skill instructions remain available.";
      // The model learns whether to pass a changelog entry from context, not by trying and being refused.
      if (records) {
        content += `\nPi working directory (unchanged): ${ctx.cwd}. Before work in an assigned linked worktree, call drift_worktree adopt with its root as a separate tool call. Do not hand-write managed artifacts to bypass a destination or policy mismatch.`;
        try {
          const repo = await records.effectiveRepo();
          if ((await changelogState(repo)).enabled) content += "\nChangelog: CHANGELOG.md is generated from changelog.d/ here. Pass changelog: { section, text } to drift_publish for a user-visible change; never edit the generated region of CHANGELOG.md.";
        } catch (error) {
          if (!(error instanceof WorktreeScopeError)) throw error;
          content += "\nPublication and measurement are blocked, not independent investigation. Use drift_worktree status/adopt for explicit recovery; no fallback to main.";
          reportScope(error, ctx);
        }
      }
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
    // Pi preflights sibling calls before executing them concurrently. Refuse the WHOLE batch, not just
    // adoption, so a sibling publication cannot accidentally write into the old checkout.
    const last = ctx.sessionManager.getBranch().findLast((entry) => entry.type === "message" && entry.message.role === "assistant");
    if (last?.type === "message" && last.message.role === "assistant") {
      const calls = last.message.content.filter((part) => part.type === "toolCall");
      if (calls.length > 1 && calls.some((call) => call.name === "drift_worktree" && call.arguments?.action !== "status")) {
        return { block: true, reason: "drift_worktree adopt must be the only tool call in its batch. This batch was not run; adopt first, then use other tools in a separate call." };
      }
    }
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

  pi.on("agent_settled", async (_event, ctx) => {
    await checkpoint("settled", ctx);
    const artifact = pendingContinuationPath;
    if (!artifact || continuationQueued) return;
    continuationQueued = true;
    const identity = key;
    // Keep the scope pinned until the queued continuation consumes it, including the compaction gap.
    ctx.compact({
      customInstructions: `A Drift handoff was published at ${artifact}. Preserve only the minimal continuation context; the next turn will read the handoff and its referenced artifacts directly.`,
      onComplete: () => {
        if (key !== identity) return;
        void (async () => { await pi.sendUserMessage(`drift-continue ${artifact}`); })().catch((error) => {
          if (key === identity) { pendingContinuationPath = undefined; continuationQueued = false; }
          ctx.ui.notify(`Automatic Drift continuation could not be queued: ${errorText(error)}. Recover with drift-continue ${artifact}; its artifact and record are retained.`, "error");
        });
      },
      onError: (error) => {
        if (key === identity) { pendingContinuationPath = undefined; continuationQueued = false; }
        ctx.ui.notify(`Automatic Drift context reset failed: ${error.message}. The published handoff remains available for manual continuation.`, "error");
      },
    });
  });
  pi.on("session_shutdown", async (event, ctx) => checkpoint(`detach:${event.reason}`, ctx));

  pi.registerCommand("drift-worktree", {
    description: "Show Drift's active worktree, or adopt an existing worktree of this repository (Pi's cwd stays unchanged)",
    handler: async (args, ctx) => {
      const path = args.trim();
      try { ctx.ui.notify(await exclusive(() => worktreeAction(!path || path === "status" ? "status" : "adopt", !path || path === "status" ? undefined : path, ctx)), "info"); }
      catch (error) { ctx.ui.notify(errorText(error), "error"); }
    },
  });

  pi.registerTool({
    name: "drift_worktree",
    label: "Drift worktree",
    description: "Report Drift's scope, or explicitly adopt an existing worktree of the same Git repository. Adoption preserves prior measurements and starts a fresh measured interval. It changes all Drift repository operations, not Pi's cwd or file-tool defaults. Run adopt alone, before substantive work; never beside other tool calls. Does not create worktrees, change policy, publish or commit.",
    promptSnippet: "Explicitly adopt an assigned worker worktree without restarting Pi; status reports measured and publication roots",
    parameters: Type.Object({
      action: StringEnum(["status", "adopt"] as const),
      path: Type.Optional(Type.String({ description: "Existing exact worktree root for adopt; absolute or relative to Pi's fixed cwd. Omit for status." })),
    }, { additionalProperties: false }),
    async execute(_id, params, signal, _update, ctx) {
      return exclusive(async () => {
        if (signal?.aborted) throw new Error("Worktree action cancelled before starting");
        return { content: [{ type: "text" as const, text: await worktreeAction(params.action, params.path, ctx) }] };
      });
    },
  });

  pi.registerTool({
    name: "drift_publish",
    label: "Publish Drift artifact",
    description: "Publish a research, plan or handoff artifact in Drift's active worktree (Pi's launch checkout unless explicitly adopted with drift_worktree; private artifacts may use a shared store). Supply the portable skill's Markdown body, without frontmatter. Drift supplies measured metadata, numbering, atomic file writes and a canonical index. A handoff completes only the current work interval; no session log is deleted. Correct argument validation errors before retrying; if a pending publication exists, retry identical input to recover it. Maximum body: 256 KiB.",
    promptSnippet: "Publish Drift artifacts with measured metadata and an indexed, session-owned handoff",
    promptGuidelines: ["Use drift_publish for Drift research/plan/handoff files instead of writing their frontmatter or INDEX.md yourself. Read the Drift skill and relevant workflow first. New handoffs should supply a portable next_session_profile; after successful publication, Pi compacts to the next fresh context window automatically. Do not ask the user to copy/paste a continuation command unless automatic continuation fails. Never delete Drift records or Pi session logs."],
    parameters: Type.Object({
      feature: Type.String({ description: "Confirmed project-local feature ID" }),
      kind: StringEnum(["research", "plan", "handoff"] as const),
      slug: Type.String({ description: "Lowercase hyphenated filename description" }),
      body: Type.String({ description: "Markdown with the workflow's required sections; no YAML frontmatter", maxLength: 262144 }),
      status: Type.Optional(StringEnum(["pending", "in-progress", "complete"] as const, { description: "Omit for the default: research complete, plan pending, handoff in-progress. Pass complete for a handoff whose work is finished." })),
      source_research: Type.Optional(Type.String({ description: "Existing repository-relative drift/...md path; omit or use an empty string when none" })),
      previous_handoff: Type.Optional(Type.String({ description: "Existing repository-relative drift/...md path; omit or use an empty string when none" })),
      related_artifacts: Type.Optional(Type.Array(Type.String(), { description: "Existing drift/...md paths; use [] when none. Blank entries are ignored." })),
      next_session_profile: Type.Optional(Type.String({ description: "Portable lowercase-hyphenated model profile for the receiving session; handoffs only." })),
      changelog: Type.Optional(Type.Object({
        section: StringEnum(sections),
        text: Type.String({ description: "Text of one changelog bullet; the renderer adds the leading '- '. Further lines continue the same bullet; no blank lines", maxLength: 4096 }),
      }, { additionalProperties: false, description: "The change's changelog entry, written as a changelog.d/ fragment beside the artifact. Only when context says the changelog is generated here; omit otherwise." })),
    }, { additionalProperties: false }),
    async execute(_id, params, signal, _update, ctx) {
      return exclusive(async () => {
        if (signal?.aborted) throw new Error("Publication cancelled before starting");
        const records = await store(ctx);
        if (failure) throw new Error(failure);
        if (!records) throw new Error("drift_publish requires Pi's cwd to be inside the target Git repository");
        // Finish an entered publication even if inference is cancelled: leave a receipt or retryable intent.
        const repo = await records.effectiveRepo();
        const receipt = await publish(records, params);
        let changelog = "";
        if (receipt.fragment) {
          // Regeneration failing never undoes a publication; the next publication or session start retries it.
          try { changelog = `\nFragment: ${receipt.fragment}\nChangelog: ${describeSync(await syncChangelog(repo))}`; }
          catch (error) { changelog = `\nFragment: ${receipt.fragment}\nChangelog: not regenerated (${errorText(error)}); it is rebuilt on the next publication or session.`; }
        }
        // A completed interval lands itself where the repo has opted in: handoff -> land -> compaction -> continue.
        // A halt keeps the handoff, holds the continuation, and says exactly what blocked.
        let landed = "";
        let held = false;
        if (params.kind === "handoff" && (await driftConfig(repo)).land?.auto) {
          try { landed = `\n${describeLanding(await land(repo, { records, message: `drift: publish ${receipt.path}` }))}`; }
          catch (error) {
            held = true;
            landed = `\nNot landed: ${errorText(error)}\nThe handoff is published. Automatic continuation is held; fix the cause, then /drift-land.`;
            ctx.ui.notify(`Drift did not land the interval: ${errorText(error)}`, "error");
          }
        }
        const autoContinue = params.kind === "handoff" && params.next_session_profile && !held;
        if (autoContinue) pendingContinuationPath = receipt.path;
        return {
          content: [{ type: "text" as const, text: `Published ${receipt.path}\nIndex: drift/INDEX.md${changelog}${landed}\n${params.kind === "handoff" ? "Current work interval completed; its receipt is retained. Do not delete records or Pi session logs." : "Work interval remains active."}${autoContinue ? "\nA fresh profiled context window is queued automatically." : ""}` }],
          details: receipt,
        };
      });
    },
  });

}
