import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDatabase, type DB } from '../server/db';
import { createApp } from '../server/app';
import { createUser } from '../server/services/users';
import { importLegacy } from '../scripts/import-json';
import type { Role } from '../server/db/schema';

const PASSWORD = 'Str0ng-Passw0rd!';
let db: DB;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  app = createApp(db, { idleMs: 30 * 60_000, maxMs: 12 * 3_600_000, secureCookie: false, production: false, loginRateLimit: 1000 });
});

async function agentFor(role: Role) {
  const username = role.toLowerCase().replace(' ', '.');
  await createUser(db, { username, fullName: `Test ${role}`, role, password: PASSWORD, mustChangePassword: false });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password: PASSWORD }).expect(200);
  return agent;
}

const created = async (res: request.Test) => (await res.expect(201)).body as { id: number };

describe('departments', () => {
  it('IT Officer can add, rename, archive and restore; names are unique ignoring case', async () => {
    const officer = await agentFor('IT Officer');
    const { id } = await created(officer.post('/api/departments').send({ name: 'Finance' }));
    const dup = await officer.post('/api/departments').send({ name: ' FINANCE ' }).expect(409);
    expect(dup.body.error).toMatch(/already exists/);
    await officer.post('/api/departments').send({ name: '' }).expect(400);

    await officer.put(`/api/departments/${id}`).send({ name: 'Finance Department' }).expect(200);
    await officer.delete(`/api/departments/${id}`).expect(200);
    await officer.delete(`/api/departments/${id}`).expect(404);
    let list = await officer.get('/api/departments').expect(200);
    expect(list.body).toMatchObject([{ id, name: 'Finance Department', archived: true, assetCount: 0, staffCount: 0 }]);
    // An archived name still counts, so restoring it can never clash.
    await officer.post('/api/departments').send({ name: 'finance department' }).expect(409);
    await officer.post(`/api/departments/${id}/restore`).expect(200);
    list = await officer.get('/api/departments').expect(200);
    expect(list.body[0].archived).toBe(false);

    const actions = db.$client.prepare("SELECT action FROM audit_log WHERE entity_type = 'department' ORDER BY id").all();
    expect(actions.map(a => (a as { action: string }).action)).toEqual(['Create Department', 'Update Department', 'Archive Department', 'Restore Department']);
  });

  it('Manager and Auditor can read but not change records', async () => {
    const officer = await agentFor('IT Officer');
    const { id } = await created(officer.post('/api/departments').send({ name: 'Finance' }));
    for (const role of ['Manager', 'Auditor'] as const) {
      const agent = await agentFor(role);
      await agent.get('/api/departments').expect(200);
      await agent.get('/api/locations').expect(200);
      await agent.get('/api/staff').expect(200);
      await agent.post('/api/departments').send({ name: 'X' }).expect(403);
      await agent.put(`/api/departments/${id}`).send({ name: 'X' }).expect(403);
      await agent.delete(`/api/departments/${id}`).expect(403);
      await agent.post('/api/locations').send({ name: 'X' }).expect(403);
      await agent.post('/api/staff').send({ fullName: 'X' }).expect(403);
    }
    await request(app).get('/api/departments').expect(401);
  });
});

describe('locations', () => {
  it('nest to any depth, show a full path, and are unique only among siblings', async () => {
    const officer = await agentFor('IT Officer');
    const region = await created(officer.post('/api/locations').send({ name: 'Eastern' }));
    const station = await created(officer.post('/api/locations').send({ name: 'Jinja', parentId: region.id }));
    const office = await officer.post('/api/locations').send({ name: 'Stores', parentId: station.id }).expect(201);
    expect(office.body.path).toBe('Eastern / Jinja / Stores');
    await officer.post('/api/locations').send({ name: 'stores', parentId: station.id }).expect(409);
    await officer.post('/api/locations').send({ name: 'Stores' }).expect(201); // same name, different parent
    await officer.post('/api/locations').send({ name: 'X', parentId: 9999 }).expect(400);

    const list = await officer.get('/api/locations').expect(200);
    expect(list.body.map((l: { path: string }) => l.path)).toEqual(['Eastern', 'Eastern / Jinja', 'Eastern / Jinja / Stores', 'Stores']);
  });

  it('cannot be moved inside itself, and archive and restore keep the tree consistent', async () => {
    const officer = await agentFor('IT Officer');
    const region = await created(officer.post('/api/locations').send({ name: 'Eastern' }));
    const station = await created(officer.post('/api/locations').send({ name: 'Jinja', parentId: region.id }));
    await officer.put(`/api/locations/${region.id}`).send({ parentId: station.id }).expect(409);
    await officer.put(`/api/locations/${region.id}`).send({ parentId: region.id }).expect(409);

    const blocked = await officer.delete(`/api/locations/${region.id}`).expect(409);
    expect(blocked.body.error).toMatch(/sub-locations/);
    await officer.delete(`/api/locations/${station.id}`).expect(200);
    await officer.delete(`/api/locations/${region.id}`).expect(200);
    const parentFirst = await officer.post(`/api/locations/${station.id}/restore`).expect(409);
    expect(parentFirst.body.error).toMatch(/parent/);
    await officer.post(`/api/locations/${region.id}/restore`).expect(200);
    await officer.post(`/api/locations/${station.id}/restore`).expect(200);

    // Moving to the top level and renaming are both allowed.
    const moved = await officer.put(`/api/locations/${station.id}`).send({ name: 'Jinja Station', parentId: null }).expect(200);
    expect(moved.body.path).toBe('Jinja Station');
  });
});

