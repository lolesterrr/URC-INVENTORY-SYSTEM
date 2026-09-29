import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { openDatabase, type DB } from '../server/db';
import { createApp } from '../server/app';
import { auditLog, hardware } from '../server/db/schema';
import { createUser } from '../server/services/users';
import {
  BackupService,
  backupName,
  parseBackupName,
  restoreBackup,
  selectBackupsToKeep,
  type BackupOptions,
} from '../server/services/backup';

const PASSWORD = 'Str0ng-Passw0rd!';
const retention = { daily: 7, weekly: 4, monthly: 12 };
let tmp: string;
let dbFile: string;
let db: DB;
let options: BackupOptions;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'urc-backup-'));
  dbFile = path.join(tmp, 'data', 'inventory.db');
  db = openDatabase(dbFile);
  options = { dir: path.join(tmp, 'backups'), copyDir: null, hour: 2, retention };
});

afterEach(() => {
  if (db.$client.open) db.$client.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const addAsset = (id: string) => db.insert(hardware).values({ id, assetName: 'Desktop Computer' }).run();

describe('retention', () => {
  it('names round-trip and sort by time', () => {
    const d = new Date(2026, 8, 29, 2, 0, 5);
    expect(backupName(d)).toBe('inventory-20260929-020005.db');
    expect(parseBackupName(backupName(d))?.getTime()).toBe(d.getTime());
    expect(parseBackupName('pre-restore-20260929-020005.db')).toBeNull();
  });

  it('keeps 7 daily, 4 weekly and 12 monthly backups', () => {
    const start = new Date(2026, 8, 29, 2, 0, 0);
    const names = Array.from({ length: 500 }, (_, i) => backupName(new Date(start.getFullYear(), start.getMonth(), start.getDate() - i, 2)));
    const keep = selectBackupsToKeep(names, retention);

    for (let i = 0; i < 7; i++) expect(keep.has(names[i])).toBe(true);
    expect(keep.size).toBeLessThanOrEqual(7 + 4 + 12);
    expect(keep.size).toBeGreaterThanOrEqual(12);
    const oldest = Math.min(...[...keep].map(n => parseBackupName(n)!.getTime()));
    expect(start.getTime() - oldest).toBeLessThan(366 * 86_400_000);
    expect(start.getTime() - oldest).toBeGreaterThan(300 * 86_400_000);
  });

  it('keeps only the newest backup of a day', () => {
    const names = ['inventory-20260929-020000.db', 'inventory-20260929-140000.db', 'inventory-20260928-020000.db'];
    const keep = selectBackupsToKeep(names, { daily: 7, weekly: 0, monthly: 0 });
    expect([...keep].sort()).toEqual(['inventory-20260928-020000.db', 'inventory-20260929-140000.db']);
  });
});

describe('BackupService', () => {
  it('creates a verified, self-contained backup and audits it', async () => {
    addAsset('HW-1');
    const service = new BackupService(db, options);
    const result = await service.run('manual');

    expect(result.ok).toBe(true);
    const file = path.join(options.dir, result.name!);
    expect(fs.readdirSync(options.dir)).toEqual([result.name]);
    const copy = openDatabase(file);
    expect(copy.select().from(hardware).all()).toHaveLength(1);
    copy.$client.close();
    expect(service.list()[0]).toMatchObject({ name: result.name, copied: false });
    expect(db.select().from(auditLog).where(eq(auditLog.action, 'Backup')).all()).toHaveLength(1);
  });

  it('copies to the second folder and prunes old backups in both', async () => {
    options.copyDir = path.join(tmp, 'share');
    fs.mkdirSync(options.dir, { recursive: true });
    fs.mkdirSync(options.copyDir, { recursive: true });
    const stale = 'inventory-20000101-020000.db';
    for (const dir of [options.dir, options.copyDir]) fs.writeFileSync(path.join(dir, stale), '');
    const service = new BackupService(db, { ...options, retention: { daily: 1, weekly: 0, monthly: 0 } });

    const result = await service.run('scheduled');
    expect(result.ok).toBe(true);
    expect(result.copyError).toBeNull();
    expect(result.pruned).toEqual([stale]);
    expect(fs.readdirSync(options.dir)).toEqual([result.name]);
    expect(fs.readdirSync(options.copyDir)).toEqual([result.name]);
    expect(service.list()[0].copied).toBe(true);
  });

  it('keeps the main backup when the second copy fails', async () => {
    options.copyDir = path.join(tmp, 'not-a-folder');
    fs.writeFileSync(options.copyDir, 'x');
    const result = await new BackupService(db, options).run('manual');
    expect(result.ok).toBe(true);
    expect(result.copyError).toBeTruthy();
    expect(fs.existsSync(path.join(options.dir, result.name!))).toBe(true);
  });

  it('schedules the next run at the configured hour', () => {
    const service = new BackupService(db, options);
    expect(service.nextRunAt(new Date(2026, 8, 29, 1, 30)).getTime()).toBe(new Date(2026, 8, 29, 2).getTime());
    expect(service.nextRunAt(new Date(2026, 8, 29, 2, 0)).getTime()).toBe(new Date(2026, 8, 30, 2).getTime());
  });
});

describe('backups API', () => {
  const login = async (app: ReturnType<typeof createApp>, username: string, role: 'Admin' | 'IT Officer') => {
    await createUser(db, { username, fullName: username, role, password: PASSWORD, mustChangePassword: false });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username, password: PASSWORD }).expect(200);
    return agent;
  };

  it('lets only Admins list and start backups', async () => {
    const backups = new BackupService(db, options);
    const app = createApp(db, { idleMs: 60_000, maxMs: 3_600_000, secureCookie: false, production: false, loginRateLimit: 1000, backups });
    const officer = await login(app, 'officer', 'IT Officer');
    await officer.get('/api/backups').expect(403);
    await officer.post('/api/backups').expect(403);

    const admin = await login(app, 'admin', 'Admin');
    const created = await admin.post('/api/backups').expect(201);
    const list = await admin.get('/api/backups').expect(200);
    expect(list.body.backups.map((b: { name: string }) => b.name)).toEqual([created.body.name]);
    expect(list.body.last.ok).toBe(true);
    expect(list.body.settings.retention).toEqual(retention);
  });
});

