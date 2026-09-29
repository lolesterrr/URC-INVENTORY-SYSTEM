import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import type { DB } from '../db';
import { alerts } from '../db/schema';
import { requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { runAlertChecks } from '../services/alerts';

type Row = typeof alerts.$inferSelect;

const toApi = (a: Row) => ({
  id: String(a.id),
  type: a.type,
  title: a.title,
  message: a.message,
  timestamp: a.createdAt,
  itemType: a.itemType,
  itemId: a.itemId,
  // Email delivery is not implemented yet (planned for v1.1), so nothing is ever sent.
  emailSent: a.emailSent,
  emailTo: '',
  status: a.status,
  resolvedBy: a.resolvedBy,
  resolvedAt: a.resolvedAt,
});

export function alertsRouter(db: DB) {
  const router = Router();

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    res.json(db.select().from(alerts).orderBy(desc(alerts.id)).limit(500).all().map(toApi));
  });

  router.post('/resolve/:id', requirePermission('alerts:manage'), (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ error: 'Alert not found.' });
    const existing = db.select().from(alerts).where(eq(alerts.id, id)).get();
    if (!existing) return res.status(404).json({ error: 'Alert not found.' });
    db.update(alerts)
      .set({ status: 'resolved', resolvedBy: req.user!.username, resolvedAt: new Date().toISOString() })
      .where(and(eq(alerts.id, id), eq(alerts.status, 'unread')))
      .run();
    recordAudit(db, req, { action: 'Resolve Alert', details: `Resolved alert "${existing.title}".`, entityType: 'alert', entityId: String(id) });
    res.json(toApi(db.select().from(alerts).where(eq(alerts.id, id)).get()!));
  });

  router.post('/check-triggers', requirePermission('alerts:manage'), (req, res) => {
    const created = runAlertChecks(db);
    recordAudit(db, req, { action: 'Alert Check', details: `Ran inventory checks manually; ${created} new alert(s).` });
    res.json({ success: true, created, message: `Inventory checked. ${created} new alert(s).` });
  });

  return router;
}
