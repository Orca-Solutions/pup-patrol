/**
 * The StreamOtter lockup in the header: the brand mark and the name, linking to streamotter.dev
 * in a new tab. The mark is streamotter.dev's own (lontra-creek, apps/site/src/assets/brand/mark.svg),
 * inlined so its S and whiskers (`.bi`, `.bw`) follow the color scheme, as they do there.
 */
import mark from "../assets/streamotter-mark.svg?raw";

export const STREAMOTTER_URL = "https://streamotter.dev";

export function StreamOtterLink() {
  return (
    <a className="so-link" href={STREAMOTTER_URL} target="_blank" rel="noopener">
      {/* A static file from this repository, not user input. */}
      <span className="so-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: mark }} />
      <span className="so-name">StreamOtter</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