describe('restore drill', () => {
  it('restores a backup and keeps a safety copy of the replaced database', async () => {
    addAsset('HW-KEEP');
    const { name } = await new BackupService(db, options).run('manual');
    // Changes after the backup: these must disappear after the restore.
    addAsset('HW-LATER');
    db.delete(hardware).where(eq(hardware.id, 'HW-KEEP')).run();
    db.$client.close();

    const result = await restoreBackup({ backupFile: path.join(options.dir, name!), dbFile, safetyDir: options.dir });
    expect(result.counts.hardware).toBe(1);

    db = openDatabase(dbFile);
    expect(db.select().from(hardware).all().map(h => h.id)).toEqual(['HW-KEEP']);
    expect(db.select().from(auditLog).where(eq(auditLog.action, 'Restore Backup')).all()).toHaveLength(1);

    const safety = openDatabase(result.safetyCopy!);
    expect(safety.select().from(hardware).all().map(h => h.id)).toEqual(['HW-LATER']);
    safety.$client.close();
  });

  it('refuses a damaged backup and leaves the database untouched', async () => {
    addAsset('HW-1');
    db.$client.close();
    const bad = path.join(tmp, 'bad.db');
    fs.writeFileSync(bad, 'not a database');
    await expect(restoreBackup({ backupFile: bad, dbFile, safetyDir: options.dir })).rejects.toThrow();

    db = openDatabase(dbFile);
    expect(db.select().from(hardware).all()).toHaveLength(1);
    expect(fs.existsSync(`${dbFile}.restore-tmp`)).toBe(false);
  });
});
