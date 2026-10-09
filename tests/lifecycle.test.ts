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
import { legacyStatusToLifecycle } from '../server/services/lifecycle';
import { importLegacy } from '../scripts/import-json';
import { staff, type Role } from '../server/db/schema';

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

/** A staff record to check assets out to (one per name per test). */
const people = new Map<string, number>();
beforeEach(() => people.clear());
function person(fullName: string) {
  if (!people.has(fullName)) people.set(fullName, db.insert(staff).values({ fullName }).returning().get().id);
  return people.get(fullName)!;
}

const ID = 'HW-L-001';
const move = (agent: request.Agent, to: string, note?: string) => agent.post(`/api/hardware/${ID}/lifecycle`).send({ to, note });

describe('hardware lifecycle', () => {
  it('new assets start In Stock unless another starting state is given, and never Disposed', async () => {
    const officer = await agentFor('IT Officer');
    const created = await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    expect(created.body.lifecycleState).toBe('In Stock');
    expect(created.body.lifecycleChangedAt).toBeTruthy();
    expect(created.body.condition).toBe('');
    // Starting Deployed with nobody named records a shared device; it still gets an open check-out.
    const shared = await officer.post('/api/hardware').send({ id: 'HW-L-005', assetName: 'Switch', lifecycleState: 'Deployed' }).expect(201);
    expect(shared.body).toMatchObject({ lifecycleState: 'Deployed', assigneeId: null, assignee: '' });
    const sharedRows = await officer.get('/api/hardware/HW-L-005/assignments').expect(200);
    expect(sharedRows.body).toMatchObject([{ staffId: null, assignee: '', open: true }]);
    const deployed = await officer.post('/api/hardware').send({ id: 'HW-L-002', assetName: 'Desktop', lifecycleState: 'Deployed', assigneeId: person('Jane') }).expect(201);
    expect(deployed.body.lifecycleState).toBe('Deployed');
    expect(deployed.body.assignee).toBe('Jane');
    await officer.post('/api/hardware').send({ id: 'HW-L-004', assetName: 'Y', assigneeId: person('Jane') }).expect(400);
    await officer.post('/api/hardware').send({ id: 'HW-L-003', assetName: 'X', lifecycleState: 'Disposed' }).expect(400);
  });

  it('allows valid moves and rejects the rest with the allowed options', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    const out = await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane') }).expect(201);
    expect(out.body.lifecycleState).toBe('Deployed');
    await move(officer, 'In Repair').expect(200);
    const same = await move(officer, 'In Repair').expect(409);
    expect(same.body.error).toMatch(/Allowed: In Stock, Retired/);
    const noDeploy = await move(officer, 'Deployed').expect(409);
    expect(noDeploy.body.error).toMatch(/Check out an asset to deploy it/);
    await move(officer, 'Disposed').expect(403); // officer lacks assets:dispose, checked before the transition rule
    await move(officer, 'Unknown').expect(400);
  });

  it('a state change through the edit form is ignored', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    const res = await officer.put(`/api/hardware/${ID}`).send({ lifecycleState: 'Retired', condition: 'Slow' }).expect(200);
    expect(res.body.lifecycleState).toBe('In Stock');
    expect(res.body.condition).toBe('Slow');
  });

  it('needs a reason to retire or dispose, and only Admin or Manager can dispose', async () => {
    const officer = await agentFor('IT Officer');
    const manager = await agentFor('Manager');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    const noNote = await move(officer, 'Retired').expect(400);
    expect(noNote.body.fields[0].field).toBe('note');
    await move(officer, 'Retired', 'Beyond economic repair').expect(200);
    await move(officer, 'Disposed', 'BoS 2026/14').expect(403);
    await move(manager, 'In Stock').expect(403); // Manager cannot do hands-on moves
    await move(manager, 'Disposed').expect(400);
    const disposed = await move(manager, 'Disposed', 'BoS 2026/14').expect(200);
    expect(disposed.body.lifecycleState).toBe('Disposed');
  });

  it('disposed assets are final and read-only', async () => {
    const officer = await agentFor('IT Officer');
    const admin = await agentFor('Admin');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    await move(officer, 'Retired', 'Old').expect(200);
    await move(admin, 'Disposed', 'Auctioned').expect(200);
    const back = await move(admin, 'In Stock').expect(409);
    expect(back.body.error).toMatch(/Disposed is final/);
    await officer.put(`/api/hardware/${ID}`).send({ condition: 'x' }).expect(409);
  });

  it('Auditor cannot change states', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    const auditor = await agentFor('Auditor');
    await move(auditor, 'Deployed').expect(403);
  });

  it('records each move in the audit log and the per-asset history', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    await officer.post('/api/hardware').send({ id: 'HW-OTHER', assetName: 'Other' }).expect(201);
    await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane') }).expect(201);
    await move(officer, 'Retired', 'Cracked screen').expect(200);
    const auditor = await agentFor('Auditor');
    const history = await auditor.get(`/api/hardware/${ID}/history`).expect(200);
    expect(history.body.map((e: { action: string }) => e.action)).toEqual(['Create Hardware', 'Check Out', 'Lifecycle Change']);
    const last = history.body[2];
    expect(last.user).toBe('it.officer');
    expect(last.before).toEqual({ lifecycleState: 'Deployed' });
    expect(last.after).toEqual({ lifecycleState: 'Retired', note: 'Cracked screen' });
    expect(last.details).toMatch(/Deployed → Retired\. Note: Cracked screen/);
    await auditor.get('/api/hardware/NOPE/history').expect(404);
  });
});

