"use client";

import { useCallback, useRef } from "react";
import type {
  SignalType,
  WatchCoachHistory,
  WatchCoachResponse,
  WatchSignalDetected,
} from "@repo/shared";

/** Per-signal cooldown so the same signal isn't *spoken* more than once every N seconds. */
const COOLDOWN_MS = 4_000;
/** How many recent detections / phrases to keep as memory for the coach. */
const RECENT_LIMIT = 8;
const RECENT_PHRASES_LIMIT = 6;

type DetectedSignal = WatchSignalDetected["signal"];

interface MemoryEntry {
  type: SignalType;
  rationale?: string;
  probability?: DetectedSignal["probability"];
  at: number;
}

/**
 * Sequential whisper-queue: receives signal detections, throttles per-type,
 * turns each into a short spoken coaching nudge via /api/watch/coach, then
 * plays the fetched ElevenLabs audio without overlapping. If TTS returns 204
 * (key absent), the alert is shown visually but no audio plays.
 *
 * Memory records EVERY detection (even ones skipped by the spoken cooldown),
 * so escalation reflects the true frequency. The cooldown only gates how often
 * we actually *speak*, not what we remember.
 */
export function useWhisperQueue(name?: string) {
  const lastSpokenRef = useRef<Map<SignalType, number>>(new Map());
  const playingRef = useRef(false);
  const queueRef = useRef<MemoryEntry[]>([]);
  // Plain phrases (e.g. the intro) to speak verbatim, jumped to the front.
  const phraseQueueRef = useRef<string[]>([]);
  const nameRef = useRef(name);
  nameRef.current = name;

  // Currently-playing audio + a flag that aborts the drain loop on cancel.
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const cancelledRef = useRef(false);

  // Session memory — records every detection, spoken or not.
  const historyRef = useRef<MemoryEntry[]>([]);
  const recentPhrasesRef = useRef<string[]>([]);

  const buildHistory = useCallback(
    (current: SignalType, excludeAt?: number): WatchCoachHistory => {
      const now = Date.now();
      // All recorded detections except the one currently being spoken.
      const past = excludeAt
        ? historyRef.current.filter((e) => e.at !== excludeAt)
        : historyRef.current;

      const countsByType: Record<string, number> = {};
      for (const e of past) {
        countsByType[e.type] = (countsByType[e.type] ?? 0) + 1;
      }

      // Current streak: how many of the most recent consecutive entries share the type.
      let currentStreak = 0;
      for (let i = past.length - 1; i >= 0; i--) {
        const entry = past[i];
        if (entry && entry.type === current) currentStreak++;
        else break;
      }

      const recent = past.slice(-RECENT_LIMIT).map((e) => ({
        type: e.type,
        rationale: e.rationale,
        secondsAgo: Math.max(0, Math.round((now - e.at) / 1000)),
      }));

      return {
        totalCount: past.length,
        countsByType,
        currentStreak,
        recent,
        recentPhrases: recentPhrasesRef.current.slice(-RECENT_PHRASES_LIMIT),
      };
    },
    [],
  );

  const drain = useCallback(async () => {
    if (playingRef.current || cancelledRef.current) return;

    // Verbatim phrases (intro, etc.) take priority over signal whispers.
    const verbatim = phraseQueueRef.current.shift();
    if (verbatim !== undefined) {
      playingRef.current = true;
      try {
        await playPhrase(verbatim, currentAudioRef, cancelledRef);
      } catch {
        // ignore
      } finally {
        playingRef.current = false;
        void drain();
      }
      return;
    }

    const next = queueRef.current.shift();
    if (!next) return;

    playingRef.current = true;
    try {
      // Memory was already recorded in enqueue(); exclude this entry so the
      // coach sees what happened BEFORE it (accurate "Nth time" / streak).
      const history = buildHistory(next.type, next.at);

      const signal: DetectedSignal = {
        type: next.type,
        rationale: next.rationale,
        probability: next.probability,
        start: 0,
      };
      const phrase = await buildPhrase(signal, nameRef.current, history);
      if (cancelledRef.current) return;
      recentPhrasesRef.current.push(phrase);
      if (recentPhrasesRef.current.length > RECENT_PHRASES_LIMIT) {
        recentPhrasesRef.current.shift();
      }

      console.log(
        "%c[whisper] Interhuman → OpenAI/ElevenLabs",
        "color:#7c3aed;font-weight:bold",
        {
          signalType: next.type,
          probability: next.probability,
          interhumanRationale: next.rationale,
          elevenLabsText: phrase,
        },
      );

      await playPhrase(phrase, currentAudioRef, cancelledRef);
    } catch {
      // Best-effort — don't block queue on network errors
    } finally {
      playingRef.current = false;
      void drain();
    }
  }, [buildHistory]);

  const enqueue = useCallback(
    (signal: DetectedSignal) => {
      if (cancelledRef.current) return;
      const now = Date.now();

      // Always record the detection in memory, even if we don't speak it.
      const entry: MemoryEntry = {
        type: signal.type,
        rationale: signal.rationale,
        probability: signal.probability,
        at: now,
      };
      historyRef.current.push(entry);

      // Cooldown only gates SPEAKING — skip the whisper but keep the memory.
      const last = lastSpokenRef.current.get(signal.type) ?? 0;
      if (now - last < COOLDOWN_MS) return;

      lastSpokenRef.current.set(signal.type, now);
      queueRef.current.push(entry);
      void drain();
    },
    [drain],
  );

  /** Speak a phrase verbatim through the same non-overlapping audio queue. */
  const speak = useCallback(
    (text: string) => {
      if (cancelledRef.current) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      phraseQueueRef.current.push(trimmed);
      void drain();
    },
    [drain],
  );

  /**
   * Stop everything: clear pending queues and halt any audio currently
   * playing. Used when the user ends the session.
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    phraseQueueRef.current = [];
    const audio = currentAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      currentAudioRef.current = null;
    }
  }, []);

  return { enqueue, speak, cancel };
}

/** Fetch ElevenLabs audio for a phrase and play it to completion (no overlap). */
async function playPhrase(
  text: string,
  currentAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  cancelledRef: React.MutableRefObject<boolean>,
): Promise<void> {
  const res = await fetch("/api/watch/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (cancelledRef.current) return;

  if (res.ok && res.status !== 204) {
    const blob = await res.blob();
    if (cancelledRef.current) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    await new Promise<void>((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        resolve();
      };
      audio.play().catch(() => resolve());
    });
  }
}

/** Ask the coach route for a short spoken nudge; fall back to a basic phrase. */
async function buildPhrase(
  signal: DetectedSignal,
  name?: string,
  history?: WatchCoachHistory,
): Promise<string> {
  try {
    const res = await fetch("/api/watch/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signalType: signal.type,
        rationale: signal.rationale,
        probability: signal.probability,
        name: name?.trim() || undefined,
        history,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as WatchCoachResponse;
      if (data?.phrase) return data.phrase;
    }
  } catch {
    // fall through to basic phrase
  }
  return name?.trim()
    ? `${name.trim()}, heads up — ${signal.type} detected.`
    : `heads up — ${signal.type} detected.`;
}
