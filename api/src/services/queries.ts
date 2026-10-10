import { and, asc, count, desc, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import type { DbOrTx } from "../db/client.js";
import { goals, projects, runs, steps, versions, type ProjectRow, type StepRow } from "../db/schema.js";
import { buildStepTree, buildVersionDTO, groupBy, toProjectCore, toRunDTO } from "../lib/dto.js";
import { notFound } from "../lib/errors.js";
import type { ProjectDTO, ProjectSummaryDTO, StepDTO, VersionDTO } from "../types.js";

// Read-side assembly. Callers are responsible for ownership checks; these load by id.
// Each loader issues a fixed handful of queries and assembles in memory (no N+1).

export async function getProjectDTO(db: DbOrTx, projectId: string): Promise<ProjectDTO> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw notFound("Project");
  const [goalRows, versionRows, runRows, stepRows] = await Promise.all([
    db.select().from(goals).where(eq(goals.projectId, projectId)).orderBy(asc(goals.position)),
    db.select().from(versions).where(eq(versions.projectId, projectId)).orderBy(asc(versions.number)),
    db.select().from(runs).where(eq(runs.projectId, projectId)).orderBy(asc(runs.number)),
    db
      .select({ step: steps })
      .from(steps)
      .innerJoin(versions, eq(versions.id, steps.versionId))
      .where(eq(versions.projectId, projectId))
      .then((rows) => rows.map((r) => r.step)),
  ]);
  return assembleProject(project, goalRows, versionRows, stepRows, runRows);
}

function assembleProject(
  project: ProjectRow,
  goalRows: (typeof goals.$inferSelect)[],
  versionRows: (typeof versions.$inferSelect)[],
  stepRows: StepRow[],
  runRows: (typeof runs.$inferSelect)[],
): ProjectDTO {
  const stepsByVersion = groupBy(stepRows, (s) => s.versionId);
  const runsByVersion = groupBy(runRows, (r) => r.versionId);
  return {
    ...toProjectCore(project, goalRows),
    versions: versionRows.map((v) =>
      buildVersionDTO(v, project.bestVersionId, stepsByVersion.get(v.id) ?? [], runsByVersion.get(v.id) ?? []),
    ),
    runs: runRows.map(toRunDTO),
  };
}

export async function getVersionDTO(db: DbOrTx, versionId: string): Promise<VersionDTO> {
  const [row] = await db
    .select({ version: versions, bestVersionId: projects.bestVersionId })
    .from(versions)
    .innerJoin(projects, eq(projects.id, versions.projectId))
    .where(eq(versions.id, versionId));
  if (!row) throw notFound("Version");
  const [stepRows, runRows] = await Promise.all([
    db.select().from(steps).where(eq(steps.versionId, versionId)),
    db.select().from(runs).where(eq(runs.versionId, versionId)),
  ]);
  return buildVersionDTO(row.version, row.bestVersionId, stepRows, runRows);
}

export async function getStepTree(db: DbOrTx, versionId: string): Promise<StepDTO[]> {
  return buildStepTree(await db.select().from(steps).where(eq(steps.versionId, versionId)));
}

export async function listProjectSummaries(
  db: DbOrTx,
  userId: string,
  archived: boolean,
): Promise<ProjectSummaryDTO[]> {
  const projectRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt)));
  if (projectRows.length === 0) return [];
  const ids = projectRows.map((p) => p.id);
  const bestIds = projectRows.map((p) => p.bestVersionId).filter((x): x is string => x !== null);

  const [goalRows, versionCounts, runStats, latestRuns, bestRuns] = await Promise.all([
    db.select().from(goals).where(inArray(goals.projectId, ids)).orderBy(asc(goals.position)),
    db
      .select({ projectId: versions.projectId, n: count() })
      .from(versions)
      .where(inArray(versions.projectId, ids))
      .groupBy(versions.projectId),
    db
      .select({ projectId: runs.projectId, n: count(), last: max(runs.createdAt) })
      .from(runs)
      .where(inArray(runs.projectId, ids))
      .groupBy(runs.projectId),
    db
      .selectDistinctOn([runs.projectId], {
        projectId: runs.projectId,
        createdAt: runs.createdAt,
        versionNumber: versions.number,
        versionName: versions.name,
      })
      .from(runs)
      .innerJoin(versions, eq(versions.id, runs.versionId))
      .where(inArray(runs.projectId, ids))
      .orderBy(runs.projectId, desc(runs.number)),
    bestIds.length === 0
      ? Promise.resolve([] as { versionId: string; outputs: Record<string, number> }[])
      : db
          .selectDistinctOn([runs.versionId], { versionId: runs.versionId, outputs: runs.outputs })
          .from(runs)
          .where(inArray(runs.versionId, bestIds))
          .orderBy(runs.versionId, desc(runs.number)),
  ]);

  const goalsBy = groupBy(goalRows, (g) => g.projectId);
  const vCount = new Map(versionCounts.map((r) => [r.projectId, r.n]));
  const rStats = new Map(runStats.map((r) => [r.projectId, r]));
  const latest = new Map(latestRuns.map((r) => [r.projectId, r]));
  const bestOut = new Map(bestRuns.map((r) => [r.versionId, r.outputs]));

  const summaries = projectRows.map((p) => {
    const stats = rStats.get(p.id);
    const lr = latest.get(p.id);
    const lastRunAt = stats?.last ?? null;
    const dto: ProjectSummaryDTO = {
      ...toProjectCore(p, goalsBy.get(p.id) ?? []),
      versionCount: vCount.get(p.id) ?? 0,
      runCount: stats?.n ?? 0,
      lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
      lastRunVersion: lr ? { number: lr.versionNumber, name: lr.versionName } : null,
      bestOutputs: p.bestVersionId ? (bestOut.get(p.bestVersionId) ?? null) : null,
    };
    const activity = Math.max(p.updatedAt.getTime(), lastRunAt?.getTime() ?? 0);
    return { dto, pinned: p.pinnedAt?.getTime() ?? null, activity, created: p.createdAt.getTime() };
  });

  summaries.sort((a, b) => {
    if (a.pinned !== null || b.pinned !== null) {
      if (a.pinned === null) return 1;
      if (b.pinned === null) return -1;
      if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    }
    return b.activity - a.activity || b.created - a.created;
  });
  return summaries.map((s) => s.dto);
}
