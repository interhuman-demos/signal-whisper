import { z } from "zod";
import { ProbabilitySchema, SignalTypeSchema } from "./signals.js";

/**
 * Events sent from the stream-proxy to the browser over the watch WebSocket.
 * All proxy-originated events use the "watch." prefix.
 */

const WatchEnvelopeBase = z.object({
  sessionId: z.string(),
});

export const WatchConnectionEstablishedSchema = WatchEnvelopeBase.extend({
  type: z.literal("watch.connection.established"),
});
export type WatchConnectionEstablished = z.infer<
  typeof WatchConnectionEstablishedSchema
>;

export const WatchWindowStatusSchema = WatchEnvelopeBase.extend({
  type: z.literal("watch.window.status"),
  index: z.number().int().nonnegative(),
  status: z.enum(["capturing", "analyzing", "complete", "failed"]),
});
export type WatchWindowStatus = z.infer<typeof WatchWindowStatusSchema>;

/** Normalized signal event forwarded from Interhuman to the browser. */
export const WatchSignalDetectedSchema = WatchEnvelopeBase.extend({
  type: z.literal("watch.signal.detected"),
  index: z.number().int().nonnegative(),
  signal: z.object({
    type: SignalTypeSchema,
    start: z.number(),
    end: z.number().optional(),
    probability: ProbabilitySchema.optional(),
    rationale: z.string().optional(),
  }),
});
export type WatchSignalDetected = z.infer<typeof WatchSignalDetectedSchema>;

export const WatchErrorSchema = WatchEnvelopeBase.extend({
  type: z.literal("watch.error"),
  code: z.string(),
  message: z.string(),
});
export type WatchError = z.infer<typeof WatchErrorSchema>;

export const WatchConnectionClosedSchema = WatchEnvelopeBase.extend({
  type: z.literal("watch.connection.closed"),
  reason: z.string().optional(),
});
export type WatchConnectionClosed = z.infer<typeof WatchConnectionClosedSchema>;

export const WatchEventSchema = z.discriminatedUnion("type", [
  WatchConnectionEstablishedSchema,
  WatchWindowStatusSchema,
  WatchSignalDetectedSchema,
  WatchErrorSchema,
  WatchConnectionClosedSchema,
]);
export type WatchEvent = z.infer<typeof WatchEventSchema>;

/**
 * The shared Interhuman stream proxy emits `demo.*`-prefixed events with an
 * identical payload shape (see stream architecture doc). We normalize those to
 * our `watch.*` events so the rest of the app has a single event vocabulary.
 * `sessionId` is optional on demo events, so we default it when missing.
 */
const DemoSignalSchema = z.object({
  type: z.literal("demo.signal.detected"),
  sessionId: z.string().optional(),
  index: z.number().int().nonnegative(),
  signal: z.object({
    type: SignalTypeSchema,
    start: z.number(),
    end: z.number().optional(),
    probability: ProbabilitySchema.optional(),
    rationale: z.string().optional(),
  }),
});

const DemoConnectionClosedSchema = z.object({
  type: z.literal("demo.connection.closed"),
  sessionId: z.string().optional(),
  reason: z.string().optional(),
});

export function parseWatchEvent(raw: unknown): WatchEvent | null {
  const result = WatchEventSchema.safeParse(raw);
  if (result.success) return result.data;

  // Fall back to the demo proxy's `demo.*` events and normalize them.
  const demoSignal = DemoSignalSchema.safeParse(raw);
  if (demoSignal.success) {
    return {
      type: "watch.signal.detected",
      sessionId: demoSignal.data.sessionId ?? "",
      index: demoSignal.data.index,
      signal: demoSignal.data.signal,
    };
  }

  const demoClosed = DemoConnectionClosedSchema.safeParse(raw);
  if (demoClosed.success) {
    return {
      type: "watch.connection.closed",
      sessionId: demoClosed.data.sessionId ?? "",
      reason: demoClosed.data.reason,
    };
  }

  return null;
}

/** Body sent to POST /api/watch/tts */
export const WatchTtsRequestSchema = z.object({
  text: z.string().min(1).max(200),
});
export type WatchTtsRequest = z.infer<typeof WatchTtsRequestSchema>;

/** Rolling per-session memory the coach can use to escalate / call back. */
export const WatchCoachHistorySchema = z.object({
  /** Total number of signals detected this session, all types. */
  totalCount: z.number().int().nonnegative(),
  /** Count of detections per signal type, e.g. { stress: 3, hesitation: 1 }. */
  countsByType: z.record(SignalTypeSchema, z.number().int().nonnegative()),
  /** How many times in a row the current signal type has fired most recently. */
  currentStreak: z.number().int().nonnegative().optional(),
  /** A few of the most recent detections, oldest → newest. */
  recent: z
    .array(
      z.object({
        type: SignalTypeSchema,
        rationale: z.string().max(500).optional(),
        secondsAgo: z.number().nonnegative().optional(),
      }),
    )
    .max(8)
    .optional(),
  /** The last few phrases already whispered, so the coach avoids repeating itself. */
  recentPhrases: z.array(z.string().max(220)).max(6).optional(),
});
export type WatchCoachHistory = z.infer<typeof WatchCoachHistorySchema>;

/** Body sent to POST /api/watch/coach — turns a detection into a spoken nudge. */
export const WatchCoachRequestSchema = z.object({
  signalType: SignalTypeSchema,
  rationale: z.string().max(1000).optional(),
  probability: ProbabilitySchema.optional(),
  /** The user's first name, spoken at the start of the nudge when present. */
  name: z.string().max(40).optional(),
  /** Rolling per-session memory of what's been detected so far. */
  history: WatchCoachHistorySchema.optional(),
});
export type WatchCoachRequest = z.infer<typeof WatchCoachRequestSchema>;

/** Response from POST /api/watch/coach. */
export const WatchCoachResponseSchema = z.object({
  /** Short coaching phrase to be whispered, e.g. "Ease the shoulders, take a pass." */
  phrase: z.string().min(1).max(200),
});
export type WatchCoachResponse = z.infer<typeof WatchCoachResponseSchema>;
