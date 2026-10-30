"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "speaking";

interface VoiceOrbProps {
  state: OrbState;
  /**
   * Colors of the recently detected signals. Empty → neutral orb. One color →
   * the orb tints toward that signal. Multiple → they blend into a gradient.
   * Any CSS color works (we pass `var(--signal-text-*)` values in).
   */
  colors?: string[];
  /** Diameter in px. Defaults to 260. */
  size?: number;
  className?: string;
}

/**
 * Produce two analogous neighbours for a given OKLCH color by mixing with a
 * slightly shifted hue reference. This gives each signal an iridescent quality
 * — the orb reads as multi-toned even with a single detection, without
 * changing any palette tokens.
 *
 * We use `color-mix` rather than parsing OKLCH ourselves so that CSS variables
 * (e.g. var(--signal-text-stress)) work without resolving them in JS.
 */
function analogous(c: string) {
  // Warm shift: mix toward a golden/amber hue to widen the specular side.
  const warm = `color-mix(in oklch longer hue, ${c} 78%, oklch(0.88 0.18 70))`;
  // Cool shift: mix toward a blue-violet to deepen the shadow/terminator side.
  const cool = `color-mix(in oklch longer hue, ${c} 72%, oklch(0.35 0.22 280))`;
  return { warm, cool };
}

/**
 * Build the orb's fill as layered sphere shading.
 *
 * Instead of hard 3-stop radial gradients or a conic "pie-slice" for
 * multi-signal, we stack soft radial "light pools" that overlap naturally:
 *
 *  1. Deep base     — the cooler-shifted tone fills the whole volume.
 *  2. Body midtone  — the dominant signal hue centered in the orb.
 *  3. Warm fill     — an analogous warm secondary on the upper-left.
 *  4. Specular      — a tight bright hotspot at ~30% 25%.
 *  5. Terminator    — a soft shadow crescent on the lower-right.
 *  6. Rim light     — subtle back-scatter along the lower edge.
 *
 * Multi-signal: each color gets its own soft radial pool scattered across
 * four quadrants so hues bleed into each other — no hard conic seams.
 */
function buildBackground(colors: string[]): string {
  if (colors.length === 0) {
    // Neutral idle — cool grey sphere with real depth.
    return [
      "radial-gradient(ellipse 90% 40% at 50% 112%, oklch(0.14 0.04 280) 0%, transparent 65%)",
      "radial-gradient(ellipse 80% 80% at 50% 52%, oklch(0.28 0.05 280) 0%, oklch(0.16 0.03 280) 100%)",
      "radial-gradient(circle at 34% 27%, oklch(0.62 0.03 280) 0%, transparent 42%)",
    ].join(", ");
  }

  if (colors.length === 1) {
    const c = colors[0]!;
    const { warm, cool } = analogous(c);
    return [
      // Rim light
      `radial-gradient(ellipse 88% 28% at 50% 110%, color-mix(in oklch, ${cool} 38%, transparent) 0%, transparent 72%)`,
      // Terminator shadow
      `radial-gradient(ellipse 65% 62% at 74% 76%, color-mix(in oklch, ${cool} 65%, black) 0%, transparent 62%)`,
      // Body — dominant hue
      `radial-gradient(ellipse 108% 108% at 48% 56%, ${c} 0%, color-mix(in oklch, ${c} 68%, ${cool}) 52%, transparent 80%)`,
      // Warm secondary fill
      `radial-gradient(ellipse 72% 68% at 22% 32%, color-mix(in oklch, ${warm} 52%, transparent) 0%, transparent 62%)`,
      // Specular hotspot
      `radial-gradient(circle at 31% 24%, color-mix(in oklch, ${warm} 55%, white) 0%, transparent 36%)`,
    ].join(", ");
  }

  // Multi-signal: each hue is a soft radial "light pool" in one quadrant.
  // Quadrant order cycles so 2 signals land diagonally opposite each other,
  // 3 form a triangle, 4 fill all corners — always a natural-looking blend.
  const POSITIONS = [
    { x: 28, y: 32 }, // upper-left  (dominant)
    { x: 70, y: 65 }, // lower-right
    { x: 22, y: 70 }, // lower-left
    { x: 74, y: 28 }, // upper-right
  ];

  const pools = colors.slice(0, 4).map((c, i) => {
    const p = POSITIONS[i % POSITIONS.length]!;
    const size = i === 0 ? "90% 88%" : "72% 70%";
    return `radial-gradient(ellipse ${size} at ${p.x}% ${p.y}%, color-mix(in oklch, ${c} 82%, transparent) 0%, transparent 68%)`;
  });

  // Deep base tinted toward the dominant color keeps it from looking grey.
  const base = `radial-gradient(ellipse 130% 130% at 50% 50%, color-mix(in oklch, ${colors[0]!} 22%, oklch(0.14 0.05 280)) 0%, oklch(0.10 0.03 280) 100%)`;
  // Shared specular so the sphere still reads as 3-D.
  const spec = `radial-gradient(circle at 31% 24%, rgba(255,255,255,0.24) 0%, transparent 33%)`;

  return [...pools, base, spec].join(", ");
}

