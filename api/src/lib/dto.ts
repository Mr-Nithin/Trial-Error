import type { GoalRow, MediaRow, ProjectRow, RunRow, StepRow, UserRow, VersionRow } from "../db/schema.js";
import type {
  GoalDTO,
  MediaDTO,
  Outputs,
  ProjectCore,
  RunDTO,
  StepDTO,
  UserDTO,
  VersionDTO,
} from "../types.js";

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

export const toUserDTO = (u: UserRow): UserDTO => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: iso(u.createdAt),
});

export const toGoalDTO = (g: GoalRow): GoalDTO => ({
  id: g.id,
  metric: g.metric,
  label: g.label,
  icon: g.icon,
  op: g.op,
  target: g.target,
  unit: g.unit,
});

export const toRunDTO = (r: RunRow): RunDTO => ({
  id: r.id,
  number: r.number,
  versionId: r.versionId,
  createdAt: iso(r.createdAt),
  outputs: r.outputs ?? {},
  notes: r.notes,
  changeNote: r.changeNote,
});

export const toMediaDTO = (m: MediaRow): MediaDTO => ({
  id: m.id,
  url: `/api/media/${m.id}`,
  contentType: m.contentType,
  size: m.size,
});

export const subStepLetter = (position: number) => String.fromCharCode(97 + position - 1);

const byPosition = (a: StepRow, b: StepRow) =>
  a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime();

/** Builds the ordered step tree for ONE version from its flat rows. */
export function buildStepTree(rows: StepRow[]): StepDTO[] {
  const children = new Map<string, StepRow[]>();
  const top: StepRow[] = [];
  for (const r of rows) {
    if (r.parentStepId) {
      const list = children.get(r.parentStepId) ?? [];
      list.push(r);
      children.set(r.parentStepId, list);
    } else {
      top.push(r);
    }
  }
  const base = (r: StepRow, label: string): StepDTO => ({
    id: r.id,
    parentStepId: r.parentStepId,
    position: r.position,
    label,
    title: r.title,
    detail: r.detail,
    origin: r.origin,
    fromVersion: r.fromVersion,
    photoMediaId: r.photoMediaId,
    outputs: r.outputs ?? {},
    subSteps: [],
  });
  return top.sort(byPosition).map((t) => {
    const dto = base(t, String(t.position));
    dto.subSteps = (children.get(t.id) ?? [])
      .sort(byPosition)
      .map((s) => base(s, `${t.position}${subStepLetter(s.position)}`));
    return dto;
  });
}

/** Finds a step (top-level or sub-step) in a built tree. */
export function findStep(tree: StepDTO[], id: string): StepDTO | undefined {
  for (const t of tree) {
    if (t.id === id) return t;
    const s = t.subSteps.find((x) => x.id === id);
    if (s) return s;
  }
  return undefined;
}

/** `runs` must be the runs of this version only (any order). */
export function buildVersionDTO(
  v: VersionRow,
  bestVersionId: string | null,
  stepRows: StepRow[],
  versionRuns: RunRow[],
): VersionDTO {
  let latest: RunRow | undefined;
  for (const r of versionRuns) if (!latest || r.number > latest.number) latest = r;
  return {
    id: v.id,
    number: v.number,
    name: v.name,
    parentId: v.parentVersionId,
    branchedAtStep: v.branchedAtStep,
    status: v.status,
    isBest: bestVersionId === v.id,
    changeNote: v.changeNote,
    createdAt: iso(v.createdAt),
    runCount: versionRuns.length,
    lastRunAt: latest ? iso(latest.createdAt) : null,
    outputs: (latest?.outputs ?? {}) as Outputs,
    steps: buildStepTree(stepRows),
  };
}

export function toProjectCore(p: ProjectRow, goalRows: GoalRow[]): ProjectCore {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    tint: p.tint,
    category: p.category,
    archivedAt: isoOrNull(p.archivedAt),
    pinnedAt: isoOrNull(p.pinnedAt),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
    goals: [...goalRows].sort((a, b) => a.position - b.position).map(toGoalDTO),
    bestVersionId: p.bestVersionId,
  };
}

export function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}
