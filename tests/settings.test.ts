import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDatabase, type DB } from '../server/db';
import { createApp } from '../server/app';
import { createUser } from '../server/services/users';
import type { Role } from '../server/db/schema';
import { loadSettings, unknownCategories, updateSettings } from '../server/services/settings';

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

describe('settings service', () => {
  it('seeds a default row and a complete replacement policy for every hardware category', () => {
    const s = loadSettings(db);
    expect(s.companyName).toBe('Uganda Railways Corporation');
    expect(s.defaultLabelPreset).toBe('24');
    expect(s.replacementPolicy).toEqual({ Laptop: 4, Desktop: 4, Switch: 7, Router: 7, Server: 5, Printer: 6, Other: null });
  });

  it('updates only the fields given, and only the categories given', () => {
    updateSettings(db, { companyName: 'URC IT' });
    expect(loadSettings(db)).toMatchObject({ companyName: 'URC IT', defaultLabelPreset: '24' });

    updateSettings(db, { replacementPolicy: { Laptop: 6, Other: 10 } });
    const after = loadSettings(db);
    expect(after.replacementPolicy).toMatchObject({ Laptop: 6, Other: 10, Desktop: 4 });
  });

  it('flags a replacement-policy key that is not a real hardware category', () => {
    expect(unknownCategories({ Laptop: 4 })).toEqual([]);
    expect(unknownCategories({ Laptop: 4, Phone: 3 })).toEqual(['Phone']);
    expect(unknownCategories(undefined)).toEqual([]);
  });
});

describe('settings through the API', () => {
  it('lets every role read settings, but only Admin change them', async () => {
    const agents: Partial<Record<Role, Awaited<ReturnType<typeof agentFor>>>> = {};
    for (const role of ['Admin', 'IT Officer', 'Manager', 'Auditor'] as Role[]) {
      agents[role] = await agentFor(role);
      await agents[role]!.get('/api/settings').expect(200);
    }
    await agents['IT Officer']!.put('/api/settings').send({ companyName: 'Nope' }).expect(403);

    const res = await agents.Admin!.put('/api/settings').send({ companyName: 'Uganda Railways Corp.' }).expect(200);
    expect(res.body.companyName).toBe('Uganda Railways Corp.');
  });

  it('rejects an unknown replacement-policy category, and a custom label size missing a dimension', async () => {
    const admin = await agentFor('Admin');
    const badCategory = await admin.put('/api/settings').send({ replacementPolicy: { Tablet: 3 } }).expect(400);
    expect(badCategory.body.error).toContain('Tablet');

    const badCustom = await admin.put('/api/settings').send({ defaultLabelPreset: 'custom', defaultLabelWidthMm: 50 }).expect(400);
    expect(badCustom.body.error).toContain('width and a height');

    const ok = await admin.put('/api/settings').send({ defaultLabelPreset: 'custom', defaultLabelWidthMm: 50, defaultLabelHeightMm: 30 }).expect(200);
    expect(ok.body).toMatchObject({ defaultLabelPreset: 'custom', defaultLabelWidthMm: 50, defaultLabelHeightMm: 30 });
  });

  it('records one audit entry per settings change, with before/after values', async () => {
    const admin = await agentFor('Admin');
    await admin.put('/api/settings').send({ companyName: 'URC IT Assets' }).expect(200);
    const history = await admin.get('/api/audit-logs').expect(200);
    const entry = history.body.find((e: { action: string }) => e.action === 'Update Settings');
    expect(entry.before.companyName).toBe('Uganda Railways Corporation');
    expect(entry.after.companyName).toBe('URC IT Assets');
  });

  it('feeds the live replacement policy into the standard reports, not the code default', async () => {
    const admin = await agentFor('Admin');
    db.$client.prepare('INSERT INTO hardware (id, asset_name, category, purchase_date) VALUES (?, ?, ?, ?)').run('HW-1', 'Old Laptop', 'Laptop', '2020');

    // Default policy (4 years for Laptop): an asset from 2020 is overdue by the time this test runs.
    let reports = await admin.get('/api/reports').expect(200);
    expect(reports.body.dueForReplacement.assets[0].policyYears).toBe(4);

    // Raise the laptop policy to 50 years: the same asset now reads as OK, with no code change.
    await admin.put('/api/settings').send({ replacementPolicy: { Laptop: 50 } }).expect(200);
    reports = await admin.get('/api/reports').expect(200);
    expect(reports.body.dueForReplacement.assets[0]).toMatchObject({ policyYears: 50, state: 'ok' });
  });
});
