import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDatabase, type DB } from '../server/db';
import { createApp } from '../server/app';
import { createUser } from '../server/services/users';
import { parseCsv, toCsv, unescapeCsvFormula } from '../shared/csv';
import type { Role } from '../server/db/schema';
import type { ImportResult } from '../server/services/hardwareImport';

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

/** Posts a file and returns the report. */
async function importCsv(
  agent: request.Agent,
  csv: string,
  opts: { dryRun?: boolean; createMissingDirectory?: boolean } = {},
): Promise<ImportResult> {
  const res = await agent
    .post('/api/hardware/import')
    .send({ csv, dryRun: opts.dryRun ?? false, createMissingDirectory: opts.createMissingDirectory ?? false })
    .expect(200);
  return res.body as ImportResult;
}

const rowFor = (result: ImportResult, id: string) => result.rows.find(r => r.id === id)!;

describe('CSV parsing', () => {
  it('handles quotes, embedded commas and newlines, CRLF, a BOM and no trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('﻿"Asset ID"\n"HW-1"')).toEqual([['Asset ID'], ['HW-1']]);
    expect(parseCsv('a,b\n"x,y","say ""hi"""')).toEqual([['a', 'b'], ['x,y', 'say "hi"']]);
    expect(parseCsv('a\n"two\nlines"')).toEqual([['a'], ['two\nlines']]);
    // A trailing newline must not add an empty record, but a row of empty cells is still a row.
    expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\n,\n')).toEqual([['a', 'b'], ['', '']]);
    expect(parseCsv('')).toEqual([]);
  });

  it('reads back exactly what the export wrote, formula guard included', () => {
    const value = '=HYPERLINK("x")';
    const parsed = parseCsv(toCsv(['Condition'], [[value]]));
    expect(parsed[1][0]).toBe(`'${value}`);
    expect(unescapeCsvFormula(parsed[1][0])).toBe(value);
    // An apostrophe that was not added as a guard is left in place.
    expect(unescapeCsvFormula("'Reserved")).toBe("'Reserved");
  });
});

