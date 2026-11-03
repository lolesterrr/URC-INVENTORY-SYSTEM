import { Router } from 'express';
import type { DB } from '../db';
import { requirePermission } from '../auth/session';
import { recordAudit } from '../services/audit';
import { loadSettings, unknownCategories, updateSettings } from '../services/settings';
import { parseBody, settingsUpdate } from '../validation';

/** Organisation-wide settings. Reading needs only assets:read (the reports and label screens read them like any other figure); writing needs settings:manage (Admin). */
export function settingsRouter(db: DB) {
  const router = Router();

  router.get('/', requirePermission('assets:read'), (_req, res) => {
    res.json(loadSettings(db));
  });

  router.put('/', requirePermission('settings:manage'), (req, res) => {
    const body = parseBody(settingsUpdate, req.body, res);
    if (!body) return;
    const bad = unknownCategories(body.replacementPolicy);
    if (bad.length) {
      return res.status(400).json({ error: `Not a hardware category: ${bad.join(', ')}.`, fields: bad.map(c => ({ field: `replacementPolicy.${c}`, message: 'Unknown category' })) });
    }
    if (body.defaultLabelPreset === 'custom' && (body.defaultLabelWidthMm == null || body.defaultLabelHeightMm == null)) {
      return res.status(400).json({ error: 'A custom label size needs both a width and a height.', fields: [{ field: 'defaultLabelWidthMm', message: 'Required for a custom size' }] });
    }

    const before = loadSettings(db);
    updateSettings(db, body);
    const after = loadSettings(db);
    recordAudit(db, req, { action: 'Update Settings', details: 'Changed the organisation settings.', entityType: 'settings', entityId: '1', before, after });
    res.json(after);
  });

  return router;
}
