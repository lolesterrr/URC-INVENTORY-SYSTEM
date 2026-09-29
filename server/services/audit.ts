import type { Request } from 'express';
import type { DB } from '../db';
import { auditLog } from '../db/schema';

export interface AuditEntry {
  action: string;
  details: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

/** Records who did what. Identity always comes from the server-side session, never from the client. */
export function recordAudit(db: DB, req: Request | null, entry: AuditEntry): void {
  db.insert(auditLog)
    .values({
      userId: req?.user?.id ?? null,
      username: req?.user?.username ?? 'system',
      role: req?.user?.role ?? 'system',
      action: entry.action,
      details: entry.details,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      before: entry.before === undefined ? null : JSON.stringify(entry.before),
      after: entry.after === undefined ? null : JSON.stringify(entry.after),
      ip: req?.ip ?? null,
    })
    .run();
}
