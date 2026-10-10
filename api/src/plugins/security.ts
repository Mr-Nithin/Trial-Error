import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";

/** Security headers for every response (JSON API + media, served same-origin via the web proxy). */
export const securityHeaders = fp(
  async (app) => {
    await app.register(helmet, {
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-site" },
    });
  },
  { name: "arc-security-headers" },
);

/** CORS only when WEB_ORIGIN is configured (dev: web on another port without the rewrite). */
export const corsAllowlist = fp<{ origins: string[] }>(
  async (app, opts) => {
    if (!opts.origins.length) return;
    await app.register(cors, { origin: opts.origins, credentials: true });
  },
  { name: "arc-cors" },
);
