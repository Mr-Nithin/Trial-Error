import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/client.js";
import type { UserRow } from "../db/schema.js";
import { unauthorized } from "../lib/errors.js";
import { resolveSession, SESSION_COOKIE } from "../lib/session.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the session hook when a valid `arc_session` cookie is present. */
    user: UserRow | null;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    setSessionCookie: (reply: FastifyReply, token: string, expiresAt: Date) => void;
    clearSessionCookie: (reply: FastifyReply) => void;
  }
}

export interface AuthOptions {
  db: Db;
  ttlDays: number;
  secure: boolean;
}

/** The authenticated user; only call behind `requireAuth`. */
export function currentUser(req: FastifyRequest): UserRow {
  if (!req.user) throw unauthorized();
  return req.user;
}

/**
 * Session auth. Runs in onRequest (after cookie parsing, before body parsing/validation) so
 * unauthenticated requests are rejected before we spend time on their bodies.
 */
export const sessionAuth = fp<AuthOptions>(
  async (app, opts) => {
    await app.register(cookie);
    const base = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: opts.secure };

    app.decorate("setSessionCookie", (reply: FastifyReply, token: string, expiresAt: Date) => {
      reply.setCookie(SESSION_COOKIE, token, {
        ...base,
        maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
      });
    });
    app.decorate("clearSessionCookie", (reply: FastifyReply) => {
      reply.clearCookie(SESSION_COOKIE, base);
    });
    app.decorateRequest("user", null);

    app.addHook("onRequest", async (req, reply) => {
      const token = req.cookies[SESSION_COOKIE];
      if (!token) return;
      const res = await resolveSession(opts.db, token, opts.ttlDays);
      if (!res) {
        app.clearSessionCookie(reply);
        return;
      }
      req.user = res.user;
      if (res.renewedUntil) app.setSessionCookie(reply, token, res.renewedUntil); // sliding renewal
    });

    app.decorate("requireAuth", async (req: FastifyRequest) => {
      if (!req.user) throw unauthorized();
    });
  },
  { name: "arc-session-auth" },
);
