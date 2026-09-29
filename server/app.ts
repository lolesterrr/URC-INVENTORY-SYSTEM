import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { DB } from './db';
import { requireAuth, sessionMiddleware, type SessionOptions } from './auth/session';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { hardwareRouter } from './routes/hardware';
import { softwareRouter } from './routes/software';
import { serverComponentsRouter } from './routes/serverComponents';
import { alertsRouter } from './routes/alerts';
import { analyticsRouter, auditLogsRouter } from './routes/reports';

export interface AppOptions extends SessionOptions {
  production: boolean;
  loginRateLimit?: number;
}

/** Builds the Express app with all API routes. Static/Vite serving is added by the caller. */
export function createApp(db: DB, opts: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  app.use(
    helmet({
      // Vite's dev server injects inline scripts, so the strict policy only applies to production builds.
      contentSecurityPolicy: opts.production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: opts.secureCookie ? [] : null,
            },
          }
        : false,
      strictTransportSecurity: opts.secureCookie,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware(db, opts));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRouter(db, opts));

  const api = express.Router();
  api.use(requireAuth);
  api.use('/users', usersRouter(db));
  api.use('/hardware', hardwareRouter(db));
  api.use('/software', softwareRouter(db));
  api.use('/server-components', serverComponentsRouter(db));
  api.use('/alerts', alertsRouter(db));
  api.use('/audit-logs', auditLogsRouter(db));
  api.use('/analytics', analyticsRouter(db));
  app.use('/api', api);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Malformed JSON body.' });
    console.error('Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
