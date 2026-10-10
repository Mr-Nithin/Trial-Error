// Idempotent demo data. Re-running resets the demo user's seeded projects to a known state.
// Goes through the same service functions as the HTTP routes so the seed exercises real logic.
import { and, eq, inArray } from "drizzle-orm";
import { loadConfig } from "./config.js";
import { createDb, runMigrations, type Db } from "./db/client.js";
import { projects, users } from "./db/schema.js";
import { hashPassword } from "./lib/password.js";
import { signup } from "./services/auth.js";
import { createProject } from "./services/projects.js";
import { createRun } from "./services/runs.js";
import { createStep, updateStep } from "./services/steps.js";
import { branchVersion, createVersion, getVersion, updateVersion } from "./services/versions.js";
import type { CreateProjectInput, Outputs, StepDTO, VersionDTO } from "./types.js";

const DEMO = { email: "demo@arc.app", password: "arcdemo123", name: "Nithin" };
const SEEDED = ["My Breakfast", "Sourdough bread", "5K training"];
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number, hour = 8) => {
  const t = new Date(Date.now() - d * DAY);
  t.setUTCHours(hour, 0, 0, 0);
  return t;
};

async function ensureUser(db: Db): Promise<string> {
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO.email));
  if (existing) {
    await db
      .update(users)
      .set({ name: DEMO.name, passwordHash: await hashPassword(DEMO.password) })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  return (await signup(db, DEMO)).id;
}

async function addSteps(
  db: Db,
  userId: string,
  versionId: string,
  list: { title: string; detail: string; outputs?: Outputs }[],
): Promise<StepDTO[]> {
  const out: StepDTO[] = [];
  for (const s of list) out.push(await createStep(db, userId, versionId, s));
  return out;
}

async function addRuns(
  db: Db,
  userId: string,
  version: VersionDTO,
  runs: { outputs: Outputs; notes?: string; changeNote?: string; at: Date }[],
) {
  for (const r of runs) {
    await createRun(db, userId, version.id, { outputs: r.outputs, notes: r.notes, changeNote: r.changeNote, createdAt: r.at });
  }
}

async function seedBreakfast(db: Db, userId: string) {
  const input: CreateProjectInput = {
    name: "My Breakfast",
    emoji: "🍳",
    category: "Food",
    goals: [
      { metric: "protein", label: "Protein", icon: "🥩", op: ">=", target: 25, unit: "g" },
      { metric: "kcal", label: "Calories", icon: "🔥", op: "<=", target: 450, unit: "kcal" },
      { metric: "taste", label: "Taste", icon: "⭐", op: ">=", target: 4, unit: "/5" },
      { metric: "time", label: "Time", icon: "⏱", op: "<=", target: 10, unit: "min" },
    ],
  };
  const p = await createProject(db, userId, input);

  const v1 = await createVersion(db, userId, p.id, { name: "Banana PB toast", createdAt: daysAgo(24) });
  await addSteps(db, userId, v1.id, [
    { title: "Bread", detail: "2 slices high-protein · 12 g protein", outputs: { protein: 12 } },
    { title: "Toast", detail: "3 min, medium" },
    { title: "Peanut butter", detail: "1 tbsp · 4 g protein", outputs: { protein: 4 } },
    { title: "Topping", detail: "Half a banana, sliced thin" },
  ]);
  const v1Runs: [number, number, number, number][] = [
    [15, 380, 3, 9],
    [16, 395, 4, 8],
    [16, 390, 3, 8],
    [17, 400, 4, 7],
    [16, 385, 4, 7],
  ];
  await addRuns(
    db,
    userId,
    v1,
    v1Runs.map(([protein, kcal, taste, time], i) => ({
      outputs: { protein, kcal, taste, time },
      notes: i === 0 ? "Tasty but not filling" : "",
      at: daysAgo(23 - i * 2),
    })),
  );

  const v1Steps = (await getVersion(db, userId, v1.id)).steps;
  let v2 = await branchVersion(db, userId, v1.id, {
    fromStepId: v1Steps[2]!.id,
    name: "+ more protein",
    createdAt: daysAgo(13),
  });
  const pb = await updateStep(db, userId, v2.steps[2]!.id, { detail: "2 tbsp · 8 g protein", outputs: { protein: 8 } });
  await createStep(db, userId, v2.id, { title: "Chia seeds", detail: "1 tsp · 2 g protein", parentStepId: pb.id, outputs: { protein: 2 } });
  await updateStep(db, userId, v2.steps[3]!.id, { detail: "Half a banana, sliced thin" });
  const v2Runs: [number, number, number, number][] = [
    [23, 470, 4, 9],
    [24, 480, 5, 9],
    [25, 445, 4, 8],
    [26, 440, 5, 8],
    [25, 430, 5, 8],
  ];
  await addRuns(
    db,
    userId,
    v2,
    v2Runs.map(([protein, kcal, taste, time], i) => ({
      outputs: { protein, kcal, taste, time },
      changeNote: i === 0 ? "Doubled the peanut butter, added chia" : "",
      at: daysAgo(12 - i * 2),
    })),
  );
  v2 = await updateVersion(db, userId, v2.id, { best: true });

  const v3 = await branchVersion(db, userId, v2.id, {
    fromStepId: v2.steps[3]!.id,
    name: "Greek yogurt topping",
    createdAt: daysAgo(2),
  });
  await updateStep(db, userId, v3.steps[3]!.id, {
    title: "Greek yogurt",
    detail: "2 tbsp Greek yogurt + a drizzle of honey",
    outputs: { protein: 3 },
  });
  await addRuns(db, userId, v3, [
    { outputs: { protein: 27, kcal: 455, taste: 4, time: 9 }, notes: "Creamier, slightly over on calories", at: daysAgo(1) },
  ]);
}

