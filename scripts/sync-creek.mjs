#!/usr/bin/env node
/**
 * Copies what the game needs from a Lontra Creek checkout, so it never imports that
 * repository: the field station's public channels that Pup Patrol reads (den, reach,
 * creekOverview) as creek/streamotter.json, and the recorded fixture as
 * creek/pup-patrol.json. Run `npm run generate` afterwards; the contract test then
 * checks the fixture against the copied schemas.
 *
 *   node scripts/sync-creek.mjs ../lontra-creek
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const CHANNELS = ["den", "reach", "creekOverview"];
const GAME_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

/** The game's fixture-mode configuration, from the field station's. */
export function gameConfig(fieldStation) {
  const channels = Object.fromEntries(CHANNELS.map(name => {
    const channel = fieldStation.channels[name];
    if (channel === undefined) throw new Error(`The field station has no ${name} channel.`);
    return [name, channel];
  }));
  const schemaNames = [...new Set(Object.values(channels).flatMap(channel => [channel.paramsSchema, channel.payloadSchema]))].sort();
  return {
    configVersion: fieldStation.configVersion,
    projectId: "pup-patrol",
    gateway: { host: "127.0.0.1", port: 7500, path: fieldStation.gateway.path, allowedOrigins: GAME_DEV_ORIGINS },
    connections: {},
    sources: { field: { kind: "fixture", generation: "pup-patrol-fixture-1", fixtureRef: "field" } },
    schemas: Object.fromEntries(schemaNames.map(name => [name, fieldStation.schemas[name]])),
    channels
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const lontra = process.argv[2];
  if (lontra === undefined) {
    console.error("Usage: node scripts/sync-creek.mjs <path to a lontra-creek checkout>");
    process.exit(2);
  }
  const app = join(lontra, "apps/field-station");
  const fieldStation = JSON.parse(readFileSync(join(app, "streamotter.fixture.json"), "utf8"));
  const root = join(import.meta.dirname, "..");
  writeFileSync(join(root, "creek/streamotter.json"), `${JSON.stringify(gameConfig(fieldStation), null, 2)}\n`);
  writeFileSync(join(root, "creek/pup-patrol.json"), readFileSync(join(app, "fixtures/pup-patrol.json")));
  console.log("Wrote creek/streamotter.json and creek/pup-patrol.json. Run npm run generate next.");
}
