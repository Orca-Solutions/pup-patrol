/**
 * Where a round gets the creek from. `useLiveCreek` is the real thing: three StreamOtter
 * subscriptions and the connection state, through the hooks. `useRecordedCreek` replays the
 * recording in the browser when the demo backend can't be reached, and says so.
 *
 * A round calls one of them on every render (several times a second, for its clock). The
 * params objects below are new each time; the hooks compare them by value, so the
 * subscriptions stay put.
 */
import { useCallback, useEffect, useState } from "react";
import type { CameraTrap, CreekOverview, DenStatus } from "./generated/streamotter.generated.ts";
import { useReportHood, useUpdateCount, type SubscriptionReport } from "./hood.ts";
import { useConnectionState, useSubscription } from "./streamotter.ts";

export interface CreekFeed {
  den: DenStatus | undefined;
  reach: CameraTrap | undefined;
  overview: CreekOverview | undefined;
  /** Changes with every field tick: the overview is republished each tick. */
  overviewRevision: string | undefined;
  /** Every subscription is live and the client is connected: what the round shows is current. */
  live: boolean;
  /** Every subscription has data, live or last known. */
  ready: boolean;
  /** What isn't live, in words, while something isn't. */
  problems: string[];
  /** A subscription needs a fresh snapshot the gateway won't send by itself (`resync-required`). */
  canResync: boolean;
  resync(): void;
  recorded: boolean;
}

export type UseCreek = () => CreekFeed;

const LABELS = { den: "Holt A den", reach: "Beaver Flats trap", creekOverview: "Creek overview" } as const;

export function useLiveCreek(): CreekFeed {
  const den = useSubscription("den", { channelVersion: 1, params: { holtId: "A" } });
  const reach = useSubscription("reach", { channelVersion: 1, params: { reachId: "beaver-flats" } });
  const overview = useSubscription("creekOverview", { channelVersion: 1, params: { watershed: "lontra" } });
  const connection = useConnectionState();

  const entries = [
    { channel: "den", params: "holtId: A", result: den, updates: useUpdateCount(den.revision) },
    { channel: "reach", params: "reachId: beaver-flats", result: reach, updates: useUpdateCount(reach.revision) },
    { channel: "creekOverview", params: "watershed: lontra", result: overview, updates: useUpdateCount(overview.revision) }
  ] as const;
  useReportHood(connection, entries.map((entry): SubscriptionReport => ({
    channel: entry.channel,
    params: entry.params,
    state: entry.result.state,
    revision: entry.result.revision,
    updates: entry.updates,
    error: entry.result.error?.code
  })));

  const problems = [
    ...connection === "connected" ? [] : [`connection: ${connection}`],
    ...entries.filter(entry => !entry.result.live).map(entry => `${LABELS[entry.channel]}: ${entry.result.state}`)
  ];
  const needsResync = entries.filter(entry => entry.result.state === "resync-required");
  const resync = useCallback(() => {
    // Each subscription's own resync(); a refusal shows up as its state and error.
    for (const entry of needsResync) entry.result.resync().catch(() => undefined);
  }, [needsResync.map(entry => entry.channel).join()]);

  return {
    den: den.data,
    reach: reach.data,
    overview: overview.data,
    overviewRevision: overview.revision,
    live: problems.length === 0,
    ready: den.data !== undefined && reach.data !== undefined && overview.data !== undefined,
    problems,
    canResync: needsResync.length > 0,
    resync,
    recorded: false
  };
}

/** The recording the field station's script produced (lontra-creek, scripts/pup-patrol-fixture.ts). */
export interface Recording {
  startTick: number;
  tickMs: number;
  initial: RecordedRecord[];
  ticks: RecordedRecord[][];
}

interface RecordedRecord {
  channel: string;
  revision: string;
  data: unknown;
}

interface RecordedState {
  den: DenStatus | undefined;
  reach: CameraTrap | undefined;
  overview: CreekOverview | undefined;
  overviewRevision: string | undefined;
}

function apply(state: RecordedState, records: readonly RecordedRecord[]): RecordedState {
  const next = { ...state };
  for (const record of records) {
    if (record.channel === "den") next.den = record.data as DenStatus;
    if (record.channel === "reach") next.reach = record.data as CameraTrap;
    if (record.channel === "creekOverview") {
      next.overview = record.data as CreekOverview;
      next.overviewRevision = record.revision;
    }
  }
  return next;
}

const noResync = (): void => {};

/** A round's creek from the recording, one field tick per `tickMs`, looped. */
export function recordedCreek(recording: Recording, tickMs: number): UseCreek {
  return function useRecordedCreek(): CreekFeed {
    const [state, setState] = useState<RecordedState>(() => apply({ den: undefined, reach: undefined, overview: undefined, overviewRevision: undefined }, recording.initial));
    useEffect(() => {
      // Start a few ticks in, so the pups come out early in the round.
      let index = Math.min(8, Math.max(0, recording.ticks.length - 1));
      const timer = setInterval(() => {
        // Loop the recording; revisions only matter to the round as "something changed".
        const tick = recording.ticks[index % recording.ticks.length] ?? [];
        const pass = Math.floor(index / recording.ticks.length);
        index += 1;
        setState(previous => apply(previous, tick.map(record => ({ ...record, revision: `${pass}:${record.revision}` }))));
      }, tickMs);
      return () => clearInterval(timer);
    }, []);
    useReportHood("recorded", []);
    return { ...state, live: true, ready: true, problems: [], canResync: false, resync: noResync, recorded: true };
  };
}
