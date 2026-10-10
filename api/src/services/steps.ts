import { and, eq, gt, isNull, max, sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client.js";
import { steps } from "../db/schema.js";
import { findStep } from "../lib/dto.js";
import { badRequest, notFound } from "../lib/errors.js";
import { loadOwnedMedia, loadOwnedStep, loadOwnedVersion } from "../lib/ownership.js";
import type { CreateStepInput, MoveStepInput, StepDTO, UpdateStepInput } from "../types.js";
import { getStepTree } from "./queries.js";

const siblingsOf = (versionId: string, parentStepId: string | null) =>
  and(eq(steps.versionId, versionId), parentStepId ? eq(steps.parentStepId, parentStepId) : isNull(steps.parentStepId));

async function stepDTO(db: Db, versionId: string, stepId: string): Promise<StepDTO> {
  const found = findStep(await getStepTree(db, versionId), stepId);
  if (!found) throw notFound("Step");
  return found;
}

async function assertMedia(tx: Tx, userId: string, mediaId: string | null | undefined) {
  if (mediaId) await loadOwnedMedia(tx, userId, mediaId);
}

export async function createStep(
  db: Db,
  userId: string,
  versionId: string,
  input: CreateStepInput,
): Promise<StepDTO> {
  const id = await db.transaction(async (tx) => {
    await loadOwnedVersion(tx, userId, versionId, { lock: true });
    const parentStepId = input.parentStepId ?? null;
    if (parentStepId) {
      const [parent] = await tx
        .select({ id: steps.id, parentStepId: steps.parentStepId })
        .from(steps)
        .where(and(eq(steps.id, parentStepId), eq(steps.versionId, versionId)));
      if (!parent) throw badRequest("invalid_parent", "Parent step not found in this version");
      if (parent.parentStepId) throw badRequest("invalid_parent", "Sub-steps cannot have sub-steps");
    }
    await assertMedia(tx, userId, input.photoMediaId);
    const [pos] = await tx.select({ n: max(steps.position) }).from(steps).where(siblingsOf(versionId, parentStepId));
    const [row] = await tx
      .insert(steps)
      .values({
        versionId,
        parentStepId,
        position: (pos?.n ?? 0) + 1,
        title: input.title,
        detail: input.detail ?? "",
        origin: "new",
        fromVersion: null,
        photoMediaId: input.photoMediaId ?? null,
        outputs: input.outputs ?? {},
      })
      .returning({ id: steps.id });
    return row!.id;
  });
  return stepDTO(db, versionId, id);
}

export async function updateStep(db: Db, userId: string, stepId: string, input: UpdateStepInput): Promise<StepDTO> {
  const versionId = await db.transaction(async (tx) => {
    const { step, version } = await loadOwnedStep(tx, userId, stepId, { lock: true });
    await assertMedia(tx, userId, input.photoMediaId);
    let origin = step.origin;
    if (origin === "inherited") origin = "changed";
    else if (origin === "pending") origin = version.parentVersionId ? "changed" : "new";
    await tx
      .update(steps)
      .set({
        origin,
        ...(input.title !== undefined && { title: input.title }),
        ...(input.detail !== undefined && { detail: input.detail }),
        ...(input.outputs !== undefined && { outputs: input.outputs }),
        ...(input.photoMediaId !== undefined && { photoMediaId: input.photoMediaId }),
      })
      .where(eq(steps.id, stepId));
    return version.id;
  });
  return stepDTO(db, versionId, stepId);
}

export async function deleteStep(db: Db, userId: string, stepId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { step } = await loadOwnedStep(tx, userId, stepId, { lock: true });
    await tx.delete(steps).where(eq(steps.id, stepId)); // sub-steps cascade
    await tx
      .update(steps)
      .set({ position: sql`${steps.position} - 1` })
      .where(and(siblingsOf(step.versionId, step.parentStepId), gt(steps.position, step.position)));
  });
}

export async function moveStep(db: Db, userId: string, stepId: string, input: MoveStepInput): Promise<StepDTO[]> {
  const { versionId, parentStepId } = await db.transaction(async (tx) => {
    const { step } = await loadOwnedStep(tx, userId, stepId, { lock: true });
    const siblings = await tx
      .select({ id: steps.id, position: steps.position })
      .from(steps)
      .where(siblingsOf(step.versionId, step.parentStepId))
      .orderBy(steps.position, steps.createdAt);
    const idx = siblings.findIndex((s) => s.id === stepId);
    const other = siblings[input.direction === "up" ? idx - 1 : idx + 1];
    if (!other) throw badRequest("cannot_move", `Step is already at the ${input.direction === "up" ? "top" : "bottom"}`);
    // Normalise to 1..n while swapping, in case positions ever drifted.
    const order = siblings.map((s) => s.id);
    const j = order.indexOf(other.id);
    [order[idx], order[j]] = [order[j]!, order[idx]!];
    for (const [i, id] of order.entries()) {
      const current = siblings.find((s) => s.id === id)!;
      if (current.position !== i + 1) await tx.update(steps).set({ position: i + 1 }).where(eq(steps.id, id));
    }
    return { versionId: step.versionId, parentStepId: step.parentStepId };
  });
  const tree = await getStepTree(db, versionId);
  if (!parentStepId) return tree;
  return tree.find((t) => t.id === parentStepId)?.subSteps ?? [];
}
