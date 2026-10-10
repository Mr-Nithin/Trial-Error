import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { ApiError } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Route accepts multipart/form-data instead of JSON (media upload). */
    allowMultipart?: boolean;
  }
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hasBody(req: FastifyRequest): boolean {
  const len = req.headers["content-length"];
  if (len !== undefined) return len !== "0";
  return req.headers["transfer-encoding"] !== undefined;
}

function firstHeader(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.split(",")[0]?.trim() || undefined;
}

export interface CsrfOptions {
  allowedOrigins: string[];
  trustProxy: boolean;
}

/**
 * CSRF defence for state-changing requests:
 *  1. If an Origin header is present it must match our Host (or X-Forwarded-Host when the proxy
 *     is trusted) or be in the WEB_ORIGIN allowlist.
 *  2. Bodies must be application/json (multipart only on routes that opt in). Simple cross-site
 *     form posts can't send JSON, so this closes the "text/plain" form CSRF hole.
 * Combined with SameSite=Lax cookies.
 */
export const csrfProtection = fp<CsrfOptions>(
  async (app, opts) => {
    const allow = new Set(opts.allowedOrigins);
    app.addHook("onRequest", async (req) => {
      if (!UNSAFE.has(req.method)) return;

      const origin = req.headers.origin;
      if (origin !== undefined) {
        let ok = false;
        try {
          const u = new URL(origin);
          const host = req.headers.host;
          const fwdHost = opts.trustProxy ? firstHeader(req.headers["x-forwarded-host"]) : undefined;
          ok = allow.has(u.origin) || (!!host && u.host === host) || (!!fwdHost && u.host === fwdHost);
        } catch {
          ok = false; // includes Origin: null
        }
        if (!ok) throw new ApiError(403, "forbidden_origin", "Cross-origin request rejected");
      }

      if (hasBody(req)) {
        const ct = (req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
        const expected = req.routeOptions.config?.allowMultipart ? "multipart/form-data" : "application/json";
        if (ct !== expected) {
          throw new ApiError(415, "unsupported_media_type", `Content-Type must be ${expected}`);
        }
      }
    });
  },
  { name: "arc-csrf" },
);
