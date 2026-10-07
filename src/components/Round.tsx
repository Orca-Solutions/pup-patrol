/**
 * One round. React owns the creek and the screen around the field; a canvas owns the frames.
 *
 * Each render calls `useCreek` (the StreamOtter hooks, live), and creek updates are handed to
 * the engine in effects: a new overview revision is a field tick, a den update changes the
 * pups' state, a new Beaver Flats frame fires the trap. A requestAnimationFrame loop, started
 * when the round mounts and stopped when it unmounts, steps the engine and draws, without
 * going through React per frame; it refreshes the score and clock a few times a second, and
 * each of those renders calls the hooks again with new params objects, which keeps the same
 * subscriptions.
 *
 * The round plays only while the creek is live and the page is visible. A hidden tab pauses it
 * like a stale creek, and coming back resumes it from a fresh snapshot, so nothing the player
 * couldn't see scores against them.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CreekFeed, UseCreek } from "../creek.ts";
import {
  createGame, FIELD, fieldTick, pause, pupsHome, resync, setPups, step, trapFired,
  type GameState, type Input, type PupsAt
} from "../game/engine.ts";
import { draw, type Scene } from "../game/render.ts";
import { countRender } from "../hood.ts";

export interface RoundResult {
  score: number;
  caught: number;
  home: number;
  /** The player ended the round before the bell. */
  quit: boolean;
}

interface Hud {
  score: number;
  secondsLeft: number;
  home: number;
  caught: number;
  message: string;
}

/** Steering keys by physical key (`KeyboardEvent.code`), so Shift or a keyboard layout can't strand one. */
const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0]
};

const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Whether the page is visible: browsers stop animating hidden tabs. */
function useVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const change = (): void => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  return visible;
}

const pupsOf = (feed: CreekFeed): PupsAt => feed.den?.pups ?? "in-den";

function hudOf(game: GameState): Hud {
  return {
    score: game.score,
    secondsLeft: Math.ceil((game.roundMs - game.elapsedMs) / 1000),
    home: pupsHome(game),
    caught: game.caught,
    message: game.message
  };
}

