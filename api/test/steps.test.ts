import { describe, expect, it } from "vitest";
import type { StepDTO } from "../src/types.js";
import { breakfastProject, type Client, signedIn, useApp } from "./helpers.js";

const ctx = useApp();

async function version(c: Client) {
  const p = (await c.post("/api/projects", breakfastProject)).json();
  return (await c.post(`/api/projects/${p.id}/versions`, { name: "V1" })).json();
}
const titles = (steps: StepDTO[]) => steps.map((s) => `${s.label}:${s.title}`);

describe("steps", () => {
  it("appends steps and sub-steps with labels", async () => {
    const c = await signedIn(ctx.app);
    const v = await version(c);
    const a = await c.post(`/api/versions/${v.id}/steps`, { title: "Bread", outputs: { protein: 12 } });
    expect(a.statusCode).toBe(201);
    expect(a.json()).toMatchObject({
      label: "1",
      position: 1,
      origin: "new",
      fromVersion: null,
      parentStepId: null,
      detail: "",
      outputs: { protein: 12 },
      subSteps: [],
      photoMediaId: null,
    });
    const b = (await c.post(`/api/versions/${v.id}/steps`, { title: "Toast" })).json();
    expect(b.label).toBe("2");
    const sub1 = (await c.post(`/api/versions/${v.id}/steps`, { title: "Chia", parentStepId: b.id })).json();
    const sub2 = (await c.post(`/api/versions/${v.id}/steps`, { title: "Salt", parentStepId: b.id })).json();
    expect([sub1.label, sub2.label]).toEqual(["2a", "2b"]);
    expect(sub2.parentStepId).toBe(b.id);

    // No sub-sub-steps; parent must be in this version.
    const nested = await c.post(`/api/versions/${v.id}/steps`, { title: "x", parentStepId: sub1.id });
    expect(nested.statusCode).toBe(400);
    expect(nested.json().error.code).toBe("invalid_parent");
    const other = await version(c);
    const foreign = await c.post(`/api/versions/${other.id}/steps`, { title: "x", parentStepId: b.id });
    expect(foreign.statusCode).toBe(400);
  });

  it("patching flips origin: inherited→changed, pending→changed (branched) / new (root)", async () => {
    const c = await signedIn(ctx.app);
    const v1 = await version(c);
    const s1 = (await c.post(`/api/versions/${v1.id}/steps`, { title: "Bread" })).json();
    const s2 = (await c.post(`/api/versions/${v1.id}/steps`, { title: "PB" })).json();
    const v2 = (await c.post(`/api/versions/${v1.id}/branch`, { fromStepId: s2.id, name: "V2" })).json();
    const [inh, pend] = v2.steps as StepDTO[];

    const changed = (await c.patch(`/api/steps/${inh!.id}`, { detail: "rye" })).json();
    expect(changed).toMatchObject({ origin: "changed", detail: "rye", fromVersion: 1 });
    const filled = (await c.patch(`/api/steps/${pend!.id}`, { detail: "2 tbsp", outputs: { protein: 8 } })).json();
    expect(filled).toMatchObject({ origin: "changed", detail: "2 tbsp", outputs: { protein: 8 } });

    // "new" stays "new"
    expect((await c.patch(`/api/steps/${s1.id}`, { title: "Sourdough" })).json()).toMatchObject({
      origin: "new",
      title: "Sourdough",
    });

    // A pending step in a version without a parent becomes "new"
    expect((await c.del(`/api/versions/${v1.id}`)).statusCode).toBe(204);
    const v2b = (await c.get(`/api/versions/${v2.id}`)).json();
    expect(v2b.parentId).toBeNull();
    const v3 = (await c.post(`/api/versions/${v2.id}/branch`, { fromStepId: v2b.steps[0].id, name: "V3" })).json();
    await c.del(`/api/versions/${v2.id}`);
    const p3 = (await c.patch(`/api/steps/${v3.steps[0].id}`, { detail: "x" })).json();
    expect(p3.origin).toBe("new");
  });

  it("moves steps among siblings and refuses at the edges", async () => {
    const c = await signedIn(ctx.app);
    const v = await version(c);
    const ids: string[] = [];
    for (const t of ["A", "B", "C"]) ids.push((await c.post(`/api/versions/${v.id}/steps`, { title: t })).json().id);
    const subA = (await c.post(`/api/versions/${v.id}/steps`, { title: "a1", parentStepId: ids[0] })).json();
    const subB = (await c.post(`/api/versions/${v.id}/steps`, { title: "a2", parentStepId: ids[0] })).json();

    const down = await c.post(`/api/steps/${ids[0]}/move`, { direction: "down" });
    expect(down.statusCode).toBe(200);
    expect(titles(down.json())).toEqual(["1:B", "2:A", "3:C"]);
    // sub-step labels follow their parent's new position
    expect(titles(down.json()[1].subSteps)).toEqual(["2a:a1", "2b:a2"]);

    const up = (await c.post(`/api/steps/${subB.id}/move`, { direction: "up" })).json();
    expect(titles(up)).toEqual(["2a:a2", "2b:a1"]);

    const top = await c.post(`/api/steps/${ids[1]}/move`, { direction: "up" });
    expect(top.statusCode).toBe(400);
    expect(top.json().error.code).toBe("cannot_move");
    expect((await c.post(`/api/steps/${ids[2]}/move`, { direction: "down" })).json().error.code).toBe("cannot_move");
    expect((await c.post(`/api/steps/${subA.id}/move`, { direction: "down" })).statusCode).toBe(400);
  });

  it("deletes a step (and its sub-steps) and renumbers siblings", async () => {
    const c = await signedIn(ctx.app);
    const v = await version(c);
    const ids: string[] = [];
    for (const t of ["A", "B", "C", "D"]) ids.push((await c.post(`/api/versions/${v.id}/steps`, { title: t })).json().id);
    await c.post(`/api/versions/${v.id}/steps`, { title: "b1", parentStepId: ids[1] });
    const b2 = (await c.post(`/api/versions/${v.id}/steps`, { title: "b2", parentStepId: ids[1] })).json();
    await c.post(`/api/versions/${v.id}/steps`, { title: "b3", parentStepId: ids[1] });

    expect((await c.del(`/api/steps/${b2.id}`)).statusCode).toBe(204);
    let steps: StepDTO[] = (await c.get(`/api/versions/${v.id}`)).json().steps;
    expect(titles(steps[1]!.subSteps)).toEqual(["2a:b1", "2b:b3"]);

    expect((await c.del(`/api/steps/${ids[1]}`)).statusCode).toBe(204);
    steps = (await c.get(`/api/versions/${v.id}`)).json().steps;
    expect(titles(steps)).toEqual(["1:A", "2:C", "3:D"]);
    expect(steps.map((s) => s.position)).toEqual([1, 2, 3]);
    expect((await c.patch(`/api/steps/${ids[1]}`, { title: "gone" })).statusCode).toBe(404);

    const next = (await c.post(`/api/versions/${v.id}/steps`, { title: "E" })).json();
    expect(next.label).toBe("4");
  });
});
