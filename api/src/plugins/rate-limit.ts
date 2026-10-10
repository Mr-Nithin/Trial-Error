import fp from "fastify-plugin";
import type { FastifyContextConfig } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { ApiError } from "../lib/errors.js";

export interface RateLimitOptions {
  /** Requests per minute per IP across the API. */
  globalMax: number;
  /** Requests per minute per IP on /api/auth/login and /api/auth/signup. */
  authMax: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitOptions = { globalMax: 300, authMax: 10 };

/** Route config for the strict auth limit; harmless if the plugin isn't registered. */
export const authRouteLimit = (limits: RateLimitOptions | false): FastifyContextConfig =>
  limits ? { rateLimit: { max: limits.authMax, timeWindow: "1 minute" } } : {};

export const rateLimiting = fp<{ limits: RateLimitOptions | false }>(
  async (app, opts) => {
    if (!opts.limits) return;
    await app.register(rateLimit, {
      global: true,
      max: opts.limits.globalMax,
      timeWindow: "1 minute",
      errorResponseBuilder: (_req, ctx) =>
        new ApiError(429, "rate_limited", `Too many requests, retry in ${ctx.after}`),
    });
  },
  { name: "arc-rate-limit" },
);
