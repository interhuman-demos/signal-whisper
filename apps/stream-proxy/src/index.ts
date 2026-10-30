import { createServer, type ServerResponse } from "node:http";
import { WebSocketServer } from "ws";
import { getEnv } from "./env.js";
import { verifyToken } from "./token.js";
import { handleWatchSession } from "./watch-session.js";

const env = getEnv();

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/healthz") {
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: "not found" });
});

/**
 * WebSocket upgrade handler. Only accepts /v1/watch/stream.
 *
 * The browser passes the short-lived HMAC token as the WebSocket subprotocol
 * (the only way to authenticate from a browser without exposing a key). The
 * server MUST echo one accepted protocol or the browser rejects the upgrade.
 */
const wss = new WebSocketServer({
  noServer: true,
  handleProtocols(protocols) {
    // Echo the first (and only) protocol offered — the HMAC token.
    return protocols.values().next().value ?? false;
  },
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname !== "/v1/watch/stream") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  // Token is passed as the Sec-WebSocket-Protocol header value.
  const protocolHeader = req.headers["sec-websocket-protocol"] ?? "";
  const token = protocolHeader.split(",")[0]?.trim() ?? "";

  const verified = verifyToken(token, env.DEMO_STREAM_PROXY_TOKEN_SECRET);
  if (!verified.ok || !verified.sessionId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const sessionId = verified.sessionId;

  wss.handleUpgrade(req, socket, head, (ws) => {
    console.log(`[watch] session=${sessionId} connected`);
    handleWatchSession(ws, sessionId, env);
  });
});

server.listen(env.PORT, () => {
  console.log(`stream-proxy listening on :${env.PORT}`);
});
