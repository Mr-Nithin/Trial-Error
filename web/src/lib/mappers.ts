import type { GoalDTO, ProjectDTO, ProjectSummaryDTO, RunDTO, StepDTO, VersionDTO } from "@shared/api-types";
import type { Goal, Project, ProjectSummary, Run, Step, Version } from "./data";
import { mediaUrl } from "./backend";

const DAY = 24 * 60 * 60 * 1000;

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.ceil((startOfToday.getTime() - then.getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function goalShort(g: Pick<Goal, "label" | "op" | "target" | "unit">): string {
  const sym = g.op === ">=" ? "≥" : "≤";
  const unit = g.unit ? (g.unit.startsWith("/") || g.unit === "×" ? g.unit : ` ${g.unit}`) : "";
  return `${g.label} ${sym} ${g.target}${unit}`;
}

export function toGoal(g: GoalDTO): Goal {
  return { id: g.id, metric: g.metric, label: g.label, icon: g.icon, op: g.op, target: g.target, unit: g.unit, short: goalShort(g) };
}

export function toStep(s: StepDTO): Step {
  return {
    id: s.id,
    label: s.label,
    title: s.title,
    detail: s.origin === "pending" && !s.detail ? "Tap to record now" : s.detail,
    origin: s.origin,
    fromVersion: s.fromVersion ?? undefined,
    photoUrl: s.photoMediaId ? mediaUrl(s.photoMediaId) : undefined,
    outputs: s.outputs,
    subSteps: s.subSteps.length ? s.subSteps.map(toStep) : undefined,
  };
}

function versionSummary(v: VersionDTO, parent?: VersionDTO): string {
  const top = v.steps.length;
  const subs = v.steps.reduce((n, s) => n + s.subSteps.length, 0);
  const origin =
    parent && v.branchedAtStep
      ? v.branchedAtStep > 1
        ? `Steps 1–${v.branchedAtStep - 1} from V${parent.number}`
        : `Branched from V${parent.number}`
      : parent
        ? `Copy of V${parent.number}`
        : "From scratch";
  return `${origin} · ${top} step${top === 1 ? "" : "s"}${subs ? ` + ${subs} sub` : ""} · ${v.runCount} run${v.runCount === 1 ? "" : "s"}`;
}

export function toVersion(v: VersionDTO, all: VersionDTO[]): Version {
  const parent = all.find((p) => p.id === v.parentId);
  return {
    id: v.id,
    number: v.number,
    name: v.name,
    parentId: v.parentId ?? undefined,
    branchedAtStep: v.branchedAtStep ?? undefined,
    status: v.isBest ? "best" : v.status === "in_progress" ? "in-progress" : "done",
    runs: v.runCount,
    summary: versionSummary(v, parent),
    lastRun: relativeTime(v.lastRunAt),
    changeNote: v.changeNote || undefined,
    outputs: v.outputs,
    steps: v.steps.map(toStep),
  };
}

export function toRun(r: RunDTO): Run {
  return { number: r.number, versionId: r.versionId, when: relativeTime(r.createdAt), outputs: r.outputs };
}

function lastRunText(lastRunAt: string | null, v: { number: number; name: string } | null | undefined): string {
  if (!lastRunAt || !v) return "no runs yet";
  return `${relativeTime(lastRunAt)} · V${v.number} — ${v.name}`;
}

export function toProject(p: ProjectDTO): Project {
  const lastRun = p.runs[p.runs.length - 1];
  const lastVersion = lastRun && p.versions.find((v) => v.id === lastRun.versionId);
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    tint: p.tint,
    category: p.category,
    goals: p.goals.map(toGoal),
    versions: p.versions.map((v) => toVersion(v, p.versions)),
    runs: p.runs.map(toRun),
    lastRun: lastRunText(lastRun?.createdAt ?? null, lastVersion),
    archived: p.archivedAt ? `archived ${relativeTime(p.archivedAt)}` : undefined,
    bestVersionId: p.bestVersionId,
  };
}

export function toSummary(p: ProjectSummaryDTO): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    tint: p.tint,
    category: p.category,
    goals: p.goals.map(toGoal),
    versionCount: p.versionCount,
    runCount: p.runCount,
    lastRun: lastRunText(p.lastRunAt, p.lastRunVersion),
    bestOutputs: p.bestOutputs,
    hasBest: !!p.bestVersionId,
    archived: p.archivedAt ? `archived ${relativeTime(p.archivedAt)} · ${p.versionCount} versions · ${p.runCount} runs` : undefined,
  };
}
