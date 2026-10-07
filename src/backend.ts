/**
 * The Lontra Creek field station's site API, as the game uses it: where the gateway is,
 * and a volunteer badge. The game sends no cookie; it keeps each badge's token in memory
 * and asks for a fresh one whenever the client connects.
 */

/** Where the field station's /api is: the demo host in production, `npm run dev:creek` locally. */
export const API_ORIGIN: string = import.meta.env.VITE_FIELD_STATION_ORIGIN
  ?? (import.meta.env.DEV ? "http://127.0.0.1:7502" : "https://demo.streamotter.dev");

export interface CreekConfig {
  gatewayOrigin: string;
  gatewayPath: string;
  /** "kafka" on the demo host, "fixture" for the local recording. */
  mode: string;
  /** Milliseconds per field tick. */
  tickMs: number;
}

export async function fetchCreekConfig(signal?: AbortSignal): Promise<CreekConfig> {
  const response = await fetch(`${API_ORIGIN}/api/config`, { signal: signal ?? AbortSignal.timeout(6_000) });
  if (!response.ok) throw new Error(`The field station answered ${response.status}.`);
  const body = await response.json() as Partial<CreekConfig>;
  if (typeof body.gatewayOrigin !== "string" || typeof body.gatewayPath !== "string") throw new Error("The field station sent no gateway address.");
  return { gatewayOrigin: body.gatewayOrigin, gatewayPath: body.gatewayPath, mode: String(body.mode ?? "kafka"), tickMs: typeof body.tickMs === "number" ? body.tickMs : 2_000 };
}

/** The StreamOtter client's `getToken`: a fresh volunteer badge for every connection. */
export async function getToken({ signal }: { signal: AbortSignal }): Promise<string> {
  const response = await fetch(`${API_ORIGIN}/api/badge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "volunteer" }),
    signal
  });
  if (!response.ok) throw new Error(`The field station refused a badge (${response.status}).`);
  const body = await response.json() as { token?: unknown };
  if (typeof body.token !== "string") throw new Error("The field station sent no token.");
  return body.token;
}
