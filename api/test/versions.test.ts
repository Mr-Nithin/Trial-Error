import { describe, expect, it } from "vitest";
import type { StepDTO, VersionDTO } from "../src/types.js";
import { breakfastProject, type Client, signedIn, useApp } from "./helpers.js";

const ctx = useApp();

/** V1 with steps 1..4; step 3 has sub-steps 3a, 3b; steps carry details/outputs. */
async function seedV1(c: Client) {
  const p = (await c.post("/api/projects", breakfastProject)).json();
  const v1: VersionDTO = (await c.post(`/api/projects/${p.id}/versions`, { name: "Banana PB toast" })).json();
  const mk = (title: string, extra: object = {}) =>
    c.post(`/api/versions/${v1.id}/steps`, { title, detail: `${title} detail`, ...extra }).then((r) => r.json() as StepDTO);
  const s1 = await mk("Bread", { outputs: { protein: 12 } });
  const s2 = await mk("Toast");
  const s3 = await mk("Peanut butter", { outputs: { protein: 4 } });
  const s4 = await mk("Topping");
  const s3a = await mk("Honey", { parentStepId: s3.id });
  const s3b = await mk("Salt", { parentStepId: s3.id });
  return { p, v1, s1, s2, s3, s4, s3a, s3b };
}

describe("versions", () => {
  it("creates versions from scratch with sequential numbers", async () => {
    const c = await signedIn(ctx.app);
    const p = (await c.post("/api/projects", breakfastProject)).json();
    const a = (await c.post(`/api/projects/${p.id}/versions`, { name: "A" })).json();
    const b = await c.post(`/api/projects/${p.id}/versions`, { name: "B" });
    expect(b.statusCode).toBe(201);
    expect(a).toMatchObject({
      number: 1,
      name: "A",
      parentId: null,
      branchedAtStep: null,
      status: "in_progress",
      isBest: false,
      changeNote: "",
      runCount: 0,
      lastRunAt: null,
      outputs: {},
      steps: [],
    });
    expect(b.json().number).toBe(2);
    expect((await c.get(`/api/versions/${a.id}`)).json().id).toBe(a.id);
  });

  it("branches at a top-level step: inherited before N, pending from N", async () => {
    const c = await signedIn(ctx.app);
    const { v1, s3 } = await seedV1(c);
    const res = await c.post(`/api/versions/${v1.id}/branch`, { fromStepId: s3.id, name: "+ more protein" });
    expect(res.statusCode).toBe(201);
    const v2: VersionDTO = res.json();
    expect(v2).toMatchObject({ number: 2, parentId: v1.id, branchedAtStep: 3, status: "in_progress", name: "+ more protein" });
    expect(v2.steps.map((s) => [s.label, s.title, s.origin, s.fromVersion])).toEqual([
      ["1", "Bread", "inherited", 1],
      ["2", "Toast", "inherited", 1],
      ["3", "Peanut butter", "pending", null],
      ["4", "Topping", "pending", null],
    ]);
    const [b1, , b3, b4] = v2.steps as StepDTO[];
    expect(b1!.detail).toBe("Bread detail");
    expect(b1!.outputs).toEqual({ protein: 12 });
    expect(b3!.detail).toBe("");
    expect(b3!.outputs).toEqual({});
    expect(b3!.photoMediaId).toBeNull();
    expect(b3!.subSteps).toEqual([]); // sub-steps at/after the branch point are dropped
    expect(b4!.detail).toBe("");
    // New ids
    expect(b1!.id).not.toBe((await c.get(`/api/versions/${v1.id}`)).json().steps[0].id);
  });

  it("branching from a sub-step id branches at its parent and keeps earlier sub-steps", async () => {
    const c = await signedIn(ctx.app);
    const { v1, s3a } = await seedV1(c);
    // First branch at step 4 so step 3's sub-steps are inherited
    const v1Steps: StepDTO[] = (await c.get(`/api/versions/${v1.id}`)).json().steps;
    const at4 = (await c.post(`/api/versions/${v1.id}/branch`, { fromStepId: v1Steps[3]!.id, name: "at4" })).json();
    expect(at4.branchedAtStep).toBe(4);
    expect(at4.steps[2].subSteps.map((s: StepDTO) => [s.label, s.title, s.origin, s.fromVersion])).toEqual([
      ["3a", "Honey", "inherited", 1],
      ["3b", "Salt", "inherited", 1],
    ]);
    expect(at4.steps[2].subSteps[0].parentStepId).toBe(at4.steps[2].id);

    const fromSub = (await c.post(`/api/versions/${v1.id}/branch`, { fromStepId: s3a.id, name: "sub" })).json();
    expect(fromSub.branchedAtStep).toBe(3);
    expect(fromSub.number).toBe(3);
    expect(fromSub.steps.map((s: StepDTO) => s.origin)).toEqual(["inherited", "inherited", "pending", "pending"]);
  });

  it("rejects branching from a step of another version", async () => {
    const c = await signedIn(ctx.app);
    const { p, s1 } = await seedV1(c);
    const other = (await c.post(`/api/projects/${p.id}/versions`, { name: "other" })).json();
    const res = await c.post(`/api/versions/${other.id}/branch`, { fromStepId: s1.id, name: "x" });
    expect(res.statusCode).toBe(404);
  });

  it("duplicates a version with all steps inherited", async () => {
    const c = await signedIn(ctx.app);
    const { v1 } = await seedV1(c);
    await c.post(`/api/versions/${v1.id}/runs`, { outputs: { protein: 1 } });
    const res = await c.post(`/api/versions/${v1.id}/duplicate`);
    expect(res.statusCode).toBe(201);
    const d: VersionDTO = res.json();
    expect(d).toMatchObject({
      number: 2,
      name: "Banana PB toast (copy)",
      parentId: v1.id,
      branchedAtStep: null,
      status: "in_progress",
      runCount: 0,
    });
    expect(d.steps.map((s) => [s.label, s.origin, s.fromVersion, s.detail])).toEqual([
      ["1", "inherited", 1, "Bread detail"],
      ["2", "inherited", 1, "Toast detail"],
      ["3", "inherited", 1, "Peanut butter detail"],
      ["4", "inherited", 1, "Topping detail"],
    ]);
    expect(d.steps[2]!.subSteps.map((s) => [s.label, s.origin])).toEqual([
      ["3a", "inherited"],
      ["3b", "inherited"],
    ]);
  });

  it("renames, marks best, and deletes (children keep existing, best cleared)", async () => {
    const c = await signedIn(ctx.app);
    const { p, v1, s2 } = await seedV1(c);
    const v2 = (await c.post(`/api/versions/${v1.id}/branch`, { fromStepId: s2.id, name: "V2" })).json();

    const renamed = (await c.patch(`/api/versions/${v1.id}`, { name: "Renamed" })).json();
    expect(renamed.name).toBe("Renamed");
    expect(renamed.isBest).toBe(false);

    const best = (await c.patch(`/api/versions/${v1.id}`, { best: true })).json();
    expect(best.isBest).toBe(true);
    expect((await c.get(`/api/projects/${p.id}`)).json().bestVersionId).toBe(v1.id);

    expect((await c.patch(`/api/versions/${v1.id}`, { best: false })).statusCode).toBe(400);

    expect((await c.del(`/api/versions/${v1.id}`)).statusCode).toBe(204);
    const proj = (await c.get(`/api/projects/${p.id}`)).json();
    expect(proj.bestVersionId).toBeNull();
    expect(proj.versions).toHaveLength(1);
    expect(proj.versions[0].id).toBe(v2.id);
    expect(proj.versions[0].parentId).toBeNull();
    expect(proj.versions[0].branchedAtStep).toBe(2);

    // Numbers keep increasing after a delete
    const v3 = (await c.post(`/api/projects/${p.id}/versions`, { name: "V3" })).json();
    expect(v3.number).toBe(3);
  });
});
