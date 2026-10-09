/**
 * StreamOtter's horizontal lockup in the header, linking to streamotter.dev in a new tab. The
 * lockup is streamotter.dev's own (lontra-creek, apps/site/src/assets/brand/lockup-horizontal.svg),
 * inlined so its S, "Stream" and whiskers (`.bi`, `.bw`) follow the color scheme, as they do there.
 */
import lockup from "../assets/streamotter-lockup.svg?raw";

export const STREAMOTTER_URL = "https://streamotter.dev";

export function StreamOtterLink() {
  return (
    <a className="so-link" href={STREAMOTTER_URL} target="_blank" rel="noopener">
      {/* A static file from this repository, not user input. */}
      <span className="so-lockup" aria-hidden="true" dangerouslySetInnerHTML={{ __html: lockup }} />
      <span className="sr-only">StreamOtter (opens in a new tab)</span>
    </a>
  );
}
