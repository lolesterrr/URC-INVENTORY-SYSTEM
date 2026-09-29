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

const HOUR_MS = 3_600_000;

async function main() {
  const config = loadConfig();
  const production = config.env === 'production';
  const db = openDatabase(config.dbFile);
  const sessionOpts = { idleMs: config.sessionIdleMs, maxMs: config.sessionMaxMs, secureCookie: Boolean(config.tls) };

  const app = createApp(db, { ...sessionOpts, production });

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

  const server = config.tls
    ? https.createServer({ cert: fs.readFileSync(config.tls.certFile), key: fs.readFileSync(config.tls.keyFile) }, app)
    : http.createServer(app);

  server.listen(config.port, config.host, () => {
    const scheme = config.tls ? 'https' : 'http';
    console.log(`URC Inventory running at ${scheme}://${config.host}:${config.port} (${config.env})`);
    console.log(`Database: ${config.dbFile}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.$client.close();
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
