import { z } from "zod";

const optionalStr = z
  .string()
  .transform((v) => (v.trim() === "" ? undefined : v))
  .pipe(z.string().optional());

const EnvSchema = z.object({
  INTERHUMAN_API_KEY: z.string().min(1, "INTERHUMAN_API_KEY is required"),
  ELEVENLABS_API_KEY: optionalStr,
  ELEVENLABS_VOICE_ID: optionalStr,
  OPENAI_API_KEY: optionalStr,
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
});

export type WebEnv = z.infer<typeof EnvSchema>;

let cached: WebEnv | null = null;

export function getEnv(): WebEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid web environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
