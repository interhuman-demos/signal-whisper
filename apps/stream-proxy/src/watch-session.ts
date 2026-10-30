import WebSocket from "ws";
import {
  MIN_SEGMENT_BYTES,
  MAX_SEGMENT_BYTES,
  windowIndexForStart,
  type WatchConnectionEstablished,
  type WatchWindowStatus,
  type WatchSignalDetected,
  type WatchError,
  type WatchConnectionClosed,
} from "@repo/shared";
import { type Env } from "./env.js";
import { InterhumanClient } from "./interhuman-client.js";

function send(ws: WebSocket, payload: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * Manages a single browser WebSocket session: opens the upstream Interhuman
 * connection, queues incoming binary windows in order, and forwards normalized
 * watch events back to the browser.
 */
export function handleWatchSession(
  browserWs: WebSocket,
  sessionId: string,
  env: Env,
): void {
  const client = new InterhumanClient(env);
  let windowIndex = 0;
  // Promise queue ensures windows are sent to Interhuman in order.
  let segmentQueue = Promise.resolve();

  const established: WatchConnectionEstablished = {
    type: "watch.connection.established",
    sessionId,
  };
  send(browserWs, established);

  // Connect to Interhuman upstream (no CQI needed for this demo).
  client.connect().catch((err: Error) => {
    const errorEvent: WatchError = {
      type: "watch.error",
      sessionId,
      code: "upstream-connect-failed",
      message: err.message,
    };
    send(browserWs, errorEvent);
    browserWs.close(1011, "upstream connect failed");
  });

  client.on("event", (event) => {
    if (event.type === "signal.detected") {
      const index = windowIndexForStart(event.data.start);
      const signalEvent: WatchSignalDetected = {
        type: "watch.signal.detected",
        sessionId,
        index,
        signal: {
          type: event.data.signal_type,
          start: event.data.start,
          end: event.data.end,
          probability: event.data.probability,
          rationale: event.data.rationale,
        },
      };
      send(browserWs, signalEvent);
    }
  });

  client.on("error", (err) => {
    const errorEvent: WatchError = {
      type: "watch.error",
      sessionId,
      code: "upstream-error",
      message: err.message,
    };
    send(browserWs, errorEvent);
  });

  client.on("close", (code, reason) => {
    const closedEvent: WatchConnectionClosed = {
      type: "watch.connection.closed",
      sessionId,
      reason: reason || `upstream closed with code ${code}`,
    };
    send(browserWs, closedEvent);
    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.close(1000, "upstream closed");
    }
  });

  browserWs.on("message", (data, isBinary) => {
    if (!isBinary) return; // ignore any text frames from browser

    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

    if (bytes.length < MIN_SEGMENT_BYTES || bytes.length > MAX_SEGMENT_BYTES) {
      console.warn(
        `[watch] session=${sessionId} skipping segment: ${bytes.length} bytes out of range`,
      );
      return;
    }

    const currentIndex = windowIndex++;

    const statusAnalyzing: WatchWindowStatus = {
      type: "watch.window.status",
      sessionId,
      index: currentIndex,
      status: "analyzing",
    };
    send(browserWs, statusAnalyzing);

    segmentQueue = segmentQueue.then(() => {
      try {
        client.sendSegment(bytes);
        const statusComplete: WatchWindowStatus = {
          type: "watch.window.status",
          sessionId,
          index: currentIndex,
          status: "complete",
        };
        send(browserWs, statusComplete);
      } catch (err) {
        console.error(`[watch] sendSegment error: ${String(err)}`);
        const statusFailed: WatchWindowStatus = {
          type: "watch.window.status",
          sessionId,
          index: currentIndex,
          status: "failed",
        };
        send(browserWs, statusFailed);
      }
    });
  });

  browserWs.on("close", () => {
    client.close();
  });

  browserWs.on("error", (err) => {
    console.error(`[watch] browser ws error: ${err.message}`);
    client.close();
  });
}
