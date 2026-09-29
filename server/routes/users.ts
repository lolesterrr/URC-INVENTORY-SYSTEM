import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../db';
import { ROLES, users } from '../db/schema';
import { checkPasswordStrength, hashPassword } from '../auth/password';
import { destroyUserSessions, requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { createUser, hasOtherActiveAdmin, UserError } from '../services/users';
import { parseBody } from '../validation';

const createSchema = z.object({
  username: z.string().trim().min(1).max(64),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
  temporaryPassword: z.string().min(1).max(200),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  disabled: z.boolean().optional(),
});

const resetSchema = z.object({ temporaryPassword: z.string().min(1).max(200) });

type UserRow = typeof users.$inferSelect;

const toApi = (u: UserRow) => ({
  id: u.id,
  username: u.username,
  fullName: u.fullName,
  role: u.role,
  disabled: u.disabled,
  mustChangePassword: u.mustChangePassword,
  locked: Boolean(u.lockedUntil && Date.parse(u.lockedUntil) > Date.now()),
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

export function usersRouter(db: DB) {
  const router = Router();
  router.use(requirePermission('users:manage'));

  router.get('/', (_req, res) => {
    res.json(db.select().from(users).orderBy(asc(users.username)).all().map(toApi));
  });

  router.post('/', async (req, res) => {
    const body = parseBody(createSchema, req.body, res);
    if (!body) return;
    try {
      const user = await createUser(db, { ...body, password: body.temporaryPassword, mustChangePassword: true });
      recordAudit(db, req, {
        action: 'Create User',
        details: `Created ${user.role} account "${user.username}".`,
        entityType: 'user',
        entityId: user.id,
        after: toApi(user),
      });
      res.status(201).json(toApi(user));
    } catch (err) {
      if (err instanceof UserError) return res.status(400).json({ error: err.message });
      throw err;
    }
  });

  router.patch('/:id', (req, res) => {
    const body = parseBody(updateSchema, req.body, res);
    if (!body) return;
    const existing = db.select().from(users).where(eq(users.id, req.params.id)).get();
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    const losesAdmin = existing.role === 'Admin' && ((body.role && body.role !== 'Admin') || body.disabled === true);
    if (losesAdmin && !hasOtherActiveAdmin(db, existing.id)) {
      return res.status(400).json({ error: 'At least one active Admin must remain.' });
    }

    db.update(users).set({ ...body, updatedAt: new Date().toISOString() }).where(eq(users.id, existing.id)).run();
    if (body.disabled || (body.role && body.role !== existing.role)) destroyUserSessions(db, existing.id);
    const updated = db.select().from(users).where(eq(users.id, existing.id)).get()!;
    recordAudit(db, req, {
      action: 'Update User',
      details: `Updated account "${existing.username}".`,
      entityType: 'user',
      entityId: existing.id,
      before: toApi(existing),
      after: toApi(updated),
    });
    res.json(toApi(updated));
  });

  router.post('/:id/reset-password', async (req, res) => {
    const body = parseBody(resetSchema, req.body, res);
    if (!body) return;
    const existing = db.select().from(users).where(eq(users.id, req.params.id)).get();
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const weak = checkPasswordStrength(body.temporaryPassword, existing.username);
    if (weak) return res.status(400).json({ error: weak });

    db.update(users)
      .set({
        passwordHash: await hashPassword(body.temporaryPassword),
        mustChangePassword: true,
        failedLogins: 0,
        lockedUntil: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, existing.id))
      .run();
    destroyUserSessions(db, existing.id);
    recordAudit(db, req, {
      action: 'Reset Password',
      details: `Reset the password for "${existing.username}".`,
      entityType: 'user',
      entityId: existing.id,
    });
    res.json({ success: true });
  });

  return router;
}
