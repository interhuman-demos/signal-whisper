import { WINDOW_SECONDS } from "./constants.js";

/**
 * Map a session-cumulative start time (seconds) to the 0-based window index.
 * Times in v1 server events are absolute-cumulative across all segments sent
 * in the connection.
 */
export function windowIndexForStart(startS: number): number {
  return Math.floor(startS / WINDOW_SECONDS);
}

/** Start/end bounds (ms) for a given window index. */
export function windowBounds(index: number): { startMs: number; endMs: number } {
  return {
    startMs: index * WINDOW_SECONDS * 1000,
    endMs: (index + 1) * WINDOW_SECONDS * 1000,
  };
}
