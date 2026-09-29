import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { Request } from 'express';
import { openDatabase, type DB } from '../db';
import { recordAudit } from './audit';

export interface Retention {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface BackupOptions {
  dir: string;
  /** Optional second location (another disk or a network share). */
  copyDir: string | null;
  /** Local hour (0-23) of the nightly backup. */
  hour: number;
  retention: Retention;
}

export interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  copied: boolean;
}

export interface BackupResult {
  ok: boolean;
  reason: 'scheduled' | 'manual' | 'catch-up';
  name: string | null;
  sizeBytes: number;
  startedAt: string;
  finishedAt: string;
  error: string | null;
  /** Set when the main backup worked but the second copy failed. */
  copyError: string | null;
  pruned: string[];
}

const NAME_RE = /^inventory-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.db$/;
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** `inventory-YYYYMMDD-HHMMSS.db` in local time: sortable, and free of characters Windows rejects. */
export function backupName(d: Date): string {
  return `inventory-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.db`;
}

export function parseBackupName(name: string): Date | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, s);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
function weekKey(d: Date): string {
  // ISO week: the week belongs to the year that contains its Thursday.
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const dayOfYear = Math.round((t.getTime() - new Date(t.getFullYear(), 0, 1).getTime()) / DAY_MS);
  return `${t.getFullYear()}-W${Math.floor(dayOfYear / 7) + 1}`;
}

