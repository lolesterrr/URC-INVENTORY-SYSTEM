import { Router, type Request, type Response } from 'express';
import { and, asc, count, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { DB } from '../db';
import { departments, hardware, locations, staff } from '../db/schema';
import { requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { checkReference, locationPath, sameText } from '../services/directory';
import { departmentInput, locationInput, locationUpdate, parseBody, staffInput, staffUpdate } from '../validation';

// Departments, locations and staff: the records assets point to. Reads need assets:read, changes need
// directory:manage. Records are archived (soft-deleted), never removed, so old assets and history keep their names.

const recordId = (req: Request) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** Active hardware per referenced id, e.g. how many assets each department has. */
function assetCounts(db: DB, column: typeof hardware.departmentId | typeof hardware.locationId | typeof hardware.assigneeId) {
  const rows = db.select({ id: column, n: count() }).from(hardware).where(and(isNull(hardware.deletedAt), isNotNull(column))).groupBy(column).all();
  return new Map(rows.map(r => [r.id as number, r.n]));
}

const conflict = (res: Response, error: string) => res.status(409).json({ error });

export function departmentsRouter(db: DB) {
  const router = Router();
  const find = (id: number | null) => (id === null ? undefined : db.select().from(departments).where(eq(departments.id, id)).get());
  const nameTaken = (name: string, exceptId = 0) =>
    Boolean(db.select({ id: departments.id }).from(departments).where(and(sameText(departments.name, name), ne(departments.id, exceptId))).get());

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    const assets = assetCounts(db, hardware.departmentId);
    const people = new Map(
      db.select({ id: staff.departmentId, n: count() }).from(staff).where(and(isNull(staff.deletedAt), isNotNull(staff.departmentId))).groupBy(staff.departmentId).all().map(r => [r.id as number, r.n]),
    );
    const rows = db.select().from(departments).orderBy(asc(sql`lower(${departments.name})`)).all();
    res.json(rows.map(({ deletedAt, ...d }) => ({ ...d, archived: deletedAt !== null, assetCount: assets.get(d.id) ?? 0, staffCount: people.get(d.id) ?? 0 })));
  });

  router.post('/', requirePermission('directory:manage'), (req, res) => {
    const body = parseBody(departmentInput, req.body, res);
    if (!body) return;
    if (nameTaken(body.name)) return conflict(res, `A department named ${body.name} already exists (it may be archived).`);
    const created = db.insert(departments).values(body).returning().get();
    recordAudit(db, req, { action: 'Create Department', details: `Added department ${created.name}.`, entityType: 'department', entityId: String(created.id), after: created });
    res.status(201).json(created);
  });

  router.put('/:id', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing) return res.status(404).json({ error: 'Department not found.' });
    const body = parseBody(departmentInput, req.body, res);
    if (!body) return;
    if (nameTaken(body.name, existing.id)) return conflict(res, `A department named ${body.name} already exists (it may be archived).`);
    const updated = db.update(departments).set({ ...body, updatedAt: new Date().toISOString() }).where(eq(departments.id, existing.id)).returning().get();
    recordAudit(db, req, { action: 'Update Department', details: `Renamed department ${existing.name} to ${updated.name}.`, entityType: 'department', entityId: String(existing.id), before: existing, after: updated });
    res.json(updated);
  });

  // Assets and staff keep an archived department; it is just no longer offered for new records.
  router.delete('/:id', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Department not found.' });
    const now = new Date().toISOString();
    db.update(departments).set({ deletedAt: now, updatedAt: now }).where(eq(departments.id, existing.id)).run();
    recordAudit(db, req, { action: 'Archive Department', details: `Archived department ${existing.name}.`, entityType: 'department', entityId: String(existing.id), before: existing });
    res.json({ success: true });
  });

  router.post('/:id/restore', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing || !existing.deletedAt) return res.status(404).json({ error: 'No archived department with that ID.' });
    db.update(departments).set({ deletedAt: null, updatedAt: new Date().toISOString() }).where(eq(departments.id, existing.id)).run();
    recordAudit(db, req, { action: 'Restore Department', details: `Restored department ${existing.name}.`, entityType: 'department', entityId: String(existing.id) });
    res.json({ success: true });
  });

  return router;
}

