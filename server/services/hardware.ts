/** Pure hardware helpers used by the routes, the legacy import and the CSV import. */
import { hardware } from '../db/schema';
import { HARDWARE_CATEGORIES } from '../validation';
import type { Directory } from './directory';

type Category = (typeof HARDWARE_CATEGORIES)[number];

/** Best guess at a category from the asset name and model, for records that do not state one. */
export function detectCategory(name: string, model: string): Category {
  const t = `${name} ${model}`.toLowerCase();
  if (/switch|catalyst/.test(t)) return 'Switch';
  if (/router|unifi|gateway|access point/.test(t)) return 'Router';
  if (/server|poweredge|proliant/.test(t)) return 'Server';
  if (/printer|laserjet|inkjet|epson/.test(t)) return 'Printer';
  if (/laptop|latitude|thinkpad|macbook|notebook/.test(t)) return 'Laptop';
  if (/desktop|thinkcentre|optiplex|workstation|elitedesk/.test(t)) return 'Desktop';
  return 'Other';
}

/**
 * The row plus display names for its department, location (full path) and assignee. This is the shape the
 * audit log stores, so a History entry reads in names rather than record ids.
 */
export function hardwareSnapshot(r: typeof hardware.$inferSelect, dir: Directory) {
  return { ...r, department: dir.department(r.departmentId), location: dir.location(r.locationId), assignee: dir.staff(r.assigneeId) };
}
