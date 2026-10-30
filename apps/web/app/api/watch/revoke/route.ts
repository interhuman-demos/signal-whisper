import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthClient } from "@interhumanai/sdk";
import { getEnv } from "@/lib/server/env";

const RequestSchema = z.object({
  token: z.string().min(1),
});

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

  const env = getEnv();
  const auth = new AuthClient();

  try {
    await auth.revokeClientToken({
      apiKey: env.INTERHUMAN_API_KEY,
      token: parsed.data.token,
    });
  } catch {
    // Best-effort — token may already be expired
  }

  return NextResponse.json({ ok: true });
}
