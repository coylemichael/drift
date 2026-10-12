import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compareVersions, developedAgainst, piVersionNotice } from "../lib/pi-version.ts";

test("version comparison is numeric per component and ignores prefixes and suffixes", () => {
  assert.ok(compareVersions("0.85.1", "1.1.0") < 0);
  assert.equal(compareVersions("1.1.0", "1.1.0"), 0);
  assert.ok(compareVersions("1.10.0", "1.9.9") > 0);
  assert.ok(compareVersions("v1.2.0-beta.1", "1.1.9") > 0);
  assert.equal(compareVersions("1.1", "1.1.0"), 0);
});

test("the developed-against version is the floor of the dev-dependency range", () => {
  assert.equal(developedAgainst(JSON.stringify({ devDependencies: { "@earendil-works/pi-coding-agent": "^1.1.0" } })), "1.1.0");
  assert.equal(developedAgainst(JSON.stringify({ devDependencies: {} })), undefined);
  assert.equal(developedAgainst("{}"), undefined);
});

test("the notice fires only for an older Pi, and this repository's package.json yields a version", async () => {
  assert.equal(piVersionNotice("1.1.0", "1.1.0"), undefined);
  assert.equal(piVersionNotice("1.2.0", "1.1.0"), undefined);
  assert.equal(piVersionNotice(undefined, "1.1.0"), undefined);
  assert.equal(piVersionNotice("0.85.1", undefined), undefined);
  assert.match(piVersionNotice("0.85.1", "1.1.0")!, /developed against Pi 1\.1\.0; this is Pi 0\.85\.1/);
  const developed = developedAgainst(await fs.readFile(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
  assert.match(developed!, /^\d+\.\d+\.\d+$/);
});
