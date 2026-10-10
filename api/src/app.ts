import Fastify, { type FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import type { S3Client } from "@aws-sdk/client-s3";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Config } from "./config.js";
import { createDb, type Db } from "./db/client.js";
import { ApiError } from "./lib/errors.js";
import { createS3 } from "./lib/s3.js";
import { sessionAuth } from "./plugins/auth.js";
import { csrfProtection } from "./plugins/csrf.js";
import { errorHandler } from "./plugins/errors.js";
import { genReqId, loggerOptions, requestLogging } from "./plugins/logging.js";
import { DEFAULT_RATE_LIMITS, rateLimiting, type RateLimitOptions } from "./plugins/rate-limit.js";
import { corsAllowlist, securityHeaders } from "./plugins/security.js";
import { zodValidation } from "./plugins/validation.js";
import authRoutes from "./routes/auth.js";
import mediaRoutes from "./routes/media.js";
import projectRoutes from "./routes/projects.js";
import runRoutes from "./routes/runs.js";
import stepRoutes from "./routes/steps.js";
import versionRoutes from "./routes/versions.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    s3: S3Client;
    config: Config;
  }
}

export interface BuildAppOptions {
  config: Config;
  /** Inject an existing drizzle instance (tests, seed). Otherwise a pool is created and closed with the app. */
  db?: Db;
  s3?: S3Client;
  /** false disables rate limiting; default: on, except when NODE_ENV=test. */
  rateLimit?: Partial<RateLimitOptions> | false;
  /** Enable the pino request logger (default true unless NODE_ENV=test). */
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { config } = opts;
  const isTest = config.NODE_ENV === "test";

  const app = Fastify({
    logger: loggerOptions(config.LOG_LEVEL, opts.logger ?? !isTest),
    genReqId,
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  let db = opts.db;
  if (!db) {
    const created = createDb(config.DATABASE_URL);
    db = created.db;
    app.addHook("onClose", async () => created.pool.end());
  }
  const s3 = opts.s3 ?? createS3(config);
  app.decorate("db", db);
  app.decorate("s3", s3);
  app.decorate("config", config);

  const limits: RateLimitOptions | false =
    opts.rateLimit === false || (opts.rateLimit === undefined && isTest)
      ? false
      : { ...DEFAULT_RATE_LIMITS, ...(opts.rateLimit ?? {}) };

  // Order matters: onRequest hooks run in registration order.
  await app.register(errorHandler);
  await app.register(requestLogging);
  await app.register(securityHeaders);
  await app.register(corsAllowlist, { origins: config.WEB_ORIGIN });
  await app.register(rateLimiting, { limits });
  await app.register(csrfProtection, { allowedOrigins: config.WEB_ORIGIN, trustProxy: config.TRUST_PROXY });
  await app.register(zodValidation);
  await app.register(sessionAuth, { db, ttlDays: config.SESSION_TTL_DAYS, secure: config.COOKIE_SECURE });

  await app.register(
    async (api) => {
      api.get("/health", async () => {
        try {
          await db.execute(sql`select 1`);
        } catch (err) {
          api.log.error({ err }, "health check: database unreachable");
          throw new ApiError(503, "unavailable", "Database unavailable");
        }
        return { ok: true };
      });

      await api.register(authRoutes, { prefix: "/auth", db, ttlDays: config.SESSION_TTL_DAYS, limits });

      await api.register(async (priv) => {
        priv.addHook("onRequest", priv.requireAuth);
        await priv.register(projectRoutes, { db });
        await priv.register(versionRoutes, { db });
        await priv.register(stepRoutes, { db });
        await priv.register(runRoutes, { db });
        await priv.register(mediaRoutes, { db, s3, bucket: config.S3_BUCKET });
      });
    },
    { prefix: "/api" },
  );

  return app;
}
