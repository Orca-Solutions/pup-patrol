import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createGame, FIELD, fieldTick, hash, inCone, inHolt, MAX_STEP_MS, pause, POINTS, pupsHome, resync, setPups, step, trapFired,
  type GameState, type Input, type Vec
} from "../src/game/engine.ts";

const still: Input = { direction: { x: 0, y: 0 }, toward: null };
const frame = { frame: "CT-2 00042", species: "river otter", count: 1 };

/** Runs the animation for `ms` in 16 ms frames. */
function animate(state: GameState, ms: number, input: Input = still): void {
  for (let t = 0; t < ms; t += 16) step(state, 16, input);
}

/** Puts a pup outside the holt at a point, with nothing pulling it elsewhere. */
function placePup(state: GameState, index: number, at: Vec): void {
  const pup = state.pups[index]!;
  pup.home = false;
  pup.settle = 0;
  pup.curious = 0;
  pup.pos = { ...at };
  pup.target = { ...at };
}

const inView: Vec = { x: FIELD.trap.x - 200, y: FIELD.trap.y };
const outOfView: Vec = { x: FIELD.trap.x - 200, y: FIELD.height - 30 };

describe("the field", () => {
  test("the camera sees a wedge toward the holt, and nothing behind it", () => {
    assert.ok(inCone(inView));
    assert.ok(!inCone(outOfView));
    assert.ok(!inCone({ x: FIELD.trap.x + 40, y: FIELD.trap.y }));
    assert.ok(!inCone({ x: FIELD.trap.x - FIELD.cone.range - 10, y: FIELD.trap.y }));
    assert.ok(!inCone(FIELD.holt), "the holt is out of the camera's view");
  });

  test("hash is deterministic and in [0, 1)", () => {
    assert.equal(hash("1000000000007:Sprout:x"), hash("1000000000007:Sprout:x"));
    assert.notEqual(hash("a"), hash("b"));
    for (const text of ["", "x", "1000000000000", "🦦"]) {
      const value = hash(text);
      assert.ok(value >= 0 && value < 1, text);
    }
  });
});

describe("a new round", () => {
  test("starts with the pups where the den snapshot says", () => {
    const home = createGame({ pupsAt: "in-den" });
    assert.equal(pupsHome(home), 2);
    assert.ok(home.pups.every(pup => inHolt(pup.pos)));
    const out = createGame({ pupsAt: "out" });
    assert.equal(pupsHome(out), 0);
    assert.ok(out.pups.every(pup => !inHolt(pup.pos)));
    assert.equal(out.phase, "playing");
    assert.equal(out.score, 0);
  });
});

describe("field ticks", () => {
  test("while the pups are out, they leave the holt and wander toward the trap", () => {
    const state = createGame({ pupsAt: "in-den" });
    state.pebble = { x: 40, y: 80 }; // out of the way
    setPups(state, "out");
    fieldTick(state, "r1");
    assert.equal(pupsHome(state), 0, "both left the holt");
    animate(state, 2_000);
    const start = state.pups.map(pup => pup.pos.x);
    for (let i = 2; i < 6; i++) {
      fieldTick(state, `r${i}`);
      animate(state, 2_000);
    }
    state.pups.forEach((pup, index) => assert.ok(pup.pos.x > start[index]! + 150, `${pup.name} moved downstream`));
    assert.ok(state.pups.every(pup => pup.pos.x <= FIELD.trap.x - 40));
  });

  test("the same updates move the pups the same way", () => {
    const run = (): Vec[] => {
      const state = createGame({ pupsAt: "out" });
      state.pebble = { x: 40, y: 80 };
      for (let i = 0; i < 5; i++) {
        fieldTick(state, `100000000000${i}`);
        animate(state, 2_000);
      }
      return state.pups.map(pup => pup.pos);
    };
    assert.deepEqual(run(), run());
  });

  test("when the pups are called home, they head for the holt on their own", () => {
    const state = createGame({ pupsAt: "out" });
    placePup(state, 0, { x: 500, y: 330 });
    placePup(state, 1, { x: 420, y: 420 });
    setPups(state, "in-den");
    for (let i = 0; i < 8; i++) {
      fieldTick(state, `home${i}`);
      animate(state, 2_000);
    }
    assert.equal(pupsHome(state), 2);
  });

  test("each pup at home scores on every tick", () => {
    const state = createGame({ pupsAt: "in-den" });
    fieldTick(state, "a");
    fieldTick(state, "b");
    assert.equal(state.score, 2 * 2 * POINTS.homePerTick);
  });

  test("a den update takes effect at the next tick, not before", () => {
    const state = createGame({ pupsAt: "in-den" });
    setPups(state, "out");
    assert.equal(pupsHome(state), 2);
    fieldTick(state, "x");
    assert.equal(pupsHome(state), 0);
  });
});

