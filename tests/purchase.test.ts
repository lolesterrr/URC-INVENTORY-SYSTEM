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
import { runAlertChecks } from '../server/services/alerts';
import { isPurchaseDate, isYearOnly, warrantyStatus, warrantyWhen } from '../shared/purchase';
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

const asset = { id: 'HW-P-001', assetName: 'Desktop Computer', lifecycleState: 'In Stock' };

describe('purchase and warranty rules', () => {
  it('accepts a year or an exact date as a purchase date, and nothing else', () => {
    for (const ok of ['', '2019', '2026', '1999', '2019-03-14', '2026-02-28']) expect(isPurchaseDate(ok)).toBe(true);
    // A day that does not exist, a half-written date, a month on its own, and text are all refused.
    for (const bad of ['2026-02-30', '2026-13-01', '2019-3-4', '2019-03', '19', '12019', 'last year', '2019/03/14']) {
      expect(isPurchaseDate(bad)).toBe(false);
    }
    expect(isYearOnly('2019')).toBe(true);
    expect(isYearOnly('2019-03-14')).toBe(false);
  });

  it('classifies a warranty against the warning window', () => {
    const now = new Date('2026-10-12T09:00:00Z');
    // No date on record is not a problem to report.
    expect(warrantyStatus('', now).state).toBe('none');
    expect(warrantyStatus('2019', now).state).toBe('none');
    expect(warrantyStatus('2027-06-01', now, 90).state).toBe('ok');
    // Exactly on the edge of the window counts as expiring.
    expect(warrantyStatus('2027-01-10', now, 90)).toEqual({ state: 'expiring', days: 90 });
    expect(warrantyStatus('2027-01-11', now, 90).state).toBe('ok');
    expect(warrantyStatus('2026-10-13', now, 90)).toEqual({ state: 'expiring', days: 1 });
    expect(warrantyStatus('2026-10-11', now, 90)).toEqual({ state: 'expired', days: -1 });
    // A shorter window leaves the same date alone.
    expect(warrantyStatus('2027-01-10', now, 30).state).toBe('ok');
    expect(warrantyWhen(1)).toBe('in 1 day');
    expect(warrantyWhen(-2)).toBe('2 days ago');
    expect(warrantyWhen(0)).toBe('today');
  });
});

describe('purchase fields through the API', () => {
  it('stores a year, an exact date, an LPO reference and a supplier', async () => {
    const it0 = await agentFor('IT Officer');
    const created = await it0.post('/api/hardware').send({
      ...asset, purchaseDate: '2019', purchaseCost: 4_500_000, orderNumber: 'URC/LPO/2019/045',
      supplier: 'Kampala Computer Centre', warrantyExpires: '2030-03-14', warrantyNotes: '3-year on-site cover',
    }).expect(201);
    expect(created.body).toMatchObject({
      purchaseDate: '2019', purchaseCost: 4_500_000, orderNumber: 'URC/LPO/2019/045',
      supplier: 'Kampala Computer Centre', warrantyExpires: '2030-03-14', warrantyNotes: '3-year on-site cover',
    });
    const updated = await it0.put(`/api/hardware/${asset.id}`).send({ purchaseDate: '2019-03-14' }).expect(200);
    expect(updated.body.purchaseDate).toBe('2019-03-14');
  });

  it('never invents a purchase date, and leaves an unknown cost null rather than 0', async () => {
    const it0 = await agentFor('IT Officer');
    const created = await it0.post('/api/hardware').send(asset).expect(201);
    expect(created.body.purchaseDate).toBe('');
    expect(created.body.purchaseCost).toBeNull();
    // The old schema stamped the creation date into date_acquired and defaulted the cost to 0.
    expect(created.body).not.toHaveProperty('dateAcquired');
    expect(created.body).not.toHaveProperty('cost');
    // An empty cost box clears the figure instead of recording that nothing was paid.
    const cleared = await it0.put(`/api/hardware/${asset.id}`).send({ purchaseCost: '' }).expect(200);
    expect(cleared.body.purchaseCost).toBeNull();
    const priced = await it0.put(`/api/hardware/${asset.id}`).send({ purchaseCost: 250_000 }).expect(200);
    expect(priced.body.purchaseCost).toBe(250_000);
  });

  it('rejects an unusable purchase date or warranty date', async () => {
    const it0 = await agentFor('IT Officer');
    const bad = await it0.post('/api/hardware').send({ ...asset, purchaseDate: 'last year' }).expect(400);
    expect(bad.body.fields.map((f: { field: string }) => f.field)).toContain('purchaseDate');
    await it0.post('/api/hardware').send({ ...asset, purchaseDate: '2026-02-30' }).expect(400);
    // A warranty needs a definite end date; a bare year is not enough to alert on.
    await it0.post('/api/hardware').send({ ...asset, warrantyExpires: '2030' }).expect(400);
    await it0.post('/api/hardware').send({ ...asset, purchaseCost: -5 }).expect(400);
  });

  it('records purchase changes in the asset history and needs assets:write', async () => {
    const it0 = await agentFor('IT Officer');
    await it0.post('/api/hardware').send(asset).expect(201);
    await it0.put(`/api/hardware/${asset.id}`).send({ purchaseCost: 300_000, orderNumber: 'URC/LPO/2026/007' }).expect(200);
    const history = await it0.get(`/api/hardware/${asset.id}/history`).expect(200);
    const update = history.body.find((e: { action: string }) => e.action === 'Update Hardware');
    expect(update.before).toMatchObject({ purchaseCost: null, orderNumber: '' });
    expect(update.after).toMatchObject({ purchaseCost: 300_000, orderNumber: 'URC/LPO/2026/007' });

    // The Manager is finance-facing but still read-only: purchase fields need assets:write.
    const manager = await agentFor('Manager');
    await manager.put(`/api/hardware/${asset.id}`).send({ purchaseCost: 1 }).expect(403);
  });
});

