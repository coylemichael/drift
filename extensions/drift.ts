import { CONFIG_DIR_NAME, getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { dirname, join, resolve } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { hasArtifacts, publish, setArtifactTracking, type TrackingRequest } from "../lib/artifacts.ts";
import { artifactStore, driftConfig, exists, git, Records, setAutoContinue, trackArtifacts, updateConfig, WorktreeScopeError, type AutoContinueRequest } from "../lib/state.ts";
import { citationNote, pickup } from "../lib/pickup.ts";

// The citation usefulness ledger: one JSONL line per checked pickup, in the agent dir, never a repo.
const citationLedger = () => join(getAgentDir(), "drift", "citation-metrics.jsonl");
import { describeProfile, modelProfileSources, planTargetWarning, readHandoffRoute, thinkingLevels, type ModelProfile, type ThinkingLevel } from "../lib/routing.ts";

/** All the model context a fresh continuation window inherits from the previous one. */
const handoffBoundary = (artifact: string) => `Drift handoff boundary: the previous work interval ended by publishing ${artifact}. Its conversation is intentionally not carried into this context window; that handoff and the artifacts it references are the complete context for the next task.`;
import { registerPiVersionNotice } from "./pi-version.ts";
import { registerSkillBinding } from "./skill-binding.ts";

/** Pi owns lifecycle invocation; the portable skill still owns the workflow. */
export default function drift(pi: ExtensionAPI) {
  // `/drift [artifact | request]`, before the skill binding so it expands the /skill:drift request this produces.
  // A rewrite rather than a command: the result is an ordinary model turn, which every host completes normally.
  pi.on("input", async (event, ctx) => {
    const match = /^\/drift(?:\s+([\s\S]*))?$/.exec(event.text.trim());
    if (!match) return { action: "continue" };
    engageExplicit(ctx, "user ran /drift");
    try {
      const { text, artifact } = await exclusive(async () => pickup(await activeRepo(ctx), match[1] ?? "", citationLedger()));
      if (artifact) ctx.ui.notify(`Drift: picking up ${artifact}`, "info");
      return { action: "transform", text };
    } catch (error) {
      ctx.ui.notify(`Drift could not choose an artifact: ${error instanceof Error ? error.message : String(error)}`, "warning");
      return { action: "transform", text: `/skill:drift ${match[1] ?? ""}`.trim() };
    }
  });
  registerSkillBinding(pi);
  registerPiVersionNotice(pi);
  let key = "";
  let ready: Promise<Records | undefined> | undefined;
  let probedEmpty = false;
  let failure: string | undefined;
  let pendingContinuationPath: string | undefined;
  let registry: ExtensionContext["modelRegistry"] | undefined; // For /drift-model-override completions, which get no ctx.
  const warnedTargets = new Set<string>(); // Plans already warned about having no acceptance criteria or breakpoint.
  let continuationQueued = false;
  let boundaryAppended: string | undefined; // The handoff whose fresh-context boundary is already in the session.
  let scopeReported: string | undefined;
  // Commands and tools can overlap. Keep adoption outside a publication that is still writing.
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
      const attaching = identity === key && probedEmpty;
      key = identity;
      probedEmpty = false;
      failure = reported = uiReported = scopeReported = undefined;
      pendingContinuationPath = boundaryAppended = undefined;
      continuationQueued = false;
      const probe: Promise<Records | undefined> = (async () => {
        // A new record measures after session preparation. On resume prepare ONLY its persisted active root,
        // not the launch checkout, which may belong to the orchestrator by now.
        let prepared = false;
        const records = await Records.open(ctx.cwd, ctx.sessionManager.getSessionId(), getAgentDir(), async (repo) => {
          await prepareSession(repo, ctx);
          prepared = true;
        });
        if (records && !prepared) {
          try { await prepareSession(await records.effectiveRepo(), ctx); }
          catch (error) {
            if (!(error instanceof WorktreeScopeError)) throw error;
            reportScope(error, ctx);
          }
        }
        if (records) {
          await attachSignals(records);
          if (attaching) ctx.ui.notify(`Drift attached to ${records.repo}; recording silently`, "info");
        } else {
          probedEmpty = true;
        }
        return records;
      })().catch((error) => {
        failure = errorText(error);
        throw error;
      });
      ready = probe;
      // A launch directory with no repository is re-probed on later calls: a clone may create one mid-session.
      probe.then((records) => { if (!records && ready === probe) ready = undefined; }, () => {});
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

  /** Attach-time salience: engage when the repository or this session already shows Drift investment. Never blocks recording. */
  async function attachSignals(records: Records) {
    try {
      const record = await records.read();
      if (record.engaged) return;
      if (record.receipts.length || record.completed || record.history?.length) { await records.engage("resumed interval with prior Drift activity"); return; }
      const repo = await records.effectiveRepo(record).catch(() => records.repo);
      if (await exists(join(repo, ".drift.json"))) { await records.engage("repository has .drift.json"); return; }
      if (await hasArtifacts(repo)) { await records.engage("artifact store already holds artifacts"); return; }
      if (await records.engagedElsewhere()) await records.engage("another session engaged this repository");
    } catch { /* salience must never block recording */ }
  }

  /** Work-based salience: the first non-drift file change or commit since the measured baseline engages the record. */
  async function engageOnWork(records: Records) {
    const record = await records.read();
    if (record.engaged || !record.checkpoint) return;
    if (record.checkpoint.files.some((name) => !name.startsWith("drift/")) || record.checkpoint.commits.length) {
      await records.engage("working tree diverged from the measured baseline");
    }
  }

  /** Explicit Drift use is an engagement signal; it must never block or delay the invocation that caused it. */
  function engageExplicit(ctx: ExtensionContext, reason: string) {
    void (async () => { await (await store(ctx))?.engage(reason); })().catch(() => {});
  }

  /** Session-start preparation for the active root, before the record measures its baseline. Never blocks recording. */
  async function prepareSession(repo: string, ctx: ExtensionContext) {
    try {
      // Where drift/ lives is also stated in every turn's context; the notice is for the first sight of an odd layout.
      const { state } = await artifactStore(repo);
      if (state === "two-stores" && !storesReported.has(repo)) ctx.ui.notify("Drift found artifacts in this worktree's own drift/ as well as the repository's shared store in its main worktree; both are kept and this worktree keeps using its own. Move the folder's contents into the main worktree's drift/ to share them.", "warning");
      storesReported.add(repo);
    } catch (error) {
      const content = `Drift could not inspect the artifact store: ${errorText(error)}\nRecording continues; pickup and recent navigation read raw artifacts.`;
      pi.sendMessage({ customType: "drift-store", content, display: true });
      if (ctx.mode === "rpc") ctx.ui.notify(content, "warning");
    }
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
    try {
      await exclusive(async () => {
        const records = await store(ctx);
        if (!records) return;
        await records.checkpoint(reason);
        await engageOnWork(records);
      });
    }
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
    if (pendingContinuationPath) lines.push(`Continuation queued for ${pendingContinuationPath}; worktree switching is held. If delivery stalled, run /drift ${pendingContinuationPath} to pick it up on the model you have selected, or reload to clear the in-memory queue. The artifact is retained.`);
    return lines.join("\n");
  }

  async function worktreeAction(action: "status" | "adopt", path: string | undefined, ctx: ExtensionContext): Promise<string> {
    const records = await store(ctx);
    if (!records) throw new Error(`Drift found no Git repository at Pi's launch directory (${ctx.cwd}). If a repository was created or cloned here after launch, retry this call; Drift re-probes on each use.`);
    if (failure) throw new Error(failure);
    let changed = false;
    if (action === "adopt") {
      if (!path?.trim()) throw new Error("Provide the existing worktree root in path; relative paths resolve from Pi's fixed cwd");
      if (pendingContinuationPath) throw new Error(`Handoff ${pendingContinuationPath} is published and a fresh context window is queued from it; it starts when this turn ends. End your turn now with no further tool calls; do not adopt, publish or continue the work here.`);
      changed = await records.adopt(resolve(ctx.cwd, path.trim()), (repo) => prepareSession(repo, ctx));
      await records.engage("worktree adoption");
      scopeReported = undefined;
    } else if (path !== undefined && path.trim() !== "") throw new Error("status takes no path; omit it (an empty string is treated as omitted), or use action: adopt with a worktree root to change Drift's worktree");
    return `${action === "adopt" ? (changed ? "Adopted worktree; earlier measurements preserved, fresh interval measured. No handoff was published.\n" : "Already using this worktree; no interval changed.\n") : ""}${await worktreeStatus(records, ctx)}`;
  }

  /** Automatic continuation takes its model from the user's profile map, read fresh each time; /drift never does. */
  function profileSources(ctx: ExtensionContext, repo: string, records: Records) {
    // Pi grants trust to its loaded checkout, not a different branch we adopted later.
    return modelProfileSources(repo, getAgentDir(), ctx.isProjectTrusted() && repo === records.repo, CONFIG_DIR_NAME);
  }

  /** What /drift-auto-continue shows while on: which file the models come from and what each profile selects. */
  async function profileNote(ctx: ExtensionContext, repo: string): Promise<string> {
    const keep = "/drift still picks up on the model you have selected.";
    try {
      const records = await store(ctx);
      if (!records) return "";
      const { files, defaultFile, profiles } = await profileSources(ctx, repo, records);
      const names = Object.keys(profiles).sort();
      if (!names.length) return `No model profiles are configured (expected in ${defaultFile}): a handoff without a next_session_profile continues on the model in use; a named profile stops visibly until it is configured. ${keep}`;
      return `Each fresh window uses the model its handoff's next_session_profile maps to in ${files.join(", overridden by ")} (none named: the model in use):\n${names.map((name) => `  ${describeProfile(name, profiles[name])}`).join("\n")}`;
    } catch (error) {
      return `Model profiles could not be read: ${errorText(error)}. Automatic continuation stops visibly until this is fixed. ${keep}`;
    }
  }

  /** What drift_publish says about a queued continuation: the exact profile, model and file it will use. */
  async function continuationTarget(ctx: ExtensionContext, repo: string, records: Records, artifact: string, profile: string | undefined): Promise<string> {
    const manual = `run /drift ${artifact} to pick it up on the model you have selected`;
    const pin = await driftConfig(repo);
    if (pin.model) return `Next model: pinned ${pin.model}${pin.thinkingLevel ? ` (${pin.thinkingLevel})` : ""} by /drift-model-override; handoff profiles are ignored.`;
    if (!profile) return `Next model: the one in use, ${ctx.model ? `${ctx.model.provider}/${ctx.model.id}${ctx.thinkingLevel ? ` (${ctx.thinkingLevel})` : ""}` : "unchanged"} (no next_session_profile and no /drift-model-override pin).`;
    try {
      const { files, defaultFile, profiles } = await profileSources(ctx, repo, records);
      const target = profiles[profile];
      return target
        ? `Next model: profile ${describeProfile(profile, target)}, from ${files.join(", overridden by ")}.`
        : `Next model: profile ${JSON.stringify(profile)} is not configured in ${files.join(" or ") || defaultFile}, so the automatic step will stop visibly; configure it, or ${manual}.`;
    } catch (error) {
      return `Next model: profiles could not be read (${errorText(error)}), so the automatic step will stop visibly; fix them, or ${manual}.`;
    }
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
      // A /drift-model-override pin overrides every profile; with neither, the model in use continues.
      const pin = await driftConfig(repo);
      const route = await readHandoffRoute(repo, artifact);
      // Pi grants trust to its loaded checkout, not a different branch we adopted later.
      // The automatic step's model comes from the pin or the user's profile map; /drift always keeps the selected model.
      const manual = ` To pick it up on the model you have selected instead, run /drift ${route.path}.`;
      let target: ModelProfile | undefined;
      let label = "";
      if (pin.model) {
        const slash = pin.model.indexOf("/");
        target = { provider: pin.model.slice(0, slash), model: pin.model.slice(slash + 1), ...(pin.thinkingLevel ? { thinkingLevel: pin.thinkingLevel as ThinkingLevel } : {}) };
        label = "/drift-model-override pin";
      } else if (route.profile) {
        const { files, defaultFile, profiles } = await profileSources(ctx, repo, records!);
        target = profiles[route.profile];
        if (!target) {
          throw new Error(`No local Drift model profile named ${JSON.stringify(route.profile)} in ${files.join(" or ") || defaultFile}. Configure it there or in the trusted project's ${CONFIG_DIR_NAME}/drift-model-profiles.json.${manual}`);
        }
        label = `profile ${JSON.stringify(route.profile)}`;
      }
      if (target) {
        const model = ctx.modelRegistry.find(target.provider, target.model);
        if (!model) throw new Error(`Configured Drift ${label} selects an unavailable model ID: ${target.provider}/${target.model}. Use the ID printed by pi --list-models, not the picker label.${manual}`);
        if (!(await pi.setModel(model))) throw new Error(`Configured Drift ${label} could not authenticate ${target.provider}/${target.model}.${manual}`);
        if (target.thinkingLevel) pi.setThinkingLevel(target.thinkingLevel);
      }
      ctx.ui.notify(!target ? `Drift continues on the model in use${ctx.model ? `: ${ctx.model.provider}/${ctx.model.id}` : ""}` : `Drift ${pin.model ? describeProfile("pinned", target) : `profile ${describeProfile(route.profile!, target)}`}`, "info");
      pendingContinuationPath = boundaryAppended = undefined;
      continuationQueued = false;
      // The same citation grading /drift gets: what to re-check before relying on the handoff.
      const note = await citationNote(repo, (await artifactStore(repo)).root, route.path, citationLedger()).catch(() => undefined);
      await pi.sendUserMessage(`Continue the work recorded in the Drift handoff at \`${route.path}\`. Follow the handoff workflow: read this handoff and its referenced source documents, inspect the recent raw-artifact list, then continue from its Next Steps. Do not re-research completed work.${note ? `\n\n${note}` : ""}`);
    } catch (error) {
      pendingContinuationPath = boundaryAppended = undefined;
      continuationQueued = false;
      ctx.ui.notify(errorText(error), "error");
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    registry = ctx.modelRegistry;
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
        engageExplicit(ctx, "user ran /drift-track-artifacts");
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

  // The user's choice whether an open handoff opens the next fresh context window itself. A command, never a model turn.
  const continueRequests = ["on", "off", "status"] as const;
  pi.registerCommand("drift-auto-continue", {
    description: "Whether each open handoff automatically starts a fresh context window from the handoff alone, on its profile's model, the /drift-model-override pin or the model in use (off by default: pick up with /drift on your selected model): on, off or status",
    getArgumentCompletions: (prefix) => continueRequests.filter((value) => value.startsWith(prefix.trim())).map((value) => ({ value, label: value })),
    handler: async (args, ctx) => {
      try {
        const request = args.trim().toLowerCase() || "status"; // A bare command is safe: it only reports.
        if (!continueRequests.includes(request as any)) throw new Error("Usage: /drift-auto-continue on|off|status (no argument shows status)");
        engageExplicit(ctx, "user ran /drift-auto-continue");
        await exclusive(async () => {
          const repo = await activeRepo(ctx);
          if (!repo) throw new Error("/drift-auto-continue requires an active Drift worktree");
          const message = await setAutoContinue(repo, request as AutoContinueRequest);
          ctx.ui.notify((await driftConfig(repo)).autoContinue ? `${message}\n${await profileNote(ctx, repo)}` : message, "info");
        });
      } catch (error) {
        ctx.ui.notify(errorText(error), "error");
      }
    },
  });

  // The user's one-model override: every automatic continuation in this repo uses it, whatever the handoff's profile.
  pi.registerCommand("drift-model-override", {
    description: "Pin automatic Drift continuation in this repo to one model, ignoring handoff profiles: <provider/model> [thinking], current, off or status",
    getArgumentCompletions: (prefix) => ["status", "current", "off", ...(registry?.getAvailable() ?? []).map((m) => `${m.provider}/${m.id}`)]
      .filter((value) => value.startsWith(prefix.trim())).map((value) => ({ value, label: value })),
    handler: async (args, ctx) => {
      try {
        const [request = "status", level] = args.trim().split(/\s+/).filter(Boolean);
        engageExplicit(ctx, "user ran /drift-model-override");
        await exclusive(async () => {
          const repo = await activeRepo(ctx);
          if (!repo) throw new Error("/drift-model-override requires an active Drift worktree");
          const config = await driftConfig(repo);
          const off = config.autoContinue ? "" : " Automatic continuation is off; /drift-auto-continue on enables it.";
          if (request === "status") {
            ctx.ui.notify(config.model ? `Drift continuation is pinned to ${config.model}${config.thinkingLevel ? ` (${config.thinkingLevel})` : ""}; handoff profiles are ignored. /drift-model-override off restores profile routing.${off}` : `No Drift model pin: automatic continuation uses each handoff's next_session_profile. /drift-model-override current pins the model you have selected.${off}`, "info");
            return;
          }
          if (request === "off") {
            await updateConfig(repo, { model: undefined, thinkingLevel: undefined });
            ctx.ui.notify("Drift model pin removed from .drift.json: automatic continuation uses each handoff's next_session_profile again.", "info");
            return;
          }
          const slash = request.indexOf("/");
          const model = request === "current" ? ctx.model : slash > 0 ? ctx.modelRegistry.find(request.slice(0, slash), request.slice(slash + 1)) : undefined;
          if (!model) throw new Error(request === "current" ? "No model is selected to pin" : `Unknown model ${request}: use provider/id as listed by pi --list-models (Tab completes)`);
          const thinking = level ?? (request === "current" ? ctx.thinkingLevel : undefined);
          if (thinking && !thinkingLevels.includes(thinking as ThinkingLevel)) throw new Error(`Thinking level must be one of: ${thinkingLevels.join(", ")}`);
          await updateConfig(repo, { model: `${model.provider}/${model.id}`, thinkingLevel: thinking });
          ctx.ui.notify(`Drift continuation pinned to ${model.provider}/${model.id}${thinking ? ` (${thinking})` : ""} in .drift.json: every open handoff continues on it, whatever its next_session_profile.${off}`, "info");
        });
      } catch (error) {
        ctx.ui.notify(errorText(error), "error");
      }
    },
  });

  // Bare syntax keeps the copy/paste continuation prompt from being interpreted as a slash command by hosts that reserve those.
  pi.on("input", async (event, ctx) => {
    const match = /^drift-continue(?:\s+([\s\S]*))?$/.exec(event.text.trim());
    if (!match) return { action: "continue" };
    engageExplicit(ctx, "user ran drift-continue");
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

  // A handoff is the only clean way into a fresh window, so ask for one in both modes, well before Pi's
  // compaction threshold, so a single large tool result cannot overflow the window first.
  const HANDOFF_AT = 0.6; // ponytail: fixed fraction of the window; make it a .drift.json setting if one value stops fitting
  async function handoffNudge(ctx: ExtensionContext, records: Records): Promise<string> {
    const usage = ctx.getContextUsage();
    if (pendingContinuationPath || !usage?.tokens || usage.tokens < usage.contextWindow * HANDOFF_AT) return "";
    const repo = await records.effectiveRepo();
    const config = await driftConfig(repo);
    const { profiles } = await profileSources(ctx, repo, records).catch(() => ({ profiles: {} as Record<string, ModelProfile> }));
    const names = Object.keys(profiles);
    const same = names.find((name) => profiles[name].provider === ctx.model?.provider && profiles[name].model === ctx.model?.id);
    const profile = config.model ? `any next_session_profile; this repo is pinned to ${config.model}`
      : same ? `next_session_profile "${same}" (keeps ${ctx.model!.provider}/${ctx.model!.id})`
      : names.length ? `a next_session_profile from: ${names.join(", ")}, or none to keep the model in use` : "no next_session_profile, so the model in use continues";
    const next = config.autoContinue ? "so a fresh context window continues the work" : "then tell the user to run /drift to pick it up in a fresh context window";
    return `\nContext is ${Math.round((usage.tokens / usage.contextWindow) * 100)}% full (${usage.tokens}/${usage.contextWindow} tokens). Finish the current step, avoid large tool output, then publish a Drift handoff with drift_publish (kind: handoff, ${profile}) ${next}.`;
  }

  // A hidden note can be ignored: crossing the threshold also steers once with an explicit user message.
  // Re-arms when usage drops back below it (fresh window or compaction).
  let handoffRequested = false;
  pi.on("turn_end", async (_event, ctx) => {
    try {
      const records = await store(ctx);
      const note = records && !failure ? await handoffNudge(ctx, records) : "";
      if (!note) { handoffRequested = false; return; }
      if (handoffRequested) return;
      handoffRequested = true;
      pi.sendUserMessage(`Drift: ${note.trim()}`, { deliverAs: "steer" });
    } catch { /* the per-request context note still applies */ }
  });

  pi.on("context", async (event, ctx) => {
    let content: string;
    try {
      const records = await store(ctx);
      if (failure) throw new Error(failure);
      if (!records) {
        content = "Drift is inactive: Pi's working directory is not inside a Git repository. No action is needed; do not guess a nested repository or claim a measured baseline. Drift attaches automatically if a repository appears here; portable skill instructions remain available.";
      } else {
        const record = await records.read();
        if (!record.engaged && !record.pending && !record.completed) {
          content = await records.contextQuiet();
        } else {
          content = await records.context();
          content += `\nPi working directory (unchanged): ${ctx.cwd}. Only when assigned a different linked worktree, call drift_worktree adopt with its root as a separate tool call; the current one needs no adoption. Do not hand-write managed artifacts to bypass a destination or policy mismatch.`;
          try {
            await records.effectiveRepo(); // A scope failure blocks publication; say so here rather than at the tool call.
          } catch (error) {
            if (!(error instanceof WorktreeScopeError)) throw error;
            content += "\nPublication and measurement are blocked, not independent investigation. Use drift_worktree status/adopt for explicit recovery; no fallback to main.";
            reportScope(error, ctx);
          }
        }
        content += await handoffNudge(ctx, records).catch(() => "");
      }
    } catch (error) {
      failure = errorText(error);
      report(failure, ctx);
      // Do not await abort from inside the running loop: it waits for that loop to settle.
      ctx.abort();
      content = `Drift recording failed: ${failure}. Do not claim a valid record or publish artifacts. Fix the cause and reload.`;
    }
    // An unchanged context keeps its place and timestamp; replacing it every turn would present old bookkeeping as news.
    const previous = event.messages.find((message) => message.role === "custom" && message.customType === "drift-context");
    if (previous?.role === "custom" && previous.content === content) return;
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

  // Automatic continuation needs no summary: the handoff is the whole context for the next task. Just before the
  // publishing run settles, append a retain-none boundary (no summarizer call, no retained transcript tail), so the
  // next request carries only the system prompt, this note and the continuation prompt. Raw history stays in the
  // session file; only model context changes.
  pi.on("agent_before_settle", async (event) => {
    const artifact = pendingContinuationPath;
    if (!artifact || continuationQueued || boundaryAppended === artifact || failure) return;
    // Queued user input runs first, with its own context; the boundary lands when that run settles.
    if (event.context.pendingMessages.length) return;
    boundaryAppended = artifact;
    return { entries: [...event.entries, { type: "compaction" as const, summary: handoffBoundary(artifact), firstKeptEntryId: null, details: { drift: "handoff-boundary", artifact } }] };
  });

  pi.on("agent_settled", async (_event, ctx) => {
    await checkpoint("settled", ctx);
    const artifact = pendingContinuationPath;
    if (!artifact || continuationQueued) return;
    if (boundaryAppended !== artifact) {
      // Never continue on top of the old transcript.
      pendingContinuationPath = boundaryAppended = undefined;
      ctx.ui.notify(`Automatic Drift continuation did not start: no fresh context boundary was recorded for ${artifact}. Run /drift ${artifact} to pick it up on the model you have selected; the artifact and record are retained.`, "warning");
      return;
    }
    continuationQueued = true;
    const identity = key;
    // Keep the scope pinned until the queued continuation consumes it. Pi runs this prompt once settlement ends.
    void (async () => { await pi.sendUserMessage(`drift-continue ${artifact}`); })().catch((error) => {
      if (key === identity) { pendingContinuationPath = boundaryAppended = undefined; continuationQueued = false; }
      ctx.ui.notify(`Automatic Drift continuation could not be queued: ${errorText(error)}. Run /drift ${artifact} to pick it up on the model you have selected; its artifact and record are retained.`, "error");
    });
  });
  pi.on("session_shutdown", async (event, ctx) => checkpoint(`detach:${event.reason}`, ctx));

  pi.registerCommand("drift-worktree", {
    description: "Show Drift's active worktree, or adopt an existing worktree of this repository (Pi's cwd stays unchanged)",
    handler: async (args, ctx) => {
      const path = args.trim();
      engageExplicit(ctx, "user ran /drift-worktree");
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
      path: Type.Optional(Type.String({ description: "Existing exact worktree root for adopt; absolute or relative to Pi's fixed cwd. Omit or pass an empty string for status." })),
    }, { additionalProperties: false }),
    async execute(_id, params, signal, _update, ctx) {
      return exclusive(async () => {
        if (signal?.aborted) throw new Error("Worktree action cancelled before starting");
        return { content: [{ type: "text" as const, text: await worktreeAction(params.action, params.path, ctx) }], details: undefined };
      });
    },
  });

  pi.registerTool({
    name: "drift_publish",
    label: "Publish Drift artifact",
    description: "Publish a research, plan or handoff artifact in Drift's active worktree (Pi's launch checkout unless explicitly adopted with drift_worktree; private artifacts may use a shared store). Supply the portable skill's Markdown body, without frontmatter. Drift supplies measured metadata, numbering and atomic file writes. A handoff completes only the current work interval; no session log is deleted. Correct argument validation errors before retrying; if a pending publication exists, retry identical input to recover it. Maximum body: 256 KiB.",
    promptSnippet: "Publish Drift artifacts with measured metadata and a session-owned handoff",
    promptGuidelines: ["Use drift_publish for Drift research/plan/handoff files instead of writing their frontmatter yourself. Read the Drift skill and relevant workflow first. New handoffs should supply a portable next_session_profile; without one, automatic continuation keeps the model in use. When Drift reports context past 60%, finish the current step and publish a handoff. Auto-continue stops when the plan's Acceptance Criteria are met, so publish that handoff with status complete. At a plan Breakpoint or a pending user decision, publish with breakpoint: true, which queues nothing. Relay Drift's warning when a plan has nothing to work towards; it appears once per plan. By default publication only records the handoff: tell the user to run /drift (or /drift <file>) to pick it up on the model they have selected, then stop. Where the repo opted in with /drift-auto-continue on, a fresh context window starts from the handoff alone on the model the tool result names; then do not ask the user to run anything unless automatic continuation fails. drift-continue is internal; never present it as a user command. Never delete Drift records or Pi session logs."],
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
      breakpoint: Type.Optional(Type.Boolean({ description: "For handoffs. Pass true at a plan Breakpoint or a pending user decision. The handoff stays open and nothing is queued, even with auto-continue on." })),
    }, { additionalProperties: false }),
    async execute(_id, params, signal, _update, ctx) {
      return exclusive(async () => {
        if (signal?.aborted) throw new Error("Publication cancelled before starting");
        const records = await store(ctx);
        if (failure) throw new Error(failure);
        if (!records) throw new Error("drift_publish requires Pi's cwd to be inside the target Git repository");
        await records.engage("drift_publish");
        // Finish an entered publication even if inference is cancelled: leave a receipt or retryable intent.
        const repo = await records.effectiveRepo();
        const receipt = await publish(records, params);
        const config = params.kind === "research" ? undefined : await driftConfig(repo);
        // A complete handoff closes the work: never queue or propose a continuation, even when profiled.
        const closed = params.kind === "handoff" && params.status === "complete";
        // A breakpoint (a plan's review point or a pending user decision) stays open but waits for the user.
        const paused = params.kind === "handoff" && !closed && params.breakpoint === true;
        const autoContinue = params.kind === "handoff" && !closed && !paused && config?.autoContinue === true;
        if (autoContinue) { pendingContinuationPath = receipt.path; boundaryAppended = undefined; }
        // Nothing to stop at means the chain may never end. Say so once per plan per Pi session: repeating it on every hop only spends tokens.
        const featureDir = dirname(resolve((await artifactStore(repo)).root, receipt.path));
        let warning = config?.autoContinue && (params.kind === "plan" || autoContinue) ? await planTargetWarning(featureDir).catch(() => undefined) : undefined;
        if (warning && warnedTargets.has(featureDir + warning)) warning = undefined;
        else if (warning) { warnedTargets.add(featureDir + warning); ctx.ui.notify(`Drift: ${warning}`, "warning"); }
        const continuation = closed ? "\nHandoff complete: there is no open work to continue. Nothing is queued."
          : paused ? `\nStopped at a breakpoint. Nothing is queued, even with auto-continue on. Tell the user what to review or decide, then stop. They run /drift ${receipt.path} to continue.`
          : autoContinue ? `\nA fresh context window is queued from this handoff alone; no summary of this conversation is carried.\n${await continuationTarget(ctx, repo, records, receipt.path, params.next_session_profile || undefined)}`
          : params.kind === "handoff" ? `\nAutomatic continuation is off (the default; /drift-auto-continue on enables it). Nothing is queued. The user runs /drift to pick up the latest work, or /drift ${receipt.path}, on the model they have selected.` : "";
        return {
          content: [{ type: "text" as const, text: `Published ${receipt.path}\n${params.kind === "handoff" ? "Current work interval completed; its receipt is retained. Do not delete records or Pi session logs." : "Work interval remains active."}${continuation}${warning ? `\nTell the user: ${warning}` : ""}` }],
          details: receipt,
          // The continuation starts only once this run settles; end it here so the model cannot keep working.
          terminate: autoContinue,
        };
      });
    },
  });

}