describe('staff', () => {
  it('have an optional unique staff number and an active department', async () => {
    const officer = await agentFor('IT Officer');
    const dept = await created(officer.post('/api/departments').send({ name: 'Finance' }));
    const jane = await officer.post('/api/staff').send({ fullName: 'Jane Doe', staffNumber: 'PF-1', departmentId: dept.id }).expect(201);
    expect(jane.body).toMatchObject({ fullName: 'Jane Doe', staffNumber: 'PF-1', department: 'Finance' });
    await officer.post('/api/staff').send({ fullName: 'Other', staffNumber: 'pf-1' }).expect(409);
    // Names need not be unique, and an empty staff number is not a clash.
    await officer.post('/api/staff').send({ fullName: 'Jane Doe' }).expect(201);
    await officer.post('/api/staff').send({ fullName: 'John Roe' }).expect(201);

    await officer.delete(`/api/departments/${dept.id}`).expect(200);
    const archivedDept = await officer.post('/api/staff').send({ fullName: 'New Person', departmentId: dept.id }).expect(400);
    expect(archivedDept.body.error).toMatch(/archived/);
    // Keeping the department someone already has is fine even after it was archived.
    await officer.put(`/api/staff/${jane.body.id}`).send({ fullName: 'Jane A. Doe', departmentId: dept.id }).expect(200);
  });

  it('cannot be archived while holding an asset, and archived staff cannot check assets out', async () => {
    const officer = await agentFor('IT Officer');
    const jane = await created(officer.post('/api/staff').send({ fullName: 'Jane Doe' }));
    await officer.post('/api/hardware').send({ id: 'HW-1', assetName: 'Laptop' }).expect(201);
    await officer.post('/api/hardware/HW-1/checkout').send({ staffId: jane.id }).expect(201);
    const list = await officer.get('/api/staff').expect(200);
    expect(list.body[0].assetCount).toBe(1);

    const held = await officer.delete(`/api/staff/${jane.id}`).expect(409);
    expect(held.body.error).toMatch(/still holds 1 asset/);
    await officer.post('/api/hardware/HW-1/checkin').send({}).expect(200);
    await officer.delete(`/api/staff/${jane.id}`).expect(200);

    const archived = await officer.post('/api/hardware/HW-1/checkout').send({ staffId: jane.id }).expect(400);
    expect(archived.body.error).toMatch(/archived/);
    await officer.post('/api/hardware/HW-1/checkout').send({ staffId: 9999 }).expect(400);
  });
});

