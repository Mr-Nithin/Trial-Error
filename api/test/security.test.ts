import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { breakfastProject, signedIn, useApp } from "./helpers.js";

const ctx = useApp();

describe("CSRF defence", () => {
  it("rejects a mismatched Origin with 403 and accepts a matching one", async () => {
    const c = await signedIn(ctx.app);
    const bad = await c.inject({
      method: "POST",
      url: "/api/projects",
      payload: breakfastProject,
      headers: { origin: "https://evil.example", host: "arc.app" },
    });
    expect(bad.statusCode).toBe(403);
    expect(bad.json().error.code).toBe("forbidden_origin");

    const nullOrigin = await c.inject({
      method: "DELETE",
      url: "/api/projects/00000000-0000-0000-0000-000000000000",
      headers: { origin: "null" },
    });
    expect(nullOrigin.statusCode).toBe(403);

    const good = await c.inject({
      method: "POST",
      url: "/api/projects",
      payload: breakfastProject,
      headers: { origin: "https://arc.app", host: "arc.app" },
    });
    expect(good.statusCode).toBe(201);
  });

  it("does not check Origin on safe methods", async () => {
    const c = await signedIn(ctx.app);
    const res = await c.inject({ method: "GET", url: "/api/projects", headers: { origin: "https://evil.example" } });
    expect(res.statusCode).toBe(200);
  });

  it("requires application/json bodies on mutating requests", async () => {
    const c = await signedIn(ctx.app);
    const res = await c.inject({
      method: "POST",
      url: "/api/projects",
      payload: JSON.stringify(breakfastProject),
      headers: { "content-type": "text/plain" },
    });
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe("unsupported_media_type");

    const form = await c.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: "email=a@b.c&password=x",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(form.statusCode).toBe(415);
  });

  it("allows empty-body POSTs with or without a JSON content-type", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const plain = await c.inject({ method: "POST", url: `/api/projects/${p.id}/duplicate` });
    expect(plain.statusCode).toBe(201);
    const jsonEmpty = await c.inject({
      method: "POST",
      url: `/api/projects/${p.id}/duplicate`,
      headers: { "content-type": "application/json" },
      payload: "",
    });
    expect(jsonEmpty.statusCode).toBe(201);
  });

  it("allows WEB_ORIGIN origins and answers CORS preflights for them", async () => {
    const config = loadConfig({ ...process.env, WEB_ORIGIN: "http://localhost:3000" });
    const app = await buildApp({ config, db: ctx.db });
    try {
      const pre = await app.inject({
        method: "OPTIONS",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:3000", "access-control-request-method": "POST" },
      });
      expect(pre.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
      expect(pre.headers["access-control-allow-credentials"]).toBe("true");
      const signup = await app.inject({
        method: "POST",
        url: "/api/auth/signup",
        headers: { origin: "http://localhost:3000", host: "localhost:4000" },
        payload: { name: "W", email: "w@example.com", password: "password123" },
      });
      expect(signup.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });
});

describe("validation & errors", () => {
  it("returns the ApiErrorBody shape for validation failures", async () => {
    const c = await signedIn(ctx.app);
    const res = await c.post("/api/projects", { name: "", emoji: "x", category: "Nope", goals: [] });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("validation");
    expect(typeof body.error.message).toBe("string");
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it("rejects non-finite / non-numeric outputs and bad uuids", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const v = (await c.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const res = await c.inject({
      method: "POST",
      url: `/api/versions/${v.id}/runs`,
      headers: { "content-type": "application/json" },
      payload: '{"outputs":{"protein":"lots"}}',
    });
    expect(res.statusCode).toBe(400);
    expect((await c.get("/api/projects/not-a-uuid")).json().error.code).toBe("validation");
  });

  it("returns 400 invalid_json on malformed JSON and 404 not_found for unknown routes", async () => {
    const c = await signedIn(ctx.app);
    const bad = await c.inject({
      method: "POST",
      url: "/api/projects",
      headers: { "content-type": "application/json" },
      payload: "{nope",
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe("invalid_json");
    const nf = await c.get("/api/nope");
    expect(nf.statusCode).toBe(404);
    expect(nf.json().error.code).toBe("not_found");
  });

  it("sets security headers and a request id", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/health" });
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});

describe("ownership", () => {
  it("hides another user's project/version/step/run data behind 404", async () => {
    const a = await signedIn(ctx.app);
    const b = await signedIn(ctx.app);
    const p = (await a.post("/api/projects", breakfastProject)).json();
    const v = (await a.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const s = (await a.post(`/api/versions/${v.id}/steps`, { title: "Bread" })).json();

    const checks = await Promise.all([
      b.get(`/api/projects/${p.id}`),
      b.patch(`/api/projects/${p.id}`, { name: "pwned" }),
      b.del(`/api/projects/${p.id}`),
      b.post(`/api/projects/${p.id}/duplicate`),
      b.put(`/api/projects/${p.id}/goals`, { goals: [] }),
      b.post(`/api/projects/${p.id}/versions`, { name: "x" }),
      b.get(`/api/projects/${p.id}/runs`),
      b.get(`/api/versions/${v.id}`),
      b.patch(`/api/versions/${v.id}`, { best: true }),
      b.del(`/api/versions/${v.id}`),
      b.post(`/api/versions/${v.id}/duplicate`),
      b.post(`/api/versions/${v.id}/branch`, { fromStepId: s.id, name: "x" }),
      b.post(`/api/versions/${v.id}/steps`, { title: "x" }),
      b.post(`/api/versions/${v.id}/runs`, { outputs: {} }),
      b.patch(`/api/steps/${s.id}`, { title: "x" }),
      b.del(`/api/steps/${s.id}`),
      b.post(`/api/steps/${s.id}/move`, { direction: "down" }),
    ]);
    for (const res of checks) {
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("not_found");
    }
    expect((await b.get("/api/projects")).json()).toEqual([]);

    // A's data is untouched.
    const still = (await a.get(`/api/projects/${p.id}`)).json();
    expect(still.name).toBe("My Breakfast");
    expect(still.versions[0].steps[0].title).toBe("Bread");
  });

  it("cannot attach another user's media to a step", async () => {
    const a = await signedIn(ctx.app);
    const b = await signedIn(ctx.app);
    const up = await a.inject({
      method: "POST",
      url: "/api/media",
      headers: { "content-type": "multipart/form-data; boundary=X" },
      payload: '--X\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\npng\r\n--X--\r\n',
    });
    expect(up.statusCode).toBe(201);
    const p = (await b.post("/api/projects", breakfastProject)).json();
    const v = (await b.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const res = await b.post(`/api/versions/${v.id}/steps`, { title: "x", photoMediaId: up.json().id });
    expect(res.statusCode).toBe(404);
  });
});

describe("rate limiting", () => {
  it("applies the strict auth limit when enabled", async () => {
    const config = loadConfig();
    const app = await buildApp({ config, db: ctx.db, rateLimit: { authMax: 3, globalMax: 1000 } });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: "nobody@example.com", password: "password123" },
        });
        codes.push(res.statusCode);
        if (res.statusCode === 429) expect(res.json().error.code).toBe("rate_limited");
      }
      expect(codes).toEqual([401, 401, 401, 429]);
      // Other routes still have headroom.
      expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
