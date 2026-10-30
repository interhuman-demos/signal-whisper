import { z } from "zod";

const optionalStr = z
  .string()
  .transform((v) => (v.trim() === "" ? undefined : v))
  .pipe(z.string().optional());

const EnvSchema = z.object({
  INTERHUMAN_API_KEY: optionalStr,
  DEMO_STREAM_PROXY_TOKEN_SECRET: z
    .string()
    .min(16, "DEMO_STREAM_PROXY_TOKEN_SECRET must be at least 16 chars"),
  PORT: z.coerce.number().int().positive().default(8787),
  API_PLATFORM_BASE_URL: z.string().url().default("https://api.interhuman.ai"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid stream-proxy environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Interhuman WebSocket URL derived from the platform base URL. */
export function interhumanWsUrl(env: Env): string {
  const base = env.API_PLATFORM_BASE_URL.replace(/^http/, "ws");
  return `${base}/v1/stream/analyze`;
}