describe("the camera trap", () => {
  test("costs points for each pup in view outside the holt", () => {
    const state = createGame({ pupsAt: "out" });
    placePup(state, 0, inView);
    placePup(state, 1, outOfView);
    trapFired(state, frame);
    assert.equal(state.caught, 1);
    assert.equal(state.score, POINTS.caught);
    assert.deepEqual(state.flash?.caught, ["Sprout"]);
    assert.match(state.message, /Sprout caught on camera \(CT-2 00042\)/);
  });

  test("a frame taken while the round is paused doesn't count", () => {
    const state = createGame({ pupsAt: "out" });
    placePup(state, 0, inView);
    pause(state);
    trapFired(state, frame);
    assert.equal(state.score, 0);
    assert.equal(state.caught, 0);
    assert.equal(state.flash, null);
  });

  test("a frame with no pups in it costs nothing", () => {
    const state = createGame({ pupsAt: "in-den" });
    trapFired(state, { frame: "CT-2 00043", species: "American beaver", count: 2 });
    assert.equal(state.score, 0);
    assert.match(state.message, /2 × American beaver/);
  });
});

describe("Pebble", () => {
  test("moves with the keyboard and stays on the field", () => {
    const state = createGame({ pupsAt: "in-den" });
    const start = { ...state.pebble };
    animate(state, 500, { direction: { x: 1, y: 0 }, toward: null });
    assert.ok(state.pebble.x > start.x + 100);
    animate(state, 20_000, { direction: { x: 1, y: 1 }, toward: null });
    assert.ok(state.pebble.x <= FIELD.width && state.pebble.y <= FIELD.height);
  });

  test("moves toward a pointer and stops there", () => {
    const state = createGame({ pupsAt: "in-den" });
    const target = { x: 600, y: 400 };
    animate(state, 4_000, { direction: { x: 0, y: 0 }, toward: target });
    assert.ok(Math.hypot(state.pebble.x - target.x, state.pebble.y - target.y) < 10);
  });

  test("herds a pup away from her, and the nudge outlasts the tween", () => {
    const state = createGame({ pupsAt: "out" });
    placePup(state, 0, { x: 400, y: 300 });
    state.pebble = { x: 440, y: 300 };
    animate(state, 300);
    const pup = state.pups[0]!;
    assert.ok(pup.pos.x < 395, "pushed left, away from Pebble");
    state.pebble = { x: 900, y: 500 };
    const pushed = pup.pos.x;
    animate(state, 1_000);
    assert.ok(Math.abs(pup.pos.x - pushed) < 1, "it stays where it was pushed");
  });

  test("a pup herded into the holt is home and settles before wandering again", () => {
    const state = createGame({ pupsAt: "out" });
    placePup(state, 0, { x: FIELD.holt.x + FIELD.holt.r + 4, y: FIELD.holt.y });
    placePup(state, 1, outOfView);
    state.pebble = { x: FIELD.holt.x + FIELD.holt.r + 40, y: FIELD.holt.y };
    animate(state, 800);
    assert.equal(state.pups[0]!.home, true);
    fieldTick(state, "s1");
    fieldTick(state, "s2");
    assert.equal(state.pups[0]!.home, true, "settled for two ticks");
    fieldTick(state, "s3");
    assert.equal(state.pups[0]!.home, false, "then out again, while the pups are out");
  });

  test("camping at the holt mouth doesn't keep a pup home: a pup that just came out won't go back in", () => {
    const state = createGame({ pupsAt: "in-den" });
    state.pebble = { x: FIELD.holt.x + FIELD.holt.r + 60, y: FIELD.holt.y };
    setPups(state, "out");
    fieldTick(state, "c1");
    assert.equal(pupsHome(state), 0, "both came out");
    // Pebble stays just beyond Sprout, on the far side from the holt, pushing her straight back in.
    const sprout = state.pups[0]!;
    const camp = (ms: number): void => {
      for (let t = 0; t < ms; t += 16) {
        const off = Math.hypot(sprout.pos.x - FIELD.holt.x, sprout.pos.y - FIELD.holt.y);
        const behind = { x: sprout.pos.x + ((sprout.pos.x - FIELD.holt.x) / off) * 30, y: sprout.pos.y + ((sprout.pos.y - FIELD.holt.y) / off) * 30 };
        step(state, 16, { direction: { x: 0, y: 0 }, toward: behind });
      }
    };
    camp(2_000);
    assert.equal(sprout.home, false, "her nudges couldn't send Sprout back in");
    assert.ok(!inHolt(sprout.pos), "Sprout kept clear of the holt");
    fieldTick(state, "c2");
    camp(2_000);
    assert.equal(sprout.home, false, "still curious on the next tick");
    fieldTick(state, "c3");
    camp(2_000);
    assert.equal(sprout.home, true, "two ticks after coming out, she can be herded home");
  });

  test("a pup that comes out dashes well clear of the holt mouth", () => {
    const state = createGame({ pupsAt: "in-den" });
    state.pebble = { x: 40, y: 80 }; // out of the way
    setPups(state, "out");
    fieldTick(state, "d1");
    for (const pup of state.pups) assert.ok(pup.target.x - (FIELD.holt.x + FIELD.holt.r) >= 90, `${pup.name} dashes out`);
  });

  test("a pause and a fresh snapshot don't reopen the holt mouth: pups placed out are curious too", () => {
    const state = createGame({ pupsAt: "out" });
    assert.ok(state.pups.every(pup => pup.curious > 0), "a round that starts with the pups out");
    pause(state);
    resync(state, "out");
    assert.ok(state.pups.every(pup => pup.curious > 0), "and after a resync");
    // Pebble right beyond Sprout, pushing her toward the holt.
    const sprout = state.pups[0]!;
    for (let t = 0; t < 2_000; t += 16) {
      const off = Math.hypot(sprout.pos.x - FIELD.holt.x, sprout.pos.y - FIELD.holt.y);
      const behind = { x: sprout.pos.x + ((sprout.pos.x - FIELD.holt.x) / off) * 30, y: sprout.pos.y + ((sprout.pos.y - FIELD.holt.y) / off) * 30 };
      step(state, 16, { direction: { x: 0, y: 0 }, toward: behind });
    }
    assert.equal(sprout.home, false);
  });

  test("a curious pup still heads home when its mother calls", () => {
    const state = createGame({ pupsAt: "in-den" });
    state.pebble = { x: 40, y: 80 }; // out of the way
    setPups(state, "out");
    fieldTick(state, "m1");
    setPups(state, "in-den");
    for (let i = 2; i < 8; i++) {
      fieldTick(state, `m${i}`);
      animate(state, 2_000);
    }
    assert.equal(pupsHome(state), 2);
  });
});

