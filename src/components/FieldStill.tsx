/**
 * A still of the field across the top of the start card, so the first screen shows the game
 * and not only text: Pebble between the holt and the camera trap, one pup wandering toward the
 * trap's view. Decoration only (hidden from assistive tech); the card's text says the same.
 */
import { useEffect, useRef } from "react";
import { createGame, FIELD } from "../game/engine.ts";
import { draw, LABEL_FONT } from "../game/render.ts";

/** The band of the field shown: the creek's edge, the holt and the trap. */
const CROP = { top: 70, height: 360 } as const;

export function FieldStill() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (element == null || ctx == null) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    element.width = FIELD.width * ratio;
    element.height = CROP.height * ratio;
    const state = createGame({ pupsAt: "out" });
    state.pebble = { x: 400, y: 300 };
    state.pups[0]!.pos = { x: 520, y: 236 };
    state.pups[0]!.target = { x: 560, y: 236 };
    state.pups[1]!.pos = { x: 250, y: 392 };
    state.pups[1]!.target = { x: 210, y: 392 };
    let cancelled = false;
    const paint = (): void => {
      if (cancelled) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, -CROP.top * ratio);
      draw(ctx, state, { daylight: "day", weather: "clear", stale: false, now: 0, reducedMotion: true });
    };
    // Paint now, then again once Figtree is in, so the labels end in the page's type.
    paint();
    document.fonts.load(LABEL_FONT).then(paint, () => {});
    return () => { cancelled = true; };
  }, []);

  return <canvas ref={canvas} className="field-still" aria-hidden="true" data-testid="field-still" />;
}
