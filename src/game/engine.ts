/**
 * The game, without React or a canvas: plain state and the functions that change it, so
 * it runs the same in the browser and in unit tests.
 *
 * The creek drives the pups and the trap; the game only animates between its updates.
 * `fieldTick` runs on each creek overview update (one field tick, two seconds), `setPups`
 * on each den update, and `trapFired` on each new Beaver Flats frame. `step` runs every
 * animation frame: it tweens the pups toward the targets the last tick set, moves Pebble
 * from input, and lets her herd. While the creek is stale the round is paused, and the
 * first fresh snapshot afterwards resets the pups (`resync`): the game never guesses what
 * happened while it couldn't hear the creek.
 */

export interface Vec {
  x: number;
  y: number;
}

/** The public den view's `pups`: home, out with their mother, or none (a holt without a litter). */
export type PupsAt = "in-den" | "out" | "none";
export type PupName = "Sprout" | "Skipper";

export interface Pup {
  name: PupName;
  pos: Vec;
  /** Where the last field tick sent the pup; `step` tweens toward it. */
  target: Vec;
  home: boolean;
  /** Field ticks a herded-home pup stays put before wandering again while the pups are out. */
  settle: number;
  /**
   * Field ticks a pup that just came out won't go back in. Herding can't send it home, and it
   * keeps clear of the holt, so camping at the holt mouth doesn't work: you chase it home instead.
   */
  curious: number;
  /** Milliseconds left on the "caught on camera" highlight. */
  caught: number;
}

export interface TrapFrame {
  /** The camera's frame id, such as "CT-2 00123". */
  frame: string;
  species: string;
  count: number;
}

export interface Flash extends TrapFrame {
  /** Pups the frame caught outside the holt. */
  caught: PupName[];
  /** Milliseconds since it fired, for the flash effect. */
  age: number;
}

export type Phase = "playing" | "paused" | "over";

export interface GameState {
  phase: Phase;
  /** Live round time; it stops while paused. */
  elapsedMs: number;
  roundMs: number;
  /** Milliseconds per field tick, from the field station; scales the tween. */
  tickMs: number;
  pebble: Vec;
  pups: Pup[];
  pupsAt: PupsAt;
  score: number;
  /** Pup frames the trap took. */
  caught: number;
  ticks: number;
  flash: Flash | null;
  /** The last thing worth saying in the log line under the field. */
  message: string;
}

export interface Input {
  /** A direction from the keyboard, each axis -1 to 1. */
  direction: Vec;
  /** A point to move toward (pointer or touch), or null. */
  toward: Vec | null;
}

export const FIELD = {
  width: 960,
  height: 540,
  holt: { x: 130, y: 330, r: 64 },
  trap: { x: 860, y: 250 },
  /** The camera looks back toward the holt: a wedge this wide and this long. */
  cone: { direction: Math.PI, half: 0.42, range: 450 }
} as const;

export const ROUND_MS = 60_000;
export const POINTS = { homePerTick: 1, caught: -5, homeAtBell: 10 } as const;
/**
 * The most one animation frame advances the round. A frame after a stall (a busy main thread,
 * or a tab the browser stopped animating) counts as this long, so the clock never jumps.
 */
export const MAX_STEP_MS = 250;
const PEBBLE_SPEED = 270;
const HERD_RADIUS = 84;
const PUSH_SPEED = 260;
const SETTLE_TICKS = 2;
const CURIOUS_TICKS = 2;
const MARGIN = 24;

/** A number in [0, 1) from a string: the same creek update always moves the pups the same way. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

function clampToField(point: Vec): Vec {
  return { x: clamp(point.x, MARGIN, FIELD.width - MARGIN), y: clamp(point.y, MARGIN + 40, FIELD.height - MARGIN) };
}

export function inHolt(point: Vec): boolean {
  return distance(point, FIELD.holt) <= FIELD.holt.r;
}

/** Whether the trap's camera sees a point. */
export function inCone(point: Vec): boolean {
  const dx = point.x - FIELD.trap.x;
  const dy = point.y - FIELD.trap.y;
  if (Math.hypot(dx, dy) > FIELD.cone.range) return false;
  let off = Math.atan2(dy, dx) - FIELD.cone.direction;
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) <= FIELD.cone.half;
}

/** Where a pup sits when the creek says it is home, or just come out of the holt. */
function placePup(index: number, pupsAt: PupsAt): Vec {
  const offset = index === 0 ? -1 : 1;
  if (pupsAt === "out") return { x: FIELD.holt.x + FIELD.holt.r + 26, y: FIELD.holt.y + offset * 30 };
  return { x: FIELD.holt.x + offset * 18, y: FIELD.holt.y + 6 };
}

