import { Router } from 'express';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DB } from '../db';
import { serverComponents } from '../db/schema';
import { requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { runAlertChecks } from '../services/alerts';
import { componentCreate, componentUpdate, parseBody } from '../validation';

type Row = typeof serverComponents.$inferSelect;
const toApi = ({ deletedAt: _deleted, ...r }: Row) => r;

export function serverComponentsRouter(db: DB) {
  const router = Router();
  const table = serverComponents;
  const active = (id: string) => db.select().from(table).where(and(eq(table.id, id), isNull(table.deletedAt))).get();

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    res.json(db.select().from(table).where(isNull(table.deletedAt)).orderBy(asc(table.serverName), asc(table.partName)).all().map(toApi));
  });

  router.post('/', requirePermission('assets:write'), (req, res) => {
    const body = parseBody(componentCreate, req.body, res);
    if (!body) return;
    if (db.select({ id: table.id }).from(table).where(eq(table.id, body.id)).get()) {
      return res.status(409).json({ error: `A component with ID ${body.id} already exists (it may be archived).` });
    }
    db.insert(table).values(body).run();
    const created = active(body.id)!;
    recordAudit(db, req, {
      action: 'Create Server Component', details: `Added ${created.partName} for ${created.serverName} (${created.id}).`,
      entityType: 'server_component', entityId: created.id, after: created,
    });
    runAlertChecks(db);
    res.status(201).json(toApi(created));
  });

  router.put('/:id', requirePermission('assets:write'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Component not found.' });
    const body = parseBody(componentUpdate, req.body, res);
    if (!body) return;
    db.update(table).set({ ...body, updatedAt: new Date().toISOString() }).where(eq(table.id, existing.id)).run();
    const updated = active(existing.id)!;
    recordAudit(db, req, {
      action: 'Update Server Component', details: `Updated ${updated.partName} for ${updated.serverName} (${updated.id}).`,
      entityType: 'server_component', entityId: updated.id, before: existing, after: updated,
    });
    runAlertChecks(db);
    res.json(toApi(updated));
  });

  router.delete('/:id', requirePermission('assets:delete'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Component not found.' });
    const now = new Date().toISOString();
    db.update(table).set({ deletedAt: now, updatedAt: now }).where(eq(table.id, existing.id)).run();
    recordAudit(db, req, {
      action: 'Delete Server Component', details: `Archived ${existing.partName} for ${existing.serverName} (${existing.id}).`,
      entityType: 'server_component', entityId: existing.id, before: existing,
    });
    res.json({ success: true, deletedId: existing.id });
  });

  return router;
}
