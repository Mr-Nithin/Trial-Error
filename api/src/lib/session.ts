import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { DbOrTx } from "../db/client.js";
import { sessions, users, type UserRow } from "../db/schema.js";

export const SESSION_COOKIE = "arc_session";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Only the hash ever touches the database. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(
  db: DbOrTx,
  userId: string,
  ttlDays: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlDays * DAY_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function deleteSession(db: DbOrTx, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/**
 * Resolves a token to its user. Expired sessions are deleted and yield null.
 * When less than half the TTL remains the session is extended (`renewedUntil` set).
 */
export async function resolveSession(
  db: DbOrTx,
  token: string,
  ttlDays: number,
): Promise<{ user: UserRow; renewedUntil: Date | null } | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));
  if (!row) return null;
  const now = Date.now();
  if (row.session.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  const ttlMs = ttlDays * DAY_MS;
  let renewedUntil: Date | null = null;
  if (row.session.expiresAt.getTime() - now < ttlMs / 2) {
    renewedUntil = new Date(now + ttlMs);
    await db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id));
  }
  return { user: row.user, renewedUntil };
}

export async function purgeExpiredSessions(db: DbOrTx): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