function placedPups(pupsAt: PupsAt): Pup[] {
  return (["Sprout", "Skipper"] as const).map((name, index) => {
    const pos = placePup(index, pupsAt);
    return { name, pos, target: { ...pos }, home: pupsAt !== "out", settle: 0, curious: 0, caught: 0 };
  });
}

export function createGame(options: { pupsAt: PupsAt; tickMs?: number; roundMs?: number }): GameState {
  return {
    phase: "playing",
    elapsedMs: 0,
    roundMs: options.roundMs ?? ROUND_MS,
    tickMs: options.tickMs ?? 2_000,
    pebble: { x: FIELD.holt.x + 170, y: FIELD.holt.y - 60 },
    pups: placedPups(options.pupsAt),
    pupsAt: options.pupsAt,
    score: 0,
    caught: 0,
    ticks: 0,
    flash: null,
    message: options.pupsAt === "out" ? "The pups are out. Keep them away from the camera." : "The pups are in the holt. Watch for them coming out."
  };
}

/** A den update: the pups' state on the creek. It takes effect at the next field tick. */
export function setPups(state: GameState, pupsAt: PupsAt): void {
  if (pupsAt === state.pupsAt) return;
  state.pupsAt = pupsAt;
  state.message = pupsAt === "out" ? "The pups are out of the holt!" : "Pebble called the pups home.";
}

/**
 * One field tick: give each pup its next target. `seed` is the creek update's revision,
 * so a replay of the same updates moves the pups the same way.
 */
export function fieldTick(state: GameState, seed: string): void {
  if (state.phase !== "playing") return;
  state.ticks += 1;
  state.pups.forEach((pup, index) => {
    const r1 = hash(`${seed}:${pup.name}:x`);
    const r2 = hash(`${seed}:${pup.name}:y`);
    if (state.pupsAt === "out") {
      if (pup.home) {
        if (pup.settle > 0) {
          pup.settle -= 1;
          return;
        }
        // Out of the holt mouth and a dash toward the creek, too curious to go back in for a while.
        const side = index === 0 ? -1 : 1;
        pup.home = false;
        pup.curious = CURIOUS_TICKS;
        pup.pos = { x: FIELD.holt.x + FIELD.holt.r + 4, y: FIELD.holt.y + side * 12 };
        pup.target = clampToField({ x: FIELD.holt.x + FIELD.holt.r + 90 + r1 * 50, y: FIELD.holt.y + side * (30 + r2 * 50) });
        return;
      }
      if (pup.curious > 0) pup.curious -= 1;
      // Wander downstream toward Beaver Flats, where the trap is.
      const step = { x: 50 + r1 * 45, y: (r2 - 0.5) * 110 + (FIELD.trap.y - pup.pos.y) * 0.12 };
      pup.target = clampToField({ x: Math.min(FIELD.trap.x - 40, pup.pos.x + step.x), y: pup.pos.y + step.y });
    } else if (!pup.home) {
      // Their mother is calling: head for the holt on their own, curious or not.
      pup.curious = 0;
      const away = distance(pup.pos, FIELD.holt);
      const stride = Math.min(away, 90 + r1 * 20);
      pup.target = {
        x: pup.pos.x + ((FIELD.holt.x - pup.pos.x) / away) * stride,
        y: pup.pos.y + ((FIELD.holt.y - pup.pos.y) / away) * stride + (r2 - 0.5) * 20
      };
    }
  });
  const home = state.pups.filter(pup => pup.home).length;
  state.score += home * POINTS.homePerTick;
}

/** A new frame from the Beaver Flats camera trap: every pup in view outside the holt is caught on camera. */
export function trapFired(state: GameState, frame: TrapFrame): void {
  // Only a round in play scores: a frame taken while paused (or after the bell) never counts.
  if (state.phase !== "playing") return;
  const caught = state.pups.filter(pup => !pup.home && inCone(pup.pos));
  for (const pup of caught) pup.caught = 900;
  state.caught += caught.length;
  state.score += caught.length * POINTS.caught;
  state.flash = { ...frame, caught: caught.map(pup => pup.name), age: 0 };
  const subject = frame.species === "none" ? "nothing" : `${frame.count > 1 ? `${frame.count} × ` : ""}${frame.species}`;
  state.message = caught.length > 0
    ? `Flash! ${caught.map(pup => pup.name).join(" and ")} caught on camera (${frame.frame}).`
    : `Flash! ${frame.frame}: ${subject}. No pups in the picture.`;
}

