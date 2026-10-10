import { sql } from "drizzle-orm";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { buildApp, type BuildAppOptions } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Db } from "../src/db/client.js";
import type { UserDTO } from "../src/types.js";

export interface Ctx {
  app: FastifyInstance;
  db: Db;
}

export async function resetDb(db: Db) {
  await db.execute(sql`TRUNCATE users, sessions, projects, goals, versions, steps, runs, media CASCADE`);
}

/** Builds an app against arc_test; truncates all tables before each test. */
export function useApp(overrides: Partial<BuildAppOptions> = {}): Ctx {
  const ctx = {} as Ctx;
  let pool: { end: () => Promise<void> };
  beforeAll(async () => {
    const config = loadConfig();
    const created = createDb(config.DATABASE_URL, 4);
    pool = created.pool;
    ctx.db = created.db;
    ctx.app = await buildApp({ config, db: created.db, ...overrides });
    await ctx.app.ready();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
  });
  afterAll(async () => {
    await ctx.app?.close();
    await pool?.end();
  });
  return ctx;
}

export class Client {
  constructor(
    private app: FastifyInstance,
    public token?: string,
  ) {}

  inject(opts: InjectOptions): Promise<LightMyRequestResponse> {
    return this.app.inject({
      ...opts,
      cookies: { ...(this.token ? { arc_session: this.token } : {}), ...(opts.cookies ?? {}) },
    });
  }
  get = (url: string) => this.inject({ method: "GET", url });
  del = (url: string) => this.inject({ method: "DELETE", url });
  post = (url: string, payload?: object) => this.inject({ method: "POST", url, ...(payload && { payload }) });
  patch = (url: string, payload: object) => this.inject({ method: "PATCH", url, payload });
  put = (url: string, payload: object) => this.inject({ method: "PUT", url, payload });
}

export function sessionToken(res: LightMyRequestResponse): string | undefined {
  return res.cookies.find((c) => c.name === "arc_session")?.value;
}

let counter = 0;
export async function signedIn(app: FastifyInstance, email?: string): Promise<Client & { user: UserDTO }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signup",
    payload: { name: "Tester", email: email ?? `user${++counter}-${Date.now()}@example.com`, password: "password123" },
  });
  if (res.statusCode !== 201) throw new Error(`signup failed: ${res.statusCode} ${res.body}`);
  const client = new Client(app, sessionToken(res)) as Client & { user: UserDTO };
  client.user = res.json();
  return client;
}

export const breakfastProject = {
  name: "My Breakfast",
  emoji: "🍳",
  category: "Food" as const,
  goals: [
    { metric: "protein", label: "Protein", icon: "🥩", op: ">=" as const, target: 25, unit: "g" },
    { metric: "kcal", label: "Calories", icon: "🔥", op: "<=" as const, target: 450, unit: "kcal" },
  ],
};
