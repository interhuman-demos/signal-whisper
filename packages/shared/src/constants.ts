/** Fixed window size used by both the browser recorder and the proxy. */
export const WINDOW_MS = 5_000;
export const WINDOW_SECONDS = WINDOW_MS / 1000;

/** Minimum segment duration the Interhuman API will accept. */
export const MIN_SEGMENT_DURATION_S = 3;

/** Byte guards for each binary window frame. */
export const MIN_SEGMENT_BYTES = 1024;
export const MAX_SEGMENT_BYTES = 32 * 1024 * 1024;
