import crypto from 'crypto';
import { and, eq, ne } from 'drizzle-orm';
import type { DB } from '../db';
import { users, type Role } from '../db/schema';
import { checkPasswordStrength, hashPassword } from '../auth/password';

export class UserError extends Error {}

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,64}$/;

export async function createUser(
  db: DB,
  input: { username: string; fullName: string; role: Role; password: string; mustChangePassword?: boolean },
) {
  const username = input.username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new UserError('Username must be 3–64 characters: lowercase letters, digits, dot, dash or underscore.');
  }
  if (db.select({ id: users.id }).from(users).where(eq(users.username, username)).get()) {
    throw new UserError(`Username "${username}" is already taken.`);
  }
  const weak = checkPasswordStrength(input.password, username);
  if (weak) throw new UserError(weak);

  const row = {
    id: crypto.randomUUID(),
    username,
    fullName: input.fullName.trim(),
    role: input.role,
    passwordHash: await hashPassword(input.password),
    mustChangePassword: input.mustChangePassword ?? true,
  };
  db.insert(users).values(row).run();
  return db.select().from(users).where(eq(users.id, row.id)).get()!;
}

/** True when some active Admin other than `userId` exists. Prevents locking everyone out. */
export function hasOtherActiveAdmin(db: DB, userId: string): boolean {
  return Boolean(
    db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'Admin'), eq(users.disabled, false), ne(users.id, userId)))
      .get(),
  );
}
