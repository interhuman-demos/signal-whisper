import type { Probability, SignalType } from "@repo/shared";

export interface TimelineEvent {
  /** Offset from demo start, in milliseconds. */
  atMs: number;
  /** Which social signal lights up in the feed. Omit for orb-only moments. */
  signal?: SignalType;
  probability?: Probability;
  rationale?: string;
  /**
   * Line the orb "says" (drives the speaking animation, no transcript shown).
   * Can exist with or without a signal.
   */
  speak?: string;
  /** How long the orb stays in its speaking state, in ms. Defaults to 2600. */
  speakMs?: number;
}

export const DEFAULT_SPEAK_MS = 2600;

export const DEMO_TIMELINE: TimelineEvent[] = [
  // 00:00–00:04  Orb intro
  {
    atMs: 0,
    speak:
      "Okay, got it Vincent — I will tell you when I receive stress and confidence.",
    speakMs: 4000,
  },

  // 00:12  Stress detected
  {
    atMs: 12_000,
    signal: "stress",
    probability: "medium",
  },

  // 00:17  Hesitation
  {
    atMs: 17_000,
    signal: "hesitation",
    probability: "medium",
  },

  // 00:23  Stress + hesitation
  {
    atMs: 23_000,
    signal: "stress",
    probability: "high",
  },
  {
    atMs: 23_200,
    signal: "hesitation",
    probability: "medium",
  },

  // 00:24–00:28  Orb whispers
  {
    atMs: 22_000,
    speak:
      "Vincent, careful — covering your face is giving your nerves a little spotlight.",
    speakMs: 4000,
  },

  // 00:33  Confidence (post-suggestion, more confident now)
  {
    atMs: 33_000,
    signal: "confidence",
    probability: "medium",
  },
  {
    atMs: 31_200,
    signal: "stress",
    probability: "low",
  },

  // 00:36–00:40  Orb whispers
  {
    atMs: 33_000,
    speak:
      "Vincent, third round of face rubs — want a stress bingo card for your next move?",
    speakMs: 4000,
  },

  // 00:42  Confidence
  {
    atMs: 42_000,
    signal: "confidence",
    probability: "medium",
  },

  // 00:47  Confidence
  {
    atMs: 47_000,
    signal: "confidence",
    probability: "high",
  },
];