/**
 * A GPT-Advanced-Voice-Mode-style orb. A soft glowing sphere that breathes
 * when idle, tightens when listening, and pulses when speaking. Its color is
 * driven by the recently detected social signals (see `colors`).
 *
 * Purely presentational — the parent decides `state`/`colors`. No transcript
 * is ever shown; the orb IS the voice.
 */
export function VoiceOrb({
  state,
  colors = [],
  size = 260,
  className,
}: VoiceOrbProps) {
  const reduce = useReducedMotion();

  const speaking = state === "speaking";
  const listening = state === "listening";
  const active = colors.length > 0;

  // Speaking uses explicit keyframes so it pulses like syllables rather than
  // a single mirror bounce. Slightly irregular values keep it from feeling metronomic.
  const coreScale = reduce
    ? 1
    : speaking
      ? [1, 1.02, 0.99, 1.02, 0.98, 1.04, 0.97, 1]
      : listening
        ? 1.02
        : 1.015;

  const springConfig = reduce
    ? {}
    : speaking
      ? {
          duration: 2.4,
          ease: "easeInOut" as const,
          repeat: Infinity,
          times: [0, 0.12, 0.28, 0.42, 0.57, 0.72, 0.88, 1],
        }
      : listening
        ? { type: "spring" as const, duration: 1.8, bounce: 0.05, repeat: Infinity, repeatType: "mirror" as const }
        : { type: "spring" as const, duration: 2.5, bounce: 0.05, repeat: Infinity, repeatType: "mirror" as const };

  const bloomColor = active ? colors[0]! : "oklch(0.7 0.06 280)";
  const glowOpacity = active ? (speaking ? 0.85 : 0.6) : 0.25;

  const background = buildBackground(colors);

  // Fresnel rim: a thin inner ring of light along the sphere boundary that
  // catches the "back light" and reinforces the 3-D curvature read.
  const rimColor = active
    ? `color-mix(in oklch, ${colors[0]!} 45%, white)`
    : "oklch(0.75 0.04 280)";

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Ambient bloom behind the orb, tinted by the active signal */}
      <motion.div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 1.5,
          height: size * 1.5,
          background: `radial-gradient(circle, color-mix(in oklch, ${bloomColor} 60%, transparent) 0%, transparent 62%)`,
          filter: "blur(20px)",
          willChange: "transform, opacity",
        }}
        animate={
          reduce
            ? { opacity: glowOpacity, scale: 1 }
            : speaking
              ? {
                  opacity: [glowOpacity * 0.75, glowOpacity, glowOpacity * 0.8, glowOpacity, glowOpacity * 0.78, glowOpacity * 0.95, glowOpacity * 0.8, glowOpacity * 0.75],
                  scale:   [1.02, 1.12, 1.0, 1.1, 1.01, 1.08, 1.0, 1.02],
                }
              : {
                  opacity: glowOpacity * 0.9,
                  scale: 1.03,
                }
        }
        transition={
          reduce
            ? { duration: 0 }
            : speaking
              ? {
                  duration: 2.2,
                  ease: "easeInOut",
                  repeat: Infinity,
                  times: [0, 0.12, 0.28, 0.42, 0.57, 0.72, 0.88, 1],
                }
              : {
                  type: "spring",
                  duration: 2.5,
                  bounce: 0.05,
                  repeat: Infinity,
                  repeatType: "mirror",
                }
        }
      />

      {/* The orb core */}
      <motion.div
        aria-hidden
        className="relative overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          boxShadow: [
            // Deep inset shadow to push the edges into darkness.
            `inset 0 0 ${Math.round(size * 0.22)}px ${Math.round(size * 0.04)}px color-mix(in oklch, black 55%, transparent)`,
            // Fresnel rim — thin inner glow that traces the sphere boundary.
            `inset 0 0 ${Math.round(size * 0.07)}px ${Math.round(size * 0.012)}px color-mix(in oklch, ${rimColor} 30%, transparent)`,
            // Outer bloom drop-shadow tinted by the active color.
            `0 ${Math.round(size * 0.05)}px ${Math.round(size * 0.25)}px color-mix(in oklch, ${bloomColor} 38%, transparent)`,
          ].join(", "),
          willChange: "transform",
        }}
        animate={reduce ? undefined : { scale: coreScale }}
        transition={springConfig}
      >
        {/* Color layer — cross-fades smoothly as signals arrive/leave.
            AnimatePresence mode="sync" keeps the exiting layer visible while
            the entering one fades in, preventing the black flash that occurs
            when the old layer is unmounted before the new one reaches full opacity. */}
        <AnimatePresence mode="sync">
          <motion.div
            key={background}
            className="absolute inset-0"
            style={{ background }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.215, 0.61, 0.355, 1] }}
          />
        </AnimatePresence>

        {/*
         * Liquid highlight — a soft elliptical off-center light source.
         * Idle: imperceptibly slow rotation.
         * Speaking: drifts on two independent axes (6s × 9s) so the path
         * never obviously repeats. Coprime durations → Lissajous-like float
         * that reads as "alive" rather than "spinning gradient".
         */}
        {!reduce && (
          <motion.div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 52% 42% at 38% 32%, rgba(255,255,255,0.2) 0%, transparent 100%)",
              mixBlendMode: "screen",
              willChange: "transform, opacity",
            }}
            animate={speaking
              ? {
                  x: [0, 18, -10, 22, -6, 0],
                  y: [0, -12, 20, 6, -16, 0],
                  opacity: [0.55, 1, 0.65, 0.95, 0.6, 1],
                }
              : { x: 0, y: 0, opacity: 0.55, rotate: 360 }
            }
            transition={speaking
              ? {
                  x: { duration: 6, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
                  y: { duration: 9, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
                  opacity: { duration: 4, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
                }
              : {
                  x: { duration: 0.8, ease: "easeOut" },
                  y: { duration: 0.8, ease: "easeOut" },
                  opacity: { duration: 0.8, ease: "easeOut" },
                  rotate: { duration: 22, ease: "linear", repeat: Infinity },
                }
            }
          />
        )}

        {/*
         * Film grain — SVG feTurbulence fractal noise at ~3.5% opacity.
         * Breaks up gradient banding across the entire fill so it reads as
         * a continuous tone rather than discrete CSS stops. The tile is sized
         * relative to the orb so it scales correctly at any `size` value.
         */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E")`,
            backgroundSize: `${Math.round(size * 0.65)}px ${Math.round(size * 0.65)}px`,
            opacity: 0.035,
            mixBlendMode: "overlay",
          }}
        />
      </motion.div>
    </div>
  );
}
