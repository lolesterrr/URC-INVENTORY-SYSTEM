import path from 'path';
import 'dotenv/config';
import { z } from 'zod';
import type { BackupOptions } from './services/backup';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().default(path.join(process.cwd(), 'storage')),
  DB_FILE: z.string().optional(),
  TLS_CERT_FILE: z.string().optional(),
  TLS_KEY_FILE: z.string().optional(),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
  SESSION_MAX_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  BACKUP_DIR: z.string().optional(),
  BACKUP_COPY_DIR: z.string().optional(),
  BACKUP_HOUR: z.coerce.number().int().min(0).max(23).default(2),
  BACKUP_KEEP_DAILY: z.coerce.number().int().min(1).max(366).default(7),
  BACKUP_KEEP_WEEKLY: z.coerce.number().int().min(0).max(520).default(4),
  BACKUP_KEEP_MONTHLY: z.coerce.number().int().min(0).max(1200).default(12),
});

export type Config = {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  dataDir: string;
  dbFile: string;
  tls: { certFile: string; keyFile: string } | null;
  sessionIdleMs: number;
  sessionMaxMs: number;
  backup: BackupOptions;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration in .env: ${problems}`);
  }
  const e = parsed.data;
  if (Boolean(e.TLS_CERT_FILE) !== Boolean(e.TLS_KEY_FILE)) {
    throw new Error('Set both TLS_CERT_FILE and TLS_KEY_FILE, or neither.');
  }
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    dataDir: e.DATA_DIR,
    dbFile: e.DB_FILE ?? path.join(e.DATA_DIR, 'inventory.db'),
    tls: e.TLS_CERT_FILE && e.TLS_KEY_FILE ? { certFile: e.TLS_CERT_FILE, keyFile: e.TLS_KEY_FILE } : null,
    sessionIdleMs: e.SESSION_IDLE_MINUTES * 60_000,
    sessionMaxMs: e.SESSION_MAX_HOURS * 3_600_000,
    backup: {
      dir: e.BACKUP_DIR || path.join(e.DATA_DIR, 'backups'),
      copyDir: e.BACKUP_COPY_DIR || null,
      hour: e.BACKUP_HOUR,
      retention: { daily: e.BACKUP_KEEP_DAILY, weekly: e.BACKUP_KEEP_WEEKLY, monthly: e.BACKUP_KEEP_MONTHLY },
    },
  };
}