/** Grandfather-father-son retention: the newest backup of each of the last N days, weeks and months. */
export function selectBackupsToKeep(names: string[], retention: Retention): Set<string> {
  const dated = names
    .map(name => ({ name, date: parseBackupName(name) }))
    .filter((b): b is { name: string; date: Date } => b.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const keep = new Set<string>();
  const rules: [(d: Date) => string, number][] = [
    [dayKey, retention.daily],
    [weekKey, retention.weekly],
    [monthKey, retention.monthly],
  ];
  for (const [key, count] of rules) {
    const seen = new Set<string>();
    for (const b of dated) {
      const k = key(b.date);
      if (seen.has(k)) continue;
      if (seen.size >= count) break;
      seen.add(k);
      keep.add(b.name);
    }
  }
  return keep;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Checks a database file and switches it to a single self-contained file (no -wal/-shm).
 * Throws if the file is damaged or is not a URC Inventory database.
 */
export function verifyDatabaseFile(file: string): void {
  const sqlite = new Database(file, { fileMustExist: true });
  try {
    const result = sqlite.pragma('integrity_check', { simple: true });
    if (result !== 'ok') throw new Error(`Integrity check failed: ${String(result)}`);
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'hardware', 'audit_log')")
      .all();
    if (tables.length !== 3) throw new Error('This file is not a URC Inventory database.');
    sqlite.pragma('journal_mode = DELETE');
  } finally {
    sqlite.close();
  }
}

function writeAtomically(target: string, write: (tmp: string) => void | Promise<void>) {
  const tmp = `${target}.tmp`;
  return (async () => {
    try {
      await write(tmp);
      fs.renameSync(tmp, target);
    } catch (err) {
      fs.rmSync(tmp, { force: true });
      throw err;
    }
  })();
}

export class BackupService {
  last: BackupResult | null = null;
  private running = false;

  constructor(private readonly db: DB, readonly options: BackupOptions) {}

  get isRunning() {
    return this.running;
  }

  list(): BackupFile[] {
    if (!fs.existsSync(this.options.dir)) return [];
    const copies = this.options.copyDir && fs.existsSync(this.options.copyDir) ? new Set(fs.readdirSync(this.options.copyDir)) : new Set<string>();
    return fs
      .readdirSync(this.options.dir)
      .filter(name => NAME_RE.test(name))
      .sort()
      .reverse()
      .map(name => ({
        name,
        sizeBytes: fs.statSync(path.join(this.options.dir, name)).size,
        createdAt: parseBackupName(name)!.toISOString(),
        copied: copies.has(name),
      }));
  }

  /** Creates, verifies, copies and prunes. Never throws: failures are returned, logged and audited. */
  async run(reason: BackupResult['reason'], req: Request | null = null): Promise<BackupResult> {
    const started = new Date();
    const result: BackupResult = {
      ok: false,
      reason,
      name: null,
      sizeBytes: 0,
      startedAt: started.toISOString(),
      finishedAt: started.toISOString(),
      error: null,
      copyError: null,
      pruned: [],
    };
    if (this.running) {
      result.error = 'A backup is already running.';
      return result;
    }
    this.running = true;
    try {
      const { dir, copyDir } = this.options;
      fs.mkdirSync(dir, { recursive: true });
      const name = backupName(started);
      const target = path.join(dir, name);
      await writeAtomically(target, async tmp => {
        await this.db.$client.backup(tmp);
        verifyDatabaseFile(tmp);
      });
      result.ok = true;
      result.name = name;
      result.sizeBytes = fs.statSync(target).size;

      if (copyDir) {
        try {
          fs.mkdirSync(copyDir, { recursive: true });
          await writeAtomically(path.join(copyDir, name), tmp => fs.copyFileSync(target, tmp));
        } catch (err) {
          result.copyError = errorText(err);
        }
      }
      result.pruned = this.prune();
    } catch (err) {
      result.error = errorText(err);
    } finally {
      this.running = false;
      result.finishedAt = new Date().toISOString();
      this.last = result;
    }

    const details = result.ok
      ? `Backup ${result.name} created (${reason}).${result.copyError ? ` Second copy failed: ${result.copyError}` : ''}`
      : `Backup failed (${reason}): ${result.error}`;
    (result.ok && !result.copyError ? console.log : console.error)(details);
    try {
      recordAudit(this.db, req, { action: result.ok ? 'Backup' : 'Backup Failed', details });
    } catch (err) {
      console.error('Could not record the backup in the audit log:', errorText(err));
    }
    return result;
  }

  /** Deletes backups outside the retention policy, in both folders. Returns the names removed. */
  private prune(): string[] {
    const removed = new Set<string>();
    for (const dir of [this.options.dir, this.options.copyDir]) {
      if (!dir || !fs.existsSync(dir)) continue;
      const names = fs.readdirSync(dir);
      for (const name of names) {
        if (name.endsWith('.db.tmp')) fs.rmSync(path.join(dir, name), { force: true });
      }
      const keep = selectBackupsToKeep(names, this.options.retention);
      for (const name of names) {
        if (NAME_RE.test(name) && !keep.has(name)) {
          fs.rmSync(path.join(dir, name), { force: true });
          removed.add(name);
        }
      }
    }
    return [...removed];
  }

  nextRunAt(from = new Date()): Date {
    const next = new Date(from);
    next.setHours(this.options.hour, 0, 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }

  /** Starts the nightly schedule, with a catch-up backup if the newest one is over a day old. Returns a stop function. */
  startSchedule(): () => void {
    let timer: NodeJS.Timeout | undefined;
    let stopped = false;
    const planNext = () => {
      if (stopped) return;
      const delay = this.nextRunAt().getTime() - Date.now();
      timer = setTimeout(() => {
        void this.run('scheduled').finally(planNext);
      }, delay);
      timer.unref();
    };

    const newest = this.list()[0];
    if (!newest || Date.now() - Date.parse(newest.createdAt) > DAY_MS) void this.run('catch-up');
    planNext();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }
}

/** The running server writes its process ID here, so the restore script can refuse to run alongside it. */
export const pidFileFor = (dbFile: string) => path.join(path.dirname(dbFile), 'server.pid');

export function isServerRunning(dbFile: string): boolean {
  const file = pidFileFor(dbFile);
  if (!fs.existsSync(file)) return false;
  const pid = Number(fs.readFileSync(file, 'utf-8').trim());
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export interface RestoreResult {
  safetyCopy: string | null;
  counts: { users: number; hardware: number; software: number; serverComponents: number };
}

/**
 * Replaces the database with a backup. The server must be stopped.
 * The backup is verified first, and the current database is saved as `pre-restore-*.db` in `safetyDir`.
 */
export async function restoreBackup(opts: { backupFile: string; dbFile: string; safetyDir: string }): Promise<RestoreResult> {
  const { backupFile, dbFile, safetyDir } = opts;
  if (!fs.existsSync(backupFile)) throw new Error(`Backup file not found: ${backupFile}`);
  if (path.resolve(backupFile) === path.resolve(dbFile)) throw new Error('The backup file is the live database.');
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });

  // Work on a copy so the backup itself is never changed.
  const staged = `${dbFile}.restore-tmp`;
  fs.copyFileSync(backupFile, staged);
  try {
    verifyDatabaseFile(staged);
  } catch (err) {
    fs.rmSync(staged, { force: true });
    throw err;
  }

  let safetyCopy: string | null = null;
  if (fs.existsSync(dbFile)) {
    fs.mkdirSync(safetyDir, { recursive: true });
    safetyCopy = path.join(safetyDir, backupName(new Date()).replace(/^inventory-/, 'pre-restore-'));
    const current = new Database(dbFile, { fileMustExist: true });
    try {
      await current.backup(safetyCopy);
    } finally {
      current.close();
    }
  }

  for (const suffix of ['-wal', '-shm']) fs.rmSync(dbFile + suffix, { force: true });
  fs.renameSync(staged, dbFile);

  // Opening applies any migrations added since the backup was taken.
  const db = openDatabase(dbFile);
  try {
    const count = (table: string) => (db.$client.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    const counts = {
      users: count('users'),
      hardware: count('hardware WHERE deleted_at IS NULL'),
      software: count('software WHERE deleted_at IS NULL'),
      serverComponents: count('server_components WHERE deleted_at IS NULL'),
    };
    recordAudit(db, null, { action: 'Restore Backup', details: `Database restored from backup "${path.basename(backupFile)}".` });
    return { safetyCopy, counts };
  } finally {
    db.$client.close();
  }
}