export function locationsRouter(db: DB) {
  const router = Router();
  const all = () => new Map(db.select().from(locations).all().map(l => [l.id, l]));
  const find = (id: number | null) => (id === null ? undefined : db.select().from(locations).where(eq(locations.id, id)).get());
  // Names are unique among siblings, so "Kampala / Stores" and "Jinja / Stores" can both exist.
  const nameTaken = (name: string, parentId: number | null, exceptId = 0) =>
    Boolean(
      db.select({ id: locations.id }).from(locations)
        .where(and(sameText(locations.name, name), parentId === null ? isNull(locations.parentId) : eq(locations.parentId, parentId), ne(locations.id, exceptId)))
        .get(),
    );
  const takenMessage = (name: string) => `A location named ${name} already exists there (it may be archived).`;
  const activeChildren = (id: number) =>
    db.select({ n: count() }).from(locations).where(and(eq(locations.parentId, id), isNull(locations.deletedAt))).get()!.n;

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    const byId = all();
    const assets = assetCounts(db, hardware.locationId);
    const rows = [...byId.values()].map(({ deletedAt, ...l }) => ({ ...l, path: locationPath(byId, l.id), archived: deletedAt !== null, assetCount: assets.get(l.id) ?? 0 }));
    rows.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }));
    res.json(rows);
  });

  router.post('/', requirePermission('directory:manage'), (req, res) => {
    const body = parseBody(locationInput, req.body, res);
    if (!body) return;
    const refError = checkReference(db, 'location', body.parentId);
    if (refError) return res.status(400).json({ error: refError, fields: [{ field: 'parentId', message: refError }] });
    if (nameTaken(body.name, body.parentId)) return conflict(res, takenMessage(body.name));
    const created = db.insert(locations).values(body).returning().get();
    const path = locationPath(all(), created.id);
    recordAudit(db, req, { action: 'Create Location', details: `Added location ${path}.`, entityType: 'location', entityId: String(created.id), after: { ...created, path } });
    res.status(201).json({ ...created, path });
  });

  router.put('/:id', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing) return res.status(404).json({ error: 'Location not found.' });
    const body = parseBody(locationUpdate, req.body, res);
    if (!body) return;
    const next = { name: body.name ?? existing.name, parentId: body.parentId === undefined ? existing.parentId : body.parentId };
    const refError = checkReference(db, 'location', next.parentId, existing.parentId);
    if (refError) return res.status(400).json({ error: refError, fields: [{ field: 'parentId', message: refError }] });
    const byId = all();
    // Walk up from the new parent: reaching this location would make it its own ancestor.
    for (let cur = next.parentId === null ? undefined : byId.get(next.parentId); cur; cur = cur.parentId === null ? undefined : byId.get(cur.parentId)) {
      if (cur.id === existing.id) return conflict(res, 'A location cannot be placed inside itself or one of its sub-locations.');
    }
    if (nameTaken(next.name, next.parentId, existing.id)) return conflict(res, takenMessage(next.name));
    const before = { ...existing, path: locationPath(byId, existing.id) };
    const updated = db.update(locations).set({ ...next, updatedAt: new Date().toISOString() }).where(eq(locations.id, existing.id)).returning().get();
    const path = locationPath(all(), updated.id);
    recordAudit(db, req, { action: 'Update Location', details: `Updated location ${before.path}${before.path !== path ? ` → ${path}` : ''}.`, entityType: 'location', entityId: String(existing.id), before, after: { ...updated, path } });
    res.json({ ...updated, path });
  });

  router.delete('/:id', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Location not found.' });
    if (activeChildren(existing.id) > 0) return conflict(res, 'Archive or move its sub-locations first.');
    const now = new Date().toISOString();
    db.update(locations).set({ deletedAt: now, updatedAt: now }).where(eq(locations.id, existing.id)).run();
    const path = locationPath(all(), existing.id);
    recordAudit(db, req, { action: 'Archive Location', details: `Archived location ${path}.`, entityType: 'location', entityId: String(existing.id), before: existing });
    res.json({ success: true });
  });

  router.post('/:id/restore', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing || !existing.deletedAt) return res.status(404).json({ error: 'No archived location with that ID.' });
    if (existing.parentId !== null && find(existing.parentId)?.deletedAt) return conflict(res, 'Restore its parent location first.');
    db.update(locations).set({ deletedAt: null, updatedAt: new Date().toISOString() }).where(eq(locations.id, existing.id)).run();
    recordAudit(db, req, { action: 'Restore Location', details: `Restored location ${locationPath(all(), existing.id)}.`, entityType: 'location', entityId: String(existing.id) });
    res.json({ success: true });
  });

  return router;
}

