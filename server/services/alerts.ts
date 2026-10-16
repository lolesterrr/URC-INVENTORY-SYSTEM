import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '../db';
import { alerts, hardware, serverComponents, software } from '../db/schema';
import { DEFAULT_WARRANTY_WARNING_DAYS, warrantyStatus, warrantyWhen } from '../../shared/purchase';

type NewAlert = typeof alerts.$inferInsert;

const DAY_MS = 86_400_000;
export const LICENSE_EXPIRY_WARNING_DAYS = 30;

export interface AlertCheckOptions {
  now?: Date;
  /** Days before a warranty ends that it is reported. Comes from WARRANTY_WARNING_DAYS. */
  warrantyWarningDays?: number;
}

/** Scans inventory and inserts an unread alert for each new problem. Existing unread alerts are not duplicated. */
export function runAlertChecks(db: DB, options: AlertCheckOptions = {}): number {
  const now = options.now ?? new Date();
  const warrantyWarningDays = options.warrantyWarningDays ?? DEFAULT_WARRANTY_WARNING_DAYS;
  const found: NewAlert[] = [];

  for (const hw of db.select().from(hardware).where(isNull(hardware.deletedAt)).all()) {
    // Cover on an asset that is out of service is not news, so only assets still in use are checked.
    if (hw.lifecycleState !== 'Retired' && hw.lifecycleState !== 'Disposed') {
      const warranty = warrantyStatus(hw.warrantyExpires, now, warrantyWarningDays);
      if (warranty.state === 'expired') {
        found.push({
          type: 'warranty_expiry',
          itemType: 'hardware',
          itemId: hw.id,
          title: `Warranty expired: ${hw.assetName}`,
          message: `The warranty on ${hw.assetName} (${hw.id}) ended on ${hw.warrantyExpires}, ${warrantyWhen(warranty.days)}. Repairs are now chargeable.`,
        });
      } else if (warranty.state === 'expiring') {
        found.push({
          type: 'warranty_expiry',
          itemType: 'hardware',
          itemId: hw.id,
          title: `Warranty ending: ${hw.assetName}`,
          message: `The warranty on ${hw.assetName} (${hw.id}) ends on ${hw.warrantyExpires}, ${warrantyWhen(warranty.days)}. Plan an extension or a replacement.`,
        });
      }
    }
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
