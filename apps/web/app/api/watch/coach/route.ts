import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  type WatchCoachHistory,
  WatchCoachRequestSchema,
  WatchCoachResponseSchema,
} from "@repo/shared";
import { getEnv } from "@/lib/server/env";

export type { WatchCoachResponse } from "@repo/shared";

const PhraseSchema = z.object({
  phrase: z
    .string()
    .describe(
      "Just the spoken words of the coaching nudge — a witty, specific one-liner, max ~16 words. Do NOT include any audio tags or stage directions; the delivery is whispered automatically.",
    ),
});

function fallbackPhrase(signalType: string, name?: string): string {
  const lead = name ? `${name}, ` : "";
  return `${lead}heads up — ${signalType} detected.`;
}

/** Turn the rolling session memory into a compact prompt block for the coach. */
function buildMemoryBlock(
  current: string,
  history?: WatchCoachHistory,
): string | null {
  if (!history || history.totalCount === 0) return null;

  const lines: string[] = ["SESSION MEMORY (use this to escalate / call back / avoid repeats):"];
  lines.push(`- Total signals so far this session: ${history.totalCount}.`);

  const counts = Object.entries(history.countsByType)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([type, n]) => `${type} ×${n}`)
    .join(", ");
  if (counts) lines.push(`- Counts by type: ${counts}.`);

  const priorOfSame = history.countsByType[current as keyof typeof history.countsByType] ?? 0;
  if (priorOfSame > 0) {
    lines.push(
      `- "${current}" has already happened ${priorOfSame} time(s) before this one${
        history.currentStreak && history.currentStreak > 1
          ? ` (and ${history.currentStreak} in a row right now — escalate!)`
          : ""
      }.`,
    );
  }

  if (history.recent?.length) {
    lines.push("- Recent timeline (oldest→newest), with the cue actually observed for each:");
    for (const r of history.recent) {
      const ago = r.secondsAgo != null ? `${r.secondsAgo}s ago` : "recently";
      const cue = r.rationale ? ` — observed: ${r.rationale}` : "";
      lines.push(`   • ${r.type} (${ago})${cue}`);
    }
  }

  if (history.recentPhrases?.length) {
    lines.push("- Phrases you ALREADY said (do NOT repeat these):");
    for (const p of history.recentPhrases) lines.push(`   • ${p}`);
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  const env = getEnv();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = WatchCoachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { signalType, rationale, probability, name, history } = parsed.data;

  // Without a key, return a deterministic fallback so the whisper still fires.
  if (!env.OPENAI_API_KEY) {
    const json: z.infer<typeof WatchCoachResponseSchema> = {
      phrase: fallbackPhrase(signalType, name),
    };
    return Response.json(json);
  }

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  const nameLine = name
    ? `Address the person by name once at the very start: "${name}".`
    : "Do not use any name.";

  const detail = [
    `Detected social signal: ${signalType}.`,
    probability ? `Confidence: ${probability}.` : null,
    rationale ? `Observed cues: ${rationale}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const memory = buildMemoryBlock(signalType, history);

  try {
    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: PhraseSchema,
      system: [
        "You are a cheeky but kind social coach secretly whispering into someone's earpiece during a live, in-person conversation. This runs in the background and the other person must NOT notice — keep it short and discreet.",
        "Your job: react to the specific physical/verbal cue that was observed and give one tiny, actionable nudge — with a light, funny, affectionate touch. Think gentle teasing, not insults.",
        "Output ONLY the spoken words. Do NOT include any audio tags, brackets, stage directions, or emoji — the whispered delivery is applied automatically downstream.",
        "Keep it to ONE short spoken sentence, ideally under 16 words. They'll hear it mid-conversation, so brevity is everything.",
        "CRITICAL — STAY FACTUAL: Anchor the joke ONLY in the cue described in the current 'Observed cues' line. Reference that specific behavior. NEVER invent or mention a cue (filler words, hands, neck-touching, blinking, etc.) unless it actually appears in THIS detection's observed cues. If the cue is vague, keep the nudge general rather than fabricating a specific behavior.",
        "USE THE MEMORY only for repetition awareness: if the SAME observed cue keeps recurring in the timeline, you may escalate the teasing and acknowledge it ('again?', 'that's the third time'). Match repetition to the actual observed cues listed in memory, not just the signal type. NEVER repeat a phrase you've already used — keep each whisper fresh.",
        'These are FORMAT/TONE examples only — do not copy their cues; use the real observed cue instead. When a name is provided, you may open with it: "Hey [name], [observed cue] — they can see you." / "[name], that\'s twice now with the [observed cue]." When NO name is provided, drop the name entirely: "[observed cue] — they can see you." / "That\'s twice now with the [observed cue]."',
        "No preamble, no explanation, no markdown, no surrounding quotes. Just the sentence.",
        nameLine,
      ].join(" "),
      prompt: memory ? `${detail}\n\n${memory}` : detail,
      maxOutputTokens: 80,
    });

    const phrase = object.phrase.trim().slice(0, 200) || fallbackPhrase(signalType, name);
    const json: z.infer<typeof WatchCoachResponseSchema> = { phrase };
    return Response.json(json);
  } catch {
    // Best-effort — fall back to the basic phrase rather than dropping the whisper.
    const json: z.infer<typeof WatchCoachResponseSchema> = {
      phrase: fallbackPhrase(signalType, name),
    };
    return Response.json(json);
  }
}
