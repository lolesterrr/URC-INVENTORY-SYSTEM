import { Router } from 'express';
import { requirePermission } from '../auth/session';
import type { BackupService } from '../services/backup';

/** Admin-only. There is deliberately no download route: backups contain password hashes. */
export function backupsRouter(backups: BackupService) {
  const router = Router();
  router.use(requirePermission('backups:manage'));

  router.get('/', (_req, res) => {
    const { dir, copyDir, hour, retention } = backups.options;
    res.json({
      backups: backups.list(),
      last: backups.last,
      running: backups.isRunning,
      settings: { directory: dir, copyDirectory: copyDir, hour, retention },
      nextRunAt: backups.nextRunAt().toISOString(),
    });
  });

  router.post('/', async (req, res) => {
    if (backups.isRunning) return res.status(409).json({ error: 'A backup is already running. Try again in a moment.' });
    const result = await backups.run('manual', req);
    if (!result.ok) return res.status(500).json({ error: `Backup failed: ${result.error}` });
    res.status(201).json(result);
  });

  return router;
}
