import { WatchTtsRequestSchema } from "@repo/shared";
import { getEnv } from "@/lib/server/env";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel — calm, measured

export async function POST(req: Request) {
  const env = getEnv();

  if (!env.ELEVENLABS_API_KEY) {
    return new Response(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = WatchTtsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const voiceId = env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  // This runs in the background during a real conversation — the other person
  // should barely hear it, so we ALWAYS force a quiet whisper. Strip any audio
  // tag the caller supplied and prepend our own guaranteed whisper tag.
  const stripped = parsed.data.text.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
  const text = `[whispering very quietly] ${stripped}`;

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_v3",
        // v3 stability is bucketed: 0.0 = Creative (honors delivery tags like
        // [whispering] most faithfully), 0.5 = Natural, 1.0 = Robust.
        voice_settings: {
          stability: 0.0,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: false,
        },
      }),
    },
  );

  if (!elRes.ok) {
    const errText = await elRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: `elevenlabs error ${elRes.status}: ${errText}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(elRes.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
