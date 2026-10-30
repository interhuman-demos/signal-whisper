"use client";

import { motion } from "motion/react";
import { GLYPHS } from "./dot-pattern-icon.js";

export type { GlyphName } from "./dot-pattern-icon.js";
export { GLYPHS } from "./dot-pattern-icon.js";

/**
 * Animated white-on-dark glyph. The "on" dots ripple outward from the center
 * on a loop — a living "signal" pulse.
 */
export function DotPatternIconAnimated({
  rows,
  size = 35,
  className,
  color = "white",
}: {
  rows: readonly string[];
  size?: number;
  className?: string;
  color?: string;
}) {
  const cell = 3;
  const gap = 0.9;
  const pitch = cell + gap;
  const viewSize = rows.length * cell + (rows.length - 1) * gap;
  const center = (rows.length - 1) / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      fill="none"
      aria-hidden
      className={className}
    >
      {rows.map((row, y) =>
        [...row].map((dot, x) => {
          const on = dot === "1";
          if (!on) {
            return (
              <rect
                key={`${x}-${y}`}
                x={x * pitch}
                y={y * pitch}
                width={cell}
                height={cell}
                rx="0.9"
                fill={color}
                opacity={0.09}
              />
            );
          }

          const dist = Math.hypot(x - center, y - center);
          const delay = dist * 0.12;

          return (
            <motion.rect
              key={`${x}-${y}`}
              x={x * pitch}
              y={y * pitch}
              width={cell}
              height={cell}
              rx="0.9"
              fill={color}
              initial={{ opacity: 0.92 }}
              animate={{ opacity: [0.92, 0.32, 0.92] }}
              transition={{
                duration: 1.6,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.6,
                delay,
              }}
            />
          );
        }),
      )}
    </svg>
  );
}

// Re-export non-animated variants for convenience
export {
  DotPatternIcon,
  DotPatternIconSmall,
} from "./dot-pattern-icon.js";