describe('check-out / check-in', () => {
  it('checks an asset out, and rejects a second check-out until it is checked in', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    const out = await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane Doe'), dueBack: '2026-12-01', notes: 'For fieldwork' }).expect(201);
    expect(out.body.lifecycleState).toBe('Deployed');
    expect(out.body.assignee).toBe('Jane Doe');

    const again = await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Someone Else') }).expect(409);
    expect(again.body.error).toMatch(/Cannot check out an asset that is Deployed/);

    await officer.post(`/api/hardware/${ID}/checkout`).send({}).expect(400);

    const assignments = await officer.get(`/api/hardware/${ID}/assignments`).expect(200);
    expect(assignments.body).toHaveLength(1);
    expect(assignments.body[0]).toMatchObject({ assignee: 'Jane Doe', dueBack: '2026-12-01', open: true, checkedInAt: null });
  });

  it('checks an asset back in, returning it to In Stock and clearing the assignee', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane Doe') }).expect(201);

    const noOpen = await officer.post('/api/hardware/HW-NOPE/checkin').send({}).expect(404);
    expect(noOpen.body.error).toMatch(/not found/);

    const back = await officer.post(`/api/hardware/${ID}/checkin`).send({ notes: 'Returned in good condition' }).expect(200);
    expect(back.body.lifecycleState).toBe('In Stock');
    expect(back.body.assignee).toBe('');
    expect(back.body.assigneeId).toBeNull();

    const again = await officer.post(`/api/hardware/${ID}/checkin`).send({}).expect(409);
    expect(again.body.error).toMatch(/Cannot check in an asset that is In Stock/);

    const assignments = await officer.get(`/api/hardware/${ID}/assignments`).expect(200);
    expect(assignments.body[0]).toMatchObject({ assignee: 'Jane Doe', open: false });
    expect(assignments.body[0].checkedInBy).toBe('it.officer');
    expect(assignments.body[0].notes).toMatch(/Returned in good condition/);
  });

  it('checking in an asset sent for repair keeps it In Repair but releases the assignee', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane Doe') }).expect(201);
    await move(officer, 'In Repair').expect(200);

    const back = await officer.post(`/api/hardware/${ID}/checkin`).send({}).expect(200);
    expect(back.body.lifecycleState).toBe('In Repair');
    expect(back.body.assignee).toBe('');
    expect(back.body.assigneeId).toBeNull();
  });

  it('cannot check out an asset that is Deployed, Retired or Disposed', async () => {
    const officer = await agentFor('IT Officer');
    const manager = await agentFor('Manager');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane Doe') }).expect(201);
    const deployed = await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Bob') }).expect(409);
    expect(deployed.body.error).toMatch(/Cannot check out an asset that is Deployed/);

    await move(officer, 'Retired', 'Old').expect(200);
    const retired = await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Bob') }).expect(409);
    expect(retired.body.error).toMatch(/Cannot check out an asset that is Retired/);

    await move(manager, 'Disposed', 'BoS 2026/14').expect(200);
    const disposed = await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Bob') }).expect(409);
    expect(disposed.body.error).toMatch(/Cannot check out an asset that is Disposed/);
  });

  it('a lifecycle move that returns an asset to stock or retires it closes the open check-out', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane Doe') }).expect(201);
    await move(officer, 'In Repair').expect(200);
    const back = await move(officer, 'In Stock').expect(200);
    expect(back.body.assignee).toBe('');
    expect(back.body.assigneeId).toBeNull();

    const assignments = await officer.get(`/api/hardware/${ID}/assignments`).expect(200);
    expect(assignments.body[0]).toMatchObject({ open: false });
    expect(assignments.body[0].notes).toMatch(/Closed by a move to In Stock/);
  });

  it('deploys a shared device with no individual assignee, and checks it back in', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Core switch' }).expect(201);
    await officer.post(`/api/hardware/${ID}/checkout`).send({}).expect(400); // the choice must be explicit
    const out = await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: null }).expect(201);
    expect(out.body).toMatchObject({ lifecycleState: 'Deployed', assigneeId: null, assignee: '' });
    const back = await officer.post(`/api/hardware/${ID}/checkin`).send({}).expect(200);
    expect(back.body.lifecycleState).toBe('In Stock');
    const history = await officer.get(`/api/hardware/${ID}/history`).expect(200);
    expect(history.body.map((e: { details: string }) => e.details).join(' ')).toMatch(/deployed as a shared device.*checked in \(shared device\)/);
  });

  it('Auditor and Manager cannot check an asset out or in', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    const auditor = await agentFor('Auditor');
    await auditor.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane Doe') }).expect(403);
    await officer.post(`/api/hardware/${ID}/checkout`).send({ staffId: person('Jane Doe') }).expect(201);
    const manager = await agentFor('Manager');
    await manager.post(`/api/hardware/${ID}/checkin`).send({}).expect(403);
  });

  it('a new asset created already Deployed opens an assignment too', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop', lifecycleState: 'Deployed', assigneeId: person('Jane Doe') }).expect(201);
    const assignments = await officer.get(`/api/hardware/${ID}/assignments`).expect(200);
    expect(assignments.body).toMatchObject([{ assignee: 'Jane Doe', open: true }]);
  });
});

