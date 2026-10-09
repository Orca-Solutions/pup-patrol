/**
 * What the "Live data" drawer shows: each mounted subscription's state, revision and
 * update count, the client's connection state, and how often the round has rendered. The
 * round writes here; the drawer reads it a few times a second while open.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

export interface SubscriptionReport {
  channel: string;
  params: string;
  state: string;
  revision: string | undefined;
  updates: number;
  error: string | undefined;
}

export interface Hood {
  /** "recorded" when the round replays the recording; null when no round is mounted. */
  connection: string | null;
  subscriptions: SubscriptionReport[];
  roundRenders: number;
}

let hood: Hood = { connection: null, subscriptions: [], roundRenders: 0 };
const listeners = new Set<() => void>();

function publish(next: Hood): void {
  hood = next;
  for (const listener of listeners) listener();
}

export function useHood(): Hood {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => hood
  );
}

/** Counts a render without notifying anyone: the drawer picks it up on its next report. */
export function countRender(): void {
  hood.roundRenders += 1;
}

/** Reports the round's subscriptions while it is mounted, and clears them when it unmounts. */
export function useReportHood(connection: string, subscriptions: SubscriptionReport[]): void {
  const key = JSON.stringify([connection, subscriptions]);
  const latest = useRef({ connection, subscriptions });
  latest.current = { connection, subscriptions };
  useEffect(() => {
    publish({ ...hood, ...latest.current });
  }, [key]);
  useEffect(() => () => publish({ connection: null, subscriptions: [], roundRenders: hood.roundRenders }), []);
}

/** Counts each new revision of a subscription. */
export function useUpdateCount(revision: string | undefined): number {
  const count = useRef(0);
  const last = useRef<string | undefined>(undefined);
  if (revision !== undefined && revision !== last.current) {
    last.current = revision;
    count.current += 1;
  }
  return count.current;
}
