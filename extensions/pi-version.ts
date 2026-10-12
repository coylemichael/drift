import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { VERSION, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { developedAgainst, piVersionNotice } from "../lib/pi-version.ts";

const packageJson = fileURLToPath(new URL("../package.json", import.meta.url));

/** One warning per extension load when the running Pi is older than the one Drift is developed against. Never touches the prompt. */
export function registerPiVersionNotice(pi: ExtensionAPI) {
  let checked = false;
  pi.on("before_agent_start", (_event, ctx) => {
    if (checked) return;
    checked = true;
    try {
      // Pi aliases its own package for extensions, so VERSION is the running Pi, not any copy in this checkout.
      const notice = piVersionNotice(VERSION, developedAgainst(readFileSync(packageJson, "utf8")));
      if (notice) ctx.ui.notify(notice, "warning");
    } catch { /* an unreadable package.json or an odd version string is no reason to disturb a prompt */ }
  });
}
