import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../db/client.js";
import { toUserDTO } from "../lib/dto.js";
import { loginSchema, signupSchema, updateMeSchema } from "../lib/schemas.js";
import { createSession, deleteSession, SESSION_COOKIE } from "../lib/session.js";
import { currentUser } from "../plugins/auth.js";
import { authRouteLimit, type RateLimitOptions } from "../plugins/rate-limit.js";
import { login, signup, updateMe } from "../services/auth.js";

export interface AuthRouteOptions {
  db: Db;
  ttlDays: number;
  limits: RateLimitOptions | false;
}

const authRoutes: FastifyPluginAsyncZod<AuthRouteOptions> = async (app, { db, ttlDays, limits }) => {
  const strict = authRouteLimit(limits);

  app.post("/signup", { schema: { body: signupSchema }, config: strict }, async (req, reply) => {
    const user = await signup(db, req.body);
    const s = await createSession(db, user.id, ttlDays);
    app.setSessionCookie(reply, s.token, s.expiresAt);
    return reply.code(201).send(toUserDTO(user));
  });

  app.post("/login", { schema: { body: loginSchema }, config: strict }, async (req, reply) => {
    const user = await login(db, req.body);
    const s = await createSession(db, user.id, ttlDays);
    app.setSessionCookie(reply, s.token, s.expiresAt);
    return toUserDTO(user);
  });

  app.post("/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await deleteSession(db, token);
    app.clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/me", { onRequest: app.requireAuth }, async (req) => toUserDTO(currentUser(req)));

  app.patch("/me", { onRequest: app.requireAuth, schema: { body: updateMeSchema } }, async (req) =>
    toUserDTO(await updateMe(db, currentUser(req).id, req.body)),
  );
};

export default authRoutes;
