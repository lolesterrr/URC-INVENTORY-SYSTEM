import { Router } from 'express';
import { desc, eq, isNull } from 'drizzle-orm';
import type { DB } from '../db';
import { alerts, auditLog, hardware, serverComponents, software } from '../db/schema';
import { requirePermission } from '../auth/session';
import { DEFAULT_WARRANTY_WARNING_DAYS } from '../../shared/purchase';

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

export function analyticsRouter(db: DB, warrantyWarningDays = DEFAULT_WARRANTY_WARNING_DAYS) {
  const router = Router();
  router.get('/', requirePermission('assets:read'), (_req, res) => {
    const hw = db.select().from(hardware).where(isNull(hardware.deletedAt)).all();
    const sw = db.select().from(software).where(isNull(software.deletedAt)).all();
    const sc = db.select().from(serverComponents).where(isNull(serverComponents.deletedAt)).all();
    const openAlerts = db.select({ type: alerts.type }).from(alerts).where(eq(alerts.status, 'unread')).all();

    // Most assets have no recorded price, so a sum of what is known would read as the whole register's
    // worth. Report the count it covers, and null rather than 0 when nothing is priced at all.
    const costed = hw.filter(h => h.purchaseCost !== null);

    res.json({
      totalHardwareCount: hw.length,
      totalHardwareValue: costed.length ? costed.reduce((a, h) => a + (h.purchaseCost ?? 0), 0) : null,
      costedHardwareCount: costed.length,
      totalActiveLicenses: sw.filter(s => s.status === 'Active' || s.status === 'Expiring Soon').length,
      totalLicenseCost: sw.reduce((a, s) => a + s.subscriptionCost, 0),
      totalServerComponents: sc.reduce((a, s) => a + s.quantity, 0),
      lowStockAlertCount: openAlerts.filter(a => a.type === 'low_stock').length,
      expiringLicensesCount: openAlerts.filter(a => a.type === 'license_expiry').length,
      expiringWarrantiesCount: openAlerts.filter(a => a.type === 'warranty_expiry').length,
      warrantyWarningDays,
      categoryHardwareBreakdown: tally(hw, h => h.category),
      softwareStatusBreakdown: tally(sw, s => s.status),
      serverComponentCategoryBreakdown: tally(sc, s => s.category, s => s.quantity),
    });
  });
  return router;
}
