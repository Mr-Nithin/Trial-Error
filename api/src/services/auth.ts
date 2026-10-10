import { eq } from "drizzle-orm";
import type { DbOrTx } from "../db/client.js";
import { users, type UserRow } from "../db/schema.js";
import { ApiError, isUniqueViolation } from "../lib/errors.js";
import { hashPassword, verifyDummyPassword, verifyPassword } from "../lib/password.js";
import type { LoginInput, SignupInput, UpdateMeInput } from "../types.js";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const emailTaken = () => new ApiError(409, "email_taken", "An account with this email already exists");
const invalidCredentials = () => new ApiError(401, "invalid_credentials", "Incorrect email or password");

export async function signup(db: DbOrTx, input: SignupInput): Promise<UserRow> {
  const email = normalizeEmail(input.email);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw emailTaken();
  const passwordHash = await hashPassword(input.password);
  try {
    const [user] = await db.insert(users).values({ email, name: input.name.trim(), passwordHash }).returning();
    return user!;
  } catch (err) {
    if (isUniqueViolation(err)) throw emailTaken();
    throw err;
  }
}

export async function login(db: DbOrTx, input: LoginInput): Promise<UserRow> {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(input.email)));
  if (!user) {
    await verifyDummyPassword(input.password);
    throw invalidCredentials();
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) throw invalidCredentials();
  return user;
}

export async function updateMe(db: DbOrTx, userId: string, input: UpdateMeInput): Promise<UserRow> {
  if (input.name === undefined) {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    return u!;
  }
  const [u] = await db.update(users).set({ name: input.name }).where(eq(users.id, userId)).returning();
  return u!;
}