describe('hardware CSV import', () => {
  it('adds new assets, updates existing ones and leaves unchanged rows alone', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: 'HW-001', assetName: 'Reception Laptop', model: 'Latitude 5490' }).expect(201);

    const csv = toCsv(
      ['Asset ID', 'Asset Name', 'Model', 'Purchased', 'Purchase Cost (UGX)', 'Warranty', 'LPO / Order Ref.', 'Supplier'],
      [
        ['HW-001', 'Reception Laptop', 'Latitude 5490', '2019', '1200000', '2027-03-14', 'LPO/2019/045', 'Computer Point'],
        ['HW-002', 'Store Printer', 'LaserJet 1102', '2021-06-01', '', '', '', ''],
      ],
    );
    const preview = await importCsv(officer, csv, { dryRun: true });
    expect(preview).toMatchObject({ dryRun: true, rowsRead: 2, created: 1, updated: 1, unchanged: 0, rejected: 0 });
    // A dry run writes nothing at all.
    expect((await officer.get('/api/hardware')).body).toHaveLength(1);
    expect(db.$client.prepare("SELECT count(*) n FROM audit_log WHERE action = 'CSV Import'").get()).toEqual({ n: 0 });

    const applied = await importCsv(officer, csv);
    expect(applied).toMatchObject({ dryRun: false, created: 1, updated: 1, rejected: 0 });
    expect(rowFor(applied, 'HW-001').changed).toContain('Purchase Cost (UGX)');

    const list = (await officer.get('/api/hardware').expect(200)).body as Record<string, unknown>[];
    expect(list).toHaveLength(2);
    expect(list.find(h => h.id === 'HW-001')).toMatchObject({
      purchaseDate: '2019', purchaseCost: 1200000, warrantyExpires: '2027-03-14', orderNumber: 'LPO/2019/045', supplier: 'Computer Point',
    });
    // A new asset starts In Stock with no assignee, whatever the file says.
    expect(list.find(h => h.id === 'HW-002')).toMatchObject({ lifecycleState: 'In Stock', assigneeId: null, purchaseDate: '2021-06-01', purchaseCost: null });

    // Importing the same file again changes nothing.
    const again = await importCsv(officer, csv);
    expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 2, rejected: 0 });
  });

  it('writes one audit entry per changed asset plus a batch summary, and nothing for an unchanged row', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: 'HW-001', assetName: 'Reception Laptop' }).expect(201);
    await importCsv(
      officer,
      toCsv(['Asset ID', 'Asset Name', 'Supplier'], [['HW-001', 'Reception Laptop', 'Computer Point'], ['HW-002', 'Store Printer', '']]),
    );

    const history = (await officer.get('/api/hardware/HW-001/history').expect(200)).body as { action: string; details: string }[];
    const imported = history.filter(h => h.action === 'Import Hardware');
    expect(imported).toHaveLength(1);
    expect(imported[0].details).toMatch(/Changed: Supplier/);
    const batch = db.$client.prepare("SELECT details FROM audit_log WHERE action = 'CSV Import'").all() as { details: string }[];
    expect(batch).toHaveLength(1);
    expect(batch[0].details).toMatch(/2 rows read, 1 added, 1 updated, 0 unchanged, 0 rejected/);

    // A second, identical import leaves no new per-asset entry behind.
    await importCsv(officer, toCsv(['Asset ID', 'Asset Name', 'Supplier'], [['HW-001', 'Reception Laptop', 'Computer Point']]));
    const after = (await officer.get('/api/hardware/HW-001/history').expect(200)).body as { action: string }[];
    expect(after.filter(h => h.action === 'Import Hardware')).toHaveLength(1);
  });

  it('only touches the columns the file carries, and a blank cell in a column that is there clears the field', async () => {
    const officer = await agentFor('IT Officer');
    await officer
      .post('/api/hardware')
      .send({ id: 'HW-001', assetName: 'Reception Laptop', supplier: 'Computer Point', purchaseCost: 1200000, condition: 'OK' })
      .expect(201);

    // Only the cost column is present, so the supplier and condition are left as they are.
    await importCsv(officer, toCsv(['Asset ID', 'Purchase Cost (UGX)'], [['HW-001', '1500000']]));
    let asset = (await officer.get('/api/hardware')).body[0];
    expect(asset).toMatchObject({ purchaseCost: 1500000, supplier: 'Computer Point', condition: 'OK' });

    // Now the supplier column is present and blank, which clears it. An empty cost becomes NULL, never 0.
    await importCsv(officer, toCsv(['Asset ID', 'Supplier', 'Purchase Cost (UGX)'], [['HW-001', '', '']]));
    asset = (await officer.get('/api/hardware')).body[0];
    expect(asset).toMatchObject({ supplier: '', purchaseCost: null, condition: 'OK' });
  });

  it('accepts money with separators and a currency prefix, and matches headers and categories whatever the case', async () => {
    const officer = await agentFor('IT Officer');
    const result = await importCsv(
      officer,
      toCsv(['  asset id ', 'DEVICE NAME', 'type', 'purchase cost'], [['HW-001', 'Core Switch', 'switch', 'UGX 2,400,000']]),
    );
    expect(result).toMatchObject({ created: 1, rejected: 0 });
    expect((await officer.get('/api/hardware')).body[0]).toMatchObject({ assetName: 'Core Switch', category: 'Switch', purchaseCost: 2400000 });
  });

  it('detects a category for a new asset when the file does not give one, and keeps the old one on an update', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: 'HW-001', assetName: 'Reception Laptop', category: 'Laptop' }).expect(201);
    await importCsv(officer, toCsv(['Asset ID', 'Asset Name', 'Category'], [['HW-001', 'Reception Laptop', ''], ['HW-002', 'HP LaserJet 1102', '']]));
    const list = (await officer.get('/api/hardware')).body as Record<string, unknown>[];
    expect(list.find(h => h.id === 'HW-001')!.category).toBe('Laptop');
    expect(list.find(h => h.id === 'HW-002')!.category).toBe('Printer');
  });

  it('never changes the lifecycle state or the assignee, and says those columns were ignored', async () => {
    const officer = await agentFor('IT Officer');
    const { body: dept } = await officer.post('/api/departments').send({ name: 'Finance' }).expect(201);
    const { body: person } = await officer.post('/api/staff').send({ fullName: 'A. Person', departmentId: dept.id }).expect(201);
    await officer.post('/api/hardware').send({ id: 'HW-001', assetName: 'Reception Laptop' }).expect(201);
    await officer.post('/api/hardware/HW-001/checkout').send({ staffId: person.id }).expect(201);

    const result = await importCsv(
      officer,
      toCsv(['Asset ID', 'Asset Name', 'State', 'User / Assignee', 'Condition'], [['HW-001', 'Reception Laptop', 'Retired', '', 'Scratched lid']]),
    );
    expect(result.ignoredColumns.map(c => c.header)).toEqual(['State', 'User / Assignee']);
    expect(rowFor(result, 'HW-001')).toMatchObject({ status: 'update', changed: ['Condition'] });
    expect((await officer.get('/api/hardware')).body[0]).toMatchObject({ lifecycleState: 'Deployed', assignee: 'A. Person', condition: 'Scratched lid' });
  });

  it('reports a column that merges two fields instead of guessing which one was meant', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: 'HW-001', assetName: 'Core Switch', firmwareVersion: '15.2' }).expect(201);
    const result = await importCsv(officer, toCsv(['Asset ID', 'Firmware / OS', 'Operating System'], [['HW-001', '16.9', 'IOS 16.9']]));
    expect(result.ignoredColumns[0]).toMatchObject({ header: 'Firmware / OS' });
    expect((await officer.get('/api/hardware')).body[0]).toMatchObject({ firmwareVersion: '15.2', operatingSystem: 'IOS 16.9' });
  });

  it('rejects a row rather than the file: bad id, duplicate, disposed, archived and unusable values', async () => {
    const admin = await agentFor('Admin');
    await admin.post('/api/hardware').send({ id: 'HW-001', assetName: 'Reception Laptop' }).expect(201);
    await admin.post('/api/hardware').send({ id: 'HW-DIS', assetName: 'Old Laptop' }).expect(201);
    await admin.post('/api/hardware/HW-DIS/lifecycle').send({ to: 'Retired', note: 'End of life' }).expect(200);
    await admin.post('/api/hardware/HW-DIS/lifecycle').send({ to: 'Disposed', note: 'Board of survey 12' }).expect(200);
    await admin.post('/api/hardware').send({ id: 'HW-ARC', assetName: 'Lost Laptop' }).expect(201);
    await admin.delete('/api/hardware/HW-ARC').expect(200);

    const result = await importCsv(
      admin,
      toCsv(
        ['Asset ID', 'Asset Name', 'Purchased', 'Warranty', 'Purchase Cost (UGX)', 'Category'],
        [
          ['', 'No ID', '', '', '', ''],
          ['HW 001', 'Bad characters', '', '', '', ''],
          ['HW-001', 'Reception Laptop', '', '', '', ''],
          ['HW-001', 'Repeated', '', '', '', ''],
          ['HW-DIS', 'Old Laptop', '', '', '', ''],
          ['HW-ARC', 'Lost Laptop', '', '', '', ''],
          ['HW-002', 'Bad date', 'March 2019', '', '', ''],
          ['HW-003', 'Year as a warranty', '', '2027', '', ''],
          ['HW-004', 'Negative cost', '', '', '-5', ''],
          ['HW-005', 'Bad category', '', '', '', 'Tablet'],
          ['HW-006', '', '', '', '', ''],
          ['HW-007', 'Good row', '2020', '', '', ''],
        ],
      ),
    );
    expect(result).toMatchObject({ rowsRead: 12, created: 1, updated: 0, unchanged: 1, rejected: 10 });
    const why = (row: number) => result.rows.find(r => r.row === row)!.error!;
    expect(why(1)).toMatch(/"Asset ID" cell is empty/);
    expect(why(2)).toMatch(/may only contain/);
    expect(why(4)).toMatch(/also appears on row 3/);
    expect(why(5)).toMatch(/Disposed/);
    expect(why(6)).toMatch(/archived/);
    expect(why(7)).toMatch(/Use a year .* or an exact date/);
    expect(why(8)).toMatch(/exact date/);
    expect(why(9)).toMatch(/Purchase Cost/);
    expect(why(10)).toMatch(/is not a category/);
    expect(why(11)).toMatch(/needs a name/);
    // The one good row still went in, and the disposed asset was left untouched.
    expect((await admin.get('/api/hardware')).body.map((h: { id: string }) => h.id)).toContain('HW-007');
    expect(db.$client.prepare("SELECT asset_name FROM hardware WHERE id = 'HW-DIS'").get()).toEqual({ asset_name: 'Old Laptop' });
  });

  it('a row needing a new asset is rejected when the file has no name column', async () => {
    const officer = await agentFor('IT Officer');
    const result = await importCsv(officer, toCsv(['Asset ID', 'Supplier'], [['HW-001', 'Computer Point']]));
    expect(result.rejected).toBe(1);
    expect(rowFor(result, 'HW-001').error).toMatch(/needs an "Asset Name" column/);
  });

  it('refuses a whole file with no Asset ID column, no rows, or too many rows', async () => {
    const officer = await agentFor('IT Officer');
    const noId = await officer.post('/api/hardware/import').send({ csv: 'Name,Model\nA,B', dryRun: true }).expect(400);
    expect(noId.body.error).toMatch(/needs an "Asset ID" column/);
    const noRows = await officer.post('/api/hardware/import').send({ csv: 'Asset ID,Asset Name', dryRun: true }).expect(400);
    expect(noRows.body.error).toMatch(/no rows/);
    const tooMany = toCsv(['Asset ID', 'Asset Name'], Array.from({ length: 5001 }, (_, i) => [`HW-${i}`, 'Laptop']));
    const over = await officer.post('/api/hardware/import').send({ csv: tooMany, dryRun: true }).expect(400);
    expect(over.body.error).toMatch(/At most 5000/);
    await officer.post('/api/hardware/import').send({ csv: '', dryRun: true }).expect(400);
  });

  it('lists unknown columns without failing the row', async () => {
    const officer = await agentFor('IT Officer');
    const result = await importCsv(officer, toCsv(['Asset ID', 'Asset Name', 'Insurance Policy'], [['HW-001', 'Reception Laptop', 'POL/9']]));
    expect(result).toMatchObject({ created: 1, rejected: 0, unknownColumns: ['Insurance Policy'] });
  });
});

