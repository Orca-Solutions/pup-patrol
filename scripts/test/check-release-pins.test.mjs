/** scripts/check-release-pins.mjs: a release build must install StreamOtter from the registry. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { releasePinProblems } from "../check-release-pins.mjs";

const REGISTRY_LOCK = { packages: {
  "node_modules/streamotter": { version: "1.1.0", resolved: "https://registry.npmjs.org/streamotter/-/streamotter-1.1.0.tgz" },
  "node_modules/@streamotter/client": { version: "1.1.0", resolved: "https://registry.npmjs.org/@streamotter/client/-/client-1.1.0.tgz" },
  "node_modules/react": { version: "19.3.0", resolved: "https://registry.npmjs.org/react/-/react-19.3.0.tgz" }
} };

function checkout(t, { manifest = { dependencies: { streamotter: "1.1.0" } }, lock = REGISTRY_LOCK, vendor = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pins-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
  if (vendor) mkdirSync(join(dir, "vendor"));
  return dir;
}

test("an exact registry pin passes", t => {
  assert.deepEqual(releasePinProblems(checkout(t)), []);
});

test("vendored tarballs, file: specs, overrides and a non-registry lockfile are each refused", t => {
  const problems = releasePinProblems(checkout(t, {
    vendor: true,
    manifest: {
      dependencies: { streamotter: "file:vendor/streamotter-1.1.0-dev.0.tgz" },
      overrides: { "@streamotter/client": "file:vendor/streamotter-client-1.1.0-dev.0.tgz" }
    },
    lock: { packages: { "node_modules/@streamotter/client": { version: "1.1.0-dev.0", resolved: "file:vendor/streamotter-client-1.1.0-dev.0.tgz" } } }
  }));
  assert.equal(problems.length, 4, problems.join("\n"));
  assert.match(problems.join("\n"), /vendor\//);
  assert.match(problems.join("\n"), /not an exact version/);
  assert.match(problems.join("\n"), /overrides @streamotter\/client/);
  assert.match(problems.join("\n"), /resolves @streamotter\/client from file:/);
});

test("a range is not a pin", t => {
  assert.match(releasePinProblems(checkout(t, { manifest: { dependencies: { streamotter: "^1.1.0" } } })).join("\n"), /not an exact version/);
});

test("this checkout is not a release build while it vendors the hooks prerelease", () => {
  const problems = releasePinProblems(join(import.meta.dirname, "../.."));
  assert.ok(problems.some(problem => problem.includes("vendor/")), problems.join("\n"));
});