async function seedSourdough(db: Db, userId: string) {
  const p = await createProject(db, userId, {
    name: "Sourdough bread",
    emoji: "🍞",
    category: "Food",
    goals: [
      { metric: "rise", label: "Oven spring", icon: "📈", op: ">=", target: 2, unit: "x" },
      { metric: "crumb", label: "Crumb", icon: "🫧", op: ">=", target: 4, unit: "/5" },
      { metric: "hours", label: "Total time", icon: "⏱", op: "<=", target: 24, unit: "h" },
    ],
  });
  const v1 = await createVersion(db, userId, p.id, { name: "Basic loaf", createdAt: daysAgo(30) });
  const s = await addSteps(db, userId, v1.id, [
    { title: "Levain", detail: "50 g starter, 50 g flour, 50 g water · 4 h" },
    { title: "Autolyse", detail: "450 g flour + 330 g water · 1 h" },
    { title: "Mix", detail: "Add levain + 10 g salt" },
    { title: "Bulk ferment", detail: "4 sets of stretch & folds · 5 h" },
    { title: "Shape & proof", detail: "Overnight in the fridge" },
    { title: "Bake", detail: "250 °C lid on 20 min, 230 °C lid off 25 min" },
  ]);
  await addRuns(db, userId, v1, [
    { outputs: { rise: 1.5, crumb: 3, hours: 22 }, notes: "Dense crumb", at: daysAgo(28, 18) },
    { outputs: { rise: 1.7, crumb: 3, hours: 23 }, at: daysAgo(21, 18) },
  ]);
  const v2 = await branchVersion(db, userId, v1.id, { fromStepId: s[3]!.id, name: "Longer bulk", createdAt: daysAgo(14) });
  await updateStep(db, userId, v2.steps[3]!.id, { detail: "6 sets of coil folds · 6 h at 24 °C" });
  await updateStep(db, userId, v2.steps[4]!.id, { detail: "Overnight in the fridge" });
  await updateStep(db, userId, v2.steps[5]!.id, { detail: "250 °C lid on 20 min, 230 °C lid off 25 min" });
  await addRuns(db, userId, v2, [{ outputs: { rise: 2.1, crumb: 4, hours: 23 }, notes: "Big ear!", at: daysAgo(7, 18) }]);
}

async function seed5k(db: Db, userId: string) {
  const p = await createProject(db, userId, {
    name: "5K training",
    emoji: "🏃",
    category: "Fitness",
    goals: [
      { metric: "minutes", label: "5K time", icon: "⏱", op: "<=", target: 28, unit: "min" },
      { metric: "hr", label: "Avg heart rate", icon: "❤️", op: "<=", target: 165, unit: "bpm" },
    ],
  });
  const v1 = await createVersion(db, userId, p.id, { name: "Steady run", createdAt: daysAgo(20) });
  await addSteps(db, userId, v1.id, [
    { title: "Warm-up", detail: "10 min easy jog" },
    { title: "Run", detail: "5 km at a steady pace" },
    { title: "Cool-down", detail: "5 min walk + stretch" },
  ]);
  await addRuns(db, userId, v1, [
    { outputs: { minutes: 31.5, hr: 170 }, at: daysAgo(19, 7) },
    { outputs: { minutes: 30.8, hr: 168 }, at: daysAgo(16, 7) },
    { outputs: { minutes: 30.1, hr: 167 }, at: daysAgo(12, 7) },
  ]);
}

async function main() {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL, 2);
  try {
    await runMigrations(db);
    const userId = await ensureUser(db);
    await db.delete(projects).where(and(eq(projects.userId, userId), inArray(projects.name, SEEDED)));
    await seedBreakfast(db, userId);
    await seedSourdough(db, userId);
    await seed5k(db, userId);
    console.log(`Seeded ${DEMO.email} / ${DEMO.password} with ${SEEDED.length} projects.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
