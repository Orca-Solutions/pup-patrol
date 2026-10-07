/**
 * The copied creek files: the recording must fit the copied channel schemas, show every
 * game state, and the generated types must match the copied configuration.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { validateProjectConfig, validateValue, type Json, type ProjectConfig } from "streamotter/contracts";
import type { Recording } from "../src/creek.ts";

const root = join(import.meta.dirname, "..");
const config = JSON.parse(readFileSync(join(root, "creek/streamotter.json"), "utf8")) as ProjectConfig;
interface RecordedField {
  channel: string;
  params: Record<string, string>;
  revision: string;
  data: Json;
}
const recording = JSON.parse(readFileSync(join(root, "creek/pup-patrol.json"), "utf8")) as Omit<Recording, "initial" | "ticks"> & { initial: RecordedField[]; ticks: RecordedField[][] };
const records = [...recording.initial, ...recording.ticks.flat()];

test("the copied configuration is valid, with exactly the three channels the game reads", () => {
  assert.deepEqual(validateProjectConfig(config).issues, []);
  assert.deepEqual(Object.keys(config.channels).sort(), ["creekOverview", "den", "reach"]);
});

test("every recorded record fits its channel's schemas", () => {
  for (const record of records) {
    const channel = config.channels[record.channel];
    assert.ok(channel !== undefined, record.channel);
    assert.equal(validateValue(config.schemas[channel.payloadSchema]!, record.data), null, `${record.channel} ${record.revision}`);
    assert.equal(validateValue(config.schemas[channel.paramsSchema]!, record.params as unknown as Json), null, `${record.channel} params`);
  }
});

test("the recording has the instances the game subscribes to, and every game state", () => {
  assert.deepEqual(recording.initial.map(record => `${record.channel}:${Object.values(record.params).join()}`).sort(), ["creekOverview:lontra", "den:A", "reach:beaver-flats"]);
  const pups = new Set(records.filter(record => record.channel === "den").map(record => (record.data as { pups: string }).pups));
  assert.ok(pups.has("in-den") && pups.has("out"), [...pups].join());
  assert.ok(recording.ticks.filter(tick => tick.some(record => record.channel === "reach")).length >= 5, "the trap fires");
  assert.ok(recording.ticks.every(tick => tick.some(record => record.channel === "creekOverview")), "the overview ticks every tick");
  // Revisions only grow, per instance.
  const last = new Map<string, bigint>();
  for (const record of records) {
    const key = `${record.channel}:${Object.values(record.params).join()}`;
    const revision = BigInt(record.revision);
    assert.ok(revision >= (last.get(key) ?? 0n), key);
    last.set(key, revision);
  }
});

test("src/generated matches creek/streamotter.json", () => {
  // Inside the repository: the generator picks its import from the nearest package.json.
  const cache = join(root, "node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  const out = mkdtempSync(join(cache, "pup-patrol-generated-"));
  try {
    const cli = join(root, "node_modules/streamotter/bin/streamotter.js");
    const result = spawnSync(process.execPath, [cli, "generate", "--config", join(root, "creek/streamotter.json"), "--out", out], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(join(out, "streamotter.generated.ts"), "utf8"), readFileSync(join(root, "src/generated/streamotter.generated.ts"), "utf8"), "run npm run generate");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
