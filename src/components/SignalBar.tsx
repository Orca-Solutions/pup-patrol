/** The receiver: the StreamOtter client's connection state as signal bars. */
import { useConnectionState } from "../streamotter.ts";

const BARS: Record<string, { bars: number; label: string }> = {
  connected: { bars: 4, label: "Receiving" },
  connecting: { bars: 1, label: "Connecting" },
  reconnecting: { bars: 1, label: "Reconnecting" },
  "auth-required": { bars: 0, label: "Signing in" },
  idle: { bars: 0, label: "Idle" },
  closed: { bars: 0, label: "Off" }
};

export function SignalBar() {
  const state = useConnectionState();
  const { bars, label } = BARS[state] ?? { bars: 0, label: state };
  return (
    <span className={`signal signal-${state}`} data-testid="signal" data-state={state} title={`Connection: ${state}`}>
      <span className="signal-bars" aria-hidden="true">
        {[1, 2, 3, 4].map(n => <span key={n} className={n <= bars ? "on" : ""} style={{ height: `${n * 4 + 2}px` }} />)}
      </span>
      <span>{label}</span>
    </span>
  );
}
