"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { SignalType } from "@repo/shared";
import { ALL_SIGNAL_TYPES } from "@repo/shared";
import { SignalBadge } from "@/components/ui/signal-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GLYPHS,
  DotPatternIcon,
  DotPatternIconSmall,
} from "@/components/ui/dot-pattern-icon";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface WatchPresetInit {
  signals: SignalType[];
  voiceOn: boolean;
  name: string;
}

interface SignalPickerProps {
  onStart(watchedSignals: SignalType[], voiceOn: boolean, name: string): void;
  initialPreset?: WatchPresetInit;
}

export function SignalPicker({ onStart, initialPreset }: SignalPickerProps) {
  // A saved preset that watched every signal is stored as the full list; treat
  // that as "watch all" (empty selection) so the UI matches the original intent.
  const presetSelection =
    initialPreset && initialPreset.signals.length < ALL_SIGNAL_TYPES.length
      ? initialPreset.signals
      : [];
  const [selected, setSelected] = useState<Set<SignalType>>(
    new Set(presetSelection),
  );
  const [voiceOn, setVoiceOn] = useState(initialPreset?.voiceOn ?? true);
  const [name, setName] = useState(initialPreset?.name ?? "");
  const [starting, setStarting] = useState(false);

  const toggle = (sig: SignalType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sig)) next.delete(sig);
      else next.add(sig);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ALL_SIGNAL_TYPES));
  const clearAll = () => setSelected(new Set());

  const isAllSelected = selected.size === ALL_SIGNAL_TYPES.length;
  const isNoneSelected = selected.size === 0;

  const watchingAll = selected.size === 0;
  const watchCount = watchingAll ? ALL_SIGNAL_TYPES.length : selected.size;

  const handleStart = async () => {
    setStarting(true);
    onStart(
      selected.size === 0 ? [...ALL_SIGNAL_TYPES] : [...selected],
      voiceOn,
      name.trim(),
    );
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex w-full max-w-2xl flex-col gap-6"
    >
      <motion.div variants={fadeUp} className="flex items-start gap-4">
        <div className="mt-0.5 hidden shrink-0 text-foreground sm:block">
          <DotPatternIcon rows={GLYPHS.spark} size={44} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-label text-muted-foreground">
            Session setup
          </span>
          <h1 className="text-h2">Which signals do you want to watch for?</h1>
          <p className="text-body text-muted-foreground max-w-reading">
            Leave everything unselected to watch every signal. Start a session
            and an ElevenLabs voice whispers an alert the moment one is
            detected.
          </p>
        </div>
      </motion.div>

      <motion.section
        variants={fadeUp}
        className="surface flex flex-col gap-4 p-5 sm:p-6"
      >
        <header className="flex items-center gap-2">
          <span className="text-label text-muted-foreground">Signals</span>
        </header>

        <div className="flex flex-wrap gap-2">
          {ALL_SIGNAL_TYPES.map((sig) => {
            const active = selected.has(sig);
            return (
              <button
                key={sig}
                onClick={() => toggle(sig)}
                className="cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-pressed={active}
              >
                <SignalBadge
                  type={sig}
                  className={[
                    "px-3 py-1 text-sm capitalize transition-[opacity,transform,box-shadow] duration-150 ease-[var(--ease-out)] will-change-transform motion-reduce:transition-none",
                    active
                      ? "scale-105 shadow-md"
                      : "opacity-30 hover:scale-[1.03] hover:opacity-90",
                  ].join(" ")}
                >
                  {sig}
                </SignalBadge>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Button
            variant="outline"
            size="sm"
            pill
            onClick={selectAll}
            aria-pressed={isAllSelected}
            className={cn(
              isAllSelected &&
                "border-foreground/50 bg-foreground/[0.06] text-foreground",
            )}
          >
            All
          </Button>
          <Button
            variant="outline"
            size="sm"
            pill
            onClick={clearAll}
            aria-pressed={isNoneSelected}
            className={cn(
              isNoneSelected &&
                "border-foreground/50 bg-foreground/[0.06] text-foreground",
            )}
          >
            None
          </Button>
        </div>
      </motion.section>

      <motion.section
        variants={fadeUp}
        className="surface flex flex-col gap-4 p-5 sm:p-6"
      >
        <header className="flex items-center gap-2">
          <span className="text-label text-muted-foreground">Your name</span>
        </header>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Alex"
          className="max-w-xs"
          aria-label="Your name"
        />
      </motion.section>

      <motion.section
        variants={fadeUp}
        className="surface flex flex-col gap-4 p-5 sm:p-6"
      >
        <header className="flex items-center gap-2">
          <span className="text-label text-muted-foreground">Voice alerts</span>
          <div className="h-px flex-1 bg-border" />
        </header>
        <button
          onClick={() => setVoiceOn((v) => !v)}
          className={[
            "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
            "cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            voiceOn
              ? "border-foreground/15 bg-foreground/[0.04]"
              : "border-border hover:bg-foreground/[0.02]",
          ].join(" ")}
          aria-pressed={voiceOn}
        >
          <span
            className={[
              "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
              voiceOn ? "bg-foreground/[0.06]" : "bg-transparent",
            ].join(" ")}
          >
            <DotPatternIconSmall
              rows={GLYPHS.wave}
              size={18}
              className={voiceOn ? "text-foreground" : "text-muted-foreground"}
            />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">
              {voiceOn ? "Whisper on" : "Whisper off"}
            </span>
            <span className="text-xs text-muted-foreground">
              {voiceOn
                ? "ElevenLabs voice alerts on detection"
                : "Silent — watch the live feed only"}
            </span>
          </span>
          <span
            className={[
              "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ease-[var(--ease-out)] motion-reduce:transition-none",
              voiceOn ? "bg-[var(--color-brand)]" : "bg-foreground/15",
            ].join(" ")}
            aria-hidden
          >
            <span
              className={[
                "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-[var(--ease-out)] will-change-transform motion-reduce:transition-none",
                voiceOn ? "translate-x-[1.125rem]" : "translate-x-0.5",
              ].join(" ")}
            />
          </span>
        </button>
      </motion.section>

      <motion.div variants={fadeUp} className="flex justify-end pt-1">
        <Button
          variant="gradient"
          size="lg"
          pill
          onClick={handleStart}
          disabled={starting}
          className="w-full sm:w-auto"
        >
          {starting ? "Starting…" : "Start session →"}
        </Button>
      </motion.div>
    </motion.div>
  );
}
