/**
 * A still of the field above the start card, so the first screen shows the game and not only
 * text: the pups in the holt and Pebble at her start, in the given daylight and weather. No
 * animation loop. While the creek is still being found it shows the empty field. Decoration only (hidden
 * from assistive tech); the card's text says the same.
 */
import { useEffect, useRef } from "react";
import { createGame, FIELD } from "../game/engine.ts";
import { draw, LABEL_FONT, type Scene } from "../game/render.ts";

export function FieldStill(props: { daylight: Scene["daylight"]; weather: Scene["weather"]; empty: boolean }) {
  const { daylight, weather, empty } = props;
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (element == null || ctx == null) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    element.width = FIELD.width * ratio;
    element.height = FIELD.height * ratio;
    const state = empty ? null : createGame({ pupsAt: "in-den" });
    let cancelled = false;
    const paint = (): void => {
      if (cancelled) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(ctx, state, { daylight, weather, stale: false, now: 0, reducedMotion: true });
    };
    // Paint now, then again once Figtree is in, so the labels end in the page's type.
    paint();
    document.fonts.load(LABEL_FONT).then(paint, () => {});
    return () => { cancelled = true; };
  }, [daylight, weather, empty]);

  return (
    <div className="field still" aria-hidden="true" data-testid="field-still">
      <canvas ref={canvas} className="field-still" />
    </div>
  );
}