describe('legacy status mapping', () => {
  it('turns lifecycle words into states and keeps other text as the condition', () => {
    expect(legacyStatusToLifecycle('In Use', '')).toEqual({ lifecycleState: 'Deployed', condition: '' });
    expect(legacyStatusToLifecycle(' maintenance ', 'X')).toEqual({ lifecycleState: 'In Repair', condition: '' });
    expect(legacyStatusToLifecycle('To be disposed', 'Jane')).toEqual({ lifecycleState: 'Deployed', condition: 'To be disposed' });
    expect(legacyStatusToLifecycle('OK', 'Unassigned')).toEqual({ lifecycleState: 'In Stock', condition: 'OK' });
    expect(legacyStatusToLifecycle(undefined, undefined)).toEqual({ lifecycleState: 'In Stock', condition: '' });
  });

  it('legacy import uses the same mapping, and "N/A" users count as unassigned', () => {
    importLegacy(db, {
      hardware: [
        { id: 'HW-1', assetName: 'A', user: 'Someone', status: 'OK' },
        { id: 'HW-2', assetName: 'B', user: 'N/A', status: 'Faulty' },
        { id: 'HW-3', assetName: 'C', status: 'Retired' },
        { id: 'HW-4', assetName: 'D', lifecycleState: 'Disposed', condition: 'Written off' },
      ],
    });
    const rows = db.$client.prepare('SELECT id, lifecycle_state AS s, condition AS c FROM hardware ORDER BY id').all();
    expect(rows).toEqual([
      { id: 'HW-1', s: 'Deployed', c: 'OK' },
      { id: 'HW-2', s: 'In Stock', c: 'Faulty' },
      { id: 'HW-3', s: 'Retired', c: '' },
      { id: 'HW-4', s: 'Disposed', c: 'Written off' },
    ]);
  });

  it('migration 0002 converts an existing database the same way', () => {
    // Build a database at migration 0001 (the old free-text status), then apply the rest.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urc-mig-'));
    try {
      const src = path.join(process.cwd(), 'drizzle');
      fs.mkdirSync(path.join(tmp, 'meta'));
      const journal = JSON.parse(fs.readFileSync(path.join(src, 'meta', '_journal.json'), 'utf8'));
      const old = journal.entries.slice(0, 2);
      for (const e of old) fs.copyFileSync(path.join(src, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));
      fs.writeFileSync(path.join(tmp, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: old }));

      const sqlite = new Database(':memory:');
      const legacy = drizzle(sqlite);
      migrate(legacy, { migrationsFolder: tmp });
      const legacyRows = [
        ['HW-1', 'In Use', 'Unassigned'],
        ['HW-2', 'To be disposed', 'Jane'],
        ['HW-3', 'Faulty', 'Unassigned'],
        ['HW-4', 'Maintenance', 'Jane'],
        ['HW-5', ' retired ', ''],
      ] as const;
      const insert = sqlite.prepare('INSERT INTO hardware (id, asset_name, status, assigned_to) VALUES (?, ?, ?, ?)');
      for (const [id, status, user] of legacyRows) insert.run(id, 'Asset', status, user);

      migrate(legacy, { migrationsFolder: src });
      const rows = sqlite.prepare('SELECT id, lifecycle_state AS s, condition AS c FROM hardware ORDER BY id').all();
      expect(rows).toEqual([
        { id: 'HW-1', s: 'Deployed', c: '' },
        { id: 'HW-2', s: 'Deployed', c: 'To be disposed' },
        { id: 'HW-3', s: 'In Stock', c: 'Faulty' },
        { id: 'HW-4', s: 'In Repair', c: '' },
        { id: 'HW-5', s: 'Retired', c: '' },
      ]);
      // The SQL rules and legacyStatusToLifecycle() must agree.
      expect(rows).toEqual(
        legacyRows.map(([id, status, user]) => {
          const m = legacyStatusToLifecycle(status, user);
          return { id, s: m.lifecycleState, c: m.condition };
        }),
      );
      const columns = sqlite.prepare("SELECT name FROM pragma_table_info('hardware')").all().map(c => (c as { name: string }).name);
      expect(columns).not.toContain('status');
      const note = sqlite.prepare("SELECT details FROM audit_log WHERE action = 'Migrate Lifecycle'").get() as { details: string };
      expect(note.details).toMatch(/5 records/);
      sqlite.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('migration 0003 opens an assignment for every asset that is already Deployed', () => {
    // Build a database at migration 0002 (lifecycle states, no assignments table yet), then apply 0003.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urc-mig-'));
    try {
      const src = path.join(process.cwd(), 'drizzle');
      fs.mkdirSync(path.join(tmp, 'meta'));
      const journal = JSON.parse(fs.readFileSync(path.join(src, 'meta', '_journal.json'), 'utf8'));
      const old = journal.entries.slice(0, 3);
      for (const e of old) fs.copyFileSync(path.join(src, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));
      fs.writeFileSync(path.join(tmp, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: old }));

      const sqlite = new Database(':memory:');
      const legacy = drizzle(sqlite);
      migrate(legacy, { migrationsFolder: tmp });
      const rows = [
        ['HW-1', 'Deployed', 'Jane Doe'],
        ['HW-2', 'Deployed', 'Unassigned'],
        ['HW-3', 'In Stock', 'Unassigned'],
        ['HW-4', 'In Repair', 'Bob'],
      ] as const;
      const insert = sqlite.prepare('INSERT INTO hardware (id, asset_name, lifecycle_state, assigned_to) VALUES (?, ?, ?, ?)');
      for (const [id, state, user] of rows) insert.run(id, 'Asset', state, user);

      // Apply 0003 only (0004 adds more open rows for assets In Repair).
      const upTo3 = journal.entries.slice(0, 4);
      fs.copyFileSync(path.join(src, `${upTo3[3].tag}.sql`), path.join(tmp, `${upTo3[3].tag}.sql`));
      fs.writeFileSync(path.join(tmp, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: upTo3 }));
      migrate(legacy, { migrationsFolder: tmp });
      const assignments = sqlite.prepare('SELECT hardware_id AS id, assignee, checked_out_by AS by, checked_in_at AS closed FROM asset_assignments ORDER BY hardware_id').all();
      expect(assignments).toEqual([{ id: 'HW-1', assignee: 'Jane Doe', by: 'system', closed: null }]);
      const note = sqlite.prepare("SELECT details FROM audit_log WHERE action = 'Migrate Assignments'").get() as { details: string };
      expect(note.details).toMatch(/1 already-deployed assets/);
      sqlite.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
