"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  InterhumanClient,
  type StreamClient,
  type SignalDetectedEvent,
} from "@interhumanai/sdk";
import type { WatchSignalDetected } from "@repo/shared";

export type WatchStatus =
  | "idle"
  | "starting"
  | "live"
  | "stopping"
  | "stopped"
  | "error";

export type SignalEntry = WatchSignalDetected & { receivedAt: number };

export interface UseWatchSessionResult {
  status: WatchStatus;
  error: string | null;
  signals: SignalEntry[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start(watchedSignals: string[]): Promise<void>;
  stop(): void;
}

const WINDOW_MS = 5_000;

/**
 * Streams video to Interhuman via the @interhumanai/sdk. The browser gets a
 * short-lived client token from our API, then opens a direct WebSocket to
 * wss://api.interhuman.ai/v1/stream/analyze via the SDK.
 *
 * Chunks are sent exactly as MediaRecorder emits them. For WebM the recorder
 * puts the EBML header in the first chunk only and the rest are raw
 * continuations; the API reassembles that stream itself, so nothing is
 * prepended to later chunks.
 */
export function useWatchSession(): UseWatchSessionResult {
  const [status, setStatus] = useState<WatchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sdkStreamRef = useRef<StreamClient | null>(null);
  const sessionIdRef = useRef<string>("");
  const segmentIndexRef = useRef(0);
  const accessTokenRef = useRef<string>("");

  const teardown = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    try {
      sdkStreamRef.current?.requestClose();
    } catch {
      /* may already be closed */
    }
    sdkStreamRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    segmentIndexRef.current = 0;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("stopped");

    if (accessTokenRef.current) {
      fetch("/api/watch/revoke", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessTokenRef.current }),
      }).catch(() => {});
      accessTokenRef.current = "";
    }
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(
    async (watchedSignals: string[]) => {
      try {
        setStatus("starting");
        setError(null);
        setSignals([]);

        // 1. Request camera + mic
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => {});
        }

        // 2. Mint a client token
        const sessionRes = await fetch("/api/watch/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent: { cameraMic: true } }),
        });
        if (!sessionRes.ok) throw new Error("Failed to create watch session");
        const { sessionId, accessToken } = (await sessionRes.json()) as {
          sessionId: string;
          accessToken: string;
          expiresAt: string;
        };
        sessionIdRef.current = sessionId;
        accessTokenRef.current = accessToken;

        // 3. Connect to Interhuman via the SDK
        const client = new InterhumanClient({ accessToken });
        const stream = client.stream();
        sdkStreamRef.current = stream;

        stream.on("signal.detected", (ev: SignalDetectedEvent) => {
          const signal = ev.data;
          const signalType = signal.signal_type;
          console.log("[signal detected]", {
            type: signalType,
            probability: signal.probability,
            rationale: signal.rationale,
            start: signal.start,
            sessionId,
          });

          if (watchedSignals.length === 0 || watchedSignals.includes(signalType)) {
            const windowIndex = Math.max(0, segmentIndexRef.current - 1);
            const entry: SignalEntry = {
              type: "watch.signal.detected",
              sessionId,
              index: windowIndex,
              signal: {
                type: signalType as SignalEntry["signal"]["type"],
                start: signal.start,
                probability: signal.probability ?? undefined,
                rationale: signal.rationale ?? undefined,
              },
              receivedAt: Date.now(),
            };
            setSignals((prev) => [...prev, entry]);
          }
        });

        stream.on("session.ready", () => {
          stream.updateConfig({
            include: ["conversation_quality_overall", "conversation_quality_timeline"],
          });
        });

        stream.on("socketError", (err) => {
          console.error("[watch] socket error:", err);
          setError("WebSocket connection failed");
          setStatus("error");
          teardown();
        });

        stream.on("close", () => {
          if (status !== "stopping" && status !== "stopped") {
            teardown();
          }
        });

        await stream.connect();

        // 4. Start MediaRecorder — 5s timeslice
        const mimeType = getSupportedMimeType();
        const recorder = new MediaRecorder(mediaStream, {
          mimeType,
          videoBitsPerSecond: 250_000,
          audioBitsPerSecond: 64_000,
        });
        recorderRef.current = recorder;

        recorder.ondataavailable = async (evt) => {
          if (!evt.data || evt.data.size === 0) return;
          if (!sdkStreamRef.current) return;

          const ab = await evt.data.arrayBuffer();
          sdkStreamRef.current.sendVideo(new Uint8Array(ab));
          segmentIndexRef.current++;
        };

        recorder.onerror = () => {
          setError("MediaRecorder error");
          setStatus("error");
          teardown();
        };

        recorder.start(WINDOW_MS);
        setStatus("live");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus("error");
        teardown();
      }
    },
    [teardown, status],
  );

  const stop = useCallback(() => {
    setStatus("stopping");
    teardown();
  }, [teardown]);

  return { status, error, signals, videoRef, start, stop };
}

function getSupportedMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const mt of candidates) {
    if (MediaRecorder.isTypeSupported(mt)) return mt;
  }
  return "video/webm";
}