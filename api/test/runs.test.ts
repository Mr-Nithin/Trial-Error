import { describe, expect, it } from "vitest";
import { meetsAllGoals, meetsGoal } from "../src/services/runs.js";
import { breakfastProject, signedIn, useApp } from "./helpers.js";

const ctx = useApp();

describe("goal evaluation", () => {
  it("handles >=, <= and missing metrics", () => {
    expect(meetsGoal({ metric: "p", op: ">=", target: 25 }, { p: 25 })).toBe(true);
    expect(meetsGoal({ metric: "p", op: ">=", target: 25 }, { p: 24.9 })).toBe(false);
    expect(meetsGoal({ metric: "k", op: "<=", target: 450 }, { k: 450 })).toBe(true);
    expect(meetsGoal({ metric: "k", op: "<=", target: 450 }, { k: 451 })).toBe(false);
    expect(meetsGoal({ metric: "k", op: "<=", target: 450 }, {})).toBe(false);
    expect(meetsAllGoals([], { p: 1 })).toBe(false);
  });
});

describe("runs", () => {
  it("numbers runs per project, marks the version done, and auto-picks best once", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const v1 = (await c.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const v2 = (await c.post(`/api/projects/${p.id}/versions`, { name: "V2" })).json();

    const r1 = await c.post(`/api/versions/${v1.id}/runs`, { outputs: { protein: 15, kcal: 390 }, notes: "meh" });
    expect(r1.statusCode).toBe(201);
    expect(r1.json()).toMatchObject({ number: 1, versionId: v1.id, outputs: { protein: 15, kcal: 390 }, notes: "meh", changeNote: "" });
    let proj = (await c.get(`/api/projects/${p.id}`)).json();
    expect(proj.versions[0].status).toBe("done");
    expect(proj.versions[1].status).toBe("in_progress");
    expect(proj.bestVersionId).toBeNull(); // protein goal not met

    // Missing metric => not met
    await c.post(`/api/versions/${v2.id}/runs`, { outputs: { protein: 30 } });
    expect((await c.get(`/api/projects/${p.id}`)).json().bestVersionId).toBeNull();

    const r3 = (await c.post(`/api/versions/${v2.id}/runs`, { outputs: { protein: 26, kcal: 440 }, changeNote: "2 tbsp" })).json();
    expect(r3.number).toBe(3);
    proj = (await c.get(`/api/projects/${p.id}`)).json();
    expect(proj.bestVersionId).toBe(v2.id);
    expect(proj.versions[1]).toMatchObject({ isBest: true, runCount: 2, outputs: { protein: 26, kcal: 440 } });
    expect(proj.versions[1].lastRunAt).toBe(r3.createdAt);

    // Once a best exists, later qualifying runs don't steal it.
    await c.post(`/api/versions/${v1.id}/runs`, { outputs: { protein: 40, kcal: 100 } });
    expect((await c.get(`/api/projects/${p.id}`)).json().bestVersionId).toBe(v2.id);

    // Numbering is per project
    const other = (await c.post("/api/projects", breakfastProject)).json();
    const ov = (await c.post(`/api/projects/${other.id}/versions`, { name: "O" })).json();
    expect((await c.post(`/api/versions/${ov.id}/runs`, { outputs: {} })).json().number).toBe(1);

    const runs = (await c.get(`/api/projects/${p.id}/runs`)).json();
    expect(runs.map((r: { number: number }) => r.number)).toEqual([1, 2, 3, 4]);
  });

  it("bumps project updatedAt", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const v = (await c.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const before = (await c.get(`/api/projects/${p.id}`)).json().updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await c.post(`/api/versions/${v.id}/runs`, { outputs: { protein: 1 } });
    const after = (await c.get(`/api/projects/${p.id}`)).json().updatedAt;
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it("assigns unique numbers under concurrency", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const v = (await c.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => c.post(`/api/versions/${v.id}/runs`, { outputs: { protein: 1 } })),
    );
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    expect(results.map((r) => r.json().number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
