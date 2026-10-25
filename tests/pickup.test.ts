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

test("/drift finds raw artifacts under a Git-policy mismatch, changing no policy and creating no INDEX.md", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "auth", "001-plan-build.md", "2026-10-09T10:00:00+01:00", "pending");
  await fs.unlink(join(dir, ".gitignore")); // Pickup only reads, so the mismatch neither blocks it nor gets repaired.
  const result = await pickup(dir, "");
  assert.equal(result.artifact, "drift/auth/001-plan-build.md");
  assert.match(result.text, /Execute the Drift plan/);
  await assert.rejects(fs.stat(join(dir, "drift", "INDEX.md")), { code: "ENOENT" });
  await assert.rejects(fs.stat(join(dir, ".gitignore")), { code: "ENOENT" });
});

test("/drift alone picks the newest raw artifact and routes it by kind, creating no INDEX.md", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "auth", "001-research-flow.md", "2026-10-09T10:00:00+01:00", "complete");
  assert.match((await pickup(dir, "")).text, /^\/skill:drift Turn the Drift research at `drift\/auth\/001-research-flow\.md` into an implementation plan/);

  await artifact(dir, "auth", "002-plan-build.md", "2026-10-09T11:00:00+01:00", "pending");
  assert.match((await pickup(dir, "")).text, /^\/skill:drift Execute the Drift plan at `drift\/auth\/002-plan-build\.md`/);

  // Newest by the shared parser's true instant, not by feature or folder number.
  await artifact(dir, "other", "001-handoff-later.md", "2026-10-09T12:00:00+01:00", "in-progress");
  const result = await pickup(dir, "");
  assert.equal(result.artifact, "drift/other/001-handoff-later.md");
  assert.match(result.text, /^\/skill:drift Continue the work recorded in the Drift handoff at `drift\/other\/001-handoff-later\.md`\. Follow the handoff workflow/);
  assert.match(result.text, /Picked by \/drift: the newest artifact from the raw files/);
  await assert.rejects(fs.stat(join(dir, "drift", "INDEX.md")), { code: "ENOENT" });
});

test("/drift alone stops at finished work rather than reopening it or searching for older open work", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "other", "001-plan-open.md", "2026-10-09T09:00:00+01:00", "pending");
  await artifact(dir, "auth", "001-handoff-done.md", "2026-10-09T10:00:00+01:00", "complete");
  const result = await pickup(dir, "");
  assert.match(result.text, /is a handoff with status "complete", so there is no open work to continue\..*Do not start work\./);
  assert.doesNotMatch(result.text, /Continue the work recorded/);
});

test("/drift ignores a leftover INDEX.md (stale, blocked or conflicting), never rewrites it and never acquires the publication lock", async (t) => {
  for (const scenario of ["stale", "directory", "merge", "locked"]) {
    await t.test(scenario, async (t: any) => {
      const dir = await repo(t);
      await artifact(dir, "auth", "001-plan-old.md", "2026-10-09T10:00:00+01:00", "pending");
      await artifact(dir, "auth", "002-handoff-new.md", "2026-10-09T11:00:00+01:00", "in-progress");
      const index = join(dir, "drift", "INDEX.md");
      const stale = "| # | Date | Feature | Type | Artifact |\n|---|---|---|---|---|\n| 001 | 2026-10-09 10:00 +01:00 | auth | plan | [001-plan-old](auth/001-plan-old.md) |\n";
      if (scenario === "directory") await fs.mkdir(index);
      else await fs.writeFile(index, scenario === "merge" ? "<<<<<<< ours\n" + stale + "=======\n>>>>>>> theirs\n" : stale);
      if (scenario === "merge") await fs.writeFile(join(dir, ".git", "MERGE_HEAD"), "0".repeat(40) + "\n");
      if (scenario === "locked") {
        await fs.mkdir(join(dir, "drift", ".publish.lock"));
        await fs.writeFile(join(dir, "drift", ".publish.lock", "owner.json"), "do not reap\n");
      }
      const result = await pickup(dir, "");
      assert.equal(result.artifact, "drift/auth/002-handoff-new.md");
      assert.match(result.text, /Continue the work recorded/);
      if (scenario === "directory") assert.deepEqual(await fs.readdir(index), []);
      else assert.equal(await fs.readFile(index, "utf8"), scenario === "merge" ? "<<<<<<< ours\n" + stale + "=======\n>>>>>>> theirs\n" : stale);
      if (scenario === "locked") assert.equal(await fs.readFile(join(dir, "drift", ".publish.lock", "owner.json"), "utf8"), "do not reap\n");
      else await assert.rejects(fs.stat(join(dir, "drift", ".publish.lock")), { code: "ENOENT" });
    });
  }
});

