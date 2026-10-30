import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthClient } from "@interhumanai/sdk";
import { getEnv } from "@/lib/server/env";

const RequestSchema = z.object({
  consent: z.object({
    cameraMic: z.boolean(),
  }),
});

const ResponseSchema = z.object({
  sessionId: z.string(),
  accessToken: z.string(),
  expiresAt: z.string(),
});
export type WatchSessionResponse = z.infer<typeof ResponseSchema>;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.consent.cameraMic) {
    return NextResponse.json(
      { error: "camera/mic consent required" },
      { status: 400 },
    );
  }

  const env = getEnv();
  const sessionId = randomUUID();

  const auth = new AuthClient();
  const tokenRes = await auth.createClientToken({
    apiKey: env.INTERHUMAN_API_KEY,
    scopes: ["interhumanai.stream"],
    expiresIn: 600,
    maxConcurrent: 1,
  });

  const expiresAt = new Date(
    Date.now() + tokenRes.expires_in * 1000,
  ).toISOString();

  const response: WatchSessionResponse = {
    sessionId,
    accessToken: tokenRes.access_token,
    expiresAt,
  };
  return NextResponse.json(response);
}
