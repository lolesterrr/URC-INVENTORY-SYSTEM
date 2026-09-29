import { Router } from 'express';
import { desc, eq, isNull } from 'drizzle-orm';
import type { DB } from '../db';
import { alerts, auditLog, hardware, serverComponents, software } from '../db/schema';
import { requirePermission } from '../auth/session';

const tally = <T>(items: T[], key: (i: T) => string, amount: (i: T) => number = () => 1) =>
  items.reduce<Record<string, number>>((acc, i) => {
    const k = key(i) || 'Unknown';
    acc[k] = (acc[k] ?? 0) + amount(i);
    return acc;
  }, {});

/** Audit row in the shape the UI expects (before/after parsed from JSON). */
export function auditToApi(r: typeof auditLog.$inferSelect) {
  return {
    id: String(r.id),
    user: r.username,
    role: r.role,
    action: r.action,
    details: r.details,
    timestamp: r.timestamp,
    entityType: r.entityType,
    entityId: r.entityId,
    before: r.before ? JSON.parse(r.before) : null,
    after: r.after ? JSON.parse(r.after) : null,
  };
}

export function auditLogsRouter(db: DB) {
  const router = Router();
  router.get('/', requirePermission('audit:read'), (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);
    const rows = db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit).all();
    res.json(rows.map(auditToApi));
  });
  return router;
}

export function analyticsRouter(db: DB) {
  const router = Router();
  router.get('/', requirePermission('assets:read'), (_req, res) => {
    const hw = db.select().from(hardware).where(isNull(hardware.deletedAt)).all();
    const sw = db.select().from(software).where(isNull(software.deletedAt)).all();
    const sc = db.select().from(serverComponents).where(isNull(serverComponents.deletedAt)).all();
    const openAlerts = db.select({ type: alerts.type }).from(alerts).where(eq(alerts.status, 'unread')).all();

    res.json({
      totalHardwareCount: hw.length,
      totalHardwareValue: hw.reduce((a, h) => a + h.cost, 0),
      totalActiveLicenses: sw.filter(s => s.status === 'Active' || s.status === 'Expiring Soon').length,
      totalLicenseCost: sw.reduce((a, s) => a + s.subscriptionCost, 0),
      totalServerComponents: sc.reduce((a, s) => a + s.quantity, 0),
      lowStockAlertCount: openAlerts.filter(a => a.type === 'low_stock').length,
      expiringLicensesCount: openAlerts.filter(a => a.type === 'license_expiry').length,
      categoryHardwareBreakdown: tally(hw, h => h.category),
      softwareStatusBreakdown: tally(sw, s => s.status),
      serverComponentCategoryBreakdown: tally(sc, s => s.category, s => s.quantity),
    });
  });
  return router;
}