test("/drift does not mistake a tree holding only a leftover INDEX.md, or undated artifacts, for a newest artifact", async (t) => {
  const dir = await repo(t);
  await fs.mkdir(join(dir, "drift"));
  const index = join(dir, "drift", "INDEX.md");
  await fs.writeFile(index, "| 001 | 2026-10-09 10:00 +01:00 | auth | plan | [missing](auth/001-plan-missing.md) |\n");
  assert.match((await pickup(dir, "")).text, /has no Drift artifacts yet/);
  await artifact(dir, "auth", "001-plan-undated.md", "not-a-date", "pending");
  const result = await pickup(dir, "");
  assert.equal(result.artifact, undefined);
  assert.match(result.text, /1 artifact\(s\) without a parsable date/);
  assert.doesNotMatch(result.text, /no Drift artifacts/);
  assert.equal((await pickup(dir, "001-plan-undated.md")).artifact, "drift/auth/001-plan-undated.md");
  assert.match(await fs.readFile(index, "utf8"), /001-plan-missing/);
});

test("/drift preserves UTC/tie order, legacy names and missing status without inventing chronology", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "z", "001-plan-earlier.md", "2026-10-09T12:00:00+01:00", "pending");
  await artifact(dir, "a", "001-plan-tie.md", "2026-10-09T11:00:00Z");
  assert.equal((await pickup(dir, "")).artifact, "drift/z/001-plan-earlier.md"); // Equal instant: feature tie-break.
  await artifact(dir, "a", "002-handoff-later.md", "2026-10-09T11:01:00Z");
  assert.equal((await pickup(dir, "")).artifact, "drift/a/002-handoff-later.md");
  await fs.mkdir(join(dir, "drift", "legacy", "handoffs"), { recursive: true });
  await fs.writeFile(join(dir, "drift", "legacy", "handoffs", "old.md"), '---\ntype: handoff\n---\n\n**Date:** 2026-10-10\n');
  const legacy = await pickup(dir, "");
  assert.equal(legacy.artifact, "drift/legacy/handoffs/old.md");
  assert.match(legacy.text, /Continue the work recorded/);
});

test("/drift takes kind from the filename, not a look-alike directory, with frontmatter fallback for legacy names", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "002-plan-migration", "001-plan-build.md", "2026-10-09T10:00:00Z", "pending");
  const conventional = join(dir, "drift", "002-plan-migration", "001-plan-build.md");
  await fs.writeFile(conventional, (await fs.readFile(conventional, "utf8")).replace('type: "plan"', 'type: "handoff"'));
  assert.match((await pickup(dir, "")).text, /Execute the Drift plan/); // Existing filename precedence.
  await fs.writeFile(join(dir, "drift", "002-plan-migration", "old.md"), "---\ndate: 2026-10-10T10:00:00Z\ntype: handoff\n---\n");
  const legacy = await pickup(dir, "");
  assert.equal(legacy.artifact, "drift/002-plan-migration/old.md");
  assert.match(legacy.text, /Continue the work recorded/);
  await artifact(dir, "other", "001-plan-undated.md", "invalid", "pending");
  assert.match((await pickup(dir, "")).text, /1 undated artifact\(s\) were excluded/);
});

