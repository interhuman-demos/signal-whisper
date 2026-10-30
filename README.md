# Signal Whisper

Real-time social signal detection with spoken alerts. Pick which signals to watch for (stress, hesitation, confusion, etc.), start a session, and an ElevenLabs voice whispers in your ear the moment one is detected.

## How it works

1. The browser captures your camera/mic and streams video segments over a WebSocket.
2. A lightweight **stream proxy** (`apps/stream-proxy`) authenticates the connection with a short-lived HMAC token and forwards segments to the [Interhuman API](https://interhuman.ai), which detects social signals in real time.
3. Detected signals are forwarded back to the browser as typed events.
4. The **Next.js web app** (`apps/web`) filters for the signals you care about and queues an ElevenLabs TTS whisper for each one. An optional OpenAI-powered coach call adds a brief rationale.

## Repo structure

```
apps/
  web/            Next.js 15 app — UI, API routes, TTS, session management
  stream-proxy/   Node.js WebSocket proxy — bridges browser ↔ Interhuman API
packages/
  shared/         Zod schemas and TypeScript types shared across apps
```

## Prerequisites

- Node.js ≥ 20
- [pnpm](https://pnpm.io) 10+
- An [Interhuman](https://interhuman.ai) API key
- An [ElevenLabs](https://elevenlabs.io) API key and voice ID (optional — falls back to visual-only mode)
- An [OpenAI](https://platform.openai.com) API key (optional — falls back to a generic whisper message)

## Setup

**1. Install dependencies**

```bash
pnpm install
```

**2. Configure the stream proxy**

```bash
cp apps/stream-proxy/.env.example apps/stream-proxy/.env.local
```

Edit `apps/stream-proxy/.env.local`:

```env
INTERHUMAN_API_KEY=<your key>
DEMO_STREAM_PROXY_TOKEN_SECRET=<random string, min 16 chars>
```

**3. Configure the web app**

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
INTERHUMAN_API_KEY=<your Interhuman API key>

ELEVENLABS_API_KEY=<your key>
ELEVENLABS_VOICE_ID=<your voice ID>

OPENAI_API_KEY=<your key>

PUBLIC_BASE_URL=http://localhost:3000
```

## Development

Start both apps in parallel with Turbo:

```bash
pnpm dev
```

| App | URL |
|---|---|
| Web | http://localhost:3000 |
| Stream proxy | http://localhost:8787 |

## Build

```bash
pnpm build
```

## Signals

The Interhuman API detects 12 social signals:

`agreement` · `confidence` · `confusion` · `disagreement` · `disengagement` · `engagement` · `frustration` · `hesitation` · `interest` · `skepticism` · `stress` · `uncertainty`

Each signal comes with a probability rating (`high`, `medium`, `low`) and a short rationale.
