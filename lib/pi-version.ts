/** Compare dotted numeric versions, ignoring a leading "v" and any pre-release or build suffix: negative when a is older than b. */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) => version.trim().replace(/^v/i, "").split(/[-+]/)[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
  const [left, right] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

/** The Pi version Drift is developed against: the floor of the pi-coding-agent dev-dependency range in package.json. */
export function developedAgainst(packageJson: string): string | undefined {
  const range = JSON.parse(packageJson).devDependencies?.["@earendil-works/pi-coding-agent"];
  return typeof range === "string" ? /\d+(?:\.\d+)+/.exec(range)?.[0] : undefined;
}

/** The warning for a Pi older than the one Drift is developed against; undefined when current, newer or unknown. */
export function piVersionNotice(running: string | undefined, developed: string | undefined): string | undefined {
  if (!running || !developed || compareVersions(running, developed) >= 0) return undefined;
  return `Drift is developed against Pi ${developed}; this is Pi ${running}. Update Pi where possible (npm-global: npm install -g @earendil-works/pi-coding-agent@latest), then restart Pi.`;
}
