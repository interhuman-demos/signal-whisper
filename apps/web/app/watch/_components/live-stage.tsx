"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import type { Probability, SignalType, WatchSignalDetected } from "@repo/shared";
import type { UseWatchSessionResult, SignalEntry } from "../_hooks/use-watch-session";
import { VoiceOrb } from "@/components/ui/voice-orb";
import type { OrbState } from "@/components/ui/voice-orb";
import { SignalBadge } from "@/components/ui/signal-badge";
import { Button } from "@/components/ui/button";
import { signalSpring } from "@/lib/motion";
import { signalTextVar } from "@/lib/signal-style";
import { X } from "lucide-react";

// How long a signal keeps its color in the orb after detection.
const ACTIVE_WINDOW_MS = 12_000;
// How long the orb stays in "speaking" state after a stress whisper fires.
const SPEAKING_DURATION_MS = 4_500;
// Golden angle for orbit slot spacing.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface LiveStageProps {
  session: UseWatchSessionResult;
  watchedSignals: SignalType[];
  name: string;
  onEnqueueWhisper(signal: WatchSignalDetected["signal"]): void;
  onEditSettings(): void;
  onEndSession(): void;
}

const PROBABILITY_LEVEL: Record<Probability, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function ProbabilityBars({ probability }: { probability?: Probability }) {
  const level = probability ? PROBABILITY_LEVEL[probability] : 0;
  return (
    <span className="ml-auto flex items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{
            height: `${5 + i * 3}px`,
            backgroundColor: "currentColor",
            opacity: i < level ? 0.9 : 0.25,
          }}
        />
      ))}
    </span>
  );
}

