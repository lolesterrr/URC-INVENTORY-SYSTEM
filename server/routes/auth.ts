import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../db';
import { users, type Role } from '../db/schema';
import { checkPasswordStrength, hashPassword, verifyPassword } from '../auth/password';
import { permissionsFor } from '../auth/permissions';
import {
  SESSION_COOKIE, cookieOptions, createSession, destroySession, destroyUserSessions, type SessionOptions,
} from '../auth/session';
import { recordAudit } from '../services/audit';
import { parseBody } from '../validation';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60_000;

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

export function publicUser(u: { id: string; username: string; fullName: string; role: Role; mustChangePassword: boolean }) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    permissions: permissionsFor(u.role),
  };
}

// Verifying against a throwaway hash keeps response time similar for unknown usernames.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password-Aa1!'));

export function authRouter(db: DB, opts: SessionOptions & { loginRateLimit?: number }) {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: opts.loginRateLimit ?? 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts from this computer. Try again in 15 minutes.' },
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const body = parseBody(loginSchema, req.body, res);
    if (!body) return;
    const invalid = () => res.status(401).json({ error: 'Invalid username or password.' });

    const user = db.select().from(users).where(eq(users.username, body.username)).get();
    if (!user) {
      await verifyPassword(await getDummyHash(), body.password);
      recordAudit(db, req, { action: 'Login Failed', details: `Unknown username "${body.username}".` });
      return invalid();
    }

    const now = Date.now();
    if (user.lockedUntil && Date.parse(user.lockedUntil) > now) {
      const minutes = Math.ceil((Date.parse(user.lockedUntil) - now) / 60_000);
      return res.status(423).json({ error: `Account locked after too many failed attempts. Try again in ${minutes} minute(s).` });
    }

    const ok = await verifyPassword(user.passwordHash, body.password);
    if (!ok || user.disabled) {
      if (!ok) {
        const failed = user.failedLogins + 1;
        const lock = failed >= MAX_FAILED_LOGINS;
        db.update(users)
          .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(now + LOCKOUT_MS).toISOString() : user.lockedUntil })
          .where(eq(users.id, user.id))
          .run();
        recordAudit(db, req, {
          action: lock ? 'Account Locked' : 'Login Failed',
          details: lock ? `Account "${user.username}" locked for 15 minutes.` : `Wrong password for "${user.username}".`,
          entityType: 'user',
          entityId: user.id,
        });
      }
      return invalid();
    }

    db.update(users)
      .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(now).toISOString() })
      .where(eq(users.id, user.id))
      .run();
    const token = createSession(db, user.id, req, opts);
    res.cookie(SESSION_COOKIE, token, cookieOptions(opts));
    req.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role, mustChangePassword: user.mustChangePassword };
    recordAudit(db, req, { action: 'Login', details: `${user.username} signed in.`, entityType: 'user', entityId: user.id });
    res.json(publicUser(user));
  });

  router.post('/logout', (req, res) => {
    if (req.sessionId) {
      destroySession(db, req.sessionId);
      recordAudit(db, req, { action: 'Logout', details: `${req.user?.username} signed out.` });
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions(opts));
    res.json({ success: true });
  });

  router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in.' });
    res.json(publicUser(req.user));
  });

  router.post('/change-password', async (req, res) => {
    if (!req.user || !req.sessionId) return res.status(401).json({ error: 'Please sign in.' });
    const body = parseBody(changePasswordSchema, req.body, res);
    if (!body) return;

    const user = db.select().from(users).where(eq(users.id, req.user.id)).get();
    if (!user || !(await verifyPassword(user.passwordHash, body.currentPassword))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    if (body.newPassword === body.currentPassword) {
      return res.status(400).json({ error: 'New password must be different from the current one.' });
    }
    const weak = checkPasswordStrength(body.newPassword, user.username);
    if (weak) return res.status(400).json({ error: weak });

    db.update(users)
      .set({ passwordHash: await hashPassword(body.newPassword), mustChangePassword: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .run();
    // Sign out every other session; keep this one.
    destroyUserSessions(db, user.id);
    const token = createSession(db, user.id, req, opts);
    res.cookie(SESSION_COOKIE, token, cookieOptions(opts));
    recordAudit(db, req, { action: 'Password Changed', details: `${user.username} changed their password.`, entityType: 'user', entityId: user.id });
    res.json(publicUser({ ...user, mustChangePassword: false }));
  });

  return router;
}
