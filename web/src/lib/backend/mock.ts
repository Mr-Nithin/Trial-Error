import type {
  GoalDTO,
  GoalInput,
  ProjectDTO,
  ProjectSummaryDTO,
  RunDTO,
  StepDTO,
  UserDTO,
  VersionDTO,
} from "@shared/api-types";
import { projects as seed, type Project, type Step } from "../data";
import { ApiError, type Backend } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(x: T): T => structuredClone(x);

function daysFromText(text: string): number {
  if (text.startsWith("today")) return 0;
  if (text.startsWith("yesterday")) return 1;
  const n = Number(text.match(/\d+/)?.[0] ?? 1);
  if (text.includes("week")) return n * 7;
  if (text.includes("day")) return n;
  return 14;
}

const tints: Record<string, string> = {
  Food: "#E2F2EC",
  Fitness: "#E8E4F8",
  Plant: "#E6F2DA",
  Build: "#FBE7D6",
  Create: "#FCE4EC",
  Other: "#EDEEEA",
};

function stepToDTO(s: Step, idPrefix: string, position: number, parent: StepDTO | null): StepDTO {
  const dto: StepDTO = {
    id: `${idPrefix}-${s.id}`,
    parentStepId: parent?.id ?? null,
    position,
    label: parent ? `${parent.position}${String.fromCharCode(96 + position)}` : String(position),
    title: s.title,
    detail: s.origin === "pending" ? "" : s.detail,
    origin: s.origin,
    fromVersion: s.fromVersion ?? null,
    photoMediaId: s.photo ?? null,
    outputs: {},
    subSteps: [],
  };
  dto.subSteps = (s.subSteps ?? []).map((sub, i) => stepToDTO(sub, idPrefix, i + 1, dto));
  return dto;
}

function projectToDTO(p: Project): ProjectDTO {
  const vid = (id: string) => `${p.id}-${id}`;
  const versions: VersionDTO[] = p.versions.map((v) => ({
    id: vid(v.id),
    number: v.number,
    name: v.name,
    parentId: v.parentId ? vid(v.parentId) : null,
    branchedAtStep: v.branchedAtStep ?? null,
    status: v.status === "in-progress" ? "in_progress" : "done",
    isBest: v.status === "best",
    changeNote: v.changeNote ?? "",
    createdAt: ago(30),
    runCount: v.runs,
    lastRunAt: ago(daysFromText(v.lastRun)),
    outputs: v.outputs,
    steps: v.steps.map((s, i) => stepToDTO(s, vid(v.id), i + 1, null)),
  }));
  const runs: RunDTO[] = p.runs.map((r) => ({
    id: `${p.id}-r${r.number}`,
    number: r.number,
    versionId: vid(r.versionId),
    createdAt: ago(daysFromText(r.when)),
    outputs: r.outputs,
    notes: "",
    changeNote: "",
  }));
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    tint: p.tint,
    category: p.category,
    archivedAt: p.archived ? ago(60) : null,
    pinnedAt: null,
    createdAt: ago(40),
    updatedAt: ago(daysFromText(p.lastRun)),
    goals: p.goals.map((g, i) => ({ id: `${p.id}-g${i}`, metric: g.metric, label: g.label, icon: g.icon, op: g.op, target: g.target, unit: g.unit })),
    bestVersionId: versions.find((v) => v.isBest)?.id ?? null,
    versions,
    runs,
  };
}

let store: ProjectDTO[] | null = null;
const db = () => (store ??= seed.map(projectToDTO));
let user: UserDTO = { id: "demo", email: "demo@arc.app", name: "Nithin", createdAt: ago(40) };
const uploads = new Map<string, string>();

const notFound = () => new ApiError(404, "not_found", "Not found");

function findProject(id: string) {
  const p = db().find((x) => x.id === id);
  if (!p) throw notFound();
  return p;
}

function findVersion(id: string) {
  for (const p of db()) {
    const v = p.versions.find((x) => x.id === id);
    if (v) return { p, v };
  }
  throw notFound();
}