export function staffRouter(db: DB) {
  const router = Router();
  const find = (id: number | null) => (id === null ? undefined : db.select().from(staff).where(eq(staff.id, id)).get());
  const numberTaken = (staffNumber: string, exceptId = 0) =>
    staffNumber !== '' && Boolean(db.select({ id: staff.id }).from(staff).where(and(sameText(staff.staffNumber, staffNumber), ne(staff.id, exceptId))).get());
  const departmentName = (id: number | null) => (id === null ? '' : db.select({ name: departments.name }).from(departments).where(eq(departments.id, id)).get()?.name ?? '');
  const withDepartment = (s: typeof staff.$inferSelect) => ({ ...s, department: departmentName(s.departmentId) });

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    const holding = assetCounts(db, hardware.assigneeId);
    const names = new Map(db.select({ id: departments.id, name: departments.name }).from(departments).all().map(d => [d.id, d.name]));
    const rows = db.select().from(staff).orderBy(asc(sql`lower(${staff.fullName})`)).all();
    res.json(
      rows.map(({ deletedAt, ...s }) => ({
        ...s,
        department: s.departmentId === null ? '' : names.get(s.departmentId) ?? '',
        archived: deletedAt !== null,
        assetCount: holding.get(s.id) ?? 0,
      })),
    );
  });

  router.post('/', requirePermission('directory:manage'), (req, res) => {
    const body = parseBody(staffInput, req.body, res);
    if (!body) return;
    const refError = checkReference(db, 'department', body.departmentId);
    if (refError) return res.status(400).json({ error: refError, fields: [{ field: 'departmentId', message: refError }] });
    if (numberTaken(body.staffNumber)) return conflict(res, `Staff number ${body.staffNumber} is already in use (it may be archived).`);
    const created = withDepartment(db.insert(staff).values(body).returning().get());
    recordAudit(db, req, { action: 'Create Staff', details: `Added staff member ${created.fullName}.`, entityType: 'staff', entityId: String(created.id), after: created });
    res.status(201).json(created);
  });

  router.put('/:id', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing) return res.status(404).json({ error: 'Staff member not found.' });
    const body = parseBody(staffUpdate, req.body, res);
    if (!body) return;
    const refError = checkReference(db, 'department', body.departmentId, existing.departmentId);
    if (refError) return res.status(400).json({ error: refError, fields: [{ field: 'departmentId', message: refError }] });
    if (body.staffNumber !== undefined && numberTaken(body.staffNumber, existing.id)) {
      return conflict(res, `Staff number ${body.staffNumber} is already in use (it may be archived).`);
    }
    const updated = withDepartment(db.update(staff).set({ ...body, updatedAt: new Date().toISOString() }).where(eq(staff.id, existing.id)).returning().get());
    recordAudit(db, req, { action: 'Update Staff', details: `Updated staff member ${updated.fullName}.`, entityType: 'staff', entityId: String(existing.id), before: withDepartment(existing), after: updated });
    res.json(updated);
  });

  // Someone who still holds an asset cannot be archived, or the asset would point at a person who has left.
  router.delete('/:id', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing || existing.deletedAt) return res.status(404).json({ error: 'Staff member not found.' });
    const held = db.select({ n: count() }).from(hardware).where(and(eq(hardware.assigneeId, existing.id), isNull(hardware.deletedAt))).get()!.n;
    if (held > 0) return conflict(res, `${existing.fullName} still holds ${held} asset${held === 1 ? '' : 's'}. Check ${held === 1 ? 'it' : 'them'} in first.`);
    const now = new Date().toISOString();
    db.update(staff).set({ deletedAt: now, updatedAt: now }).where(eq(staff.id, existing.id)).run();
    recordAudit(db, req, { action: 'Archive Staff', details: `Archived staff member ${existing.fullName}.`, entityType: 'staff', entityId: String(existing.id), before: existing });
    res.json({ success: true });
  });

  router.post('/:id/restore', requirePermission('directory:manage'), (req, res) => {
    const existing = find(recordId(req));
    if (!existing || !existing.deletedAt) return res.status(404).json({ error: 'No archived staff member with that ID.' });
    db.update(staff).set({ deletedAt: null, updatedAt: new Date().toISOString() }).where(eq(staff.id, existing.id)).run();
    recordAudit(db, req, { action: 'Restore Staff', details: `Restored staff member ${existing.fullName}.`, entityType: 'staff', entityId: String(existing.id) });
    res.json({ success: true });
  });

  return router;
}
