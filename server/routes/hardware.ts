import { Router } from 'express';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import type { DB } from '../db';
import { hardware } from '../db/schema';
import { requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { runAlertChecks } from '../services/alerts';
import { HARDWARE_CATEGORIES, hardwareCreate, hardwareFields, parseBody } from '../validation';

type Row = typeof hardware.$inferSelect;
type Category = (typeof HARDWARE_CATEGORIES)[number];

/** API shape expected by the UI (includes legacy `name`/`user`/`assignee` aliases). */
export function hardwareToApi(r: Row) {
  const { deletedAt: _deleted, assignedTo, ...rest } = r;
  return { ...rest, name: r.assetName, user: assignedTo, assignee: assignedTo };
}

export function detectCategory(name: string, model: string): Category {
  const t = `${name} ${model}`.toLowerCase();
  if (/switch|catalyst/.test(t)) return 'Switch';
  if (/router|unifi|gateway|access point/.test(t)) return 'Router';
  if (/server|poweredge|proliant/.test(t)) return 'Server';
  if (/printer|laserjet|inkjet|epson/.test(t)) return 'Printer';
  if (/laptop|latitude|thinkpad|macbook|notebook/.test(t)) return 'Laptop';
  if (/desktop|thinkcentre|optiplex|workstation|elitedesk/.test(t)) return 'Desktop';
  return 'Other';
}

/** Maps validated input (with UI aliases) to table columns, dropping undefined fields. */
function toColumns(input: z.infer<typeof hardwareFields>): Partial<Row> {
  const { name, user, assignee, assetName, ...rest } = input;
  const out: Partial<Row> = { ...rest };
  const finalName = assetName ?? name;
  const finalUser = user ?? assignee;
  if (finalName !== undefined) out.assetName = finalName;
  if (finalUser !== undefined) out.assignedTo = finalUser || 'Unassigned';
  for (const k of Object.keys(out) as (keyof Row)[]) if (out[k] === undefined) delete out[k];
  return out;
}

export function hardwareRouter(db: DB) {
  const router = Router();
  const active = (id: string) =>
    db.select().from(hardware).where(and(eq(hardware.id, id), isNull(hardware.deletedAt))).get();

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    res.json(db.select().from(hardware).where(isNull(hardware.deletedAt)).orderBy(asc(hardware.id)).all().map(hardwareToApi));
  });

  router.post('/', requirePermission('assets:write'), (req, res) => {
    const body = parseBody(hardwareCreate, req.body, res);
    if (!body) return;
    const cols = toColumns(body);
    if (!cols.assetName) return res.status(400).json({ error: 'Asset name is required.' });
    if (db.select({ id: hardware.id }).from(hardware).where(eq(hardware.id, body.id)).get()) {
      return res.status(409).json({ error: `An asset with ID ${body.id} already exists (it may be archived).` });
    }
    const values = {
      ...cols,
      id: body.id,
      assetName: cols.assetName,
      category: cols.category ?? detectCategory(cols.assetName, cols.model ?? ''),
      dateAcquired: cols.dateAcquired || new Date().toISOString().slice(0, 10),
    };
    db.insert(hardware).values(values).run();
    const created = active(body.id)!;
    recordAudit(db, req, {
      action: 'Create Hardware',
      details: `Added hardware asset ${created.assetName} (${created.id}).`,
      entityType: 'hardware',
      entityId: created.id,
      after: created,
    });
    runAlertChecks(db);
    res.status(201).json(hardwareToApi(created));
  });

  router.put('/:id', requirePermission('assets:write'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Asset not found.' });
    const body = parseBody(hardwareFields, req.body, res);
    if (!body) return;
    db.update(hardware)
      .set({ ...toColumns(body), updatedAt: new Date().toISOString() })
      .where(eq(hardware.id, existing.id))
      .run();
    const updated = active(existing.id)!;
    recordAudit(db, req, {
      action: 'Update Hardware',
      details: `Updated hardware asset ${updated.assetName} (${updated.id}). Status: ${updated.status}.`,
      entityType: 'hardware',
      entityId: updated.id,
      before: existing,
      after: updated,
    });
    runAlertChecks(db);
    res.json(hardwareToApi(updated));
  });

  router.delete('/:id', requirePermission('assets:delete'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Asset not found.' });
    const now = new Date().toISOString();
    db.update(hardware).set({ deletedAt: now, updatedAt: now }).where(eq(hardware.id, existing.id)).run();
    recordAudit(db, req, {
      action: 'Delete Hardware',
      details: `Archived hardware asset ${existing.assetName} (${existing.id}).`,
      entityType: 'hardware',
      entityId: existing.id,
      before: existing,
    });
    res.json({ success: true, deletedId: existing.id });
  });

  return router;
}
