import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type OutputsJson = Record<string, number>;

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** sha256 hex of the raw cookie token. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    tint: text("tint").notNull(),
    category: text("category", {
      enum: ["Food", "Fitness", "Plant", "Build", "Create", "Other"],
    }).notNull(),
    // Circular with versions.project_id; drizzle-kit emits FKs after all tables exist.
    bestVersionId: uuid("best_version_id").references((): AnyPgColumn => versions.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_user_id_idx").on(t.userId)],
);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    metric: text("metric").notNull(),
    label: text("label").notNull(),
    icon: text("icon").notNull(),
    op: text("op", { enum: [">=", "<="] }).notNull(),
    target: doublePrecision("target").notNull(),
    unit: text("unit").notNull(),
  },
  (t) => [uniqueIndex("goals_project_metric_uq").on(t.projectId, t.metric)],
);

export const versions = pgTable(
  "versions",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    parentVersionId: uuid("parent_version_id").references((): AnyPgColumn => versions.id, {
      onDelete: "set null",
    }),
    branchedAtStep: integer("branched_at_step"),
    status: text("status", { enum: ["in_progress", "done"] })
      .notNull()
      .default("in_progress"),
    changeNote: text("change_note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("versions_project_number_uq").on(t.projectId, t.number)],
);

export const media = pgTable(
  "media",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("media_user_id_idx").on(t.userId)],
);

export const steps = pgTable(
  "steps",
  {
    id: id(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => versions.id, { onDelete: "cascade" }),
    parentStepId: uuid("parent_step_id").references((): AnyPgColumn => steps.id, {
      onDelete: "cascade",
    }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    origin: text("origin", { enum: ["inherited", "changed", "new", "pending"] }).notNull(),
    fromVersion: integer("from_version"),
    photoMediaId: uuid("photo_media_id").references(() => media.id, { onDelete: "set null" }),
    outputs: jsonb("outputs").$type<OutputsJson>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("steps_version_id_idx").on(t.versionId),
    index("steps_parent_step_id_idx").on(t.parentStepId),
  ],
);

export const runs = pgTable(
  "runs",
  {
    id: id(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => versions.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    outputs: jsonb("outputs").$type<OutputsJson>().notNull(),
    notes: text("notes").notNull().default(""),
    changeNote: text("change_note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("runs_project_number_uq").on(t.projectId, t.number),
    index("runs_version_id_idx").on(t.versionId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type VersionRow = typeof versions.$inferSelect;
export type StepRow = typeof steps.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type MediaRow = typeof media.$inferSelect;
