import { describe, expect, it } from "vitest";
import type { ProjectDTO, ProjectSummaryDTO } from "../src/types.js";
import { breakfastProject, signedIn, useApp } from "./helpers.js";

const ctx = useApp();

describe("projects", () => {
  it("creates a project with ordered goals and a category tint", async () => {
    const c = await signedIn(ctx.app);
    const res = await c.post("/api/projects", breakfastProject);
    expect(res.statusCode).toBe(201);
    const p: ProjectDTO = res.json();
    expect(p).toMatchObject({
      name: "My Breakfast",
      emoji: "🍳",
      category: "Food",
      tint: "#E2F2EC",
      archivedAt: null,
      pinnedAt: null,
      bestVersionId: null,
      versions: [],
      runs: [],
    });
    expect(p.goals.map((g) => g.metric)).toEqual(["protein", "kcal"]);
    expect(p.goals[0]).toMatchObject({ label: "Protein", op: ">=", target: 25, unit: "g", icon: "🥩" });

    const fit = (await c.post("/api/projects", { name: "Run", emoji: "🏃", category: "Fitness", goals: [] })).json();
    expect(fit.tint).toBe("#E8E4F8");
    const custom = (
      await c.post("/api/projects", { name: "X", emoji: "x", category: "Other", tint: "#123456", goals: [] })
    ).json();
    expect(custom.tint).toBe("#123456");
  });

  it("gets a project with versions, step trees and runs", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const v1 = (await c.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const s = (await c.post(`/api/versions/${v1.id}/steps`, { title: "Bread", detail: "2 slices" })).json();
    await c.post(`/api/versions/${v1.id}/steps`, { title: "Chia", parentStepId: s.id });
    await c.post(`/api/versions/${v1.id}/runs`, { outputs: { protein: 10, kcal: 300 } });
    await c.post(`/api/projects/${p.id}/versions`, { name: "V2" });

    const got: ProjectDTO = (await c.get(`/api/projects/${p.id}`)).json();
    expect(got.versions.map((v) => v.number)).toEqual([1, 2]);
    expect(got.versions[0]!.steps[0]!.subSteps[0]!.label).toBe("1a");
    expect(got.versions[0]!.runCount).toBe(1);
    expect(got.versions[0]!.outputs).toEqual({ protein: 10, kcal: 300 });
    expect(got.versions[1]!.outputs).toEqual({});
    expect(got.runs).toHaveLength(1);
  });

  it("lists active projects ordered by pin then activity; archive moves them out", async () => {
    const c = await signedIn(ctx.app);
    const a = (await c.post("/api/projects", { ...breakfastProject, name: "A" })).json();
    const b = (await c.post("/api/projects", { ...breakfastProject, name: "B" })).json();
    const cc = (await c.post("/api/projects", { ...breakfastProject, name: "C" })).json();

    const names = async (q = "") =>
      ((await c.get(`/api/projects${q}`)).json() as ProjectSummaryDTO[]).map((p) => p.name);
    expect(await names()).toEqual(["C", "B", "A"]);

    // A run on A makes it most recent.
    const va = (await c.post(`/api/projects/${a.id}/versions`, { name: "V1" })).json();
    await c.post(`/api/versions/${va.id}/runs`, { outputs: { protein: 30, kcal: 400 } });
    expect(await names()).toEqual(["A", "C", "B"]);

    // Pinned first, regardless of activity.
    const pinned = (await c.patch(`/api/projects/${b.id}`, { pinned: true })).json();
    expect(pinned.pinnedAt).not.toBeNull();
    expect(await names()).toEqual(["B", "A", "C"]);

    const archived = (await c.patch(`/api/projects/${cc.id}`, { archived: true })).json();
    expect(archived.archivedAt).not.toBeNull();
    expect(await names()).toEqual(["B", "A"]);
    expect(await names("?archived=true")).toEqual(["C"]);

    await c.patch(`/api/projects/${cc.id}`, { archived: false });
    await c.patch(`/api/projects/${b.id}`, { pinned: false });
    expect((await names()).sort()).toEqual(["A", "B", "C"]);
    expect((await names())[0]).toBe("B"); // most recently updated

    // Summary fields
    const list: ProjectSummaryDTO[] = (await c.get("/api/projects")).json();
    const sa = list.find((p) => p.id === a.id)!;
    expect(sa).toMatchObject({
      versionCount: 1,
      runCount: 1,
      lastRunVersion: { number: 1, name: "V1" },
      bestVersionId: va.id,
      bestOutputs: { protein: 30, kcal: 400 },
    });
    expect(sa.lastRunAt).not.toBeNull();
    const sb = list.find((p) => p.id === b.id)!;
    expect(sb).toMatchObject({ versionCount: 0, runCount: 0, lastRunAt: null, lastRunVersion: null, bestOutputs: null });
    expect(sb.goals).toHaveLength(2);
  });

  it("patches name/emoji/category and bumps updatedAt", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    await new Promise((r) => setTimeout(r, 5));
    const res = await c.patch(`/api/projects/${p.id}`, { name: " Lunch ", emoji: "🥗", category: "Other" });
    expect(res.statusCode).toBe(200);
    const u = res.json();
    expect(u).toMatchObject({ name: "Lunch", emoji: "🥗", category: "Other" });
    expect(new Date(u.updatedAt).getTime()).toBeGreaterThan(new Date(p.updatedAt).getTime());
  });

  it("deletes a project", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    expect((await c.del(`/api/projects/${p.id}`)).statusCode).toBe(204);
    expect((await c.get(`/api/projects/${p.id}`)).statusCode).toBe(404);
  });

  it("duplicates a project deeply, remapping links, without runs", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const v1 = (await c.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
    const s1 = (await c.post(`/api/versions/${v1.id}/steps`, { title: "Bread" })).json();
    await c.post(`/api/versions/${v1.id}/steps`, { title: "Sub", parentStepId: s1.id });
    const s2 = (await c.post(`/api/versions/${v1.id}/steps`, { title: "Toast" })).json();
    const v2 = (await c.post(`/api/versions/${v1.id}/branch`, { fromStepId: s2.id, name: "V2" })).json();
    await c.patch(`/api/versions/${v2.id}`, { best: true });
    await c.post(`/api/versions/${v1.id}/runs`, { outputs: { protein: 1 } });

    const res = await c.post(`/api/projects/${p.id}/duplicate`);
    expect(res.statusCode).toBe(201);
    const d: ProjectDTO = res.json();
    expect(d.id).not.toBe(p.id);
    expect(d.name).toBe("My Breakfast (copy)");
    expect(d.goals.map((g) => g.metric)).toEqual(["protein", "kcal"]);
    expect(d.goals[0]!.id).not.toBe(p.goals[0].id);
    expect(d.runs).toEqual([]);
    expect(d.versions.map((v) => [v.number, v.name])).toEqual([
      [1, "V1"],
      [2, "V2"],
    ]);
    const [dv1, dv2] = d.versions as [ProjectDTO["versions"][0], ProjectDTO["versions"][0]];
    expect(dv1.id).not.toBe(v1.id);
    expect(dv2.parentId).toBe(dv1.id);
    expect(dv2.branchedAtStep).toBe(2);
    expect(d.bestVersionId).toBe(dv2.id);
    expect(dv2.isBest).toBe(true);
    expect(dv1.steps.map((s) => s.title)).toEqual(["Bread", "Toast"]);
    expect(dv1.steps[0]!.subSteps.map((s) => [s.label, s.title, s.parentStepId])).toEqual([
      ["1a", "Sub", dv1.steps[0]!.id],
    ]);
    expect(dv1.steps[0]!.id).not.toBe(s1.id);
    expect(dv2.steps.map((s) => s.origin)).toEqual(["inherited", "pending"]);

    // Source untouched
    const src: ProjectDTO = (await c.get(`/api/projects/${p.id}`)).json();
    expect(src.runs).toHaveLength(1);
    expect(src.bestVersionId).toBe(v2.id);
  });

  it("replaces goals; duplicate metric is a 400", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const res = await c.put(`/api/projects/${p.id}/goals`, {
      goals: [
        { metric: "taste", label: "Taste", icon: "⭐", op: ">=", target: 4, unit: "/5" },
        { metric: "time", label: "Time", icon: "⏱", op: "<=", target: 10, unit: "min" },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((g: { metric: string }) => g.metric)).toEqual(["taste", "time"]);
    expect((await c.get(`/api/projects/${p.id}`)).json().goals.map((g: { metric: string }) => g.metric)).toEqual([
      "taste",
      "time",
    ]);

    const dupe = await c.put(`/api/projects/${p.id}/goals`, {
      goals: [
        { metric: "taste", label: "Taste", icon: "⭐", op: ">=", target: 4, unit: "/5" },
        { metric: "taste", label: "Taste 2", icon: "⭐", op: "<=", target: 5, unit: "/5" },
      ],
    });
    expect(dupe.statusCode).toBe(400);
    expect(dupe.json().error.code).toBe("validation");

    const cleared = await c.put(`/api/projects/${p.id}/goals`, { goals: [] });
    expect(cleared.json()).toEqual([]);
  });
});
