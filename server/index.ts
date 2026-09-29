import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import express from 'express';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { createApp } from './app';
import { purgeExpiredSessions } from './auth/session';
import { runAlertChecks } from './services/alerts';
import { BackupService, pidFileFor } from './services/backup';

const HOUR_MS = 3_600_000;

async function main() {
  const config = loadConfig();
  const production = config.env === 'production';
  const db = openDatabase(config.dbFile);
  // Lets the restore script detect a running server. A stale file after a crash is harmless.
  const pidFile = pidFileFor(config.dbFile);
  fs.writeFileSync(pidFile, String(process.pid));
  const backups = new BackupService(db, config.backup);
  const sessionOpts = { idleMs: config.sessionIdleMs, maxMs: config.sessionMaxMs, secureCookie: Boolean(config.tls) };

  const app = createApp(db, { ...sessionOpts, production, backups });

  if (production) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  runAlertChecks(db);
  setInterval(() => runAlertChecks(db), 6 * HOUR_MS).unref();
  setInterval(() => purgeExpiredSessions(db, sessionOpts), HOUR_MS).unref();
  const stopBackups = backups.startSchedule();

  const server = config.tls
    ? https.createServer({ cert: fs.readFileSync(config.tls.certFile), key: fs.readFileSync(config.tls.keyFile) }, app)
    : http.createServer(app);

  server.listen(config.port, config.host, () => {
    const scheme = config.tls ? 'https' : 'http';
    console.log(`URC Inventory running at ${scheme}://${config.host}:${config.port} (${config.env})`);
    console.log(`Database: ${config.dbFile}`);
    console.log(`Backups: ${config.backup.dir}${config.backup.copyDir ? ` (copied to ${config.backup.copyDir})` : ''}, next at ${backups.nextRunAt().toLocaleString()}`);
  });

  const shutdown = () => {
    stopBackups();
    server.close(() => {
      db.$client.close();
      fs.rmSync(pidFile, { force: true });
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
