import { Router, type Request, type Response } from 'express';
import { and, asc, count, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { DB } from '../db';
import { assetAssignments, departments, hardware, locations, software, staff } from '../db/schema';
import { requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { checkReference, locationPath, sameText } from '../services/directory';
import { departmentInput, locationInput, locationUpdate, mergeInput, parseBody, staffInput, staffUpdate } from '../validation';

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

/**
 * Validates a merge request: the duplicate (URL id) and the record kept (`intoId`) must both exist, differ,
 * and the record kept must be active. Sends the error and returns null when they don't.
 */
function mergePair<T extends { id: number; deletedAt: string | null }>(req: Request, res: Response, find: (id: number | null) => T | undefined, label: string) {
  const source = find(recordId(req));
  if (!source) {
    res.status(404).json({ error: `${label} not found.` });
    return null;
  }
  const body = parseBody(mergeInput, req.body, res);
  if (!body) return null;
  const target = find(body.intoId);
  if (!target) {
    res.status(400).json({ error: `The ${label.toLowerCase()} to keep does not exist.`, fields: [{ field: 'intoId', message: 'Not found' }] });
    return null;
  }
  if (target.id === source.id) {
    conflict(res, `Pick a different ${label.toLowerCase()} to keep.`);
    return null;
  }
  if (target.deletedAt) {
    conflict(res, `The ${label.toLowerCase()} to keep is archived. Restore it first.`);
    return null;
  }
  return { source, target };
}

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

  // Moves everything that points at a duplicate onto the department kept, then archives the duplicate.
  router.post('/:id/merge', requirePermission('directory:manage'), (req, res) => {
    const pair = mergePair(req, res, find, 'Department');
    if (!pair) return;
    const { source, target } = pair;
    const now = new Date().toISOString();
    const moved = db.transaction(tx => {
      const assets = tx.update(hardware).set({ departmentId: target.id }).where(eq(hardware.departmentId, source.id)).run().changes;
      const licences = tx.update(software).set({ departmentId: target.id }).where(eq(software.departmentId, source.id)).run().changes;
      const people = tx.update(staff).set({ departmentId: target.id }).where(eq(staff.departmentId, source.id)).run().changes;
      tx.update(departments).set({ deletedAt: source.deletedAt ?? now, updatedAt: now }).where(eq(departments.id, source.id)).run();
      return { assets, licences, people };
    });
    recordAudit(db, req, {
      action: 'Merge Department',
      details: `Merged department ${source.name} into ${target.name}: moved ${moved.assets} assets, ${moved.licences} licences and ${moved.people} staff, and archived ${source.name}.`,
      entityType: 'department',
      entityId: String(source.id),
      before: source,
      after: { mergedInto: target.id, ...moved },
    });
    res.json({ success: true, moved });
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

  // Moves assets and sub-locations from a duplicate onto the location kept, then archives the duplicate.
  router.post('/:id/merge', requirePermission('directory:manage'), (req, res) => {
    const pair = mergePair(req, res, find, 'Location');
    if (!pair) return;
    const { source, target } = pair;
    const byId = all();
    for (let cur: typeof target | undefined = target; cur; cur = cur.parentId === null ? undefined : byId.get(cur.parentId)) {
      if (cur.id === source.id) return conflict(res, 'A location cannot be merged into one of its own sub-locations.');
    }
    const children = db.select().from(locations).where(eq(locations.parentId, source.id)).all();
    const clash = children.find(c => nameTaken(c.name, target.id, c.id));
    if (clash) return conflict(res, `${locationPath(byId, target.id)} already has a sub-location named ${clash.name}. Rename or merge one of them first.`);
    const sourcePath = locationPath(byId, source.id);
    const targetPath = locationPath(byId, target.id);
    const now = new Date().toISOString();
    const moved = db.transaction(tx => {
      const assets = tx.update(hardware).set({ locationId: target.id }).where(eq(hardware.locationId, source.id)).run().changes;
      const subLocations = tx.update(locations).set({ parentId: target.id, updatedAt: now }).where(eq(locations.parentId, source.id)).run().changes;
      tx.update(locations).set({ deletedAt: source.deletedAt ?? now, updatedAt: now }).where(eq(locations.id, source.id)).run();
      return { assets, subLocations };
    });
    recordAudit(db, req, {
      action: 'Merge Location',
      details: `Merged location ${sourcePath} into ${targetPath}: moved ${moved.assets} assets and ${moved.subLocations} sub-locations, and archived ${sourcePath}.`,
      entityType: 'location',
      entityId: String(source.id),
      before: { ...source, path: sourcePath },
      after: { mergedInto: target.id, ...moved },
    });
    res.json({ success: true, moved });
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


  // Moves assets and check-out history from a duplicate onto the person kept, then archives the duplicate.
  // Each assignment row keeps its name snapshot, so the history still shows the name used at the time.
  router.post('/:id/merge', requirePermission('directory:manage'), (req, res) => {
    const pair = mergePair(req, res, find, 'Staff member');
    if (!pair) return;
    const { source, target } = pair;
    const now = new Date().toISOString();
    const moved = db.transaction(tx => {
      const assets = tx.update(hardware).set({ assigneeId: target.id }).where(eq(hardware.assigneeId, source.id)).run().changes;
      const assignments = tx.update(assetAssignments).set({ staffId: target.id }).where(eq(assetAssignments.staffId, source.id)).run().changes;
      // The person kept takes over a staff number or department only where they have none.
      const fill: Partial<typeof staff.$inferInsert> = {};
      if (!target.staffNumber && source.staffNumber) fill.staffNumber = source.staffNumber;
      if (target.departmentId === null && source.departmentId !== null) fill.departmentId = source.departmentId;
      tx.update(staff).set({ deletedAt: source.deletedAt ?? now, updatedAt: now, ...(fill.staffNumber ? { staffNumber: '' } : {}) }).where(eq(staff.id, source.id)).run();
      if (Object.keys(fill).length) tx.update(staff).set({ ...fill, updatedAt: now }).where(eq(staff.id, target.id)).run();
      return { assets, assignments };
    });
    recordAudit(db, req, {
      action: 'Merge Staff',
      details: `Merged staff member ${source.fullName} into ${target.fullName}: moved ${moved.assets} assets and ${moved.assignments} check-out records, and archived the duplicate.`,
      entityType: 'staff',
      entityId: String(source.id),
      before: withDepartment(source),
      after: { mergedInto: target.id, ...moved },
    });
    res.json({ success: true, moved });
  });

  return router;
}