function findStep(id: string) {
  for (const p of db())
    for (const v of p.versions)
      for (const s of v.steps) {
        if (s.id === id) return { p, v, s, siblings: v.steps, parent: null as StepDTO | null };
        const sub = s.subSteps.find((x) => x.id === id);
        if (sub) return { p, v, s: sub, siblings: s.subSteps, parent: s };
      }
  throw notFound();
}

function relabel(steps: StepDTO[], parent: StepDTO | null) {
  steps.forEach((s, i) => {
    s.position = i + 1;
    s.label = parent ? `${parent.position}${String.fromCharCode(97 + i)}` : String(i + 1);
    relabel(s.subSteps, s);
  });
}

function syncBest(p: ProjectDTO) {
  p.versions.forEach((v) => (v.isBest = v.id === p.bestVersionId));
}

function goalsFrom(inputs: GoalInput[]): GoalDTO[] {
  return inputs.map((g) => ({ id: uid(), ...g }));
}

function summarize(p: ProjectDTO): ProjectSummaryDTO {
  const { versions, runs, ...core } = p;
  const lastRun = runs[runs.length - 1];
  const lastVersion = lastRun && versions.find((v) => v.id === lastRun.versionId);
  const latest = [...versions].sort((a, b) => (b.lastRunAt ?? "").localeCompare(a.lastRunAt ?? ""))[0];
  const best = versions.find((v) => v.id === p.bestVersionId);
  return {
    ...core,
    versionCount: versions.length,
    runCount: versions.reduce((n, v) => n + v.runCount, 0),
    lastRunAt: lastRun?.createdAt ?? latest?.lastRunAt ?? null,
    lastRunVersion: lastVersion ? { number: lastVersion.number, name: lastVersion.name } : latest ? { number: latest.number, name: latest.name } : null,
    bestOutputs: best?.outputs ?? null,
  };
}

function nextNumber(p: ProjectDTO) {
  return Math.max(0, ...p.versions.map((v) => v.number)) + 1;
}

function copySteps(steps: StepDTO[], versionId: string, map: (s: StepDTO) => Partial<StepDTO>, parent: StepDTO | null = null): StepDTO[] {
  return steps.map((s) => {
    const copy: StepDTO = { ...clone(s), id: `${versionId}-${uid()}`, parentStepId: parent?.id ?? null, ...map(s) };
    copy.subSteps = copy.subSteps.length ? copySteps(s.subSteps, versionId, map, copy) : [];
    return copy;
  });
}

const touch = (p: ProjectDTO) => (p.updatedAt = new Date().toISOString());

export const mockMediaUrl = (id: string) => uploads.get(id) ?? id;

