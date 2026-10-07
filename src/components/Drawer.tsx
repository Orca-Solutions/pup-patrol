/**
 * Under the hood: what StreamOtter is doing for the round. A round mounts three
 * subscriptions and the end screen unmounts them, so the list empties between rounds.
 */
import { useEffect, useState } from "react";
import { useHood } from "../hood.ts";

export function Drawer(props: { open: boolean; onClose(): void; mode: string }) {
  const hood = useHood();
  // The render count changes without notifying; refresh it while open.
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!props.open) return;
    const timer = setInterval(() => refresh(n => n + 1), 500);
    return () => clearInterval(timer);
  }, [props.open]);
  if (!props.open) return null;
  return (
    <aside id="drawer" className="drawer" aria-label="Under the hood" data-testid="drawer">
      <div className="drawer-head">
        <h2>Under the hood</h2>
        <button type="button" className="link-button" onClick={props.onClose}>Close</button>
      </div>
      <p className="drawer-note">
        {props.mode === "recorded"
          ? "The demo backend can't be reached, so rounds replay a recording of the creek. Nothing here is live."
          : "Three useSubscription hooks and useConnectionState from streamotter/react, against Lontra Creek's gateway."}
      </p>
      <dl className="drawer-facts">
        <dt>Connection</dt>
        <dd data-testid="hood-connection">{hood.connection ?? "no round mounted"}</dd>
        <dt>Mounted subscriptions</dt>
        <dd data-testid="hood-count">{hood.subscriptions.length}</dd>
        <dt>Round renders</dt>
        <dd>{hood.roundRenders}</dd>
      </dl>
      {hood.subscriptions.length > 0 ? (
        <table className="drawer-table">
          <thead><tr><th>Channel</th><th>State</th><th>Revision</th><th>Updates</th></tr></thead>
          <tbody>
            {hood.subscriptions.map(sub => (
              <tr key={sub.channel} data-testid={`hood-${sub.channel}`}>
                <td><code>{sub.channel}</code><br /><small>{sub.params}</small></td>
                <td className={`state state-${sub.state}`}>{sub.state}{sub.error ? <><br /><small>{sub.error}</small></> : null}</td>
                <td><code>{sub.revision ?? "–"}</code></td>
                <td>{sub.updates}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="drawer-note">No subscriptions mounted: the round's components are gone, and a hook's subscription ends when its component unmounts.</p>
      )}
      <p className="drawer-note">
        Each round renders several times a second and builds new params objects every time; the hooks compare params by
        value, so the subscriptions above stay the same ones all round.
      </p>
    </aside>
  );
}
