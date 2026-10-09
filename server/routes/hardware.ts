import { Router, type Response } from 'express';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import type { DB } from '../db';
import { assetAssignments, auditLog, hardware, staff } from '../db/schema';
import { can } from '../auth/permissions';
import { requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { runAlertChecks } from '../services/alerts';
import { checkReference, loadDirectory, type Directory } from '../services/directory';
import { canTransition, LIFECYCLE_TRANSITIONS, NOTE_REQUIRED } from '../../shared/lifecycle';
import { HARDWARE_CATEGORIES, hardwareCheckin, hardwareCheckout, hardwareCreate, hardwareFields, hardwareLifecycle, parseBody } from '../validation';
import { auditToApi } from './reports';

type Row = typeof hardware.$inferSelect;
type AssignmentRow = typeof assetAssignments.$inferSelect;
type Category = (typeof HARDWARE_CATEGORIES)[number];

/** The row plus display names for its department, location (full path) and assignee. Also what the audit log stores. */
function withNames(r: Row, dir: Directory) {
  return { ...r, department: dir.department(r.departmentId), location: dir.location(r.locationId), assignee: dir.staff(r.assigneeId) };
}

/** API shape expected by the UI (includes the legacy `name` alias). */
export function hardwareToApi(r: Row, dir: Directory) {
  const { deletedAt: _deleted, ...rest } = withNames(r, dir);
  return { ...rest, name: r.assetName };
}

export function assignmentToApi(r: AssignmentRow) {
  return { ...r, open: r.checkedInAt === null };
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
  const { name, assetName, ...rest } = input;
  const out: Partial<Row> = { ...rest };
  const finalName = assetName ?? name;
  if (finalName !== undefined) out.assetName = finalName;
  for (const k of Object.keys(out) as (keyof Row)[]) if (out[k] === undefined) delete out[k];
  return out;
}

export function hardwareRouter(db: DB) {
  const router = Router();
  const active = (id: string) =>
    db.select().from(hardware).where(and(eq(hardware.id, id), isNull(hardware.deletedAt))).get();
  const openAssignment = (hardwareId: string) =>
    db.select().from(assetAssignments).where(and(eq(assetAssignments.hardwareId, hardwareId), isNull(assetAssignments.checkedInAt))).get();
  const toApi = (r: Row) => hardwareToApi(r, loadDirectory(db));
  const snapshot = (r: Row) => withNames(r, loadDirectory(db));
  /** Rejects a department or location that does not exist or was archived (keeping the current one is fine). */
  const badReference = (res: Response, cols: Partial<Row>, current?: Row) => {
    for (const [field, kind] of [['departmentId', 'department'], ['locationId', 'location']] as const) {
      const error = checkReference(db, kind, cols[field], current ? current[field] : null);
      if (error) return res.status(400).json({ error, fields: [{ field, message: error }] });
    }
    return null;
  };

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    const dir = loadDirectory(db);
    res.json(db.select().from(hardware).where(isNull(hardware.deletedAt)).orderBy(asc(hardware.id)).all().map(r => hardwareToApi(r, dir)));
  });

  router.post('/', requirePermission('assets:write'), (req, res) => {
    const body = parseBody(hardwareCreate, req.body, res);
    if (!body) return;
    const { assigneeId, lifecycleState = 'In Stock', ...fields } = body;
    const cols = toColumns(fields);
    if (!cols.assetName) return res.status(400).json({ error: 'Asset name is required.' });
    if (badReference(res, cols)) return;
    // A Deployed asset always has an open check-out, so one that starts Deployed needs its assignee now.
    if (lifecycleState === 'Deployed' && !assigneeId) {
      return res.status(400).json({ error: 'Pick who has an asset that starts Deployed.', fields: [{ field: 'assigneeId', message: 'Required' }] });
    }
    if (lifecycleState !== 'Deployed' && assigneeId) {
      return res.status(400).json({ error: 'Only an asset that starts Deployed has an assignee. Check it out instead.', fields: [{ field: 'assigneeId', message: 'Not allowed' }] });
    }
    const assigneeError = checkReference(db, 'staff', assigneeId);
    if (assigneeError) return res.status(400).json({ error: assigneeError, fields: [{ field: 'assigneeId', message: assigneeError }] });
    if (db.select({ id: hardware.id }).from(hardware).where(eq(hardware.id, body.id)).get()) {
      return res.status(409).json({ error: `An asset with ID ${body.id} already exists (it may be archived).` });
    }
    const values = {
      ...cols,
      id: body.id,
      lifecycleState,
      assigneeId: assigneeId ?? null,
      lifecycleChangedAt: new Date().toISOString(),
      assetName: cols.assetName,
      category: cols.category ?? detectCategory(cols.assetName, cols.model ?? ''),
      dateAcquired: cols.dateAcquired || new Date().toISOString().slice(0, 10),
    };
    db.insert(hardware).values(values).run();
    const created = active(body.id)!;
    const after = snapshot(created);
    // A new asset may start Deployed (e.g. recording one already in the field); open its assignment too.
    if (created.assigneeId !== null) {
      db.insert(assetAssignments)
        .values({ hardwareId: created.id, staffId: created.assigneeId, assignee: after.assignee, checkedOutAt: values.lifecycleChangedAt, checkedOutBy: req.user!.username, notes: 'Set at creation.' })
        .run();
    }
    recordAudit(db, req, {
      action: 'Create Hardware',
      details: `Added hardware asset ${created.assetName} (${created.id}).`,
      entityType: 'hardware',
      entityId: created.id,
      after,
    });
    runAlertChecks(db);
    res.status(201).json(toApi(created));
  });

  router.put('/:id', requirePermission('assets:write'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Asset not found.' });
    if (existing.lifecycleState === 'Disposed') return res.status(409).json({ error: 'Disposed assets are read-only.' });
    const body = parseBody(hardwareFields, req.body, res);
    if (!body) return;
    const cols = toColumns(body);
    if (badReference(res, cols, existing)) return;
    db.update(hardware)
      .set({ ...cols, updatedAt: new Date().toISOString() })
      .where(eq(hardware.id, existing.id))
      .run();
    const updated = active(existing.id)!;
    recordAudit(db, req, {
      action: 'Update Hardware',
      details: `Updated hardware asset ${updated.assetName} (${updated.id}). State: ${updated.lifecycleState}.`,
      entityType: 'hardware',
      entityId: updated.id,
      before: snapshot(existing),
      after: snapshot(updated),
    });
    runAlertChecks(db);
    res.json(toApi(updated));
  });

  // The only way to change a lifecycle state after creation, so every move is checked and audited.
  router.post('/:id/lifecycle', requirePermission('assets:read'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Asset not found.' });
    const body = parseBody(hardwareLifecycle, req.body, res);
    if (!body) return;
    const { to, note } = body;
    if (!can(req.user!.role, to === 'Disposed' ? 'assets:dispose' : 'assets:write')) {
      return res.status(403).json({ error: 'Your role does not allow this action.' });
    }
    const from = existing.lifecycleState;
    if (!canTransition(from, to)) {
      const allowed = LIFECYCLE_TRANSITIONS[from];
      const hint = allowed.length ? ` Allowed: ${allowed.join(', ')}.` : ' Disposed is final.';
      const deployHint = to === 'Deployed' ? ' Check out an asset to deploy it.' : '';
      return res.status(409).json({ error: `An asset cannot move from ${from} to ${to}.${hint}${deployHint}` });
    }
    if (NOTE_REQUIRED.includes(to) && !note) {
      return res.status(400).json({ error: `Give a reason when moving an asset to ${to}.`, fields: [{ field: 'note', message: 'Required' }] });
    }
    const now = new Date().toISOString();
    // Leaving active service closes any open check-out; In Repair keeps it, since the same person gets the asset back.
    const releasesAssignee = to === 'In Stock' || to === 'Retired' || to === 'Disposed';
    const assignment = releasesAssignee ? openAssignment(existing.id) : null;
    if (assignment) {
      db.update(assetAssignments)
        .set({ checkedInAt: now, checkedInBy: req.user!.username, notes: `${assignment.notes} Closed by a move to ${to}.`.trim() })
        .where(eq(assetAssignments.id, assignment.id))
        .run();
    }
    db.update(hardware)
      .set({ lifecycleState: to, lifecycleChangedAt: now, updatedAt: now, ...(releasesAssignee ? { assigneeId: null } : {}) })
      .where(eq(hardware.id, existing.id))
      .run();
    const updated = active(existing.id)!;
    recordAudit(db, req, {
      action: 'Lifecycle Change',
      details: `${updated.assetName} (${updated.id}): ${from} → ${to}.${note ? ` Note: ${note}` : ''}`,
      entityType: 'hardware',
      entityId: updated.id,
      before: { lifecycleState: from },
      after: { lifecycleState: to, note },
    });
    res.json(toApi(updated));
  });

  // The only way into Deployed: records who the asset is with and closes once it is checked in.
  router.post('/:id/checkout', requirePermission('assets:write'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Asset not found.' });
    const body = parseBody(hardwareCheckout, req.body, res);
    if (!body) return;
    if (existing.lifecycleState !== 'In Stock' && existing.lifecycleState !== 'In Repair') {
      return res.status(409).json({ error: `Cannot check out an asset that is ${existing.lifecycleState}.` });
    }
    if (openAssignment(existing.id)) {
      return res.status(409).json({ error: 'This asset already has an open check-out. Check it in first.' });
    }
    const staffError = checkReference(db, 'staff', body.staffId);
    if (staffError) return res.status(400).json({ error: staffError, fields: [{ field: 'staffId', message: staffError }] });
    const person = db.select().from(staff).where(eq(staff.id, body.staffId)).get()!;
    const dir = loadDirectory(db);
    const now = new Date().toISOString();
    db.insert(assetAssignments)
      .values({ hardwareId: existing.id, staffId: person.id, assignee: person.fullName, checkedOutAt: now, checkedOutBy: req.user!.username, dueBack: body.dueBack || null, notes: body.notes })
      .run();
    db.update(hardware).set({ lifecycleState: 'Deployed', lifecycleChangedAt: now, assigneeId: person.id, updatedAt: now }).where(eq(hardware.id, existing.id)).run();
    const updated = active(existing.id)!;
    recordAudit(db, req, {
      action: 'Check Out',
      details: `${updated.assetName} (${updated.id}): checked out to ${person.fullName}.${body.dueBack ? ` Due back ${body.dueBack}.` : ''}${body.notes ? ` Note: ${body.notes}` : ''}`,
      entityType: 'hardware',
      entityId: updated.id,
      before: { lifecycleState: existing.lifecycleState, assignee: dir.staff(existing.assigneeId) },
      after: { lifecycleState: 'Deployed', assignee: person.fullName },
    });
    runAlertChecks(db);
    res.status(201).json(hardwareToApi(updated, dir));
  });

  // Closes the open check-out. A Deployed asset returns to In Stock; one In Repair stays In Repair.
  router.post('/:id/checkin', requirePermission('assets:write'), (req, res) => {
    const existing = active(String(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Asset not found.' });
    if (existing.lifecycleState !== 'Deployed' && existing.lifecycleState !== 'In Repair') {
      return res.status(409).json({ error: `Cannot check in an asset that is ${existing.lifecycleState}.` });
    }
    const assignment = openAssignment(existing.id);
    if (!assignment) return res.status(409).json({ error: 'This asset has no open check-out.' });
    const body = parseBody(hardwareCheckin, req.body, res);
    if (!body) return;
    const now = new Date().toISOString();
    db.update(assetAssignments)
      .set({ checkedInAt: now, checkedInBy: req.user!.username, notes: body.notes ? `${assignment.notes} ${body.notes}`.trim() : assignment.notes })
      .where(eq(assetAssignments.id, assignment.id))
      .run();
    const toState = existing.lifecycleState === 'Deployed' ? 'In Stock' : existing.lifecycleState;
    db.update(hardware)
      .set({
        lifecycleState: toState,
        lifecycleChangedAt: toState !== existing.lifecycleState ? now : existing.lifecycleChangedAt,
        assigneeId: null,
        updatedAt: now,
      })
      .where(eq(hardware.id, existing.id))
      .run();
    const updated = active(existing.id)!;
    recordAudit(db, req, {
      action: 'Check In',
      details: `${updated.assetName} (${updated.id}): checked in from ${assignment.assignee}.${toState === existing.lifecycleState ? ` State stays ${toState}.` : ''}${body.notes ? ` Note: ${body.notes}` : ''}`,
      entityType: 'hardware',
      entityId: updated.id,
      before: { lifecycleState: existing.lifecycleState, assignee: assignment.assignee },
      after: { lifecycleState: updated.lifecycleState, assignee: '' },
    });
    runAlertChecks(db);
    res.json(toApi(updated));
  });

  // Every check-out/check-in for this asset, newest first (open one included).
  router.get('/:id/assignments', requirePermission('assets:read'), (req, res) => {
    const id = String(req.params.id);
    if (!db.select({ id: hardware.id }).from(hardware).where(eq(hardware.id, id)).get()) {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    const rows = db.select().from(assetAssignments).where(eq(assetAssignments.hardwareId, id)).orderBy(desc(assetAssignments.id)).all();
    res.json(rows.map(assignmentToApi));
  });

  // Per-asset timeline from the append-only audit log, oldest first. Works for archived assets too.
  router.get('/:id/history', requirePermission('audit:read'), (req, res) => {
    const id = String(req.params.id);
    if (!db.select({ id: hardware.id }).from(hardware).where(eq(hardware.id, id)).get()) {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    const rows = db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'hardware'), eq(auditLog.entityId, id)))
      .orderBy(asc(auditLog.id))
      .all();
    res.json(rows.map(auditToApi));
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
      before: snapshot(existing),
    });
    res.json({ success: true, deletedId: existing.id });
  });

  return router;
}
