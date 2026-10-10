import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/client.js";
import { goals, projects, steps, versions, type StepRow } from "../db/schema.js";
import { toGoalDTO } from "../lib/dto.js";
import { loadOwnedProject } from "../lib/ownership.js";
import type { Category, CreateProjectInput, GoalDTO, GoalInput, ProjectDTO, UpdateProjectInput } from "../types.js";
import { getProjectDTO } from "./queries.js";

export const DEFAULT_TINTS: Record<Category, string> = {
  Food: "#E2F2EC",
  Fitness: "#E8E4F8",
  Plant: "#E6F2DA",
  Build: "#FBE7D6",
  Create: "#FCE4EC",
  Other: "#EDEEEA",
};

const goalRows = (projectId: string, list: GoalInput[]) =>
  list.map((g, i) => ({ projectId, position: i + 1, ...g }));

export async function createProject(db: Db, userId: string, input: CreateProjectInput): Promise<ProjectDTO> {
  const id = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(projects)
      .values({
        userId,
        name: input.name,
        emoji: input.emoji,
        category: input.category,
        tint: input.tint ?? DEFAULT_TINTS[input.category],
      })
      .returning({ id: projects.id });
    if (input.goals.length) await tx.insert(goals).values(goalRows(p!.id, input.goals));
    return p!.id;
  });
  return getProjectDTO(db, id);
}

export async function getProject(db: Db, userId: string, projectId: string): Promise<ProjectDTO> {
  await loadOwnedProject(db, userId, projectId);
  return getProjectDTO(db, projectId);
}

export async function updateProject(
  db: Db,
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectDTO> {
  const p = await loadOwnedProject(db, userId, projectId);
  const now = new Date();
  await db
    .update(projects)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.emoji !== undefined && { emoji: input.emoji }),
      ...(input.category !== undefined && { category: input.category }),
      // Keep the original timestamp if it's already set, so re-archiving/pinning is idempotent.
      ...(input.archived !== undefined && { archivedAt: input.archived ? (p.archivedAt ?? now) : null }),
      ...(input.pinned !== undefined && { pinnedAt: input.pinned ? (p.pinnedAt ?? now) : null }),
      updatedAt: now,
    })
    .where(eq(projects.id, projectId));
  return getProjectDTO(db, projectId);
}

export async function deleteProject(db: Db, userId: string, projectId: string): Promise<void> {
  await loadOwnedProject(db, userId, projectId);
  await db.delete(projects).where(eq(projects.id, projectId));
}

export async function replaceGoals(
  db: Db,
  userId: string,
  projectId: string,
  list: GoalInput[],
): Promise<GoalDTO[]> {
  const rows = await db.transaction(async (tx) => {
    await loadOwnedProject(tx, userId, projectId, { lock: true });
    await tx.delete(goals).where(eq(goals.projectId, projectId));
    await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
    if (!list.length) return [];
    return tx.insert(goals).values(goalRows(projectId, list)).returning();
  });
  return rows.sort((a, b) => a.position - b.position).map(toGoalDTO);
}

/**
 * Copies steps (with one level of sub-steps) into another version, generating ids up front
 * so parent links can be remapped without relying on RETURNING order.
 */
export async function copySteps(
  tx: DbOrTx,
  source: StepRow[],
  targetVersionId: string,
  transform: (s: StepRow) => Partial<typeof steps.$inferInsert> = () => ({}),
): Promise<void> {
  if (!source.length) return;
  const idMap = new Map(source.map((s) => [s.id, randomUUID()]));
  const toInsert = (s: StepRow): typeof steps.$inferInsert => ({
    id: idMap.get(s.id)!,
    versionId: targetVersionId,
    parentStepId: s.parentStepId ? idMap.get(s.parentStepId)! : null,
    position: s.position,
    title: s.title,
    detail: s.detail,
    origin: s.origin,
    fromVersion: s.fromVersion,
    photoMediaId: s.photoMediaId,
    outputs: s.outputs,
    ...transform(s),
  });
  const top = source.filter((s) => !s.parentStepId);
  const subs = source.filter((s) => s.parentStepId && idMap.has(s.parentStepId));
  await tx.insert(steps).values(top.map(toInsert));
  if (subs.length) await tx.insert(steps).values(subs.map(toInsert));
}

export async function duplicateProject(db: Db, userId: string, projectId: string): Promise<ProjectDTO> {
  const newId = await db.transaction(async (tx) => {
    const src = await loadOwnedProject(tx, userId, projectId);
    // Sequential on purpose: a transaction is a single connection.
    const srcGoals = await tx.select().from(goals).where(eq(goals.projectId, projectId)).orderBy(asc(goals.position));
    const srcVersions = await tx
      .select()
      .from(versions)
      .where(eq(versions.projectId, projectId))
      .orderBy(asc(versions.number));
    const srcSteps = srcVersions.length
      ? await tx.select().from(steps).where(inArray(steps.versionId, srcVersions.map((v) => v.id)))
      : [];

    const vMap = new Map(srcVersions.map((v) => [v.id, randomUUID()]));
    const pid = randomUUID();
    await tx.insert(projects).values({
      id: pid,
      userId,
      name: `${src.name} (copy)`.slice(0, 120),
      emoji: src.emoji,
      tint: src.tint,
      category: src.category,
    });
    if (srcGoals.length) {
      await tx.insert(goals).values(
        srcGoals.map((g) => ({
          projectId: pid,
          position: g.position,
          metric: g.metric,
          label: g.label,
          icon: g.icon,
          op: g.op,
          target: g.target,
          unit: g.unit,
        })),
      );
    }
    if (srcVersions.length) {
      // Parent links point at versions in the same batch; FK checks run per statement, so one insert is fine.
      await tx.insert(versions).values(
        srcVersions.map((v) => ({
          id: vMap.get(v.id)!,
          projectId: pid,
          number: v.number,
          name: v.name,
          parentVersionId: v.parentVersionId ? (vMap.get(v.parentVersionId) ?? null) : null,
          branchedAtStep: v.branchedAtStep,
          status: v.status,
          changeNote: v.changeNote,
        })),
      );
      const byVersion = new Map<string, StepRow[]>();
      for (const s of srcSteps) byVersion.set(s.versionId, [...(byVersion.get(s.versionId) ?? []), s]);
      for (const [vid, list] of byVersion) await copySteps(tx, list, vMap.get(vid)!);
    }
    const best = src.bestVersionId ? (vMap.get(src.bestVersionId) ?? null) : null;
    if (best) await tx.update(projects).set({ bestVersionId: best }).where(eq(projects.id, pid));
    return pid;
  });
  return getProjectDTO(db, newId);
}