export function Round(props: { useCreek: UseCreek; tickMs: number; roundMs: number; onEnd(result: RoundResult): void; onUseRecording?: () => void }) {
  const feed = props.useCreek();
  const visible = useVisible();
  countRender();

  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<GameState | null>(null);
  const input = useRef<Input>({ direction: { x: 0, y: 0 }, toward: null });
  const keys = useRef(new Set<string>());
  const scene = useRef<Scene>({ daylight: "day", weather: "clear", stale: false, now: 0, reducedMotion: reducedMotion() });
  const lastFrame = useRef<string | undefined>(undefined);
  const ended = useRef(false);
  const bell = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onEnd = useRef(props.onEnd);
  onEnd.current = props.onEnd;
  const [hud, setHud] = useState<Hud | null>(null);
  const [waitedLong, setWaitedLong] = useState(false);

  // The round starts on the first live snapshot of all three channels.
  const started = game.current !== null;
  if (!started && feed.live && feed.ready) {
    game.current = createGame({ pupsAt: pupsOf(feed), tickMs: props.tickMs, roundMs: props.roundMs });
    lastFrame.current = feed.reach?.lastFrame.frame;
  }

  scene.current.daylight = feed.overview?.daylight ?? "day";
  scene.current.weather = feed.overview?.weather ?? "clear";
  scene.current.stale = started && !feed.live;
  // The engine runs only while the creek is live and someone can see it.
  const active = feed.live && visible;

  useEffect(() => {
    if (started) return;
    const timer = setTimeout(() => setWaitedLong(true), 8_000);
    return () => clearTimeout(timer);
  }, [started]);

  // Pause on anything stale (or a hidden tab), and reset from the fresh snapshot when it's back.
  useEffect(() => {
    const current = game.current;
    if (current === null) return;
    if (!active) {
      pause(current);
    } else if (current.phase === "paused" && feed.ready) {
      resync(current, pupsOf(feed));
      // Frames taken while the game couldn't hear the creek don't count against the player.
      lastFrame.current = feed.reach?.lastFrame.frame;
    }
    setHud(hudOf(current));
  }, [active]);

  useEffect(() => {
    if (game.current !== null && feed.den !== undefined && active) setPups(game.current, feed.den.pups);
  }, [feed.den?.pups]);

  useEffect(() => {
    if (game.current !== null && feed.overviewRevision !== undefined && active) fieldTick(game.current, feed.overviewRevision);
  }, [feed.overviewRevision]);

  useEffect(() => {
    const frame = feed.reach?.lastFrame;
    if (game.current === null || frame === undefined || !active) return;
    if (frame.frame !== lastFrame.current && frame.frame !== "none") {
      trapFired(game.current, { frame: frame.frame, species: frame.species, count: frame.count });
      setHud(hudOf(game.current));
    }
    lastFrame.current = frame.frame;
  }, [feed.reach?.lastFrame.frame]);

  // Keyboard steering.
  useEffect(() => {
    const update = (): void => {
      let x = 0;
      let y = 0;
      for (const key of keys.current) {
        const [dx, dy] = KEYS[key] ?? [0, 0];
        x += dx;
        y += dy;
      }
      input.current.direction = { x: Math.sign(x), y: Math.sign(y) };
    };
    const down = (event: KeyboardEvent): void => {
      // Leave shortcuts (Ctrl/Cmd/Alt + a key) to the browser: they may never send a keyup.
      if (KEYS[event.code] === undefined || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      keys.current.add(event.code);
      input.current.toward = null;
      update();
    };
    const up = (event: KeyboardEvent): void => {
      keys.current.delete(event.code);
      update();
    };
    // Keys released while the window wasn't listening would otherwise stay held.
    const letGo = (): void => {
      keys.current.clear();
      update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", letGo);
    document.addEventListener("visibilitychange", letGo);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", letGo);
      document.removeEventListener("visibilitychange", letGo);
    };
  }, []);

  // The animation loop: mounted with the round, stopped when it unmounts.
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (element == null || ctx == null) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    element.width = FIELD.width * ratio;
    element.height = FIELD.height * ratio;
    let frame = 0;
    let last = performance.now();
    let hudAt = 0;
    const loop = (now: number): void => {
      const dt = now - last;
      last = now;
      const current = game.current;
      scene.current.now = now;
      if (current !== null) {
        step(current, dt, input.current);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        draw(ctx, current, scene.current);
        if (now - hudAt > 100) {
          hudAt = now;
          setHud(hudOf(current));
        }
        if (current.phase === "over" && !ended.current) {
          ended.current = true;
          const result = { score: current.score, caught: current.caught, home: pupsHome(current), quit: false };
          // Let the bell's frame show before the end screen replaces the round.
          bell.current = setTimeout(() => onEnd.current(result), 900);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(bell.current);
    };
  }, []);

  const pointer = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (event.type !== "pointerdown" && event.buttons === 0 && event.pointerType === "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    input.current.toward = { x: ((event.clientX - box.left) / box.width) * FIELD.width, y: ((event.clientY - box.top) / box.height) * FIELD.height };
  };
  const release = (): void => {
    input.current.toward = null;
  };

  const quit = (): void => {
    const current = game.current;
    if (ended.current) return;
    ended.current = true;
    onEnd.current({ score: current?.score ?? 0, caught: current?.caught ?? 0, home: current === null ? 0 : pupsHome(current), quit: true });
  };

  // The receiver overlay is for a stale creek, not a hidden tab (nobody sees that), and not over the bell.
  const paused = started && !feed.live && game.current?.phase !== "over";
  return (
    <section className="round" aria-label="Pup Patrol round">
      <div className="hud" data-testid="hud">
        <span className="hud-item"><span className="hud-label">Time</span> <strong data-testid="time-left">{hud?.secondsLeft ?? Math.ceil(props.roundMs / 1000)}</strong>s</span>
        <span className="hud-item"><span className="hud-label">Score</span> <strong data-testid="score">{hud?.score ?? 0}</strong></span>
        <span className="hud-item"><span className="hud-label">Home</span> <strong>{hud?.home ?? 0}</strong>/2</span>
        <span className="hud-item"><span className="hud-label">Caught on camera</span> <strong>{hud?.caught ?? 0}</strong></span>
        <span className="hud-item hud-creek">
          {feed.overview ? `Day ${feed.overview.observed.day}, ${feed.overview.observed.time} · ${feed.overview.daylight}` : "…"}
          {feed.den ? ` · pups ${feed.den.pups === "out" ? "out" : "in the holt"}` : ""}
        </span>
        <button type="button" className="link-button" onClick={quit}>End round</button>
      </div>
      <div className="field">
        <canvas
          ref={canvas}
          className="field-canvas"
          role="img"
          aria-label="The field: Holt A on the left, the Beaver Flats camera trap on the right, Pebble and her pups between them."
          onPointerDown={pointer}
          onPointerMove={pointer}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
        />
        {feed.recorded && <div className="badge-recorded" data-testid="recorded">Recording · not live</div>}
        {!started && (
          <div className="overlay" data-testid="tuning" role="status">
            <p className="overlay-title">Tuning the receiver…</p>
            <p>Waiting for Holt A, the Beaver Flats trap and the creek overview to come in live.</p>
            {feed.problems.length > 0 && <p className="problems">{feed.problems.join(" · ")}</p>}
            {waitedLong && props.onUseRecording && (
              <button type="button" className="button" onClick={props.onUseRecording}>Play the recording instead</button>
            )}
          </div>
        )}
        {paused && (
          <div className="overlay overlay-stale" data-testid="stale" role="status">
            <p className="overlay-title">Lost the receiver</p>
            <p>The round is paused on the last known creek. It picks up from a fresh snapshot when every channel is live again.</p>
            <p className="problems">{feed.problems.join(" · ")}</p>
            {feed.canResync && <button type="button" className="button" onClick={feed.resync}>Re-tune</button>}
          </div>
        )}
      </div>
      <p className="log" aria-live="polite" data-testid="log">{hud?.message ?? (started ? "" : " ")}</p>
    </section>
  );
}