describe('assets point at directory records', () => {
  it('shows names, follows renames, and rejects missing or archived records', async () => {
    const officer = await agentFor('IT Officer');
    const dept = await created(officer.post('/api/departments').send({ name: 'Finance' }));
    const region = await created(officer.post('/api/locations').send({ name: 'Central' }));
    const office = await created(officer.post('/api/locations').send({ name: 'HQ', parentId: region.id }));
    const res = await officer.post('/api/hardware').send({ id: 'HW-1', assetName: 'Laptop', departmentId: dept.id, locationId: office.id }).expect(201);
    expect(res.body).toMatchObject({ departmentId: dept.id, department: 'Finance', locationId: office.id, location: 'Central / HQ', assigneeId: null, assignee: '' });
    expect(res.body).not.toHaveProperty('user');

    await officer.put(`/api/departments/${dept.id}`).send({ name: 'Finance Department' }).expect(200);
    const list = await officer.get('/api/hardware').expect(200);
    expect(list.body[0].department).toBe('Finance Department');

    await officer.post('/api/hardware').send({ id: 'HW-2', assetName: 'X', departmentId: 9999 }).expect(400);
    await officer.delete(`/api/departments/${dept.id}`).expect(200);
    const archived = await officer.post('/api/hardware').send({ id: 'HW-2', assetName: 'X', departmentId: dept.id }).expect(400);
    expect(archived.body.fields[0].field).toBe('departmentId');
    // An asset keeps its archived department when edited for something else, and can clear it.
    await officer.put('/api/hardware/HW-1').send({ departmentId: dept.id, condition: 'Slow' }).expect(200);
    const cleared = await officer.put('/api/hardware/HW-1').send({ departmentId: null }).expect(200);
    expect(cleared.body.department).toBe('');
  });

  it('the edit form cannot change the assignee; only check-out and check-in can', async () => {
    const officer = await agentFor('IT Officer');
    const jane = await created(officer.post('/api/staff').send({ fullName: 'Jane Doe' }));
    const bob = await created(officer.post('/api/staff').send({ fullName: 'Bob Roe' }));
    await officer.post('/api/hardware').send({ id: 'HW-1', assetName: 'Laptop' }).expect(201);
    await officer.post('/api/hardware/HW-1/checkout').send({ staffId: jane.id }).expect(201);
    const edited = await officer.put('/api/hardware/HW-1').send({ assigneeId: bob.id, assignee: 'Bob Roe', condition: 'OK' }).expect(200);
    expect(edited.body).toMatchObject({ assigneeId: jane.id, assignee: 'Jane Doe', condition: 'OK' });
    const assignments = await officer.get('/api/hardware/HW-1/assignments').expect(200);
    expect(assignments.body).toMatchObject([{ staffId: jane.id, assignee: 'Jane Doe', open: true }]);
  });

  it('the history shows names next to the ids, and software has a department too', async () => {
    const officer = await agentFor('IT Officer');
    const a = await created(officer.post('/api/departments').send({ name: 'Finance' }));
    const b = await created(officer.post('/api/departments').send({ name: 'Audit' }));
    await officer.post('/api/hardware').send({ id: 'HW-1', assetName: 'Laptop', departmentId: a.id }).expect(201);
    await officer.put('/api/hardware/HW-1').send({ departmentId: b.id }).expect(200);
    const history = await officer.get('/api/hardware/HW-1/history').expect(200);
    expect(history.body[1].before.department).toBe('Finance');
    expect(history.body[1].after.department).toBe('Audit');

    const sw = await officer.post('/api/software').send({ id: 'SW-1', name: 'Office', category: 'Office', departmentId: a.id }).expect(201);
    expect(sw.body).toMatchObject({ departmentId: a.id, department: 'Finance' });
    await officer.post('/api/software').send({ id: 'SW-2', name: 'X', category: 'Office', departmentId: 9999 }).expect(400);
  });
});