describe('warranty expiry alerts', () => {
  const now = new Date('2026-10-12T09:00:00Z');

  /** Inserts an asset straight into the table so a lifecycle state can be set freely. */
  const add = (id: string, warrantyExpires: string, lifecycleState = 'In Stock') =>
    db.$client
      .prepare('INSERT INTO hardware (id, asset_name, lifecycle_state, warranty_expires) VALUES (?, ?, ?, ?)')
      .run(id, `Asset ${id}`, lifecycleState, warrantyExpires);

  const openAlerts = () =>
    db.$client.prepare("SELECT item_id AS id, title, message FROM alerts WHERE type = 'warranty_expiry' ORDER BY item_id").all() as
      { id: string; title: string; message: string }[];

  it('reports warranties that have ended or are about to, and nothing else', () => {
    add('HW-1', '2026-12-01'); // 50 days away: inside the 90-day window
    add('HW-2', '2026-09-01'); // already over
    add('HW-3', '2028-01-01'); // far off
    add('HW-4', ''); // nothing on record
    runAlertChecks(db, { now, warrantyWarningDays: 90 });
    const found = openAlerts();
    expect(found.map(a => a.id)).toEqual(['HW-1', 'HW-2']);
    expect(found[0].title).toBe('Warranty ending: Asset HW-1');
    expect(found[0].message).toContain('ends on 2026-12-01, in 50 days');
    expect(found[1].title).toBe('Warranty expired: Asset HW-2');
    expect(found[1].message).toContain('ended on 2026-09-01, 41 days ago');
    // Serial numbers and staff names are internal data; alert text carries the asset name and id only.
    expect(found.map(a => a.message).join(' ')).not.toMatch(/serial/i);
  });

  it('ignores assets that are out of service', () => {
    add('HW-5', '2026-09-01', 'Retired');
    add('HW-6', '2026-09-01', 'Disposed');
    add('HW-7', '2026-09-01', 'In Repair');
    runAlertChecks(db, { now });
    expect(openAlerts().map(a => a.id)).toEqual(['HW-7']);
  });

  it('honours the configured window and does not duplicate an open alert', () => {
    add('HW-8', '2026-12-01');
    expect(runAlertChecks(db, { now, warrantyWarningDays: 30 })).toBe(0);
    expect(runAlertChecks(db, { now, warrantyWarningDays: 120 })).toBe(1);
    expect(runAlertChecks(db, { now, warrantyWarningDays: 120 })).toBe(0);
    expect(openAlerts()).toHaveLength(1);
  });

  it('shows the window and the warranty count in the dashboard figures', async () => {
    const admin = await agentFor('Admin');
    const custom = createApp(db, { idleMs: 60_000, maxMs: 3_600_000, secureCookie: false, production: false, loginRateLimit: 1000, warrantyWarningDays: 45 });
    add('HW-9', '2026-11-01');
    runAlertChecks(db, { now, warrantyWarningDays: 45 });
    const stats = await admin.get('/api/analytics').expect(200);
    expect(stats.body.expiringWarrantiesCount).toBe(1);
    expect(stats.body.warrantyWarningDays).toBe(90);
    // The configured window reaches the UI through the same figures.
    const agent = request.agent(custom);
    await agent.post('/api/auth/login').send({ username: 'admin', password: PASSWORD }).expect(200);
    expect((await agent.get('/api/analytics').expect(200)).body.warrantyWarningDays).toBe(45);
  });
});

