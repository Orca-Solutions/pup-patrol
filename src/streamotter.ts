/**
 * The StreamOtter hooks, typed for the creek channels the game reads. This file and
 * creek.ts (`useLiveCreek`) are the only places the game touches StreamOtter.
 */
import { createStreamOtterHooks } from "streamotter/react";
import type { AppChannels } from "./generated/streamotter.generated.ts";

export const { useSubscription, useConnectionState } = createStreamOtterHooks<AppChannels>();
export { StreamOtterProvider } from "streamotter/react";