describe("stale and resync", () => {
  test("a paused round stands still: no clock, no movement, no ticks", () => {
    const state = createGame({ pupsAt: "out" });
    placePup(state, 0, { x: 400, y: 300 });
    state.pups[0]!.target = { x: 600, y: 300 };
    pause(state);
    const before = JSON.stringify({ pups: state.pups, pebble: state.pebble, elapsed: state.elapsedMs, ticks: state.ticks, score: state.score });
    animate(state, 3_000, { direction: { x: 1, y: 0 }, toward: null });
    fieldTick(state, "while-paused");
    assert.equal(JSON.stringify({ pups: state.pups, pebble: state.pebble, elapsed: state.elapsedMs, ticks: state.ticks, score: state.score }), before);
  });

  test("the trap's flash freezes mid-flash while paused", () => {
    const state = createGame({ pupsAt: "in-den" });
    trapFired(state, frame);
    step(state, 100, still);
    pause(state);
    animate(state, 2_000);
    assert.equal(state.flash?.age, 100);
  });

  test("the fresh snapshot resets the pups, keeps Pebble, and resumes", () => {
    const state = createGame({ pupsAt: "out" });
    placePup(state, 0, inView);
    placePup(state, 1, { x: 700, y: 450 });
    state.pebble = { x: 300, y: 200 };
    pause(state);
    resync(state, "in-den");
    assert.equal(state.phase, "playing");
    assert.equal(pupsHome(state), 2);
    assert.equal(state.pupsAt, "in-den");
    assert.deepEqual(state.pebble, { x: 300, y: 200 });
    resync(state, "out");
    assert.ok(state.pups.every(pup => !pup.home && !inCone(pup.pos)), "out, but at the holt mouth");
  });
});

describe("the bell", () => {
  test("ends the round after its length and scores the pups at home", () => {
    const state = createGame({ pupsAt: "in-den", roundMs: 10_000 });
    animate(state, 9_000);
    assert.equal(state.phase, "playing");
    animate(state, 1_100);
    assert.equal(state.phase, "over");
    assert.equal(state.score, 2 * POINTS.homeAtBell);
    animate(state, 1_000);
    trapFired(state, frame);
    assert.equal(state.score, 2 * POINTS.homeAtBell, "nothing scores after the bell");
  });

  test("a long frame (a stalled or hidden tab) advances the clock by at most MAX_STEP_MS", () => {
    const state = createGame({ pupsAt: "in-den", roundMs: 10_000 });
    step(state, 40_000, still);
    assert.equal(state.elapsedMs, MAX_STEP_MS);
    assert.equal(state.phase, "playing");
    step(state, -5, still);
    assert.equal(state.elapsedMs, MAX_STEP_MS, "a clock that runs backwards adds nothing");
  });

  test("time spent paused doesn't count", () => {
    const state = createGame({ pupsAt: "in-den", roundMs: 10_000 });
    animate(state, 5_000);
    pause(state);
    animate(state, 30_000);
    assert.equal(state.phase, "paused");
    resync(state, "in-den");
    animate(state, 4_000);
    assert.equal(state.phase, "playing");
  });
});