describe('hardware valuation', () => {
  it('reports no valuation until a cost is recorded, then says how many assets it covers', async () => {
    const it0 = await agentFor('IT Officer');
    await it0.post('/api/hardware').send(asset).expect(201);
    await it0.post('/api/hardware').send({ ...asset, id: 'HW-P-002' }).expect(201);
    // Two assets, neither priced: null, not "UGX 0".
    let stats = await it0.get('/api/analytics').expect(200);
    expect(stats.body).toMatchObject({ totalHardwareCount: 2, totalHardwareValue: null, costedHardwareCount: 0 });

    await it0.put(`/api/hardware/${asset.id}`).send({ purchaseCost: 1_200_000 }).expect(200);
    stats = await it0.get('/api/analytics').expect(200);
    expect(stats.body).toMatchObject({ totalHardwareCount: 2, totalHardwareValue: 1_200_000, costedHardwareCount: 1 });
  });
});

describe('migration 0005 and the legacy import', () => {
  it('carries the purchase year over and drops the invented date-acquired column', () => {
    // Build a database at migration 0004, then apply 0005.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urc-mig5-'));
    try {
      const src = path.join(process.cwd(), 'drizzle');
      fs.mkdirSync(path.join(tmp, 'meta'));
      const journal = JSON.parse(fs.readFileSync(path.join(src, 'meta', '_journal.json'), 'utf8'));
      const old = journal.entries.slice(0, 5);
      for (const e of old) fs.copyFileSync(path.join(src, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));
      fs.writeFileSync(path.join(tmp, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries: old }));

      const sqlite = new Database(':memory:');
      const legacy = drizzle(sqlite);
      migrate(legacy, { migrationsFolder: tmp });
      const rows = [
        ['HW-1', '2019', '2026-10-09', 0],
        ['HW-2', '', '2026-10-09', 1_500_000],
        ['HW-3', 'unknown', '', 0],
        ['HW-4', '2026', '2026-01-01', 0],
      ] as const;
      const insert = sqlite.prepare('INSERT INTO hardware (id, asset_name, year_of_purchase, date_acquired, cost) VALUES (?, ?, ?, ?, ?)');
      for (const [id, year, acquired, cost] of rows) insert.run(id, 'Asset', year, acquired, cost);

      migrate(legacy, { migrationsFolder: src });
      const all = (q: string) => sqlite.prepare(q).all();
      expect(all('SELECT id, purchase_date AS d, purchase_cost AS c FROM hardware ORDER BY id')).toEqual([
        { id: 'HW-1', d: '2019', c: null },
        { id: 'HW-2', d: '', c: 1_500_000 },
        // Text that is not a year is left empty rather than guessed at.
        { id: 'HW-3', d: '', c: null },
        { id: 'HW-4', d: '2026', c: null },
      ]);
      const columns = all("SELECT name FROM pragma_table_info('hardware')").map(c => (c as { name: string }).name);
      expect(columns).not.toContain('year_of_purchase');
      expect(columns).not.toContain('date_acquired');
      expect(columns).not.toContain('cost');
      expect(columns).toEqual(expect.arrayContaining(['purchase_date', 'purchase_cost', 'order_number', 'supplier', 'warranty_expires', 'warranty_notes']));
      const note = sqlite.prepare("SELECT details FROM audit_log WHERE action = 'Migrate Purchase Fields'").get() as { details: string };
      expect(note.details).toContain('Carried over 2 purchase year(s) and 1 purchase cost(s)');
      sqlite.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('imports the legacy purchase year and ignores the old made-up costs', () => {
    const result = importLegacy(db, {
      hardware: [
        { id: 'HW-1', assetName: 'Laptop', yearOfPurchase: '2019', status: 'OK', user: 'Unassigned' },
        { id: 'HW-2', assetName: 'Printer', yearOfPurchase: '', cost: 999_999, status: 'OK' },
      ],
    });
    expect(result.hw.imported).toBe(2);
    const stored = db.$client.prepare('SELECT id, purchase_date AS d, purchase_cost AS c FROM hardware ORDER BY id').all();
    // The old form pre-filled invented costs, so a legacy cost is not imported at all.
    expect(stored).toEqual([{ id: 'HW-1', d: '2019', c: null }, { id: 'HW-2', d: '', c: null }]);
  });
});
