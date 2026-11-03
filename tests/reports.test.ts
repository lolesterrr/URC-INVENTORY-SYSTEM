import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDatabase, type DB } from '../server/db';
import { createApp } from '../server/app';
import { createUser } from '../server/services/users';
import type { Role } from '../server/db/schema';
import {
  ageBucket, ageInYears, estimatedAcquisitionDate, isOverCapacity, licenceExpiryStatus, replacementStatus,
} from '../shared/reports';
import { buildReports } from '../server/services/reports';

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

describe('shared report rules', () => {
  const now = new Date('2026-11-03T00:00:00Z');

  it('reads a year-only purchase date as 1 July of that year, and an exact date as itself', () => {
    expect(estimatedAcquisitionDate('2020')).toEqual(new Date(Date.UTC(2020, 6, 1)));
    expect(estimatedAcquisitionDate('2020-03-14')).toEqual(new Date('2020-03-14T00:00:00Z'));
    expect(estimatedAcquisitionDate('')).toBeNull();
    expect(estimatedAcquisitionDate('not a date')).toBeNull();
  });

  it('computes age in whole years from the mid-year estimate', () => {
    // 2020 -> 1 Jul 2020; by 3 Nov 2026 that is just over 6 years.
    expect(ageInYears('2020', now)).toBe(6);
    expect(ageInYears('2026-11-01', now)).toBe(0);
    expect(ageInYears('', now)).toBeNull();
  });

  it('buckets ages, with unknown as its own bucket', () => {
    expect(ageBucket(0)).toBe('Under 1 year');
    expect(ageBucket(1.5)).toBe('1–2 years');
    expect(ageBucket(3)).toBe('2–4 years');
    expect(ageBucket(5)).toBe('4–6 years');
    expect(ageBucket(9)).toBe('6+ years');
    expect(ageBucket(null)).toBe('Unknown');
  });

  it('classifies replacement status against the per-category policy', () => {
    // Laptop, policy 4 years: bought mid-2020 is ~6.4 years old by Nov 2026 -> overdue.
    expect(replacementStatus('Laptop', '2020', now).state).toBe('overdue');
    // Bought mid-2023: ~3.4 years old, due date mid-2027, under a year away -> due soon.
    expect(replacementStatus('Laptop', '2023', now).state).toBe('due_soon');
    // Bought mid-2025: just over a year old, due mid-2029 -> ok.
    expect(replacementStatus('Laptop', '2025', now).state).toBe('ok');
    // "Other" has no default policy.
    expect(replacementStatus('Other', '2020', now)).toMatchObject({ state: 'no_policy', policyYears: null });
    // A policy exists but the date is unusable.
    expect(replacementStatus('Laptop', '', now)).toMatchObject({ state: 'unknown', policyYears: 4 });
  });

  it('classifies a licence expiry date the same way warranties are classified', () => {
    expect(licenceExpiryStatus('', now).state).toBe('none');
    expect(licenceExpiryStatus('2026-11-20', now, 30).state).toBe('expiring');
    expect(licenceExpiryStatus('2026-10-01', now, 30).state).toBe('expired');
    expect(licenceExpiryStatus('2028-01-01', now, 30).state).toBe('ok');
  });

  it('flags over-capacity only when capacity is actually tracked', () => {
    expect(isOverCapacity(10, 12)).toBe(true);
    expect(isOverCapacity(10, 10)).toBe(false);
    // 0 capacity means "not tracked", not "zero seats allowed".
    expect(isOverCapacity(0, 5)).toBe(false);
  });
});

