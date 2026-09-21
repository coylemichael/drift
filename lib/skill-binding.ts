/** Replace only Drift's advertised skill, preserving other skills and chained prompt edits. */
export function bindDriftAdvertisement(systemPrompt: string, bundledAdvertisement: string): string {
  const entry = bundledAdvertisement.match(/<skill>[\s\S]*?<\/skill>/)?.[0];
  if (!entry || !/<name>drift<\/name>/.test(entry)) throw new Error("Bundled Drift skill advertisement is invalid");
  return systemPrompt.replace(/<available_skills>[\s\S]*?<\/available_skills>/g, (group) => {
    let replaced = false;
    return group.replace(/<skill>[\s\S]*?<\/skill>/g, (skill) => {
      if (!/<name>drift<\/name>/.test(skill)) return skill;
      // Dedupe only Drift entries within the advertised group. Never touch quoted skill bodies.
      if (replaced) return "";
      replaced = true;
      return entry;
    });
  });
}

/** Match Pi's explicit skill invocation, not mentions of it in ordinary user prose. */
export function driftSkillArgs(text: string): string | undefined {
  return /^\/skill:drift(?:\s+([\s\S]*))?$/.exec(text)?.[1]?.trim() ??
    (text === "/skill:drift" ? "" : undefined);
}

/** Pi's direct steer/follow-up APIs expand commands before the input hook can see them. */
export function expandedDriftArgs(text: string): string | undefined {
  const match = /^<skill name="drift" location="[^"]+">\r?\n[\s\S]*?\r?\n<\/skill>(?:\r?\n\r?\n([\s\S]*))?$/.exec(text);
  return match ? match[1] ?? "" : undefined;
}

export function expandDriftSkill(filePath: string, baseDir: string, text: string, args: string): string {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim();
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const block = `<skill name="drift" location="${escape(filePath)}">\nReferences are relative to ${baseDir}.\n\n${body}\n</skill>`;
  return args ? `${block}\n\n${args}` : block;
}
