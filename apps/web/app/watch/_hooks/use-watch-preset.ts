"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { SignalTypeSchema, type SignalType } from "@repo/shared";

const STORAGE_KEY = "signal-whisper:watch-preset";

const WatchPresetSchema = z.object({
  signals: z.array(SignalTypeSchema),
  voiceOn: z.boolean(),
  name: z.string(),
});

export type WatchPreset = z.infer<typeof WatchPresetSchema>;

export interface UseWatchPresetResult {
  /** `null` until hydrated from localStorage, then the saved preset or `false`. */
  preset: WatchPreset | null | false;
  save(preset: WatchPreset): void;
  clear(): void;
}

/** Persists the watch settings (signals, voice, name) across sessions. */
export function useWatchPreset(): UseWatchPresetResult {
  const [preset, setPreset] = useState<WatchPreset | null | false>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setPreset(false);
        return;
      }
      const parsed = WatchPresetSchema.safeParse(JSON.parse(raw));
      setPreset(parsed.success ? parsed.data : false);
    } catch {
      setPreset(false);
    }
  }, []);

  const save = useCallback((next: WatchPreset) => {
    setPreset(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / unavailable storage
    }
  }, []);

  const clear = useCallback(() => {
    setPreset(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { preset, save, clear };
}

export type { SignalType };
