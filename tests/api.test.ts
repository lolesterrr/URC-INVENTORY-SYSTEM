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

async function agentFor(role: Role, username = role.toLowerCase().replace(' ', '.')) {
  await createUser(db, { username, fullName: `Test ${role}`, role, password: PASSWORD, mustChangePassword: false });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password: PASSWORD }).expect(200);
  return agent;
}

const asset = { id: 'HW-T-001', assetName: 'Desktop Computer', model: 'EliteDesk', serialNumber: 'SN1', status: 'In Use' };

describe('authentication', () => {
  it('rejects API access without a session', async () => {
    await request(app).get('/api/hardware').expect(401);
  });

  it('ignores client-supplied role headers', async () => {
    await request(app).post('/api/hardware').set('x-user-role', 'Admin').send(asset).expect(401);
  });

  it('returns a generic error for a wrong password and an unknown user', async () => {
    await createUser(db, { username: 'alice', fullName: 'A', role: 'Admin', password: PASSWORD, mustChangePassword: false });
    const wrong = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'nope' }).expect(401);
    const unknown = await request(app).post('/api/auth/login').send({ username: 'bob', password: 'nope' }).expect(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('locks the account after 5 failed attempts', async () => {
    await createUser(db, { username: 'alice', fullName: 'A', role: 'Admin', password: PASSWORD, mustChangePassword: false });
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send({ username: 'alice', password: 'bad' });
    await request(app).post('/api/auth/login').send({ username: 'alice', password: PASSWORD }).expect(423);
  });

  it('forces a password change before any other API use', async () => {
    await createUser(db, { username: 'newbie', fullName: 'N', role: 'IT Officer', password: PASSWORD });
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ username: 'newbie', password: PASSWORD }).expect(200);
    expect(login.body.mustChangePassword).toBe(true);
    await agent.get('/api/hardware').expect(403);
    await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'short' }).expect(400);
    await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'An0ther-G00d-One' }).expect(200);
    await agent.get('/api/hardware').expect(200);
  });

  it('sets an httpOnly SameSite=Strict cookie and never returns password hashes', async () => {
    await createUser(db, { username: 'alice', fullName: 'A', role: 'Admin', password: PASSWORD, mustChangePassword: false });
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: PASSWORD }).expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'alice', password: PASSWORD });
    const users = await agent.get('/api/users').expect(200);
    expect(JSON.stringify(users.body)).not.toMatch(/argon2|passwordHash/);
  });

  it('logout ends the session', async () => {
    const agent = await agentFor('Admin');
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/hardware').expect(401);
  });
});

describe('role permissions', () => {
  it('IT Officer can create, edit and archive assets', async () => {
    const agent = await agentFor('IT Officer');
    await agent.post('/api/hardware').send(asset).expect(201);
    const updated = await agent.put(`/api/hardware/${asset.id}`).send({ status: 'Maintenance' }).expect(200);
    expect(updated.body.status).toBe('Maintenance');
    await agent.delete(`/api/hardware/${asset.id}`).expect(200);
    const list = await agent.get('/api/hardware').expect(200);
    expect(list.body).toHaveLength(0);
  });

  it.each(['Manager', 'Auditor'] as Role[])('%s can read but not modify', async role => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send(asset).expect(201);
    const agent = await agentFor(role);
    await agent.get('/api/hardware').expect(200);
    await agent.get('/api/audit-logs').expect(200);
    await agent.post('/api/hardware').send({ ...asset, id: 'HW-T-002' }).expect(403);
    await agent.put(`/api/hardware/${asset.id}`).send({ status: 'Retired' }).expect(403);
    await agent.delete(`/api/hardware/${asset.id}`).expect(403);
  });

  it('only Admin can manage users', async () => {
    const officer = await agentFor('IT Officer');
    await officer.get('/api/users').expect(403);
    const admin = await agentFor('Admin');
    const created = await admin
      .post('/api/users')
      .send({ username: 'm.nakato', fullName: 'Manager', role: 'Manager', temporaryPassword: 'Temp-Passw0rd!' })
      .expect(201);
    expect(created.body.mustChangePassword).toBe(true);
  });

  it('refuses to disable the last active Admin', async () => {
    const admin = await agentFor('Admin');
    const me = await admin.get('/api/auth/me');
    await admin.patch(`/api/users/${me.body.id}`).send({ disabled: true }).expect(400);
  });
});

describe('validation and audit', () => {
  it('rejects invalid input with field errors', async () => {
    const agent = await agentFor('IT Officer');
    const res = await agent.post('/api/hardware').send({ id: 'bad id!', cost: -5 }).expect(400);
    expect(res.body.fields.map((f: { field: string }) => f.field)).toEqual(expect.arrayContaining(['id', 'cost']));
  });

  it('records the real signed-in user with before/after values', async () => {
    const agent = await agentFor('IT Officer', 'tech1');
    await agent.post('/api/hardware').send(asset).expect(201);
    await agent.put(`/api/hardware/${asset.id}`).send({ status: 'Retired' }).expect(200);
    const logs = await agent.get('/api/audit-logs').expect(200);
    const update = logs.body.find((l: { action: string }) => l.action === 'Update Hardware');
    expect(update.user).toBe('tech1');
    expect(update.before.status).toBe('In Use');
    expect(update.after.status).toBe('Retired');
  });

  it('audit log rows cannot be changed or deleted', async () => {
    await agentFor('Admin');
    expect(() => db.$client.prepare('DELETE FROM audit_log').run()).toThrow(/append-only/);
    expect(() => db.$client.prepare("UPDATE audit_log SET username = 'x'").run()).toThrow(/append-only/);
  });
});

describe('legacy import', () => {
  it('imports valid rows, skips duplicates and reports invalid ones', () => {
    const data = {
      hardware: [
        { id: 'HW-1', assetName: 'LAPTOP', model: 'ProBook', user: 'Someone', serialNumber: 'N/A', status: 'OK', yearOfPurchase: '2023', category: 'Laptop' },
        { id: 'bad id!', assetName: 'X' },
      ],
      software: [{ id: 'SW-1', name: 'Office', category: 'Office', seatCapacity: 10, activeSeats: 2, expiryDate: '2030-01-01', subscriptionCost: 5, vendor: 'MS', status: 'Active' }],
    };
    const first = importLegacy(db, data);
    expect(first.hw.imported).toBe(1);
    expect(first.hw.invalid).toHaveLength(1);
    expect(first.sw.imported).toBe(1);
    const second = importLegacy(db, data);
    expect(second.hw.skipped).toBe(1);
  });
});
