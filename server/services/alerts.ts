import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '../db';
import { alerts, hardware, serverComponents, software } from '../db/schema';

type NewAlert = typeof alerts.$inferInsert;

const DAY_MS = 86_400_000;
export const LICENSE_EXPIRY_WARNING_DAYS = 30;

/** Scans inventory and inserts an unread alert for each new problem. Existing unread alerts are not duplicated. */
export function runAlertChecks(db: DB, now: Date = new Date()): number {
  const found: NewAlert[] = [];

  for (const hw of db.select().from(hardware).where(isNull(hardware.deletedAt)).all()) {
    if (hw.reorderLevel > 0 && hw.stockLevel <= hw.reorderLevel) {
      found.push({
        type: 'low_stock',
        itemType: 'hardware',
        itemId: hw.id,
        title: `Low hardware stock: ${hw.assetName}`,
        message: `Stock for ${hw.assetName} is ${hw.stockLevel} (reorder level ${hw.reorderLevel}).`,
      });
    }
  }

  for (const sw of db.select().from(software).where(isNull(software.deletedAt)).all()) {
    const expiry = Date.parse(sw.expiryDate);
    if (Number.isNaN(expiry)) continue;
    const days = Math.ceil((expiry - now.getTime()) / DAY_MS);
    if (days < 0) {
      found.push({
        type: 'license_expiry',
        itemType: 'software',
        itemId: sw.id,
        title: `Expired licence: ${sw.name}`,
        message: `The licence for ${sw.name} expired on ${sw.expiryDate} (${Math.abs(days)} days ago).`,
      });
    } else if (days <= LICENSE_EXPIRY_WARNING_DAYS) {
      found.push({
        type: 'license_expiry',
        itemType: 'software',
        itemId: sw.id,
        title: `Licence expiring: ${sw.name}`,
        message: `The licence for ${sw.name} expires on ${sw.expiryDate} (in ${days} days). Plan the renewal.`,
      });
    }
  }

  for (const sc of db.select().from(serverComponents).where(isNull(serverComponents.deletedAt)).all()) {
    if (sc.quantity <= sc.reorderLevel) {
      found.push({
        type: 'low_stock',
        itemType: 'server',
        itemId: sc.id,
        title: `Low server component: ${sc.partName}`,
        message: `${sc.partName} for ${sc.serverName}: ${sc.quantity} left (reorder level ${sc.reorderLevel}).`,
      });
    } else if (sc.status === 'Faulty') {
      found.push({
        type: 'maintenance',
        itemType: 'server',
        itemId: sc.id,
        title: `Faulty component: ${sc.partName}`,
        message: `${sc.partName} on ${sc.serverName} is marked Faulty and needs repair or replacement.`,
      });
    }
  }

  let inserted = 0;
  db.transaction(tx => {
    for (const alert of found) {
      const open = tx
        .select({ id: alerts.id })
        .from(alerts)
        .where(and(eq(alerts.itemId, alert.itemId), eq(alerts.type, alert.type), eq(alerts.status, 'unread')))
        .get();
      if (!open) {
        tx.insert(alerts).values(alert).run();
        inserted++;
      }
    }
  });
  return inserted;
}
