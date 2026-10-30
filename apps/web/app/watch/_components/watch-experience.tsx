"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { SignalType, WatchSignalDetected } from "@repo/shared";
import { ALL_SIGNAL_TYPES } from "@repo/shared";
import { SignalPicker } from "./signal-picker";
import { LiveStage } from "./live-stage";
import { useWatchSession } from "../_hooks/use-watch-session";
import { useWhisperQueue } from "../_hooks/use-whisper-queue";
import { useWatchPreset } from "../_hooks/use-watch-preset";
import { FloatingNav } from "@/components/ui/floating-nav";
import { fadeUp } from "@/lib/motion";
import { useState } from "react";

type Stage = "setup" | "live";

export function WatchExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // When the user explicitly opens Settings (?config=1), always show the
  // picker — never auto-start.
  const forceConfig = searchParams.get("config") === "1";
  const [stage, setStage] = useState<Stage>("setup");
  const [watchedSignals, setWatchedSignals] = useState<SignalType[]>([]);
  const [name, setName] = useState("");

  const session = useWatchSession();
  // Whispers keyed to the user's name — empty by default (no setup screen).
  const { enqueue, speak, cancel } = useWhisperQueue(name);
  const { preset, save } = useWatchPreset();
  const autoStarted = useRef(false);

  const handleStart = useCallback(
    async (signals: SignalType[], voice: boolean, userName: string) => {
      setWatchedSignals(signals);
      setName(userName);
      setStage("live");
      save({ signals, voiceOn: voice, name: userName });
      if (voice) speak(buildIntro(userName, signals));
      await session.start(signals);
    },
    [session, speak, save],
  );

  // Default auto-start: watch stress only, voice on, no name.
  // Fires immediately unless the user explicitly asked for ?config=1.
  // Wait until preset has finished loading (null = still loading).
  useEffect(() => {
    if (autoStarted.current || forceConfig || preset === null) return;
    autoStarted.current = true;
    // Honor a saved preset in full; otherwise fall back to stress only.
    const voiceOn = preset !== false ? preset.voiceOn : true;
    const userName = preset !== false ? preset.name : "";
    const signals: SignalType[] =
      preset !== false ? preset.signals : ["stress"];
    void handleStart(signals, voiceOn, userName);
  }, [forceConfig, preset, handleStart]);

  const handleEditSettings = useCallback(() => {
    cancel();
    session.stop();
    setStage("setup");
  }, [session, cancel]);

  const handleEndSession = useCallback(() => {
    cancel();
    session.stop();
    router.push("/");
  }, [session, cancel, router]);

  const handleEnqueue = useCallback(
    (signal: WatchSignalDetected["signal"]) => {
      enqueue(signal);
    },
    [enqueue],
  );

  return (
    <>
      {stage === "setup" && <FloatingNav />}
      <AnimatePresence mode="wait">
        {stage === "setup" ? (
          <motion.main
            key="setup"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
            className="flex min-h-screen flex-col items-center justify-center px-6 pb-16 pt-28"
          >
            <SignalPicker initialPreset={preset || undefined} onStart={handleStart} />
          </motion.main>
        ) : (
          <motion.div
            key="live"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="w-full"
          >
            <LiveStage
              session={session}
              watchedSignals={watchedSignals}
              name={name}
              onEnqueueWhisper={handleEnqueue}
              onEditSettings={handleEditSettings}
              onEndSession={handleEndSession}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function buildIntro(name: string, signals: SignalType[]): string {
  const who = name.trim() ? `${name.trim()}, ` : "";

  const isAll = signals.length === ALL_SIGNAL_TYPES.length;
  let what: string;
  if (isAll) {
    what = "any signal";
  } else if (signals.length === 1) {
    what = signals[0]!;
  } else if (signals.length === 2) {
    what = `${signals[0]} and ${signals[1]}`;
  } else {
    const last = signals[signals.length - 1];
    const rest = signals.slice(0, -1).join(", ");
    what = `${rest}, and ${last}`;
  }

  return `Okay, got it ${who}— I'll let you know when I detect ${what}.`;
}
