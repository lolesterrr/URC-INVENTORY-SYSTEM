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

const ID = 'HW-L-001';
const move = (agent: request.Agent, to: string, note?: string) => agent.post(`/api/hardware/${ID}/lifecycle`).send({ to, note });

describe('hardware lifecycle', () => {
  it('new assets start In Stock unless another starting state is given, and never Disposed', async () => {
    const officer = await agentFor('IT Officer');
    const created = await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    expect(created.body.lifecycleState).toBe('In Stock');
    expect(created.body.lifecycleChangedAt).toBeTruthy();
    expect(created.body.condition).toBe('');
    const deployed = await officer.post('/api/hardware').send({ id: 'HW-L-002', assetName: 'Desktop', lifecycleState: 'Deployed' }).expect(201);
    expect(deployed.body.lifecycleState).toBe('Deployed');
    await officer.post('/api/hardware').send({ id: 'HW-L-003', assetName: 'X', lifecycleState: 'Disposed' }).expect(400);
  });

  it('allows valid moves and rejects the rest with the allowed options', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: ID, assetName: 'Laptop' }).expect(201);
    expect((await move(officer, 'Deployed').expect(200)).body.lifecycleState).toBe('Deployed');
    await move(officer, 'In Repair').expect(200);
    const same = await move(officer, 'In Repair').expect(409);
    expect(same.body.error).toMatch(/Allowed: In Stock, Deployed, Retired/);
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
    await move(officer, 'Deployed').expect(200);
    await move(officer, 'Retired', 'Cracked screen').expect(200);
    const auditor = await agentFor('Auditor');
    const history = await auditor.get(`/api/hardware/${ID}/history`).expect(200);
    expect(history.body.map((e: { action: string }) => e.action)).toEqual(['Create Hardware', 'Lifecycle Change', 'Lifecycle Change']);
    const last = history.body[2];
    expect(last.user).toBe('it.officer');
    expect(last.before).toEqual({ lifecycleState: 'Deployed' });
    expect(last.after).toEqual({ lifecycleState: 'Retired', note: 'Cracked screen' });
    expect(last.details).toMatch(/Deployed → Retired\. Note: Cracked screen/);
    await auditor.get('/api/hardware/NOPE/history').expect(404);
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
});
