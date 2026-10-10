import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessions } from "../src/db/schema.js";
import { hashToken } from "../src/lib/session.js";
import { Client, sessionToken, signedIn, useApp } from "./helpers.js";

const ctx = useApp();

describe("auth", () => {
  it("signs up, sets a hardened session cookie, and returns the user", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { name: "  Nithin ", email: "  Nithin@Example.COM ", password: "password123" },
    });
    expect(res.statusCode).toBe(201);
    const user = res.json();
    expect(user).toMatchObject({ email: "nithin@example.com", name: "Nithin" });
    expect(Object.keys(user).sort()).toEqual(["createdAt", "email", "id", "name"]);

    const cookie = res.cookies.find((c) => c.name === "arc_session")!;
    expect(cookie).toBeDefined();
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.path).toBe("/");
    expect(cookie.secure).toBeFalsy();
    expect(cookie.maxAge).toBeGreaterThan(29 * 24 * 3600);

    // Only the hash of the token is stored.
    const rows = await ctx.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(hashToken(cookie.value));
    expect(rows[0]!.id).not.toBe(cookie.value);
  });

  it("rejects duplicate email with 409 email_taken (case-insensitive)", async () => {
    await signedIn(ctx.app, "dupe@example.com");
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { name: "X", email: "DUPE@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("email_taken");
  });

  it("logs in; wrong password and unknown email give the same 401", async () => {
    await signedIn(ctx.app, "login@example.com");
    const ok = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "LOGIN@example.com", password: "password123" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().email).toBe("login@example.com");
    expect(sessionToken(ok)).toBeTruthy();

    const wrong = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "login@example.com", password: "nope-nope-nope" },
    });
    const unknown = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ghost@example.com", password: "password123" },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json().error.code).toBe("invalid_credentials");
  });

  it("me / patch me / logout", async () => {
    const c = await signedIn(ctx.app, "me@example.com");
    const me = await c.get("/api/auth/me");
    expect(me.statusCode).toBe(200);
    expect(me.json().id).toBe(c.user.id);

    const patched = await c.patch("/api/auth/me", { name: "New Name" });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().name).toBe("New Name");

    const out = await c.post("/api/auth/logout");
    expect(out.statusCode).toBe(204);
    const cleared = out.cookies.find((c) => c.name === "arc_session")!;
    expect(cleared.value).toBe("");
    expect((await ctx.db.select().from(sessions)).length).toBe(0);

    const after = await c.get("/api/auth/me");
    expect(after.statusCode).toBe(401);
    expect(after.json()).toEqual({ error: { code: "unauthorized", message: expect.any(String) } });
  });

  it("logout works without a session", async () => {
    const res = await new Client(ctx.app).post("/api/auth/logout");
    expect(res.statusCode).toBe(204);
  });

  it("returns 401 on protected routes without a cookie or with a bogus one", async () => {
    expect((await ctx.app.inject({ method: "GET", url: "/api/projects" })).statusCode).toBe(401);
    expect((await new Client(ctx.app, "bogus").get("/api/projects")).statusCode).toBe(401);
    // Rejected before body validation.
    const res = await ctx.app.inject({ method: "POST", url: "/api/projects", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("rejects and deletes expired sessions", async () => {
    const c = await signedIn(ctx.app);
    await ctx.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    const res = await c.get("/api/auth/me");
    expect(res.statusCode).toBe(401);
    expect((await ctx.db.select().from(sessions)).length).toBe(0);
  });

  it("slides the session expiry when less than half the TTL remains", async () => {
    const c = await signedIn(ctx.app);
    const id = hashToken(c.token!);
    const soon = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    await ctx.db.update(sessions).set({ expiresAt: soon }).where(eq(sessions.id, id));
    const res = await c.get("/api/auth/me");
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((x) => x.name === "arc_session");
    expect(cookie?.value).toBe(c.token);
    const [row] = await ctx.db.select().from(sessions).where(eq(sessions.id, id));
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);

    // Fresh sessions are not re-set on every request.
    const again = await c.get("/api/auth/me");
    expect(again.cookies.find((x) => x.name === "arc_session")).toBeUndefined();
  });

  it("validates signup input", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { name: "", email: "not-an-email", password: "short" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("validation");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThanOrEqual(3);
  });
});
