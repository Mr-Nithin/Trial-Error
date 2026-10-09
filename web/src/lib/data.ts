export type MetricKey = string;

export type Goal = {
  metric: MetricKey;
  label: string;
  short: string;
  icon: string;
  op: ">=" | "<=";
  target: number;
  unit: string;
};

export type StepOrigin = "inherited" | "changed" | "new" | "pending";

export type Step = {
  id: string;
  label: string;
  title: string;
  detail: string;
  origin: StepOrigin;
  fromVersion?: number;
  photo?: string;
  subSteps?: Step[];
};

export type Outputs = Record<MetricKey, number>;

export type Version = {
  id: string;
  number: number;
  name: string;
  parentId?: string;
  branchedAtStep?: number;
  status: "done" | "best" | "in-progress";
  runs: number;
  summary: string;
  lastRun: string;
  changeNote?: string;
  outputs: Outputs;
  steps: Step[];
};

export type Run = {
  number: number;
  versionId: string;
  when: string;
  outputs: Outputs;
};

export type Category = "Food" | "Fitness" | "Plant" | "Build" | "Create" | "Other";

export type Project = {
  id: string;
  name: string;
  emoji: string;
  tint: string;
  category: Category;
  goals: Goal[];
  versions: Version[];
  runs: Run[];
  lastRun: string;
  archived?: string;
};

const breakfastGoals: Goal[] = [
  { metric: "protein", label: "Protein", short: "Protein ≥ 25 g", icon: "🥩", op: ">=", target: 25, unit: "g" },
  { metric: "kcal", label: "Calories", short: "≤ 450 kcal", icon: "🔥", op: "<=", target: 450, unit: "kcal" },
  { metric: "taste", label: "Taste", short: "Taste ≥ 4/5", icon: "⭐", op: ">=", target: 4, unit: "/5" },
  { metric: "time", label: "Time", short: "≤ 10 min", icon: "⏱", op: "<=", target: 10, unit: "min" },
];

const v1Steps: Step[] = [
  { id: "s1", label: "1", title: "Bread", detail: "2 slices high-protein · 12 g protein", origin: "new", photo: "#E8DCC7" },
  { id: "s2", label: "2", title: "Toast", detail: "3 min, medium · ⏱ 3:10", origin: "new", photo: "#D9B98A" },
  { id: "s3", label: "3", title: "Peanut butter", detail: "1 tbsp · 4 g protein", origin: "new", photo: "#B98551" },
  { id: "s4", label: "4", title: "Topping", detail: "Half a banana, sliced thin", origin: "new", photo: "#E9D27A" },
];

const v2Steps: Step[] = [
  { ...v1Steps[0], origin: "inherited", fromVersion: 1 },
  { ...v1Steps[1], origin: "inherited", fromVersion: 1 },
  {
    id: "s3",
    label: "3",
    title: "Peanut butter",
    detail: "2 tbsp · 8 g protein",
    origin: "changed",
    photo: "#B98551",
    subSteps: [
      { id: "s3a", label: "3a", title: "Chia seeds", detail: "1 tsp · 2 g protein", origin: "new" },
    ],
  },
  { id: "s4", label: "4", title: "Topping", detail: "Tap to record now", origin: "pending" },
];

const v3Steps: Step[] = [
  { ...v1Steps[0], origin: "inherited", fromVersion: 2 },
  { ...v1Steps[1], origin: "inherited", fromVersion: 2 },
  { ...v2Steps[2], origin: "inherited", fromVersion: 2, subSteps: undefined },
  { id: "s4", label: "4", title: "Greek yogurt", detail: "3 tbsp instead of banana", origin: "changed", photo: "#F1EEE6" },
];