describe('reports computed from the register', () => {
  const now = new Date('2026-11-03T00:00:00Z');

  const addAsset = (id: string, fields: { category?: string; departmentId?: number | null; purchaseDate?: string; purchaseCost?: number | null }) => {
    db.$client
      .prepare('INSERT INTO hardware (id, asset_name, category, department_id, purchase_date, purchase_cost) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, `Asset ${id}`, fields.category ?? 'Laptop', fields.departmentId ?? null, fields.purchaseDate ?? '', fields.purchaseCost ?? null);
  };

  const addSoftware = (id: string, fields: { seatCapacity?: number; activeSeats?: number; expiryDate?: string }) => {
    db.$client
      .prepare('INSERT INTO software (id, name, category, seat_capacity, active_seats, expiry_date) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, `Licence ${id}`, 'Office', fields.seatCapacity ?? 0, fields.activeSeats ?? 0, fields.expiryDate ?? '');
  };

  it('groups hardware by department and reports what the valuation covers', () => {
    const deptId = db.$client.prepare('INSERT INTO departments (name) VALUES (?)').run('IT').lastInsertRowid as number;
    addAsset('HW-1', { departmentId: deptId, purchaseCost: 1_000_000 });
    addAsset('HW-2', { departmentId: deptId, purchaseCost: null });
    addAsset('HW-3', { departmentId: null });

    const report = buildReports(db, { now });
    expect(report.byDepartment.coverage).toEqual({ withDepartment: 2, total: 3 });
    const it = report.byDepartment.rows.find(r => r.department === 'IT')!;
    expect(it).toEqual({ department: 'IT', assetCount: 2, costedCount: 1, totalValue: 1_000_000 });
    const none = report.byDepartment.rows.find(r => r.department === 'No department recorded')!;
    expect(none).toMatchObject({ assetCount: 1, costedCount: 0, totalValue: null });
  });

  it('buckets hardware by age, keeping unknown dates out of the coverage count', () => {
    addAsset('HW-1', { purchaseDate: '2020' }); // ~6 years -> 6+ years
    addAsset('HW-2', { purchaseDate: '' }); // unknown

    const report = buildReports(db, { now });
    expect(report.byAge.coverage).toEqual({ withPurchaseDate: 1, total: 2 });
    expect(report.byAge.buckets.find(b => b.bucket === '6+ years')?.count).toBe(1);
    expect(report.byAge.buckets.find(b => b.bucket === 'Unknown')?.count).toBe(1);
    const unknown = report.byAge.assets.find(a => a.id === 'HW-2')!;
    expect(unknown).toMatchObject({ ageYears: null, bucket: 'Unknown' });
  });

  it('flags overdue and due-soon replacements against the default policy, and separates "no policy" from "unknown"', () => {
    addAsset('HW-1', { category: 'Laptop', purchaseDate: '2020' }); // overdue (4-year policy)
    addAsset('HW-2', { category: 'Other', purchaseDate: '2020' }); // no policy for this category
    addAsset('HW-3', { category: 'Laptop', purchaseDate: '' }); // policy exists, date unknown

    const report = buildReports(db, { now });
    expect(report.dueForReplacement.coverage).toEqual({ evaluable: 1, total: 3 });
    expect(report.dueForReplacement.assets.find(a => a.id === 'HW-1')?.state).toBe('overdue');
    expect(report.dueForReplacement.assets.find(a => a.id === 'HW-2')?.state).toBe('no_policy');
    expect(report.dueForReplacement.assets.find(a => a.id === 'HW-3')?.state).toBe('unknown');
  });

  it('reports licence seat usage and expiry, with capacity 0 read as "not tracked"', () => {
    addSoftware('SW-1', { seatCapacity: 10, activeSeats: 12, expiryDate: '2026-11-10' });
    addSoftware('SW-2', { seatCapacity: 0, activeSeats: 3, expiryDate: '' });

    const report = buildReports(db, { now, licenceExpiryWarningDays: 30 });
    expect(report.licenceCompliance.coverage).toEqual({ withExpiryDate: 1, total: 2 });
    const sw1 = report.licenceCompliance.licences.find(l => l.id === 'SW-1')!;
    expect(sw1).toMatchObject({ overCapacity: true, expiryState: 'expiring' });
    const sw2 = report.licenceCompliance.licences.find(l => l.id === 'SW-2')!;
    expect(sw2).toMatchObject({ overCapacity: false, expiryState: 'none' });
  });

  it('serves the report through the API under assets:read, with no extra permission needed', async () => {
    const deptId = db.$client.prepare('INSERT INTO departments (name) VALUES (?)').run('IT').lastInsertRowid as number;
    addAsset('HW-1', { departmentId: deptId, purchaseCost: 500_000 });

    for (const role of ['Admin', 'IT Officer', 'Manager', 'Auditor'] as Role[]) {
      const agent = await agentFor(role);
      const res = await agent.get('/api/reports').expect(200);
      expect(res.body.byDepartment.rows).toEqual([{ department: 'IT', assetCount: 1, costedCount: 1, totalValue: 500_000 }]);
    }
  });
});
