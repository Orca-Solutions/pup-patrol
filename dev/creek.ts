/**
 * A local stand-in for the Lontra Creek demo backend, with no Kafka: a StreamOtter gateway
 * in development mode that replays the recorded creek (creek/pup-patrol.json) one field tick
 * at a time, and the three /api routes the game calls on the real field station.
 *
 *   node dev/creek.ts     (or `npm run dev`, which also starts Vite)
 *
 * The recording is three minutes long; it loops, each pass with higher revisions, as the
 * creek's own revisions only grow. `POST /api/dev/pause-source` makes the next creek
 * record fail to map, which pauses the source and turns every subscription stale, as a real
 * source failure would; `POST /api/dev/resume-source` lets it through again. The browser
 * tests use them to force the stale state.
 *
 * Environment: PUP_PATROL_TICK_MS (default 2000), PUP_PATROL_GATEWAY_PORT (7500),
 * PUP_PATROL_MANAGEMENT_PORT (7501), PUP_PATROL_API_PORT (7502), and PUP_PATROL_WEB_PORT (5173)
 * and PUP_PATROL_PREVIEW_PORT (4173), Vite's dev and preview servers, for the allowed origins only.
 */
import { readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { join } from "node:path";
import type { ProjectConfig } from "streamotter/contracts";
import { createGateway, type ChannelHandlers, type HandlerRegistry, type Json, type Principal } from "streamotter/gateway";
import { startManagementServer } from "streamotter/gateway/management";
import type { AppChannels } from "../src/generated/streamotter.generated.ts";

interface FieldRecord {
  tenantId: string;
  channel: string;
  params: Record<string, string>;
  revision: string;
  data: Json;
}

interface Recording {
  startTick: number;
  tickMs: number;
  initial: FieldRecord[];
  ticks: FieldRecord[][];
}

function port(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer port; got ${JSON.stringify(raw)}.`);
  return value;
}

const TICK_MS = Number(process.env["PUP_PATROL_TICK_MS"] ?? "2000");
const GATEWAY_PORT = port("PUP_PATROL_GATEWAY_PORT", 7500);
const MANAGEMENT_PORT = port("PUP_PATROL_MANAGEMENT_PORT", 7501);
const API_PORT = port("PUP_PATROL_API_PORT", 7502);
const WEB_PORTS = [port("PUP_PATROL_WEB_PORT", 5173), port("PUP_PATROL_PREVIEW_PORT", 4173)];
const PASSES = 40;
const DEV_TOKEN = "pup-patrol-dev-token";

const root = join(import.meta.dirname, "..");
const recording = JSON.parse(readFileSync(join(root, "creek/pup-patrol.json"), "utf8")) as Recording;
const fileConfig = JSON.parse(readFileSync(join(root, "creek/streamotter.json"), "utf8")) as ProjectConfig<AppChannels>;
const config: ProjectConfig<AppChannels> = {
  ...fileConfig,
  gateway: { ...fileConfig.gateway, port: GATEWAY_PORT, allowedOrigins: WEB_PORTS.flatMap(web => [`http://localhost:${web}`, `http://127.0.0.1:${web}`]) }
};

/** Each pass of the recording is shifted past the last, so revisions keep growing. */
const span = BigInt(recording.ticks.length + 1);
const shifted = (record: FieldRecord, pass: number): FieldRecord => ({ ...record, revision: (BigInt(record.revision) + BigInt(pass) * span).toString() });

// Pass 0 is the recording; each later pass starts with the recording's opening state as one tick.
const tickSizes: number[] = [];
const records: { key: string; value: Json }[] = [];
for (let pass = 0; pass < PASSES; pass++) {
  const ticks = pass === 0 ? recording.ticks : [recording.initial, ...recording.ticks];
  for (const tick of ticks) {
    for (const record of tick) records.push({ key: `${record.channel}:${Object.values(record.params).join(",")}`, value: shifted(record, pass) as unknown as Json });
    tickSizes.push(tick.length);
  }
}

const readModel = new Map<string, FieldRecord>();
const instance = (channel: string, params: Readonly<Record<string, unknown>>): string => `${channel}:${Object.values(params).join(",")}`;
for (const record of recording.initial) readModel.set(instance(record.channel, record.params), record);

let failNext = false;

function channel<K extends keyof AppChannels>(name: K): ChannelHandlers<AppChannels[K]> {
  type Contract = AppChannels[K];
  return {
    authorize: () => true,
    map: ({ record }) => {
      if (failNext) throw new Error("Paused for testing (POST /api/dev/resume-source to continue).");
      const field = record.value as unknown as FieldRecord;
      if (field.channel !== name) return [];
      const key = instance(field.channel, field.params);
      const current = readModel.get(key);
      if (current === undefined || BigInt(field.revision) > BigInt(current.revision)) readModel.set(key, field);
      return [{ tenantId: field.tenantId, params: field.params as Contract["params"], revision: field.revision, data: field.data as Contract["data"] }];
    },
    snapshot: ({ params }) => {
      const current = readModel.get(instance(name, params));
      if (current === undefined) throw new Error(`No ${name} instance ${JSON.stringify(params)} in the recording.`);
      return { revision: current.revision, data: current.data as Contract["data"] };
    }
  };
}

const principal: Principal = { subject: "volunteer-dev", tenantId: "lontra-creek", sessionId: "dev-volunteer", expiresAt: "2099-01-01T00:00:00.000Z", claims: { role: "volunteer" } };
const handlers: HandlerRegistry<AppChannels> = {
  authenticate: ({ token }) => token === DEV_TOKEN ? principal : null,
  channels: { den: channel("den"), reach: channel("reach"), creekOverview: channel("creekOverview") }
};

const gateway = createGateway({ config, handlers, mode: "development", development: { principals: { volunteer: principal }, fixtures: { field: records } } });
await gateway.start();
const management = await startManagementServer({ gateway, port: MANAGEMENT_PORT });

async function manage(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${management.origin}/management/v1${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${management.token}`, "content-type": "application/json", "x-streamotter-workbench": "1" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
}

let tick = 0;
let ticker: NodeJS.Timeout | undefined;
function schedule(): void {
  ticker = setTimeout(() => {
    const count = tickSizes[tick];
    tick += 1;
    const advance = count === undefined || count === 0 || failNext ? Promise.resolve() : manage("/dev/fixtures/advance", { sourceId: "field", count });
    advance.catch(error => console.error("Advancing the recording failed:", error)).finally(schedule);
  }, TICK_MS);
}
schedule();

function json(response: ServerResponse, status: number, body: unknown, origin: string | undefined): void {
  const allowed = origin !== undefined && config.gateway.allowedOrigins.includes(origin);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    vary: "Origin",
    ...(allowed ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST" } : {})
  });
  response.end(status === 204 ? undefined : JSON.stringify(body));
}

const api = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://pup-patrol.invalid");
  const origin = request.headers.origin;
  const route = `${request.method} ${url.pathname}`;
  try {
    if (request.method === "OPTIONS") return json(response, 204, null, origin);
    if (route === "GET /api/config") {
      return json(response, 200, { gatewayOrigin: `http://${config.gateway.host}:${GATEWAY_PORT}`, gatewayPath: config.gateway.path, mode: "fixture", tickMs: TICK_MS }, origin);
    }
    if (route === "GET /api/status") return json(response, 200, { mode: "fixture", tick, paused: failNext }, origin);
    if (route === "POST /api/badge") {
      return json(response, 200, { badge: { subject: principal.subject, role: "volunteer", name: "Volunteer" }, token: DEV_TOKEN, expiresAt: principal.expiresAt }, origin);
    }
    if (route === "POST /api/dev/pause-source") {
      failNext = true;
      // Deliver one record now, so the source pauses on it without waiting for a tick.
      const count = tickSizes[tick] ?? 0;
      tick += 1;
      if (count > 0) await manage("/dev/fixtures/advance", { sourceId: "field", count }).catch(() => undefined);
      return json(response, 200, { paused: true }, origin);
    }
    if (route === "POST /api/dev/resume-source") {
      failNext = false;
      await manage("/sources/resume", { sourceId: "field" });
      return json(response, 200, { paused: false }, origin);
    }
    json(response, 404, { error: "Not found." }, origin);
  } catch (error) {
    console.error("Request failed:", error);
    if (!response.headersSent) json(response, 500, { error: String(error) }, origin);
  }
});
await new Promise<void>(resolve => api.listen(API_PORT, "127.0.0.1", resolve));

console.log([
  "Pup Patrol creek: the recorded Lontra Creek, no Kafka",
  `  Gateway   http://${config.gateway.host}:${GATEWAY_PORT}${config.gateway.path}`,
  `  API       http://127.0.0.1:${API_PORT}/api`,
  `  Replay    ${recording.ticks.length} field ticks, looped, one every ${TICK_MS / 1000} s`
].join("\n"));

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearTimeout(ticker);
  await new Promise<void>(resolve => api.close(() => resolve()));
  await management.close();
  await gateway.stop();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
