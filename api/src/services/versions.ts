import { eq, max } from "drizzle-orm";
import type { Db, Tx } from "../db/client.js";
import { projects, steps, versions } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import { loadOwnedProject, loadOwnedVersion } from "../lib/ownership.js";
import type { BranchInput, UpdateVersionInput, VersionDTO } from "../types.js";
import { copySteps } from "./projects.js";
import { getVersionDTO } from "./queries.js";

/** Must run inside a transaction holding the project row lock. */
async function nextVersionNumber(tx: Tx, projectId: string): Promise<number> {
  const [row] = await tx
    .select({ n: max(versions.number) })
    .from(versions)
    .where(eq(versions.projectId, projectId));
  return (row?.n ?? 0) + 1;
}

const touchProject = (tx: Tx, projectId: string) =>
  tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

export async function createVersion(
  db: Db,
  userId: string,
  projectId: string,
  input: { name: string; createdAt?: Date },
): Promise<VersionDTO> {
  const id = await db.transaction(async (tx) => {
    await loadOwnedProject(tx, userId, projectId, { lock: true });
    const [v] = await tx
      .insert(versions)
      .values({
        projectId,
        number: await nextVersionNumber(tx, projectId),
        name: input.name,
        ...(input.createdAt && { createdAt: input.createdAt }),
      })
      .returning({ id: versions.id });
    await touchProject(tx, projectId);
    return v!.id;
  });
  return getVersionDTO(db, id);
}

export async function getVersion(db: Db, userId: string, versionId: string): Promise<VersionDTO> {
  await loadOwnedVersion(db, userId, versionId);
  return getVersionDTO(db, versionId);
}

export async function updateVersion(
  db: Db,
  userId: string,
  versionId: string,
  input: UpdateVersionInput,
): Promise<VersionDTO> {
  await db.transaction(async (tx) => {
    const { project } = await loadOwnedVersion(tx, userId, versionId, { lock: true });
    if (input.name !== undefined) await tx.update(versions).set({ name: input.name }).where(eq(versions.id, versionId));
    await tx
      .update(projects)
      .set({ updatedAt: new Date(), ...(input.best && { bestVersionId: versionId }) })
      .where(eq(projects.id, project.id));
  });
  return getVersionDTO(db, versionId);
}

export async function deleteVersion(db: Db, userId: string, versionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { project } = await loadOwnedVersion(tx, userId, versionId, { lock: true });
    // FKs: children's parent_version_id and projects.best_version_id are ON DELETE SET NULL.
    await tx.delete(versions).where(eq(versions.id, versionId));
    await touchProject(tx, project.id);
  });
}

export async function duplicateVersion(db: Db, userId: string, versionId: string): Promise<VersionDTO> {
  const id = await db.transaction(async (tx) => {
    const { version: src, project } = await loadOwnedVersion(tx, userId, versionId, { lock: true });
    const srcSteps = await tx.select().from(steps).where(eq(steps.versionId, src.id));
    const [v] = await tx
      .insert(versions)
      .values({
        projectId: project.id,
        number: await nextVersionNumber(tx, project.id),
        name: `${src.name} (copy)`.slice(0, 120),
        parentVersionId: src.id,
        branchedAtStep: null,
        status: "in_progress",
      })
      .returning({ id: versions.id });
    await copySteps(tx, srcSteps, v!.id, () => ({ origin: "inherited", fromVersion: src.number }));
    await touchProject(tx, project.id);
    return v!.id;
  });
  return getVersionDTO(db, id);
}

export async function branchVersion(
  db: Db,
  userId: string,
  versionId: string,
  input: BranchInput & { createdAt?: Date },
): Promise<VersionDTO> {
  const id = await db.transaction(async (tx) => {
    const { version: src, project } = await loadOwnedVersion(tx, userId, versionId, { lock: true });
    const srcSteps = await tx.select().from(steps).where(eq(steps.versionId, src.id));
    const from = srcSteps.find((s) => s.id === input.fromStepId);
    if (!from) throw notFound("Step");
    const anchor = from.parentStepId ? srcSteps.find((s) => s.id === from.parentStepId) : from;
    if (!anchor) throw notFound("Step");
    const n = anchor.position;

    const [v] = await tx
      .insert(versions)
      .values({
        projectId: project.id,
        number: await nextVersionNumber(tx, project.id),
        name: input.name,
        parentVersionId: src.id,
        branchedAtStep: n,
        status: "in_progress",
        ...(input.createdAt && { createdAt: input.createdAt }),
      })
      .returning({ id: versions.id });

    const topById = new Map(srcSteps.filter((s) => !s.parentStepId).map((s) => [s.id, s]));
    const kept = srcSteps.filter((s) => {
      const top = s.parentStepId ? topById.get(s.parentStepId) : s;
      if (!top) return false;
      // Sub-steps of steps at/after the branch point are dropped.
      return s.parentStepId ? top.position < n : true;
    });
    await copySteps(tx, kept, v!.id, (s) => {
      const top = s.parentStepId ? topById.get(s.parentStepId)! : s;
      return top.position < n
        ? { origin: "inherited", fromVersion: src.number }
        : { origin: "pending", fromVersion: null, detail: "", photoMediaId: null, outputs: {} };
    });
    await touchProject(tx, project.id);
    return v!.id;
  });
  return getVersionDTO(db, id);
}
