import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../db/client.js";
import { media, projects, steps, versions, type MediaRow, type ProjectRow, type StepRow, type VersionRow } from "../db/schema.js";
import { notFound } from "./errors.js";

// Every helper answers 404 for both "doesn't exist" and "belongs to someone else",
// so ids can't be probed. Pass `lock: true` inside a transaction to take a row lock
// on the owning project (serialises numbering/position changes per project).

export async function loadOwnedProject(
  db: DbOrTx,
  userId: string,
  projectId: string,
  opts: { lock?: boolean } = {},
): Promise<ProjectRow> {
  const q = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  const [row] = opts.lock ? await q.for("update") : await q;
  if (!row) throw notFound("Project");
  return row;
}

export async function loadOwnedVersion(
  db: DbOrTx,
  userId: string,
  versionId: string,
  opts: { lock?: boolean } = {},
): Promise<{ version: VersionRow; project: ProjectRow }> {
  const q = db
    .select({ version: versions, project: projects })
    .from(versions)
    .innerJoin(projects, eq(projects.id, versions.projectId))
    .where(and(eq(versions.id, versionId), eq(projects.userId, userId)));
  const [row] = opts.lock ? await q.for("update", { of: projects }) : await q;
  if (!row) throw notFound("Version");
  return row;
}

export async function loadOwnedStep(
  db: DbOrTx,
  userId: string,
  stepId: string,
  opts: { lock?: boolean } = {},
): Promise<{ step: StepRow; version: VersionRow; project: ProjectRow }> {
  const q = db
    .select({ step: steps, version: versions, project: projects })
    .from(steps)
    .innerJoin(versions, eq(versions.id, steps.versionId))
    .innerJoin(projects, eq(projects.id, versions.projectId))
    .where(and(eq(steps.id, stepId), eq(projects.userId, userId)));
  const [row] = opts.lock ? await q.for("update", { of: projects }) : await q;
  if (!row) throw notFound("Step");
  return row;
}

export async function loadOwnedMedia(db: DbOrTx, userId: string, mediaId: string): Promise<MediaRow> {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.userId, userId)));
  if (!row) throw notFound("Media");
  return row;
}
