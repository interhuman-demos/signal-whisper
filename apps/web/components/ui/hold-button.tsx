"use client";

import {
  animate,
  motion,
  useMotionValue,
  useMotionTemplate,
  useReducedMotion,
} from "motion/react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type HoldButtonProps = {
  children: React.ReactNode;
  /** When provided, renders as a Next.js Link instead of a button. */
  href?: string;
  /** Time in ms for the orange fill to sweep across while held. */
  holdDuration?: number;
  className?: string;
  disabled?: boolean;
  /** Called with `true` on pointer-down and `false` on pointer-up/leave. */
  onHoldChange?: (holding: boolean) => void;
  /** Called when the hold completes fully (fill reaches 100%). */
  onComplete?: () => void;
};

/**
 * Visual-only hold-to-confirm button: an orange overlay sweeps across the
 * label while the pointer is held, and eases back out on release. Holding
 * intentionally performs no action — it's pure feedback.
 */
export function HoldButton({
  children,
  href,
  holdDuration = 3500,
  className,
  disabled,
  onHoldChange,
  onComplete,
}: HoldButtonProps) {
  const reduce = useReducedMotion();
  const [shaking, setShaking] = useState(false);
  // Right inset of the orange overlay: 100% (hidden) -> 0% (fully revealed).
  const inset = useMotionValue("100%");
  const reveal = useMotionTemplate`inset(0 ${inset} 0 0)`;
  const controlsRef = useRef<ReturnType<typeof animate> | null>(null);
  const shakeRef = useRef<ReturnType<typeof animate> | null>(null);
  const completedRef = useRef(false);

  const startShake = useCallback(() => {
    setShaking(true);
  }, []);

  const stopShake = useCallback(() => {
    setShaking(false);
    shakeRef.current?.stop();
    shakeRef.current = null;
  }, []);

  const handleDown = useCallback(() => {
    if (disabled || reduce) return;
    completedRef.current = false;
    onHoldChange?.(true);
    controlsRef.current?.stop();
    stopShake();
    inset.set("100%");
    controlsRef.current = animate(inset, "0%", {
      duration: holdDuration / 1000,
      ease: "linear",
      onComplete: () => {
        completedRef.current = true;
        startShake();
      },
    });
  }, [disabled, holdDuration, inset, onHoldChange, reduce, stopShake, startShake]);

  const handleUp = useCallback(() => {
    if (reduce) return;
    onHoldChange?.(false);
    stopShake();
    if (completedRef.current) {
      onComplete?.();
    }
    completedRef.current = false;
    controlsRef.current?.stop();
    controlsRef.current = animate(inset, "100%", {
      duration: 0.25,
      ease: [0.2, 0, 0, 1],
    });
  }, [inset, onComplete, onHoldChange, reduce, stopShake]);

  const sharedProps = {
    onPointerDown: handleDown,
    onPointerUp: handleUp,
    onPointerLeave: handleUp,
    onPointerCancel: handleUp,
    className: cn(
      "relative isolate inline-flex h-10 select-none items-center justify-center gap-2 overflow-hidden rounded-full px-6 font-medium",
      "transition-[filter,transform] duration-150",
      "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "disabled:pointer-events-none disabled:opacity-50",
      shaking && "animate-hold-shake",
      className,
    ),
  };

  const inner = (
    <>
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
      <motion.span
        aria-hidden
        style={{ clipPath: reveal }}
        className="absolute inset-0 z-20 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-6 font-medium text-white"
      >
        {children}
      </motion.span>
    </>
  );

  if (href) {
    return (
      <Link href={href} {...sharedProps}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled} {...sharedProps}>
      {inner}
    </button>
  );
}
