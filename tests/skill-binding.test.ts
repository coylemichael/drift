import assert from "node:assert/strict";
import { test } from "node:test";
import { bindDriftAdvertisement, driftSkillArgs, expandedDriftArgs, expandDriftSkill } from "../lib/skill-binding.ts";

const entry = (name: string, location: string) => `<skill>\n<name>${name}</name>\n<description>${name} workflow</description>\n<location>${location}</location>\n</skill>`;
const canonical = entry("drift", "/installed/skills/drift/SKILL.md");
const advertisement = `<available_skills>\n${canonical}\n</available_skills>`;

test("binding replaces stale Drift advertisement, preserving all other prompt content", () => {
  const other = entry("cy", "/user/skills/cy/SKILL.md");
  const stale = entry("drift", "/old/drift/SKILL.md");
  const before = `User custom prompt\n<available_skills>\n${other}\n${stale}\n</available_skills>\nEarlier extension changes`;
  const bound = bindDriftAdvertisement(before, advertisement);
  assert.equal(bound, before.replace(stale, canonical));
  assert.equal(bindDriftAdvertisement(bound, advertisement), bound);
});

test("binding does not introduce disabled skills or replace quoted skill bodies", () => {
  for (const prompt of ["Custom prompt with no skill listing", `<available_skills>${entry("cy", "/cy")}</available_skills>`, `Quoted example: ${entry("drift", "/quoted")}`]) {
    assert.equal(bindDriftAdvertisement(prompt, advertisement), prompt);
  }
  assert.throws(() => bindDriftAdvertisement("prompt", "not a skill"), /invalid/);
});

test("only Drift duplicates are collapsed and similarly named skills are preserved", () => {
  const other = entry("drift-other", "/other");
  const prompt = `<available_skills>${entry("drift", "/old")}${other}${entry("drift", "/older")}</available_skills>`;
  const bound = bindDriftAdvertisement(prompt, advertisement);
  assert.equal(bound, `<available_skills>${canonical}${other}</available_skills>`);
  assert.equal(bindDriftAdvertisement(bound, advertisement), bound);
});

test("explicit skill invocation accepts arguments and does not hijack other input", () => {
  assert.equal(driftSkillArgs("/skill:drift"), "");
  assert.equal(driftSkillArgs("/skill:drift execute plan.md\nthen verify"), "execute plan.md\nthen verify");
  assert.equal(driftSkillArgs("/skill:drift  \n"), "");
  for (const text of ["/skill:drift-other", "Tell me about /skill:drift", "drift-continue drift/feature/001-handoff-next.md", "/skill:cy"]) {
    assert.equal(driftSkillArgs(text), undefined);
  }
});

test("expanded queued invocations retain user arguments, but quoted examples are not invocations", () => {
  const old = expandDriftSkill("/old/SKILL.md", "/old", "# Old instructions", "continue the plan\nthen verify");
  assert.equal(expandedDriftArgs(old), "continue the plan\nthen verify");
  assert.equal(expandedDriftArgs(expandDriftSkill("/old/SKILL.md", "/old", "# Old instructions", "")), "");
  assert.equal(expandedDriftArgs(`Explain this example:\n${old}`), undefined);
  assert.equal(expandedDriftArgs(old.replace('name="drift"', 'name="other"')), undefined);
});

test("explicit invocation carries canonical body, relative-reference base and user arguments", () => {
  const text = "---\r\nname: drift\r\ndescription: Workflow\r\n---\r\n\r\n# Drift\r\nRead execute.md.";
  const expanded = expandDriftSkill('/clone & "work"/SKILL.md', '/clone & "work"', text, "execute plan.md");
  assert.ok(expanded.startsWith('<skill name="drift" location="/clone &amp; &quot;work&quot;/SKILL.md">'));
  assert.ok(expanded.includes('References are relative to /clone & "work".'));
  assert.ok(expanded.includes("# Drift\r\nRead execute.md."));
  assert.ok(!expanded.includes("description: Workflow"));
  assert.ok(expanded.endsWith("</skill>\n\nexecute plan.md"));
});