describe('import and the directory', () => {
  it('names missing departments and locations and refuses those rows until asked to create them', async () => {
    const officer = await agentFor('IT Officer');
    const csv = toCsv(
      ['Asset ID', 'Asset Name', 'Department', 'Location'],
      [['HW-001', 'Reception Laptop', 'Finance', 'HEAD OFFICE'], ['HW-002', 'Store Printer', 'Finance', 'PORTBELL']],
    );
    const preview = await importCsv(officer, csv, { dryRun: true });
    expect(preview).toMatchObject({
      created: 0, rejected: 2, needsDirectoryConsent: true,
      missingDepartments: ['Finance'], missingLocations: ['HEAD OFFICE', 'PORTBELL'],
    });
    expect(rowFor(preview, 'HW-001').error).toMatch(/not in the Directory/);

    const allowed = await importCsv(officer, csv, { dryRun: true, createMissingDirectory: true });
    expect(allowed).toMatchObject({ created: 2, rejected: 0, needsDirectoryConsent: false, createdDepartments: ['Finance'] });
    expect(allowed.createdLocations).toEqual(['HEAD OFFICE', 'PORTBELL']);
    // That was still a dry run, so the Directory is untouched.
    expect((await officer.get('/api/departments')).body).toEqual([]);

    await importCsv(officer, csv, { createMissingDirectory: true });
    expect((await officer.get('/api/departments')).body.map((d: { name: string }) => d.name)).toEqual(['Finance']);
    expect((await officer.get('/api/hardware')).body.map((h: { location: string }) => h.location)).toEqual(['HEAD OFFICE', 'PORTBELL']);
  });

  it('matches an existing record whatever the case, and a location by its full path', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/departments').send({ name: 'Finance' }).expect(201);
    const { body: region } = await officer.post('/api/locations').send({ name: 'Central', parentId: null }).expect(201);
    const { body: station } = await officer.post('/api/locations').send({ name: 'Kampala', parentId: region.id }).expect(201);
    await officer.post('/api/locations').send({ name: 'HQ', parentId: station.id }).expect(201);

    const result = await importCsv(
      officer,
      toCsv(['Asset ID', 'Asset Name', 'Department', 'Location'], [['HW-001', 'Reception Laptop', ' finance ', 'central / kampala / hq']]),
    );
    expect(result).toMatchObject({ created: 1, rejected: 0, createdDepartments: [], createdLocations: [] });
    expect((await officer.get('/api/hardware')).body[0]).toMatchObject({ department: 'Finance', location: 'Central / Kampala / HQ' });
  });

  it('refuses an ambiguous bare location name and an unknown nested path', async () => {
    const officer = await agentFor('IT Officer');
    const { body: a } = await officer.post('/api/locations').send({ name: 'Central', parentId: null }).expect(201);
    const { body: b } = await officer.post('/api/locations').send({ name: 'Eastern', parentId: null }).expect(201);
    await officer.post('/api/locations').send({ name: 'Store', parentId: a.id }).expect(201);
    await officer.post('/api/locations').send({ name: 'Store', parentId: b.id }).expect(201);

    const result = await importCsv(
      officer,
      toCsv(['Asset ID', 'Asset Name', 'Location'], [['HW-001', 'A', 'Store'], ['HW-002', 'B', 'Northern / Depot']]),
      { createMissingDirectory: true },
    );
    expect(result.rejected).toBe(2);
    expect(rowFor(result, 'HW-001').error).toMatch(/could be any of Central \/ Store, Eastern \/ Store/);
    // Creating would have to invent the parent, so it is refused even with permission to create.
    expect(rowFor(result, 'HW-002').error).toMatch(/Add it on the Directory screen/);
  });

  it('refuses a new reference to an archived record but keeps the one an asset already has', async () => {
    const officer = await agentFor('IT Officer');
    const { body: dept } = await officer.post('/api/departments').send({ name: 'Finance' }).expect(201);
    await officer.post('/api/hardware').send({ id: 'HW-001', assetName: 'Reception Laptop', departmentId: dept.id }).expect(201);
    await officer.post('/api/hardware').send({ id: 'HW-002', assetName: 'Store Printer' }).expect(201);
    await officer.delete(`/api/departments/${dept.id}`).expect(200);

    const result = await importCsv(
      officer,
      toCsv(['Asset ID', 'Asset Name', 'Department', 'Supplier'], [['HW-001', 'Reception Laptop', 'Finance', 'Computer Point'], ['HW-002', 'Store Printer', 'Finance', '']]),
    );
    // HW-001 already points at it, so keeping it is fine; HW-002 would be a new reference to an archived record.
    expect(rowFor(result, 'HW-001')).toMatchObject({ status: 'update' });
    expect(rowFor(result, 'HW-002').error).toMatch(/archived/);
  });

  it('clears a department when the column is present and blank', async () => {
    const officer = await agentFor('IT Officer');
    const { body: dept } = await officer.post('/api/departments').send({ name: 'Finance' }).expect(201);
    await officer.post('/api/hardware').send({ id: 'HW-001', assetName: 'Reception Laptop', departmentId: dept.id }).expect(201);
    await importCsv(officer, toCsv(['Asset ID', 'Department'], [['HW-001', '']]));
    expect((await officer.get('/api/hardware')).body[0]).toMatchObject({ departmentId: null, department: '' });
  });
});