export const mockBackend: Backend = {
  async me() {
    return user;
  },
  async signup(input) {
    user = { ...user, name: input.name, email: input.email };
    return user;
  },
  async login(input) {
    user = { ...user, email: input.email };
    return user;
  },
  async logout() {},
  async updateMe(input) {
    user = { ...user, ...input };
    return user;
  },

  async listProjects(archived) {
    return db()
      .filter((p) => !!p.archivedAt === archived)
      .sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? "") || b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => clone(summarize(p)));
  },
  async getProject(id) {
    return clone(findProject(id));
  },
  async createProject(input) {
    const now = new Date().toISOString();
    const p: ProjectDTO = {
      id: `p-${uid()}`,
      name: input.name,
      emoji: input.emoji,
      tint: input.tint ?? tints[input.category] ?? tints.Other,
      category: input.category,
      archivedAt: null,
      pinnedAt: null,
      createdAt: now,
      updatedAt: now,
      goals: goalsFrom(input.goals),
      bestVersionId: null,
      versions: [],
      runs: [],
    };
    db().unshift(p);
    return clone(p);
  },
  async updateProject(id, input) {
    const p = findProject(id);
    if (input.name !== undefined) p.name = input.name;
    if (input.emoji !== undefined) p.emoji = input.emoji;
    if (input.category !== undefined) p.category = input.category;
    if (input.archived !== undefined) p.archivedAt = input.archived ? new Date().toISOString() : null;
    if (input.pinned !== undefined) p.pinnedAt = input.pinned ? new Date().toISOString() : null;
    touch(p);
    return clone(p);
  },
  async deleteProject(id) {
    store = db().filter((p) => p.id !== id);
  },
  async duplicateProject(id) {
    const src = findProject(id);
    const copy: ProjectDTO = { ...clone(src), id: `p-${uid()}`, name: `${src.name} (copy)`, runs: [], pinnedAt: null };
    const ids = new Map<string, string>();
    copy.versions = src.versions.map((v) => {
      const nid = `${copy.id}-${uid()}`;
      ids.set(v.id, nid);
      return { ...clone(v), id: nid, runCount: 0, lastRunAt: null, outputs: {}, steps: copySteps(v.steps, nid, () => ({})) };
    });
    copy.versions.forEach((v) => (v.parentId = v.parentId ? (ids.get(v.parentId) ?? null) : null));
    copy.bestVersionId = src.bestVersionId ? (ids.get(src.bestVersionId) ?? null) : null;
    db().splice(db().indexOf(src) + 1, 0, copy);
    return clone(copy);
  },
  async replaceGoals(id, input) {
    const p = findProject(id);
    const metrics = input.goals.map((g) => g.metric);
    if (new Set(metrics).size !== metrics.length) throw new ApiError(400, "validation", "Each goal needs a different metric");
    p.goals = goalsFrom(input.goals);
    touch(p);
    return clone(p.goals);
  },

  async createVersion(projectId, input) {
    const p = findProject(projectId);
    const v: VersionDTO = {
      id: `${p.id}-${uid()}`,
      number: nextNumber(p),
      name: input.name,
      parentId: null,
      branchedAtStep: null,
      status: "in_progress",
      isBest: false,
      changeNote: "",
      createdAt: new Date().toISOString(),
      runCount: 0,
      lastRunAt: null,
      outputs: {},
      steps: [],
    };
    p.versions.push(v);
    touch(p);
    return clone(v);
  },
  async updateVersion(id, input) {
    const { p, v } = findVersion(id);
    if (input.name !== undefined) v.name = input.name;
    if (input.best) {
      p.bestVersionId = v.id;
      syncBest(p);
    }
    touch(p);
    return clone(v);
  },
  async deleteVersion(id) {
    const { p, v } = findVersion(id);
    p.versions = p.versions.filter((x) => x.id !== id);
    p.versions.forEach((x) => x.parentId === id && (x.parentId = null));
    p.runs = p.runs.filter((r) => r.versionId !== id);
    if (p.bestVersionId === v.id) p.bestVersionId = null;
    touch(p);
  },
  async duplicateVersion(id) {
    const { p, v } = findVersion(id);
    const nid = `${p.id}-${uid()}`;
    const copy: VersionDTO = {
      ...clone(v),
      id: nid,
      number: nextNumber(p),
      name: `${v.name} (copy)`,
      parentId: v.id,
      branchedAtStep: null,
      status: "in_progress",
      isBest: false,
      runCount: 0,
      lastRunAt: null,
      outputs: {},
      steps: copySteps(v.steps, nid, () => ({ origin: "inherited", fromVersion: v.number })),
    };
    p.versions.push(copy);
    touch(p);
    return clone(copy);
  },
  async branchVersion(id, input) {
    const { p, v } = findVersion(id);
    const { s, parent } = findStep(input.fromStepId);
    const at = (parent ?? s).position;
    const nid = `${p.id}-${uid()}`;
    const kept = copySteps(
      v.steps.filter((x) => x.position < at),
      nid,
      () => ({ origin: "inherited", fromVersion: v.number }),
    );
    const redo = v.steps
      .filter((x) => x.position >= at)
      .map((x) => ({ ...clone(x), id: `${nid}-${uid()}`, origin: "pending" as const, detail: "", photoMediaId: null, outputs: {}, fromVersion: null, subSteps: [] }));
    const nv: VersionDTO = {
      id: nid,
      number: nextNumber(p),
      name: input.name,
      parentId: v.id,
      branchedAtStep: at,
      status: "in_progress",
      isBest: false,
      changeNote: "",
      createdAt: new Date().toISOString(),
      runCount: 0,
      lastRunAt: null,
      outputs: {},
      steps: [...kept, ...redo],
    };
    relabel(nv.steps, null);
    p.versions.push(nv);
    touch(p);
    return clone(nv);
  },

  async createStep(versionId, input) {
    const { p, v } = findVersion(versionId);
    const parent = input.parentStepId ? v.steps.find((s) => s.id === input.parentStepId) : null;
    if (input.parentStepId && !parent) throw notFound();
    const siblings = parent ? parent.subSteps : v.steps;
    const step: StepDTO = {
      id: `${v.id}-${uid()}`,
      parentStepId: parent?.id ?? null,
      position: siblings.length + 1,
      label: "",
      title: input.title,
      detail: input.detail ?? "",
      origin: "new",
      fromVersion: null,
      photoMediaId: input.photoMediaId ?? null,
      outputs: input.outputs ?? {},
      subSteps: [],
    };
    siblings.push(step);
    relabel(v.steps, null);
    touch(p);
    return clone(step);
  },
  async updateStep(id, input) {
    const { p, v, s } = findStep(id);
    if (input.title !== undefined) s.title = input.title;
    if (input.detail !== undefined) s.detail = input.detail;
    if (input.outputs !== undefined) s.outputs = input.outputs;
    if (input.photoMediaId !== undefined) s.photoMediaId = input.photoMediaId;
    if (s.origin === "inherited" || s.origin === "pending") s.origin = s.origin === "pending" && !v.parentId ? "new" : "changed";
    s.fromVersion = null;
    touch(p);
    return clone(s);
  },
  async deleteStep(id) {
    const { p, v, siblings, s } = findStep(id);
    siblings.splice(siblings.indexOf(s), 1);
    relabel(v.steps, null);
    touch(p);
  },
  async moveStep(id, input) {
    const { p, v, siblings, s } = findStep(id);
    const i = siblings.indexOf(s);
    const j = input.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= siblings.length) throw new ApiError(400, "cannot_move", "Step is already at the edge");
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    relabel(v.steps, null);
    touch(p);
    return clone(siblings);
  },

  async createRun(versionId, input) {
    const { p, v } = findVersion(versionId);
    const run: RunDTO = {
      id: uid(),
      number: Math.max(0, ...p.runs.map((r) => r.number), p.versions.reduce((n, x) => n + x.runCount, 0)) + 1,
      versionId,
      createdAt: new Date().toISOString(),
      outputs: input.outputs,
      notes: input.notes ?? "",
      changeNote: input.changeNote ?? "",
    };
    p.runs.push(run);
    v.runCount += 1;
    v.lastRunAt = run.createdAt;
    v.outputs = input.outputs;
    v.status = "done";
    const metAll = p.goals.every((g) => {
      const val = input.outputs[g.metric];
      return val !== undefined && (g.op === ">=" ? val >= g.target : val <= g.target);
    });
    if (!p.bestVersionId && metAll) {
      p.bestVersionId = v.id;
      syncBest(p);
    }
    touch(p);
    return clone(run);
  },
  async uploadMedia(file) {
    const id = `m-${uid()}`;
    uploads.set(id, URL.createObjectURL(file));
    return { id, url: uploads.get(id)!, contentType: file.type, size: file.size };
  },
};

export function mockStaticParams() {
  return db()
    .filter((p) => !p.archivedAt)
    .map((p) => ({ projectId: p.id, versions: p.versions.map((v) => ({ versionId: v.id, steps: v.steps.flatMap((s) => [s.id, ...s.subSteps.map((x) => x.id)]) })) }));
}