test("named and default pickup agree on quoted completion statuses", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "auth", "001-handoff-done.md", "2026-10-09T10:00:00Z", "complete");
  const file = join(dir, "drift", "auth", "001-handoff-done.md");
  const body = await fs.readFile(file, "utf8");
  for (const value of ["complete", '"complete"', "'complete'", '""complete""', "''complete''"]) {
    await fs.writeFile(file, body.replace('status: "complete"', `status: ${value}`));
    assert.match((await pickup(dir, "")).text, /no open work to continue/);
    assert.match((await pickup(dir, "001-handoff-done.md")).text, /status is "complete"; confirm with the user/);
  }
});

test("/drift reports an unrecognized newest kind rather than silently choosing an older plan", async (t) => {
  const dir = await repo(t);
  await artifact(dir, "auth", "001-plan-build.md", "2026-10-09T10:00:00Z", "pending");
  await fs.writeFile(join(dir, "drift", "auth", "bad.md"), "---\ndate: 2026-10-10T10:00:00Z\ntype: mystery\n---\n");
  const result = await pickup(dir, "");
  assert.equal(result.artifact, undefined);
  assert.match(result.text, /newest raw artifact.*bad\.md.*metadata problem/);
  assert.doesNotMatch(result.text, /Execute the Drift plan/);
});

