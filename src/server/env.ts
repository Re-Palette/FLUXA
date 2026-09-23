import "server-only";
import { z } from "zod";
import { googleSetupStatus } from "@/lib/google-setup";
import "./memory-db"; // memory-db: applies zero-config defaults before the environment is validated

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required (32 bytes, base64)"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  PLATFORM_AI_ENABLED: z.enum(["true", "false"]).default("false"),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated server environment. Parsed lazily so `next build` works without secrets. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function googleOAuthConfigured(): boolean {
  return googleSetupStatus(process.env).configured;
}

export const isProduction = () => process.env.NODE_ENV === "production";

/** Secure cookies only when the app is actually served over HTTPS (http://localhost must still work). */
export const secureCookies = () => (process.env.APP_URL ?? "").startsWith("https://");

/** True when APP_URL points at this machine (local development or a local production build). */
export const isLocalApp = () => {
  // Hosted platforms (Vercel sets VERCEL=1) are never "local", even if APP_URL was left unset.
  if (process.env.VERCEL) return false;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(process.env.APP_URL ?? "http://localhost:3000");
};
