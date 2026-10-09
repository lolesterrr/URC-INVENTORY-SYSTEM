import { Router, type Response } from 'express';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DB } from '../db';
import { software } from '../db/schema';
import { requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { runAlertChecks } from '../services/alerts';
import { checkReference, loadDirectory } from '../services/directory';
import { parseBody, softwareCreate, softwareUpdate } from '../validation';

type Row = typeof software.$inferSelect;

export function softwareRouter(db: DB) {
  const router = Router();
  const active = (id: string) =>
    db.select().from(software).where(and(eq(software.id, id), isNull(software.deletedAt))).get();
  /** The row plus its department name; also what the audit log stores. */
  const withNames = (r: Row) => ({ ...r, department: loadDirectory(db).department(r.departmentId) });
  const toApi = (r: Row) => {
    const { deletedAt: _deleted, ...rest } = withNames(r);
    return rest;
  };
  const badDepartment = (res: Response, id: number | null | undefined, current: number | null = null) => {
    const error = checkReference(db, 'department', id, current);
    return error ? res.status(400).json({ error, fields: [{ field: 'departmentId', message: error }] }) : null;
  };

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    res.json(db.select().from(software).where(isNull(software.deletedAt)).orderBy(asc(software.name)).all().map(toApi));
  });

  router.post('/', requirePermission('assets:write'), (req, res) => {
    const body = parseBody(softwareCreate, req.body, res);
    if (!body) return;
    if (badDepartment(res, body.departmentId)) return;
    if (db.select({ id: software.id }).from(software).where(eq(software.id, body.id)).get()) {
      return res.status(409).json({ error: `A licence with ID ${body.id} already exists (it may be archived).` });
    }
    db.insert(software).values(body).run();
    const created = active(body.id)!;
    recordAudit(db, req, {
      action: 'Create Software', details: `Added licence ${created.name} (${created.id}).`,
      entityType: 'software', entityId: created.id, after: withNames(created),
    });
    runAlertChecks(db);
    res.status(201).json(toApi(created));
  });

  router.put('/:id', requirePermission('assets:write'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Licence not found.' });
    const body = parseBody(softwareUpdate, req.body, res);
    if (!body) return;
    if (badDepartment(res, body.departmentId, existing.departmentId)) return;
    db.update(software).set({ ...body, updatedAt: new Date().toISOString() }).where(eq(software.id, existing.id)).run();
    const updated = active(existing.id)!;
    recordAudit(db, req, {
      action: 'Update Software', details: `Updated licence ${updated.name} (${updated.id}).`,
      entityType: 'software', entityId: updated.id, before: withNames(existing), after: withNames(updated),
    });
    runAlertChecks(db);
    res.json(toApi(updated));
  });

  router.delete('/:id', requirePermission('assets:delete'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Licence not found.' });
    const now = new Date().toISOString();
    db.update(software).set({ deletedAt: now, updatedAt: now }).where(eq(software.id, existing.id)).run();
    recordAudit(db, req, {
      action: 'Delete Software', details: `Archived licence ${existing.name} (${existing.id}).`,
      entityType: 'software', entityId: existing.id, before: withNames(existing),
    });
    res.json({ success: true, deletedId: existing.id });
  });

  return router;
}
