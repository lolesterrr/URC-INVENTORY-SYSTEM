import crypto from 'crypto';
import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { eq, lt, or } from 'drizzle-orm';
import type { DB } from '../db';
import { sessions, users, type Role } from '../db/schema';
import { can, type Permission } from './permissions';

export const SESSION_COOKIE = 'urc_sid';

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
    }
  }
}

export interface SessionOptions {
  idleMs: number;
  maxMs: number;
  secureCookie: boolean;
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function cookieOptions(opts: SessionOptions): CookieOptions {
  return { httpOnly: true, sameSite: 'strict', secure: opts.secureCookie, path: '/' };
}

export function createSession(db: DB, userId: string, req: Request, opts: SessionOptions): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + opts.maxMs,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    })
    .run();
  return token;
}

export function destroySession(db: DB, sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export function destroyUserSessions(db: DB, userId: string): void {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function purgeExpiredSessions(db: DB, opts: SessionOptions): void {
  const now = Date.now();
  db.delete(sessions)
    .where(or(lt(sessions.expiresAt, now), lt(sessions.lastSeenAt, now - opts.idleMs)))
    .run();
}

/** Attaches req.user when a valid session cookie is present. Never rejects on its own. */
export function sessionMiddleware(db: DB, opts: SessionOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) return next();

    const id = hashToken(token);
    const now = Date.now();
    const row = db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, id))
      .get();

    const valid = row && row.session.expiresAt > now && row.session.lastSeenAt + opts.idleMs > now && !row.user.disabled;
    if (!valid) {
      if (row) destroySession(db, id);
      res.clearCookie(SESSION_COOKIE, cookieOptions(opts));
      return next();
    }

    // Sliding idle timeout; throttle writes to once a minute.
    if (now - row.session.lastSeenAt > 60_000) {
      db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id)).run();
    }
    req.sessionId = id;
    req.user = {
      id: row.user.id,
      username: row.user.username,
      fullName: row.user.fullName,
      role: row.user.role,
      mustChangePassword: row.user.mustChangePassword,
    };
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  if (req.user.mustChangePassword) {
    return res.status(403).json({ error: 'You must change your password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
    if (!can(req.user.role, permission)) {
      return res.status(403).json({ error: 'Your role does not allow this action.' });
    }
    next();
  };
}