describe('migration 0004 and the legacy import', () => {
  it('turns the free-text department, location and assignee into records', () => {
    // Build a database at migration 0003 (text fields), then apply 0004.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urc-mig-'));
    try {
      const src = path.join(process.cwd(), 'drizzle');
      fs.mkdirSync(path.join(tmp, 'meta'));
      const journal = JSON.parse(fs.readFileSync(path.join(src, 'meta', '_journal.json'), 'utf8'));
      const old = journal.entries.slice(0, 4);
      for (const e of old) fs.copyFileSync(path.join(src, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));
      fs.writeFileSync(path.join(tmp, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: old }));

      const sqlite = new Database(':memory:');
      const legacy = drizzle(sqlite);
      migrate(legacy, { migrationsFolder: tmp });
      const rows = [
        ['HW-1', 'Deployed', 'Finance', 'HEAD OFFICE', 'Jane Doe'],
        ['HW-2', 'Deployed', ' finance ', 'Head Office', 'jane doe '],
        ['HW-3', 'In Stock', '', '', 'Unassigned'],
        ['HW-4', 'In Repair', 'Audit', 'Jinja', 'Bob Roe'],
      ] as const;
      const insert = sqlite.prepare('INSERT INTO hardware (id, asset_name, lifecycle_state, department, location, assigned_to) VALUES (?, ?, ?, ?, ?, ?)');
      for (const [id, state, dept, loc, user] of rows) insert.run(id, 'Asset', state, dept, loc, user);
      sqlite.prepare("INSERT INTO software (id, name, category, department) VALUES ('SW-1', 'Office', 'Office', 'Legal')").run();
      // A past check-out by someone who no longer holds anything still becomes a staff record.
      sqlite.prepare("INSERT INTO asset_assignments (hardware_id, assignee, checked_out_by, checked_in_at) VALUES ('HW-3', 'Old Holder', 'x', '2026-01-01')").run();
      // Open rows for the two Deployed assets, as migration 0003 would have made.
      sqlite.prepare("INSERT INTO asset_assignments (hardware_id, assignee, checked_out_by) SELECT id, assigned_to, 'system' FROM hardware WHERE lifecycle_state = 'Deployed'").run();

      migrate(legacy, { migrationsFolder: src });
      const all = (q: string) => sqlite.prepare(q).all();
      expect(all('SELECT id, name FROM departments ORDER BY id')).toEqual([{ id: 1, name: 'Audit' }, { id: 2, name: 'Finance' }, { id: 3, name: 'Legal' }]);
      expect(all('SELECT name, parent_id AS parent FROM locations ORDER BY id')).toEqual([{ name: 'HEAD OFFICE', parent: null }, { name: 'Jinja', parent: null }]);
      expect(all('SELECT id, full_name AS name, department_id AS dept FROM staff ORDER BY id')).toEqual([
        { id: 1, name: 'Bob Roe', dept: 1 },
        { id: 2, name: 'Jane Doe', dept: 2 },
        { id: 3, name: 'Old Holder', dept: null },
      ]);
      expect(all('SELECT id, department_id AS d, location_id AS l, assignee_id AS a FROM hardware ORDER BY id')).toEqual([
        { id: 'HW-1', d: 2, l: 1, a: 2 },
        { id: 'HW-2', d: 2, l: 1, a: 2 },
        { id: 'HW-3', d: null, l: null, a: null },
        { id: 'HW-4', d: 1, l: 2, a: 1 },
      ]);
      expect(all('SELECT department_id AS d FROM software')).toEqual([{ d: 3 }]);
      // Every assignment points at its staff record, and the In Repair asset got its open row.
      expect(all('SELECT hardware_id AS h, staff_id AS s, checked_in_at IS NULL AS open FROM asset_assignments ORDER BY hardware_id, id')).toEqual([
        { h: 'HW-1', s: 2, open: 1 },
        { h: 'HW-2', s: 2, open: 1 },
        { h: 'HW-3', s: 3, open: 0 },
        { h: 'HW-4', s: 1, open: 1 },
      ]);
      const columns = all("SELECT name FROM pragma_table_info('hardware')").map(c => (c as { name: string }).name);
      expect(columns).not.toContain('department');
      expect(columns).not.toContain('location');
      expect(columns).not.toContain('assigned_to');
      const note = sqlite.prepare("SELECT details FROM audit_log WHERE action = 'Migrate Directory'").get() as { details: string };
      expect(note.details).toBe('Created 3 departments, 2 locations and 3 staff records from the existing text fields.');
      sqlite.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('the legacy import matches names to records the same way, creating missing ones', async () => {
    importLegacy(db, {
      hardware: [
        { id: 'HW-1', assetName: 'A', department: 'Finance', location: 'HEAD OFFICE', user: 'Jane Doe', status: 'In Use' },
        { id: 'HW-2', assetName: 'B', department: 'FINANCE', location: 'head office', user: 'N/A', status: 'OK' },
        { id: 'HW-3', assetName: 'C', department: 'Audit', user: 'Unassigned', status: 'OK' },
      ],
      software: [{ id: 'SW-1', name: 'Office', category: 'Office', department: 'finance' }],
    });
    const officer = await agentFor('IT Officer');
    const deps = await officer.get('/api/departments').expect(200);
    expect(deps.body.map((d: { name: string; assetCount: number }) => [d.name, d.assetCount])).toEqual([['Audit', 1], ['Finance', 2]]);
    const people = await officer.get('/api/staff').expect(200);
    expect(people.body).toMatchObject([{ fullName: 'Jane Doe', department: 'Finance', assetCount: 1 }]);
    const hw = await officer.get('/api/hardware').expect(200);
    expect(hw.body.map((h: { location: string; assignee: string; lifecycleState: string }) => [h.location, h.assignee, h.lifecycleState])).toEqual([
      ['HEAD OFFICE', 'Jane Doe', 'Deployed'],
      ['HEAD OFFICE', '', 'In Stock'],
      ['', '', 'In Stock'],
    ]);
    // The imported Deployed asset has its open check-out, so it can be checked in.
    await officer.post('/api/hardware/HW-1/checkin').send({}).expect(200);
    const sw = await officer.get('/api/software').expect(200);
    expect(sw.body[0].department).toBe('Finance');
  });
});