test("/drift reports raw discovery errors instead of using a stale index or claiming no artifacts", async (t) => {
  const dir = await repo(t);
  await fs.writeFile(join(dir, "drift"), "not a directory\n");
  const result = await pickup(dir, "");
  assert.equal(result.artifact, undefined);
  assert.match(result.text, /raw artifact discovery failed/);
  assert.doesNotMatch(result.text, /has no Drift artifacts yet/);
  assert.equal(await fs.readFile(join(dir, "drift"), "utf8"), "not a directory\n");
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
  const finished = await pickup(dir, "003-handoff-done.md");
  assert.match(finished.text, /status is "complete"; confirm with the user/);
  assert.doesNotMatch(finished.text, /Continue the work recorded/);
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

test("closed named plans and handoffs ask before executing; complete research can still be planned", async (t) => {
  const dir = await repo(t);
  for (const kind of ["plan", "handoff", "research"]) {
    const name = `001-${kind}-done.md`;
    await artifact(dir, kind, name, "2026-10-09T10:00:00Z", "complete");
    const result = await pickup(dir, `drift/${kind}/${name}`);
    if (kind === "research") assert.match(result.text, /Turn the Drift research/);
    else {
      assert.match(result.text, /status is "complete"; confirm with the user/);
      assert.doesNotMatch(result.text, /Execute the Drift plan|Continue the work recorded/);
    }
  }
});

test("superseded pickup names the recorded successor but never reopens or silently follows it", async (t) => {
  const dir = await repo(t);
  const old = "drift/auth/001-plan-old.md";
  const replacement = "drift/auth/002-plan-new.md";
  await artifact(dir, "auth", "001-plan-old.md", "2026-10-09T10:00:00Z", "superseded");
  await artifact(dir, "auth", "002-plan-new.md", "not-dated", "pending");
  const file = join(dir, old);
  const original = await fs.readFile(file, "utf8");
  for (const value of [replacement, `"${replacement}"`, `'${replacement}'`]) {
    await fs.writeFile(file, original.replace('status: "superseded"', `status: "superseded"\nsuperseded_by: ${value}`));
    for (const request of ["", old, "001-plan-old.md"]) {
      const result = await pickup(dir, request);
      assert.equal(result.artifact, old);
      assert.ok(result.text.includes(`\`${old}\` superseded by \`${replacement}\``));
      assert.doesNotMatch(result.text, /Execute the Drift plan/);
      assert.match(result.text, request ? /confirm with the user/ : /no open work to continue/);
    }
  }
  // An open dated successor still doesn't override an explicitly named closed source.
  await artifact(dir, "auth", "002-plan-new.md", "2026-10-10T10:00:00Z", "pending");
  assert.equal((await pickup(dir, old)).artifact, old);
  assert.equal((await pickup(dir, "")).artifact, replacement);
});

test("legacy superseded artifacts remain readable without inventing a replacement", async (t) => {
  const dir = await repo(t);
  for (const kind of ["research", "plan", "handoff"]) {
    const name = `001-${kind}-old.md`;
    await artifact(dir, kind, name, "2026-10-09T10:00:00Z", "superseded");
    const result = await pickup(dir, `drift/${kind}/${name}`);
    assert.match(result.text, /replacement not recorded/);
    assert.match(result.text, /confirm with the user/);
    assert.doesNotMatch(result.text, /Turn the Drift research|Execute the Drift plan|Continue the work recorded/);
  }
  assert.match((await pickup(dir, "")).text, /no open work to continue[\s\S]*replacement not recorded/);
});

test("supersession references respect the store boundary and report missing replacements", async (t) => {
  const dir = await repo(t);
  const old = "drift/auth/001-handoff-old.md";
  const replacement = "drift/auth/handoffs/002-handoff-new.md";
  await artifact(dir, "auth", "001-handoff-old.md", "2026-10-09T10:00:00Z", "superseded");
  await artifact(dir, "auth/handoffs", "002-handoff-new.md", "2026-10-10T10:00:00Z", "in-progress");
  const file = join(dir, old);
  const original = await fs.readFile(file, "utf8");
  const withRef = async (ref: string) => {
    await fs.writeFile(file, original.replace('status: "superseded"', `status: "superseded"\nsuperseded_by: "${ref}"`));
    return pickup(dir, old);
  };
  assert.ok((await withRef(replacement)).text.includes(`superseded by \`${replacement}\``));
  for (const ref of [old, "drift/other/002-handoff-new.md", "drift/auth/../../outside.md", "drift/auth/./002-handoff-new.md", "C:/outside.md", "drift\\auth\\002-handoff-new.md"]) {
    const result = await withRef(ref);
    assert.match(result.text, /invalid superseded_by reference/);
    assert.doesNotMatch(result.text, /Continue the work recorded/);
  }
  assert.match((await withRef("drift/auth/099-handoff-missing.md")).text, /replacement artifact is missing/);
  const oversized = await withRef(`drift/auth/${"x".repeat(4000)}.md`);
  assert.match(oversized.text, /invalid superseded_by reference/);
  assert.doesNotMatch(oversized.text, /x{1024}/);
  // Junctions/symlinks are metadata errors, not a route to another store.
  await fs.mkdir(join(dir, "outside"));
  await fs.symlink(join(dir, "outside"), join(dir, "drift", "auth", "linked"), process.platform === "win32" ? "junction" : "dir");
  assert.match((await withRef("drift/auth/linked/002-handoff-new.md")).text, /replacement could not be verified.*symlink/);
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
  assert.match((await pickup(dir, "", join(dir, "metrics", "citations.jsonl"))).text, /Citation check \(heuristic mode\): 1 fresh\. All cited code is unchanged\./);

  await fs.writeFile(join(dir, "app.py"), "one\nTWO CHANGED\nthree\n");
  const stale = await pickup(dir, "001-handoff-cited.md", join(dir, "metrics", "citations.jsonl"));
  assert.match(stale.text, /Citation check \(heuristic mode\): 1 changed\. Re-check before relying on: app\.py:2 changed/);
  // The citation note precedes the user's words, which stay last.
  assert.match(stale.text, /Citation check[\s\S]*The user's message: 001-handoff-cited\.md$/);
  // The usefulness ledger recorded both checks, zero-stale pickups included.
  const lines = (await fs.readFile(join(dir, "metrics", "citations.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].total, 1);
  assert.equal(lines[0].counts.fresh, 1);
  assert.equal(lines[1].counts.changed, 1);
  assert.equal(lines[1].artifact, "drift/auth/001-handoff-cited.md");
  assert.equal(lines[1].mode, "heuristic");
  assert.match(lines[1].date, /2026-10-09/);
});
