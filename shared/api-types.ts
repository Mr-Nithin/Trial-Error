// Type-only contract between api/ and web/. Keep this file free of runtime imports.

export type Op = ">=" | "<=";
export type StepOrigin = "inherited" | "changed" | "new" | "pending";
export type Outputs = Record<string, number>;
export type Category = "Food" | "Fitness" | "Plant" | "Build" | "Create" | "Other";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface GoalDTO {
  id: string;
  metric: string;
  label: string;
  icon: string;
  op: Op;
  target: number;
  unit: string;
}

export interface StepDTO {
  id: string;
  parentStepId: string | null;
  position: number;
  /** "3" for a top-level step, "3a" for its first sub-step. */
  label: string;
  title: string;
  detail: string;
  origin: StepOrigin;
  /** Version number the step was inherited from, when origin is "inherited". */
  fromVersion: number | null;
  photoMediaId: string | null;
  outputs: Outputs;
  subSteps: StepDTO[];
}

export interface VersionDTO {
  id: string;
  number: number;
  name: string;
  parentId: string | null;
  /** 1-based top-level step position the version was branched at. */
  branchedAtStep: number | null;
  status: "in_progress" | "done";
  isBest: boolean;
  changeNote: string;
  createdAt: string;
  runCount: number;
  lastRunAt: string | null;
  /** Outputs of the most recent run, or {} if never run. */
  outputs: Outputs;
  steps: StepDTO[];
}

export interface RunDTO {
  id: string;
  number: number;
  versionId: string;
  createdAt: string;
  outputs: Outputs;
  notes: string;
  changeNote: string;
}

export interface ProjectCore {
  id: string;
  name: string;
  emoji: string;
  tint: string;
  category: Category;
  archivedAt: string | null;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
  goals: GoalDTO[];
  bestVersionId: string | null;
}

export interface ProjectSummaryDTO extends ProjectCore {
  versionCount: number;
  runCount: number;
  lastRunAt: string | null;
  lastRunVersion: { number: number; name: string } | null;
  bestOutputs: Outputs | null;
}

export interface ProjectDTO extends ProjectCore {
  versions: VersionDTO[];
  runs: RunDTO[];
}

export interface MediaDTO {
  id: string;
  url: string;
  contentType: string;
  size: number;
}

/* ---------- request bodies ---------- */

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateMeInput {
  name?: string;
}

export interface GoalInput {
  metric: string;
  label: string;
  icon: string;
  op: Op;
  target: number;
  unit: string;
}

export interface CreateProjectInput {
  name: string;
  emoji: string;
  category: Category;
  tint?: string;
  goals: GoalInput[];
}

export interface UpdateProjectInput {
  name?: string;
  emoji?: string;
  category?: Category;
  archived?: boolean;
  pinned?: boolean;
}

export interface ReplaceGoalsInput {
  goals: GoalInput[];
}

export interface CreateVersionInput {
  name: string;
}

export interface UpdateVersionInput {
  name?: string;
  /** Only `true` is accepted: marks this version as the project's best. */
  best?: true;
}

export interface BranchInput {
  /** Top-level or sub-step id; sub-steps branch at their parent. */
  fromStepId: string;
  name: string;
}

export interface CreateStepInput {
  title: string;
  detail?: string;
  parentStepId?: string | null;
  outputs?: Outputs;
  photoMediaId?: string | null;
}

export interface UpdateStepInput {
  title?: string;
  detail?: string;
  outputs?: Outputs;
  photoMediaId?: string | null;
}

export interface MoveStepInput {
  direction: "up" | "down";
}

export interface CreateRunInput {
  outputs: Outputs;
  notes?: string;
  changeNote?: string;
}
