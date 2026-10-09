/**
 * Draws one frame of the field on a canvas: the creek, Holt A, the Beaver Flats camera trap
 * and its view, Pebble and the pups. Daylight and weather come from the creek overview; a
 * stale creek is drawn in grey, frozen where it was last known. With reduced motion, the
 * water, rain and pups hold still and the trap's flash is a soft glow, not a bright burst.
 */
import { FIELD, inCone, type GameState, type Pup, type Vec } from "./engine.ts";

export interface Scene {
  daylight: "dawn" | "day" | "dusk" | "night";
  weather: "clear" | "rain" | "storm";
  /** The creek isn't live: draw it as last known. */
  stale: boolean;
  /** Milliseconds since the page started, for idle animation. */
  now: number;
  /** The visitor asked for reduced motion (`prefers-reduced-motion`). */
  reducedMotion: boolean;
}

const SKY: Record<Scene["daylight"], { grass: string; grassDeep: string; water: string; tint: string | null }> = {
  dawn: { grass: "#7da35a", grassDeep: "#5f8744", water: "#6e9fb8", tint: "rgba(255, 170, 120, 0.12)" },
  day: { grass: "#86b360", grassDeep: "#6a9a49", water: "#5b9cc0", tint: null },
  dusk: { grass: "#6f8f50", grassDeep: "#55733d", water: "#55819c", tint: "rgba(120, 70, 140, 0.18)" },
  night: { grass: "#3b5536", grassDeep: "#2e4529", water: "#2b4a63", tint: "rgba(10, 20, 50, 0.35)" }
};

function creek(ctx: CanvasRenderingContext2D, colors: (typeof SKY)[keyof typeof SKY], now: number): void {
  ctx.fillStyle = colors.grass;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Bank texture.
  ctx.fillStyle = colors.grassDeep;
  for (let i = 0; i < 70; i++) {
    const x = (i * 137) % FIELD.width;
    const y = (i * 89) % FIELD.height;
    ctx.fillRect(x, y, 3, 8);
  }
  // Lontra Creek runs along the top of the field.
  ctx.fillStyle = colors.water;
  ctx.beginPath();
  ctx.moveTo(0, 40);
  for (let x = 0; x <= FIELD.width; x += 40) ctx.lineTo(x, 92 + Math.sin(x / 120) * 16);
  ctx.lineTo(FIELD.width, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const x = ((now / 30 + i * 170) % (FIELD.width + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(x, 50 + (i % 3) * 12);
    ctx.lineTo(x + 26, 50 + (i % 3) * 12);
    ctx.stroke();
  }
}

function holt(ctx: CanvasRenderingContext2D): void {
  const { x, y, r } = FIELD.holt;
  ctx.fillStyle = "#6b4a2b";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, r + 14, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a321c";
  ctx.beginPath();
  ctx.ellipse(x + 14, y + 12, 26, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, "Holt A", { x, y: y + r + 26 });
}

function trap(ctx: CanvasRenderingContext2D, flashAge: number | null, reducedMotion: boolean): void {
  const { x, y } = FIELD.trap;
  const { direction, half, range } = FIELD.cone;
  const flashing = flashAge !== null && flashAge < 450;
  const glow = reducedMotion ? 0.3 : 0.75 * (1 - (flashAge ?? 0) / 450);
  ctx.fillStyle = flashing ? `rgba(255, 255, 230, ${glow})` : "rgba(255, 255, 255, 0.10)";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, direction - half, direction + half);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.stroke();
  // The camera on its post.
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(x - 4, y, 8, 46);
  ctx.fillStyle = "#2d3b2a";
  ctx.fillRect(x - 18, y - 16, 34, 26);
  ctx.fillStyle = flashing ? "#fffbe0" : "#9ad1ff";
  ctx.beginPath();
  ctx.arc(x - 14, y - 3, 5, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "Camera trap CT-2", { x: x - 40, y: y + 66 });
}

function otter(ctx: CanvasRenderingContext2D, at: Vec, size: number, body: string, facing: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(facing, 1);
  ctx.fillStyle = body;
  // Tail, body, head.
  ctx.beginPath();
  ctx.ellipse(-size * 1.3, size * 0.15, size * 0.7, size * 0.22, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.9, -size * 0.2, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.arc(size * 1.05, -size * 0.3, size * 0.08, 0, Math.PI * 2);
  ctx.arc(size * 1.3, -size * 0.12, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The field's labels, in streamotter.dev's Figtree; the system font stands in until it loads. */
export const LABEL_FONT = '600 14px "Figtree Variable", system-ui, sans-serif';

function label(ctx: CanvasRenderingContext2D, text: string, at: Vec, color = "rgba(255,255,255,0.92)"): void {
  ctx.font = LABEL_FONT;
  ctx.textAlign = "center";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.strokeText(text, at.x, at.y);
  ctx.fillStyle = color;
  ctx.fillText(text, at.x, at.y);
}

function pup(ctx: CanvasRenderingContext2D, value: Pup, now: number): void {
  if (value.home) {
    // Tucked in: just a name over the holt, one above the other.
    label(ctx, `${value.name} ✓`, { x: FIELD.holt.x, y: FIELD.holt.y - FIELD.holt.r - (value.name === "Sprout" ? 26 : 8) }, "#e9ffd9");
    return;
  }
  const wobble = Math.sin(now / 180 + (value.name === "Sprout" ? 0 : 2)) * 2;
  const at = { x: value.pos.x, y: value.pos.y + wobble };
  otter(ctx, at, 13, value.caught > 0 ? "#f0d36a" : "#a27247", value.target.x >= value.pos.x ? 1 : -1);
  label(ctx, value.name, { x: at.x, y: at.y - 20 }, inCone(value.pos) ? "#ffe08a" : undefined);
}

/** Draws one frame. */
export function draw(ctx: CanvasRenderingContext2D, state: GameState, scene: Scene): void {
  const colors = SKY[scene.daylight];
  ctx.save();
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (scene.stale) ctx.filter = "grayscale(1) brightness(0.85)";
  // Idle animation time: stopped while stale or for reduced motion.
  const now = scene.stale || scene.reducedMotion ? 0 : scene.now;
  creek(ctx, colors, now);
  holt(ctx);
  trap(ctx, state.flash?.age ?? null, scene.reducedMotion);
  for (const value of state.pups) pup(ctx, value, now);
  otter(ctx, state.pebble, 20, "#7b5130", 1);
  label(ctx, "Pebble (you)", { x: state.pebble.x, y: state.pebble.y - 26 });

  if (scene.weather !== "clear" && !scene.stale) {
    ctx.strokeStyle = scene.weather === "storm" ? "rgba(220,230,255,0.55)" : "rgba(220,230,255,0.35)";
    ctx.lineWidth = 1;
    const drops = scene.weather === "storm" ? 140 : 70;
    for (let i = 0; i < drops; i++) {
      const x = (i * 73 + now / 3) % FIELD.width;
      const y = (i * 151 + now / 1.5) % FIELD.height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 12);
      ctx.stroke();
    }
  }
  if (colors.tint !== null) {
    ctx.fillStyle = colors.tint;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  ctx.restore();
}