/** The creek went stale or the connection dropped: freeze everything where it was last known. */
export function pause(state: GameState): void {
  if (state.phase === "playing") state.phase = "paused";
}

/**
 * The creek is live again with a fresh snapshot. The pups go where the snapshot says,
 * not where they might have wandered in between.
 */
export function resync(state: GameState, pupsAt: PupsAt): void {
  if (state.phase === "over") return;
  const pebble = state.pebble;
  const fresh = placedPups(pupsAt);
  state.pups = fresh;
  state.pupsAt = pupsAt;
  state.pebble = pebble;
  state.phase = "playing";
  state.message = "Back on the receiver: a fresh snapshot reset the pups.";
}

export function step(state: GameState, frameMs: number, input: Input): void {
  const dtMs = Math.min(Math.max(0, frameMs), MAX_STEP_MS);
  // A paused round is frozen, the trap's flash included; after the bell it fades out.
  if (state.flash !== null && state.phase !== "paused") state.flash.age += dtMs;
  if (state.phase !== "playing") return;
  const dt = dtMs / 1000;
  state.elapsedMs = Math.min(state.roundMs, state.elapsedMs + dtMs);

  // Pebble moves where she's steered.
  let move: Vec = input.direction;
  if (input.toward !== null) {
    const away = distance(input.toward, state.pebble);
    move = away < 6 ? { x: 0, y: 0 } : { x: (input.toward.x - state.pebble.x) / away, y: (input.toward.y - state.pebble.y) / away };
  }
  const length = Math.hypot(move.x, move.y);
  if (length > 0) {
    const scale = Math.min(1, length) / length;
    state.pebble = clampToField({ x: state.pebble.x + move.x * scale * PEBBLE_SPEED * dt, y: state.pebble.y + move.y * scale * PEBBLE_SPEED * dt });
  }

  // Tween toward the last tick's targets: about 95% of the way by the next tick.
  const follow = 1 - Math.exp((-3 * dtMs) / state.tickMs);
  for (const pup of state.pups) {
    pup.caught = Math.max(0, pup.caught - dtMs);
    pup.pos = { x: pup.pos.x + (pup.target.x - pup.pos.x) * follow, y: pup.pos.y + (pup.target.y - pup.pos.y) * follow };

    // Herding: Pebble nudges a pup away from her, and the nudge sticks.
    const gap = distance(pup.pos, state.pebble);
    if (gap < HERD_RADIUS && !pup.home) {
      const push = PUSH_SPEED * dt * (1 - gap / HERD_RADIUS);
      const dir = gap === 0 ? { x: -1, y: 0 } : { x: (pup.pos.x - state.pebble.x) / gap, y: (pup.pos.y - state.pebble.y) / gap };
      const moved = clampToField({ x: pup.pos.x + dir.x * push, y: pup.pos.y + dir.y * push });
      pup.target = clampToField({ x: pup.target.x + (moved.x - pup.pos.x), y: pup.target.y + (moved.y - pup.pos.y) });
      pup.pos = moved;
    }
    if (!pup.home && pup.curious > 0 && inHolt(pup.pos)) {
      // A curious pup won't go back in: it slips out to the holt's edge.
      const off = distance(pup.pos, FIELD.holt);
      const dir = off === 0 ? { x: 1, y: 0 } : { x: (pup.pos.x - FIELD.holt.x) / off, y: (pup.pos.y - FIELD.holt.y) / off };
      const edge = { x: FIELD.holt.x + dir.x * (FIELD.holt.r + 4), y: FIELD.holt.y + dir.y * (FIELD.holt.r + 4) };
      pup.target = clampToField({ x: pup.target.x + (edge.x - pup.pos.x), y: pup.target.y + (edge.y - pup.pos.y) });
      pup.pos = edge;
    }
    if (!pup.home && pup.curious === 0 && inHolt(pup.pos)) {
      pup.home = true;
      pup.settle = SETTLE_TICKS;
      pup.target = { ...pup.pos };
      state.message = `${pup.name} is home.`;
    }
  }

  if (state.elapsedMs >= state.roundMs) {
    state.phase = "over";
    const home = state.pups.filter(pup => pup.home).length;
    state.score += home * POINTS.homeAtBell;
    state.message = home === 2 ? "The bell! Both pups are home." : home === 1 ? "The bell! One pup made it home." : "The bell! The pups are still out.";
  }
}

export function pupsHome(state: GameState): number {
  return state.pups.filter(pup => pup.home).length;
}
