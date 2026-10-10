import { asc, eq, max } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { goals, projects, runs, versions, type GoalRow } from "../db/schema.js";
import { toRunDTO } from "../lib/dto.js";
import { loadOwnedProject, loadOwnedVersion } from "../lib/ownership.js";
import type { CreateRunInput, Outputs, RunDTO } from "../types.js";

/** A goal whose metric is missing from the outputs counts as not met. */
export function meetsGoal(goal: Pick<GoalRow, "metric" | "op" | "target">, outputs: Outputs): boolean {
  const v = outputs[goal.metric];
  if (typeof v !== "number" || !Number.isFinite(v)) return false;
  return goal.op === ">=" ? v >= goal.target : v <= goal.target;
}

export function meetsAllGoals(goalList: Pick<GoalRow, "metric" | "op" | "target">[], outputs: Outputs): boolean {
  // A project with no goals has nothing to meet, so it never auto-promotes a "best".
  return goalList.length > 0 && goalList.every((g) => meetsGoal(g, outputs));
}

export async function createRun(
  db: Db,
  userId: string,
  versionId: string,
  input: CreateRunInput & { createdAt?: Date },
): Promise<RunDTO> {
  return db.transaction(async (tx) => {
    const { project } = await loadOwnedVersion(tx, userId, versionId, { lock: true });
    const [last] = await tx.select({ n: max(runs.number) }).from(runs).where(eq(runs.projectId, project.id));
    const [run] = await tx
      .insert(runs)
      .values({
        versionId,
        projectId: project.id,
        number: (last?.n ?? 0) + 1,
        outputs: input.outputs,
        notes: input.notes ?? "",
        changeNote: input.changeNote ?? "",
        ...(input.createdAt && { createdAt: input.createdAt }),
      })
      .returning();
    await tx.update(versions).set({ status: "done" }).where(eq(versions.id, versionId));

    let bestVersionId = project.bestVersionId;
    if (!bestVersionId) {
      const goalList = await tx.select().from(goals).where(eq(goals.projectId, project.id));
      if (meetsAllGoals(goalList, input.outputs)) bestVersionId = versionId;
    }
    await tx
      .update(projects)
      .set({ updatedAt: new Date(), bestVersionId })
      .where(eq(projects.id, project.id));
    return toRunDTO(run!);
  });
}

export async function listRuns(db: Db, userId: string, projectId: string): Promise<RunDTO[]> {
  await loadOwnedProject(db, userId, projectId);
  const rows = await db.select().from(runs).where(eq(runs.projectId, projectId)).orderBy(asc(runs.number));
  return rows.map(toRunDTO);
}