const breakfastRuns: Run[] = [
  { number: 1, versionId: "v1", when: "4 weeks ago", outputs: { protein: 15, kcal: 380, taste: 4, time: 9 } },
  { number: 2, versionId: "v1", when: "4 weeks ago", outputs: { protein: 16, kcal: 395, taste: 4, time: 8 } },
  { number: 3, versionId: "v1", when: "3 weeks ago", outputs: { protein: 16, kcal: 390, taste: 3, time: 8 } },
  { number: 4, versionId: "v1", when: "3 weeks ago", outputs: { protein: 17, kcal: 400, taste: 4, time: 7 } },
  { number: 5, versionId: "v1", when: "2 weeks ago", outputs: { protein: 16, kcal: 390, taste: 4, time: 8 } },
  { number: 6, versionId: "v2", when: "2 weeks ago", outputs: { protein: 23, kcal: 470, taste: 4, time: 10 } },
  { number: 7, versionId: "v2", when: "10 days ago", outputs: { protein: 25, kcal: 460, taste: 5, time: 9 } },
  { number: 8, versionId: "v2", when: "1 week ago", outputs: { protein: 25, kcal: 450, taste: 5, time: 8 } },
  { number: 9, versionId: "v2", when: "3 days ago", outputs: { protein: 26, kcal: 480, taste: 4, time: 9 } },
  { number: 10, versionId: "v2", when: "today", outputs: { protein: 26, kcal: 430, taste: 5, time: 9 } },
  { number: 11, versionId: "v3", when: "today", outputs: { protein: 27, kcal: 420, time: 9 } },
];

