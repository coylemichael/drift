import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pickup } from "../lib/pickup.ts";
import { git } from "../lib/state.ts";

async function repo(t: any) {
  const dir = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "drift-pickup-")));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await git(dir, ["init", "-q"]);
  await fs.writeFile(join(dir, ".gitignore"), "/drift/\n");
  return dir;
}

async function artifact(dir: string, feature: string, name: string, date: string, status?: string) {
  await fs.mkdir(join(dir, "drift", feature), { recursive: true });
  const [sequence, type] = name.split("-");
  await fs.writeFile(join(dir, "drift", feature, name), `---\ndate: "${date}"\nfeature: "${feature}"\nsequence: "${sequence}"\ntype: "${type}"\n${status ? `status: "${status}"\n` : ""}---\n\n## Body\nx\n`);
}

test("/drift with no artifacts asks how to start instead of guessing", async (t) => {
  const dir = await repo(t);
  const result = await pickup(dir, "");
  assert.equal(result.artifact, undefined);
  assert.match(result.text, /^\/skill:drift .*has no Drift artifacts yet/);
  await assert.rejects(fs.stat(join(dir, "drift")), { code: "ENOENT" });
});

test("/drift alone picks the newest artifact in the index and routes it by kind", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "auth", "001-research-flow.md", "2026-10-09T10:00:00+01:00", "complete");
  assert.match((await pickup(dir, "")).text, /^\/skill:drift Turn the Drift research at `drift\/auth\/001-research-flow\.md` into an implementation plan/);

  await artifact(dir, "auth", "002-plan-build.md", "2026-10-09T11:00:00+01:00", "pending");
  assert.match((await pickup(dir, "")).text, /^\/skill:drift Execute the Drift plan at `drift\/auth\/002-plan-build\.md`/);

  // Newest by the index's true instant, not by feature or folder number.
  await artifact(dir, "other", "001-handoff-later.md", "2026-10-09T12:00:00+01:00", "in-progress");
  const result = await pickup(dir, "");
  assert.equal(result.artifact, "drift/other/001-handoff-later.md");
  assert.match(result.text, /^\/skill:drift Continue the work recorded in the Drift handoff at `drift\/other\/001-handoff-later\.md`\. Follow the handoff workflow/);
  assert.match(result.text, /Picked by \/drift: the newest artifact in drift\/INDEX\.md/);
  assert.match(await fs.readFile(join(dir, "drift", "INDEX.md"), "utf8"), /001-handoff-later/); // Index brought up to date first.
});

test("/drift alone stops at finished work rather than reopening it", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "auth", "001-handoff-done.md", "2026-10-09T10:00:00+01:00", "complete");
  const result = await pickup(dir, "");
  assert.match(result.text, /is a handoff with status "complete", so there is no open work to continue\..*Do not start work\./);
  assert.doesNotMatch(result.text, /Continue the work recorded/);
});

test("/drift with a link, path or file name picks that artifact and keeps the user's words", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "auth", "001-plan-build.md", "2026-10-09T10:00:00+01:00", "pending");
  await artifact(dir, "auth", "002-handoff-next.md", "2026-10-09T11:00:00+01:00", "in-progress");

  const mention = `pick up [@001-plan-build.md](file:///${dir.replaceAll("\\", "/")}/drift/auth/001-plan-build.md) but skip step 3`;
  const linked = await pickup(dir, mention);
  assert.equal(linked.artifact, "drift/auth/001-plan-build.md");
  assert.match(linked.text, /^\/skill:drift Execute the Drift plan at `drift\/auth\/001-plan-build\.md`/);
  assert.match(linked.text, /Picked by \/drift: the artifact the user named/);
  assert.match(linked.text, /The user's message: pick up .* but skip step 3$/);

  assert.equal((await pickup(dir, "continue drift\\auth\\002-handoff-next.md")).artifact, "drift/auth/002-handoff-next.md");
  assert.equal((await pickup(dir, "002-handoff-next.md")).artifact, "drift/auth/002-handoff-next.md");

  // A named finished artifact is still the user's choice, with a caution.
  await artifact(dir, "auth", "003-handoff-done.md", "2026-10-09T12:00:00+01:00", "complete");
  assert.match((await pickup(dir, "003-handoff-done.md")).text, /Continue the work recorded[\s\S]*status is "complete"; confirm with the user/);
});

test("/drift passes anything else through as an ordinary Drift skill request", async (t) => {
  const dir = await repo(t);
  assert.deepEqual(await pickup(dir, "research the auth flow"), { text: "/skill:drift research the auth flow" });
  assert.deepEqual(await pickup(dir, "drift/auth/009-handoff-missing.md"), { text: "/skill:drift drift/auth/009-handoff-missing.md" });
  // The same file name in two features is ambiguous: do not guess.
  await artifact(dir, "a", "001-handoff-same.md", "2026-10-09T10:00:00+01:00", "in-progress");
  await artifact(dir, "b", "001-handoff-same.md", "2026-10-09T11:00:00+01:00", "in-progress");
  assert.deepEqual(await pickup(dir, "001-handoff-same.md"), { text: "/skill:drift 001-handoff-same.md" });
  assert.deepEqual(await pickup(undefined, ""), { text: "/skill:drift" });
});

test("/drift grades an artifact's citations and notes what to re-check", async (t) => {
  const dir = await repo(t);
  for (const [key, value] of [["user.name", "t"], ["user.email", "t@example.invalid"], ["commit.gpgsign", "false"]]) await git(dir, ["config", key, value]);
  await fs.writeFile(join(dir, "app.py"), "one\ntwo\nthree\n");
  await git(dir, ["add", "-A"]);
  await git(dir, ["commit", "-qm", "base"]);
  const sha = (await git(dir, ["rev-parse", "HEAD"])).trim();
  await fs.mkdir(join(dir, "drift", "auth"), { recursive: true });
  await fs.writeFile(join(dir, "drift", "auth", "001-handoff-cited.md"),
    `---\ndate: "2026-10-09T10:00:00+01:00"\nfeature: "auth"\nsequence: "001"\ntype: "handoff"\nstatus: "in-progress"\ngit_commit: "${sha}"\n---\n\n## Body\nSee \`app.py:2\`.\n`);
  assert.match((await pickup(dir, "")).text, /Citation check \(heuristic mode\): 1 fresh\. All cited code is unchanged\./);

  await fs.writeFile(join(dir, "app.py"), "one\nTWO CHANGED\nthree\n");
  const stale = await pickup(dir, "001-handoff-cited.md");
  assert.match(stale.text, /Citation check \(heuristic mode\): 1 changed\. Re-check before relying on: app\.py:2 changed/);
  // The citation note precedes the user's words, which stay last.
  assert.match(stale.text, /Citation check[\s\S]*The user's message: 001-handoff-cited\.md$/);
});
