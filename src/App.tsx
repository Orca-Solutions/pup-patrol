/**
 * The page: start screen, round, end screen, and the drawer, all under one
 * StreamOtterProvider when the demo backend answers. When it doesn't, rounds replay a
 * recording of the creek, labeled as such, instead of pretending to be live.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchCreekConfig, getToken, type CreekConfig } from "./backend.ts";
import { recordedCreek, useLiveCreek, type Recording, type UseCreek } from "./creek.ts";
import { ROUND_MS } from "./game/engine.ts";
import { Drawer } from "./components/Drawer.tsx";
import { Round, type RoundResult } from "./components/Round.tsx";
import { SignalBar } from "./components/SignalBar.tsx";
import { StreamOtterProvider } from "./streamotter.ts";

type Mode =
  | { kind: "loading" }
  | { kind: "live"; config: CreekConfig }
  | { kind: "recorded"; reason: string; recording: Recording };

type Screen = { kind: "start" } | { kind: "round"; id: number } | { kind: "end"; result: RoundResult };

const BEST_KEY = "pup-patrol:best";

function readBest(): number | null {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && localStorage.getItem(BEST_KEY) !== null ? value : null;
  } catch {
    return null;
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Private windows and blocked storage just don't keep a best score.
  }
}

/** `?round=20` shortens a round (10 to 60 seconds), for trying the game and for tests. */
function roundMs(): number {
  const seconds = Number(new URLSearchParams(location.search).get("round"));
  return Number.isFinite(seconds) && seconds >= 10 && seconds <= 60 ? seconds * 1000 : ROUND_MS;
}

async function loadRecording(): Promise<Recording> {
  const module = await import("../creek/pup-patrol.json");
  return module.default as unknown as Recording;
}

export function App() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [screen, setScreen] = useState<Screen>({ kind: "start" });
  const [drawer, setDrawer] = useState(false);
  const [best, setBest] = useState<number | null>(readBest);
  const length = useMemo(roundMs, []);

  const switchToRecording = (reason: string): void => {
    loadRecording().then(recording => {
      setMode({ kind: "recorded", reason, recording });
      setScreen(current => current.kind === "round" ? { kind: "round", id: current.id + 1 } : current);
    }).catch(() => setMode({ kind: "recorded", reason, recording: { startTick: 0, tickMs: 2_000, initial: [], ticks: [] } }));
  };

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    fetchCreekConfig(controller.signal)
      .then(config => setMode({ kind: "live", config }))
      .catch(() => switchToRecording("The Lontra Creek demo backend didn't answer."))
      .finally(() => clearTimeout(timeout));
    return () => controller.abort();
  }, []);

  const tickMs = mode.kind === "live" ? mode.config.tickMs : mode.kind === "recorded" ? mode.recording.tickMs : 2_000;
  const useCreek: UseCreek | null = useMemo(
    () => mode.kind === "live" ? useLiveCreek : mode.kind === "recorded" ? recordedCreek(mode.recording, mode.recording.tickMs) : null,
    [mode]
  );

  const finish = (result: RoundResult): void => {
    if (!result.quit && (best === null || result.score > best)) {
      setBest(result.score);
      saveBest(result.score);
    }
    setScreen({ kind: "end", result });
  };
  const start = (): void => setScreen(current => ({ kind: "round", id: current.kind === "round" ? current.id + 1 : Date.now() }));

  const page = (
    <div className="page">
      <header className="top">
        <div className="brand">
          <span className="brand-name">Pup Patrol</span>
          <span className="brand-sub">on Lontra Creek</span>
        </div>
        <div className="top-actions">
          {mode.kind === "live" && <SignalBar />}
          {mode.kind === "recorded" && <span className="signal signal-recorded" data-testid="signal" data-state="recorded">Recording</span>}
          <button type="button" className="link-button" aria-expanded={drawer} onClick={() => setDrawer(open => !open)}>Under the hood</button>
        </div>
      </header>

      <main className="main">
        {mode.kind === "recorded" && (
          <p className="notice" role="status">{mode.reason} Rounds replay a recording of the creek; it is not live.</p>
        )}

        {screen.kind === "start" && (
          <section className="card start" aria-labelledby="start-title">
            <h1 id="start-title">Herd the pups home before the camera trap fires.</h1>
            <p>
              You are Pebble (LO-07), a river otter on Lontra Creek. Sprout and Skipper, her pups, wander out of Holt A
              toward the Beaver Flats camera trap. Swim close to nudge them back. Every pup in the picture when the trap
              flashes costs you points; every pup home at the bell earns them.
            </p>
            <p className="small">
              The creek is a simulation, but it is running for real: the pups come out when the field station says they're
              out, and the trap fires when its camera does, through Kafka and a StreamOtter gateway. Lose the connection and
              the round pauses on the last known creek.
            </p>
            <ul className="controls">
              <li><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to swim, or drag on the field</li>
              <li>{Math.round(length / 1000)} seconds a round</li>
            </ul>
            <button type="button" className="button button-big" onClick={start} disabled={useCreek === null}>
              {useCreek === null ? "Finding the creek…" : "Start round"}
            </button>
            {best !== null && <p className="small">Your best: {best}</p>}
          </section>
        )}

        {screen.kind === "round" && useCreek !== null && (
          <Round
            key={`${screen.id}:${mode.kind}`}
            useCreek={useCreek}
            tickMs={tickMs}
            roundMs={length}
            onEnd={finish}
            {...mode.kind === "live" ? { onUseRecording: () => switchToRecording("You chose the recording.") } : {}}
          />
        )}

        {screen.kind === "end" && (
          <section className="card end" aria-labelledby="end-title" data-testid="end">
            <h1 id="end-title">{screen.result.quit ? "Round ended" : screen.result.home === 2 ? "Both pups home!" : "The bell rang"}</h1>
            <p className="final-score">Score <strong data-testid="final-score">{screen.result.score}</strong></p>
            <p>Pups home at the end: {screen.result.home} of 2. Caught on camera: {screen.result.caught}.</p>
            {best !== null && <p className="small">Your best: {best}</p>}
            <div className="row">
              <button type="button" className="button button-big" onClick={start}>Play again</button>
              <a className="link-button" href="https://streamotter.dev/pup-patrol">How it works</a>
            </div>
          </section>
        )}
      </main>

      <footer className="foot">
        <p>
          Lontra Creek is fictional: the otters, the study and the creek are a simulation, run on real Kafka for{" "}
          <a href="https://streamotter.dev">StreamOtter</a>. The game only reads public channels; den locations stay private.
        </p>
      </footer>
      <Drawer open={drawer} onClose={() => setDrawer(false)} mode={mode.kind} />
    </div>
  );

  if (mode.kind !== "live") return page;
  return (
    <StreamOtterProvider options={{ origin: mode.config.gatewayOrigin, path: mode.config.gatewayPath, getToken }}>
      {page}
    </StreamOtterProvider>
  );
}
