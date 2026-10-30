import { z } from "zod";
import {
  EngagementStateSchema,
  ProbabilitySchema,
  SignalTypeSchema,
} from "./signals.js";

/**
 * Verbatim Interhuman v1 server-event envelopes. Shapes mirror the AsyncAPI
 * examples from /v1/stream/analyze.
 */

const EnvelopeBase = z.object({
  timestamp: z.string(),
  correlation_id: z.string(),
});

export const SignalDetectedEventSchema = EnvelopeBase.extend({
  type: z.literal("signal.detected"),
  data: z.object({
    signal_type: SignalTypeSchema,
    start: z.number(),
    end: z.number().optional(),
    probability: ProbabilitySchema.optional(),
    rationale: z.string().optional(),
  }),
});
export type SignalDetectedEvent = z.infer<typeof SignalDetectedEventSchema>;

export const EngagementUpdatedEventSchema = EnvelopeBase.extend({
  type: z.literal("engagement.updated"),
  data: z.object({
    state: EngagementStateSchema,
    start: z.number(),
    end: z.number().optional(),
  }),
});
export type EngagementUpdatedEvent = z.infer<
  typeof EngagementUpdatedEventSchema
>;

export const SessionReadyEventSchema = EnvelopeBase.extend({
  type: z.literal("session.ready"),
  data: z.unknown().optional(),
});

export const InterhumanErrorEventSchema = EnvelopeBase.extend({
  type: z.literal("error"),
  data: z.object({
    code: z.string(),
    message: z.string(),
    link: z.string().optional(),
    segment: z.number().int().optional(),
  }),
});
export type InterhumanErrorEvent = z.infer<typeof InterhumanErrorEventSchema>;

export const InterhumanEventSchema = z.discriminatedUnion("type", [
  SignalDetectedEventSchema,
  EngagementUpdatedEventSchema,
  SessionReadyEventSchema,
  InterhumanErrorEventSchema,
]);
export type InterhumanEvent = z.infer<typeof InterhumanEventSchema>;

/** Tolerant parser: returns the typed event, or null for unknown/invalid shapes. */
export function parseInterhumanEvent(raw: unknown): InterhumanEvent | null {
  const result = InterhumanEventSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Session config sent to Interhuman after the upstream socket opens. */
export const StreamConfigSchema = z.object({
  include: z
    .array(
      z.enum([
        "conversation_quality_overall",
        "conversation_quality_timeline",
      ]),
    )
    .optional(),
  goal_dimensions: z
    .array(
      z.enum(["clarity", "authority", "energy", "rapport", "learning"]),
    )
    .optional(),
});
export type StreamConfig = z.infer<typeof StreamConfigSchema>;
