"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WatchSignalDetected } from "@repo/shared";
import type { OrbState } from "@/components/ui/voice-orb";
import {
  DEFAULT_SPEAK_MS,
  DEMO_TIMELINE,
  type TimelineEvent,
} from "../timeline";

/** A signal that has already fired on the timeline, newest tracked by id. */
export interface DemoSignalEntry {
  id: number;
  signal: WatchSignalDetected["signal"];
  receivedAt: number;
}

export interface UseDemoPlayerResult {
  playing: boolean;
  finished: boolean;
  orbState: OrbState;
  signals: DemoSignalEntry[];
  /** Start (or restart) the scripted timeline from t=0. */
  play(): void;
  /** Clear everything back to the initial idle state. */
  reset(): void;
}

/**
 * Drives the scripted demo: walks `DEMO_TIMELINE`, appending each signal to the
 * feed at its `atMs`, and flipping the orb into its "speaking" state for events
 * that carry a `speak` line. The orb idles between beats and briefly "listens"
 * in the moments leading up to speaking, so the recording feels alive.
 */
export function useDemoPlayer(
  timeline: TimelineEvent[] = DEMO_TIMELINE,
): UseDemoPlayerResult {
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [signals, setSignals] = useState<DemoSignalEntry[]>([]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const idRef = useRef(0);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setPlaying(false);
    setFinished(false);
    setOrbState("idle");
    setSignals([]);
  }, [clearTimers]);

  const play = useCallback(() => {
    clearTimers();
    setSignals([]);
    setFinished(false);
    setPlaying(true);
    setOrbState("idle");

    const sorted = [...timeline].sort((a, b) => a.atMs - b.atMs);

    for (const event of sorted) {
      const speakMs = event.speakMs ?? DEFAULT_SPEAK_MS;

      // Append the signal to the feed at its scheduled time (skip orb-only events).
      if (event.signal) {
        const signalType = event.signal;
        timersRef.current.push(
          setTimeout(() => {
            const id = ++idRef.current;
            setSignals((prev) => [
              ...prev,
              {
                id,
                receivedAt: Date.now(),
                signal: {
                  type: signalType,
                  probability: event.probability,
                  rationale: event.rationale,
                  start: event.atMs / 1000,
                },
              },
            ]);
          }, event.atMs),
        );
      }

      if (event.speak) {
        // Lead-in: orb "listens" shortly before it speaks.
        const listenLead = 600;
        timersRef.current.push(
          setTimeout(
            () => setOrbState("listening"),
            Math.max(0, event.atMs - listenLead),
          ),
        );
        timersRef.current.push(
          setTimeout(() => setOrbState("speaking"), event.atMs),
        );
        timersRef.current.push(
          setTimeout(() => setOrbState("idle"), event.atMs + speakMs),
        );
      }
    }

    // Mark finished a beat after the last event resolves.
    const last = sorted[sorted.length - 1];
    if (last) {
      const tail = (last.speak ? (last.speakMs ?? DEFAULT_SPEAK_MS) : 0) + 1500;
      timersRef.current.push(
        setTimeout(() => {
          setPlaying(false);
          setFinished(true);
          setOrbState("idle");
        }, last.atMs + tail),
      );
    }
  }, [clearTimers, timeline]);

  useEffect(() => clearTimers, [clearTimers]);

  return { playing, finished, orbState, signals, play, reset };
}