describe('import permissions', () => {
  it('needs assets:write, and creating directory records needs directory:manage as well', async () => {
    const csv = toCsv(['Asset ID', 'Asset Name', 'Department'], [['HW-001', 'Reception Laptop', 'Finance']]);
    for (const role of ['Manager', 'Auditor'] as const) {
      const agent = await agentFor(role);
      await agent.post('/api/hardware/import').send({ csv, dryRun: true }).expect(403);
    }
    // No role has assets:write without directory:manage today, so the guard is checked directly.
    const { can } = await import('../server/auth/permissions');
    for (const role of ['Admin', 'IT Officer'] as const) {
      expect(can(role, 'assets:write') && can(role, 'directory:manage')).toBe(true);
    }
    for (const role of ['Manager', 'Auditor'] as const) expect(can(role, 'assets:write')).toBe(false);
  });

  it('is refused without a session', async () => {
    await request(app).post('/api/hardware/import').send({ csv: 'Asset ID\nHW-001', dryRun: true }).expect(401);
  });
});

describe('warranty alerts after an import', () => {
  it('raises a warranty alert for a date brought in by the file', async () => {
    const officer = await agentFor('IT Officer');
    await officer.post('/api/hardware').send({ id: 'HW-001', assetName: 'Reception Laptop' }).expect(201);
    expect((await officer.get('/api/alerts')).body).toEqual([]);

    const expired = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    await importCsv(officer, toCsv(['Asset ID', 'Warranty'], [['HW-001', expired]]));
    const alerts = (await officer.get('/api/alerts')).body as { type: string; message: string }[];
    expect(alerts.map(a => a.type)).toContain('warranty_expiry');
    expect(alerts.find(a => a.type === 'warranty_expiry')!.message).toMatch(/HW-001/);
  });
});
