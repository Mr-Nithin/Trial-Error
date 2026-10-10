import { z } from "zod";
import type {
  BranchInput,
  Category,
  CreateProjectInput,
  CreateRunInput,
  CreateStepInput,
  CreateVersionInput,
  GoalInput,
  LoginInput,
  MoveStepInput,
  ReplaceGoalsInput,
  SignupInput,
  UpdateMeInput,
  UpdateProjectInput,
  UpdateStepInput,
  UpdateVersionInput,
} from "../types.js";

/** Trimmed string; `min` defaults to 1 (non-empty after trimming). */
const str = (max: number, min = 1) => z.string().trim().min(min).max(max);

export const CATEGORIES = ["Food", "Fitness", "Plant", "Build", "Create", "Other"] as const satisfies readonly Category[];

export const idParams = z.object({ id: z.guid() });
export const uuidSchema = z.guid();

export const outputsSchema = z
  .record(str(64), z.number().finite())
  .refine((o) => Object.keys(o).length <= 50, "At most 50 output metrics");

export const signupSchema = z.object({
  name: str(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(200),
}) satisfies z.ZodType<SignupInput>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(200),
}) satisfies z.ZodType<LoginInput>;

export const updateMeSchema = z.object({ name: str(100).optional() }) satisfies z.ZodType<UpdateMeInput>;

export const goalSchema = z.object({
  metric: str(64),
  label: str(100),
  icon: str(16, 0),
  op: z.enum([">=", "<="]),
  target: z.number().finite(),
  unit: str(32, 0),
}) satisfies z.ZodType<GoalInput>;

const goalsList = z
  .array(goalSchema)
  .max(20)
  .superRefine((goals, ctx) => {
    const seen = new Set<string>();
    goals.forEach((g, i) => {
      if (seen.has(g.metric)) {
        ctx.addIssue({ code: "custom", message: `Duplicate goal metric "${g.metric}"`, path: [i, "metric"] });
      }
      seen.add(g.metric);
    });
  });

const tintSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Tint must be a #RRGGBB colour");

export const createProjectSchema = z.object({
  name: str(100),
  emoji: str(16),
  category: z.enum(CATEGORIES),
  tint: tintSchema.optional(),
  goals: goalsList.default([]),
}) satisfies z.ZodType<CreateProjectInput, unknown>;

export const updateProjectSchema = z.object({
  name: str(100).optional(),
  emoji: str(16).optional(),
  category: z.enum(CATEGORIES).optional(),
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
}) satisfies z.ZodType<UpdateProjectInput>;

export const replaceGoalsSchema = z.object({ goals: goalsList }) satisfies z.ZodType<ReplaceGoalsInput>;

export const createVersionSchema = z.object({ name: str(100) }) satisfies z.ZodType<CreateVersionInput>;

export const updateVersionSchema = z.object({
  name: str(100).optional(),
  best: z.literal(true).optional(),
}) satisfies z.ZodType<UpdateVersionInput>;

export const branchSchema = z.object({ fromStepId: z.guid(), name: str(100) }) satisfies z.ZodType<BranchInput>;

export const createStepSchema = z.object({
  title: str(200),
  detail: str(5000, 0).optional(),
  parentStepId: z.guid().nullable().optional(),
  outputs: outputsSchema.optional(),
  photoMediaId: z.guid().nullable().optional(),
}) satisfies z.ZodType<CreateStepInput>;

export const updateStepSchema = z.object({
  title: str(200).optional(),
  detail: str(5000, 0).optional(),
  outputs: outputsSchema.optional(),
  photoMediaId: z.guid().nullable().optional(),
}) satisfies z.ZodType<UpdateStepInput>;

export const moveStepSchema = z.object({ direction: z.enum(["up", "down"]) }) satisfies z.ZodType<MoveStepInput>;

export const createRunSchema = z.object({
  outputs: outputsSchema,
  notes: str(5000, 0).optional(),
  changeNote: str(1000, 0).optional(),
}) satisfies z.ZodType<CreateRunInput>;

export const listProjectsQuery = z.object({
  archived: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});