export const projects: Project[] = [
  {
    id: "breakfast",
    name: "My Breakfast",
    emoji: "🍳",
    tint: "#E2F2EC",
    category: "Food",
    goals: breakfastGoals,
    lastRun: "today · V2 — + more protein",
    runs: breakfastRuns,
    versions: [
      {
        id: "v1",
        number: 1,
        name: "Banana PB toast",
        status: "done",
        runs: 5,
        summary: "From scratch · 4 steps · 5 runs",
        lastRun: "Mon 6 Oct",
        outputs: { protein: 16, kcal: 390, taste: 4, time: 8 },
        steps: v1Steps,
      },
      {
        id: "v2",
        number: 2,
        name: "+ more protein",
        parentId: "v1",
        branchedAtStep: 3,
        status: "best",
        runs: 5,
        summary: "Steps 1–2 from V1 · 4 steps + 1 sub · 5 runs",
        lastRun: "today",
        changeNote: "Changed step 3 + added chia seeds",
        outputs: { protein: 26, kcal: 430, taste: 5, time: 9 },
        steps: v2Steps,
      },
      {
        id: "v3",
        number: 3,
        name: "Greek yogurt topping",
        parentId: "v2",
        branchedAtStep: 4,
        status: "in-progress",
        runs: 1,
        summary: "Steps 1–3 from V2 · swap step 4 · 1 run",
        lastRun: "today",
        changeNote: "Goal: fix calories while keeping protein ✓",
        outputs: { protein: 27, kcal: 420, time: 9 },
        steps: v3Steps,
      },
    ],
  },
  {
    id: "sourdough",
    name: "Sourdough bread",
    emoji: "🍞",
    tint: "#FBE7D6",
    category: "Food",
    goals: [
      { metric: "time", label: "Proof time", short: "≤ 14 h proof", icon: "⏱", op: "<=", target: 14, unit: "h" },
      { metric: "taste", label: "Taste", short: "Taste ≥ 4/5", icon: "⭐", op: ">=", target: 4, unit: "/5" },
      { metric: "rise", label: "Rise", short: "Rise ≥ 2×", icon: "📈", op: ">=", target: 2, unit: "×" },
    ],
    lastRun: "3 days ago · V2 — longer proof",
    runs: [],
    versions: [
      {
        id: "v1",
        number: 1,
        name: "Basic loaf",
        status: "done",
        runs: 3,
        summary: "From scratch · 5 steps · 3 runs",
        lastRun: "2 weeks ago",
        outputs: { time: 12, taste: 3, rise: 1.5 },
        steps: [
          { id: "s1", label: "1", title: "Feed starter", detail: "1:1:1 · 8 h", origin: "new", photo: "#EDE3D2" },
          { id: "s2", label: "2", title: "Autolyse", detail: "500 g flour · 350 g water · 1 h", origin: "new", photo: "#E6D8BF" },
          { id: "s3", label: "3", title: "Bulk ferment", detail: "4 folds · 5 h", origin: "new", photo: "#D8C29C" },
          { id: "s4", label: "4", title: "Cold proof", detail: "Fridge · 12 h", origin: "new", photo: "#C9AE80" },
          { id: "s5", label: "5", title: "Bake", detail: "250 °C · 20 + 25 min", origin: "new", photo: "#A9773F" },
        ],
      },
      {
        id: "v2",
        number: 2,
        name: "Longer proof",
        parentId: "v1",
        branchedAtStep: 4,
        status: "best",
        runs: 3,
        summary: "Steps 1–3 from V1 · 5 steps · 3 runs",
        lastRun: "3 days ago",
        changeNote: "Cold proof 14 h",
        outputs: { time: 14, taste: 4, rise: 1.8 },
        steps: [
          { id: "s1", label: "1", title: "Feed starter", detail: "1:1:1 · 8 h", origin: "inherited", fromVersion: 1, photo: "#EDE3D2" },
          { id: "s2", label: "2", title: "Autolyse", detail: "500 g flour · 350 g water · 1 h", origin: "inherited", fromVersion: 1, photo: "#E6D8BF" },
          { id: "s3", label: "3", title: "Bulk ferment", detail: "4 folds · 5 h", origin: "inherited", fromVersion: 1, photo: "#D8C29C" },
          { id: "s4", label: "4", title: "Cold proof", detail: "Fridge · 14 h", origin: "changed", photo: "#C9AE80" },
          { id: "s5", label: "5", title: "Bake", detail: "250 °C · 20 + 25 min", origin: "inherited", fromVersion: 1, photo: "#A9773F" },
        ],
      },
    ],
  },
  {
    id: "5k",
    name: "5K training",
    emoji: "🏃",
    tint: "#E8E4F8",
    category: "Fitness",
    goals: [
      { metric: "time", label: "Time", short: "≤ 28 min", icon: "⏱", op: "<=", target: 28, unit: "min" },
      { metric: "effort", label: "Effort", short: "Effort ≤ 3/5", icon: "💪", op: "<=", target: 3, unit: "/5" },
    ],
    lastRun: "yesterday · V1 — baseline",
    runs: [],
    versions: [
      {
        id: "v1",
        number: 1,
        name: "Baseline",
        status: "in-progress",
        runs: 4,
        summary: "From scratch · 3 steps · 4 runs",
        lastRun: "yesterday",
        outputs: { time: 31, effort: 4 },
        steps: [
          { id: "s1", label: "1", title: "Warm up", detail: "5 min brisk walk", origin: "new", photo: "#E8E4F8" },
          { id: "s2", label: "2", title: "Run", detail: "5 km steady · 6:12 /km", origin: "new", photo: "#D6CFF2" },
          { id: "s3", label: "3", title: "Cool down", detail: "Stretch 8 min", origin: "new", photo: "#C6BDEB" },
        ],
      },
    ],
  },
  {
    id: "cold-brew",
    name: "Cold brew",
    emoji: "☕",
    tint: "#EDEEEA",
    category: "Food",
    goals: [],
    lastRun: "Aug",
    runs: [],
    versions: [],
    archived: "archived Aug · 4 versions · 11 runs",
  },
  {
    id: "basil",
    name: "Basil on the balcony",
    emoji: "🌿",
    tint: "#EDEEEA",
    category: "Plant",
    goals: [],
    lastRun: "Jun",
    runs: [],
    versions: [],
    archived: "archived Jun · 2 versions · 20 runs",
  },
];

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function getVersion(project: Project, versionId: string): Version | undefined {
  return project.versions.find((v) => v.id === versionId);
}

export function findStep(version: Version, stepId: string): Step | undefined {
  for (const s of version.steps) {
    if (s.id === stepId) return s;
    const sub = s.subSteps?.find((x) => x.id === stepId);
    if (sub) return sub;
  }
  return undefined;
}

export function goalMet(goal: Goal, value: number | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return goal.op === ">=" ? value >= goal.target : value <= goal.target;
}

export function goalsMet(project: Project, outputs: Outputs): number {
  return project.goals.filter((g) => goalMet(g, outputs[g.metric])).length;
}

export function bestVersion(project: Project): Version | undefined {
  return project.versions.find((v) => v.status === "best");
}

export function totalRuns(project: Project): number {
  return project.versions.reduce((n, v) => n + v.runs, 0);
}

export function formatValue(goal: Goal, value: number | undefined): string {
  if (value === undefined) return "–";
  if (goal.unit === "g") return `${value}g`;
  if (goal.unit === "min") return `${value}m`;
  if (goal.unit === "/5") return `${value}/5`;
  if (goal.unit === "h" || goal.unit === "×") return `${value}${goal.unit}`;
  return `${value}`;
}


export function projectParams() {
  return projects.filter((p) => !p.archived).map((p) => ({ projectId: p.id }));
}
