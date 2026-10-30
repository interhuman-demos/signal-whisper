"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useTransform, animate, useReducedMotion } from "motion/react";
import { RotateCcw, X } from "lucide-react";
import { SignalBadge } from "@/components/ui/signal-badge";
import { Button } from "@/components/ui/button";
import { VoiceOrb } from "@/components/ui/voice-orb";
import { signalSpring } from "@/lib/motion";
import { signalTextVar } from "@/lib/signal-style";
import type { Probability } from "@repo/shared";
import { useDemoPlayer, type DemoSignalEntry } from "../_hooks/use-demo-player";

const PROBABILITY_LEVEL: Record<Probability, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function ProbabilityBars({ probability }: { probability?: Probability }) {  const level = probability ? PROBABILITY_LEVEL[probability] : 0;
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

function SignalRationalePopup({
  entry,
  onClose,
}: {
  entry: DemoSignalEntry;
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
 * Renders the active signal badges as "moons" orbiting the orb.
 *
 * Think of each signal as a rocket launched from a single pad just beneath the
 * orb: they all lift off from the same point, then peel off to claim their own
 * slot in orbit at a safe distance from their neighbours. Slots are assigned by
 * launch order using the golden angle, so the arrangement looks organic (never
 * a rigid symmetrical ring) yet moons never clump together. The whole
 * constellation drifts slowly so it reads as a living orbit.
 */
function SignalOrbit({
  moons,
  orbSize,
  onSelect,
}: {
  moons: DemoSignalEntry[];
  orbSize: number;
  onSelect(entry: DemoSignalEntry): void;
}) {
  const reduce = useReducedMotion();
  const radius = orbSize / 2 + 72;
  // Launch pad: a single point just below the orb that every rocket lifts off
  // from before dispersing into orbit.
  const launch = { x: 0, y: orbSize / 2 + 24 };

  // Single shared MotionValue for the orbital frame's rotation. Moons derive
  // their counter-rotation directly from this value via useTransform, so labels
  // are always exactly upright regardless of when a moon was added.
  const orbitAngle = useMotionValue(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(orbitAngle, 360, {
      duration: 90,
      ease: "linear",
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [reduce, orbitAngle]);

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      {/* Slowly rotating orbital frame — moons hold their slot, the whole ring turns. */}
      <motion.div
        className="absolute"
        style={{ width: 0, height: 0, rotate: orbitAngle }}
      >
        <AnimatePresence>
          {moons.map((entry) => {
            // Persistent slot per signal, spaced by the golden angle so orbits
            // never clump and never form a rigid symmetrical ring. Anchored to
            // the launch id so a moon's angle is stable across renders and
            // unaffected by others arriving/leaving.
            const angle = entry.id * GOLDEN_ANGLE - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <Moon
                key={entry.id}
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

// ~137.5° — the golden angle gives even-feeling but non-symmetric spacing.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function Moon({
  entry,
  x,
  y,
  launch,
  orbitAngle,
  onSelect,
}: {
  entry: DemoSignalEntry;
  x: number;
  y: number;
  launch: { x: number; y: number };
  orbitAngle: ReturnType<typeof useMotionValue<number>>;
  onSelect(entry: DemoSignalEntry): void;
}) {
  const color = signalTextVar(entry.signal.type);
  // Derive counter-rotation live from the shared orbit MotionValue so the
  // label is always exactly upright, even for moons added mid-rotation.
  const counterRotate = useTransform(orbitAngle, (a) => -a);
  // Rockets lift off from the shared launch pad, arc out to their orbit slot,
  // then on exit drift outward past the slot and dissolve.
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
      // Spring with a tiny bounce — feels like it's being pulled into orbit.
      transition={{ type: "spring", duration: 1.4, bounce: 0.12 }}
    >
      {/* style-based rotation derived from the shared MotionValue — always in sync. */}
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

export function DemoExperience() {
  const router = useRouter();
  const { playing, finished, orbState, signals, play, reset } = useDemoPlayer();
  const [selected, setSelected] = useState<DemoSignalEntry | null>(null);

  useEffect(() => { play(); }, []);

  // Signals detected within this window tint the orb; older ones fade out.
  const ACTIVE_WINDOW_MS = 12_000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Unique colors of the recently active signals (newest first), so a single
  // detection tints the orb and several blend into a gradient.
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

  const orbLabel = orbState === "speaking" ? "Whispering…" : "Listening…";

  // Signals still within the active window become "moons" orbiting the planet.
  const moons = signals.filter((s) => now - s.receivedAt <= ACTIVE_WINDOW_MS);

  return (
    <>
      <div className="relative flex min-h-screen w-full flex-col p-4 sm:p-6">
        {/* Top controls */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              pill
              onClick={() => {
                reset();
                router.push("/");
              }}
            >
              End session
            </Button>
          </div>
        </div>

        {/* Stage: orb is a planet, signals are moons pulled into its orbit */}
        <div className="relative flex flex-1 items-center justify-center">
          <div className="relative flex flex-col items-center gap-8">
            {/* Planet + orbiting moons share a centered coordinate space */}
            <div className="relative grid place-items-center">
              <VoiceOrb state={orbState} colors={orbColors} size={280} />

              <SignalOrbit
                moons={orbState === "speaking" ? [] : moons}
                orbSize={280}
                onSelect={setSelected}
              />
            </div>

            <div className="flex h-6 items-center">
              <AnimatePresence mode="wait">
                {playing ? (
                  <motion.span
                    key={orbLabel}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-base text-muted-foreground"
                  >
                    {orbLabel}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <SignalRationalePopup
            entry={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