function SignalPopup({
  entry,
  onClose,
}: {
  entry: SignalEntry;
  onClose(): void;
}) {
  const { signal } = entry;
  const dotColor = signalTextVar(signal.type);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      <motion.div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ ...signalSpring }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ background: dotColor }}
            />
            <span className="text-label font-semibold uppercase tracking-widest text-foreground">
              {signal.type} rationale
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {signal.rationale && (
          <>
            <div className="mb-4 border-t border-border" />
            <p className="text-sm leading-relaxed text-foreground/80">
              {signal.rationale}
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Signal "moons" orbiting the orb — driven by real live signals.
 * All signals appear as moons; the orb only speaks for stress.
 */
function SignalOrbit({
  moons,
  orbSize,
  onSelect,
}: {
  moons: SignalEntry[];
  orbSize: number;
  onSelect(entry: SignalEntry): void;
}) {
  const radius = orbSize / 2 + 72;
  const launch = { x: 0, y: orbSize / 2 + 24 };

  const orbitAngle = useMotionValue(0);
  useEffect(() => {
    const controls = animate(orbitAngle, 360, {
      duration: 90,
      ease: "linear",
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [orbitAngle]);

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <motion.div
        className="absolute"
        style={{ width: 0, height: 0, rotate: orbitAngle }}
      >
        <AnimatePresence>
          {moons.map((entry) => {
            const angle = entry.receivedAt * GOLDEN_ANGLE - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <OrbitMoon
                key={entry.receivedAt}
                entry={entry}
                x={x}
                y={y}
                launch={launch}
                orbitAngle={orbitAngle}
                onSelect={onSelect}
              />
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function OrbitMoon({
  entry,
  x,
  y,
  launch,
  orbitAngle,
  onSelect,
}: {
  entry: SignalEntry;
  x: number;
  y: number;
  launch: { x: number; y: number };
  orbitAngle: ReturnType<typeof useMotionValue<number>>;
  onSelect(entry: SignalEntry): void;
}) {
  const color = signalTextVar(entry.signal.type);
  const counterRotate = useTransform(orbitAngle, (a) => -a);
  const beyond = { x: x * 1.4, y: y * 1.4 };

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(entry)}
      className="pointer-events-auto absolute left-0 top-0"
      initial={{ x: launch.x, y: launch.y, opacity: 0, scale: 0.4, filter: "blur(8px)" }}
      animate={{ x, y, opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{
        x: beyond.x,
        y: beyond.y,
        opacity: 0,
        scale: 0.85,
        filter: "blur(4px)",
        transition: { duration: 1.2, ease: [0.2, 0, 0, 1] },
      }}
      transition={{ type: "spring", duration: 1.4, bounce: 0.12 }}
    >
      <motion.span
        className="block -translate-x-1/2 -translate-y-1/2"
        style={{ rotate: counterRotate }}
      >
        <SignalBadge
          type={entry.signal.type}
          className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 py-1 text-sm font-medium capitalize shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
          style={{
            color,
            backgroundColor: `color-mix(in oklch, ${color} 40%, rgba(255, 255, 255, 0.9))`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 50%, transparent), 0 6px 24px color-mix(in oklch, ${color} 35%, transparent)`,
          }}
        >
          <span className="truncate">{entry.signal.type}</span>
          <ProbabilityBars probability={entry.signal.probability} />
        </SignalBadge>
      </motion.span>
    </motion.button>
  );
}

export function LiveStage({
  session,
  name: _name,
  onEnqueueWhisper,
  onEditSettings,
  onEndSession,
}: LiveStageProps) {
  const { status, signals, videoRef } = session;
  const [selectedEntry, setSelectedEntry] = useState<SignalEntry | null>(null);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [now, setNow] = useState(() => Date.now());

  // Tick every 500ms so the active window and moons update smoothly.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Keep orb in "listening" while the session is live.
  useEffect(() => {
    if (status === "live" && orbState === "idle") {
      setOrbState("listening");
    } else if (status !== "live" && status !== "starting" && orbState === "listening") {
      setOrbState("idle");
    }
  }, [status, orbState]);

  // Fire a whisper for every signal that arrives (upstream filtering already
  // limits this to the signals the user selected in settings).
  useEffect(() => {
    const latest = signals[signals.length - 1];
    if (!latest) return;
    if (Date.now() - latest.receivedAt > 1000) return;

    onEnqueueWhisper(latest.signal);
    setOrbState("speaking");
    const t = setTimeout(() => setOrbState("listening"), SPEAKING_DURATION_MS);
    return () => clearTimeout(t);
  }, [signals, onEnqueueWhisper]);

  // Orb colors: unique signal types within the active window, newest first.
  const orbColors = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = signals.length - 1; i >= 0; i--) {
      const entry = signals[i]!;
      if (now - entry.receivedAt > ACTIVE_WINDOW_MS) break;
      if (seen.has(entry.signal.type)) continue;
      seen.add(entry.signal.type);
      out.push(signalTextVar(entry.signal.type));
      if (out.length >= 4) break;
    }
    return out;
  })();

  // Moons: all signals in the active window, hidden while speaking.
  const moons = orbState === "speaking"
    ? []
    : signals.filter((s) => now - s.receivedAt <= ACTIVE_WINDOW_MS);

  const statusLabel =
    orbState === "speaking"
      ? "Whispering…"
      : status === "starting"
        ? "Connecting…"
        : status === "live"
          ? "Listening…"
          : "Session stopped.";

  return (
    <>
      {/* h-screen + overflow-hidden prevents double-scroll from nested containers */}
      <div className="relative flex h-screen w-full flex-col overflow-hidden p-4 sm:p-6">
        {/* Top controls */}
        <div className="flex shrink-0 items-center justify-end gap-2">
          {(status === "live" || status === "starting") && (
            <Button variant="default" size="sm" pill onClick={onEndSession}>
              End session
            </Button>
          )}
        </div>

        {/* Stage: orb centered with flex-1 filling the remaining height */}
        <div className="relative flex flex-1 items-center justify-center">
          <div className="relative flex flex-col items-center gap-8">
            <div className="relative grid place-items-center">
              <VoiceOrb state={orbState} colors={orbColors} size={280} />
              <SignalOrbit
                moons={moons}
                orbSize={280}
                onSelect={setSelectedEntry}
              />
            </div>

            {/* Status label */}
            <div className="flex h-6 items-center">
              <AnimatePresence mode="wait">
                {(status === "live" || status === "starting" || orbState === "speaking") && (
                  <motion.span
                    key={statusLabel}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-base text-muted-foreground"
                  >
                    {statusLabel}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Camera thumbnail — fixed so it doesn't affect page flow.
          Dark bg so the feed is visible on any page background.
          Always mounted so MediaRecorder keeps streaming. */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-10 overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-black/20">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-24 w-32 object-cover"
        />
      </div>

      {/* Signal detail popup */}
      <AnimatePresence>
        {selectedEntry && (
          <SignalPopup
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
