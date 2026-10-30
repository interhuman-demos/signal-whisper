import { EventEmitter } from "node:events";
import WebSocket from "ws";
import {
  type InterhumanEvent,
  type StreamConfig,
  parseInterhumanEvent,
} from "@repo/shared";
import { type Env, interhumanWsUrl } from "./env.js";

/**
 * Thin wrapper over the upstream Interhuman streaming WebSocket. Opens the
 * connection with the server-side API key, sends session config, exposes
 * `sendSegment` for binary frames, and emits parsed event envelopes.
 */
export class InterhumanClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly env: Env;

  constructor(env: Env) {
    super();
    this.env = env;
  }

  connect(config?: StreamConfig): Promise<void> {
    const url = interhumanWsUrl(this.env);
    if (!this.env.INTERHUMAN_API_KEY) {
      return Promise.reject(new Error("INTERHUMAN_API_KEY is not configured"));
    }
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: { Authorization: `Bearer ${this.env.INTERHUMAN_API_KEY}` },
        perMessageDeflate: false,
      });
      this.ws = ws;

      ws.on("open", () => {
        if (config) ws.send(JSON.stringify(config));
        resolve();
      });

      ws.on("message", (data) => {
        let raw: unknown;
        try {
          raw = JSON.parse(data.toString());
        } catch {
          return;
        }
        const event = parseInterhumanEvent(raw);
        if (event) this.emit("event", event satisfies InterhumanEvent);
        else this.emit("unknown", raw);
      });

      ws.on("error", (err) => {
        this.emit("error", err);
        reject(err);
      });

      ws.on("close", (code, reason) => {
        this.emit("close", code, reason.toString());
      });
    });
  }

  sendSegment(bytes: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Interhuman socket is not open");
    }
    this.ws.send(bytes);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  on(event: "event", listener: (e: InterhumanEvent) => void): this;
  on(event: "unknown", listener: (raw: unknown) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "close", listener: (code: number, reason: string) => void): this;
  on(event: string, listener: (...args: never[]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
}
