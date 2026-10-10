import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().trim().min(1).default("us-east-1"),
  S3_BUCKET: z.string().trim().min(1).default("arc-media"),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  COOKIE_SECURE: bool,
  /** Trust X-Forwarded-* from the proxy in front of us (e.g. Next rewrites). */
  TRUST_PROXY: bool,
  WEB_ORIGIN: optionalString.transform((v) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim().replace(/\/+$/, ""))
          .filter(Boolean)
      : [],
  ),
  SESSION_TTL_DAYS: z.coerce.number().positive().max(3650).default(30),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  return parsed.data;
}
