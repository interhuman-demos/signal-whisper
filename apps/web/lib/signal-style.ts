import type { SignalType } from "@repo/shared";

const POSITIVE = new Set<SignalType>([
  "confidence",
  "interest",
  "agreement",
  "engagement",
]);

export function signalVar(type: SignalType): string {
  return `var(--signal-${type})`;
}

export function signalTextVar(type: SignalType): string {
  return `var(--signal-text-${type})`;
}

export function signalBadgeStyle(type: SignalType): React.CSSProperties {
  const color = signalTextVar(type);
  return {
    color,
    backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 30%, transparent)`,
  };
}

export function signalFillStyle(type: SignalType): React.CSSProperties {
  return { backgroundColor: signalVar(type) };
}

export function isPositiveSignal(type: SignalType): boolean {
  return POSITIVE.has(type);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
