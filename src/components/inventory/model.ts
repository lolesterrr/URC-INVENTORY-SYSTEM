/** Pure helpers for the inventory registers: grouping, filtering, CSV and ID suggestions. No React here. */
import type { HardwareAsset, ServerComponent, SoftwareLicense } from '../../types';
import { LIFECYCLE_STATES } from '../../../shared/lifecycle';

export type InventoryTab = 'hardware' | 'software' | 'servers';
export type HardwareCategory = NonNullable<HardwareAsset['category']>;
export type HardwareGroup = 'All' | 'Laptop' | 'Desktop' | 'Network' | 'Server' | 'Printer';

export const HARDWARE_CATEGORIES: HardwareCategory[] = ['Laptop', 'Desktop', 'Switch', 'Router', 'Server', 'Printer', 'Other'];
export const SOFTWARE_CATEGORIES: SoftwareLicense['category'][] = ['Operating System', 'GIS', 'Office', 'Engineering', 'Database', 'Security'];
export const COMPONENT_CATEGORIES: ServerComponent['category'][] = ['RAM', 'Storage', 'CPU', 'Power Supply', 'NIC'];

export const STATUSES: Record<InventoryTab, string[]> = {
  hardware: [...LIFECYCLE_STATES],
  software: ['Active', 'Expiring Soon', 'Expired'],
  servers: ['Active', 'Faulty', 'Spare'],
};

export const HARDWARE_GROUPS: { id: HardwareGroup; label: string; categories: HardwareCategory[] | null }[] = [
  { id: 'All', label: 'All Hardware', categories: null },
  { id: 'Laptop', label: 'Laptops', categories: ['Laptop'] },
  { id: 'Desktop', label: 'Desktops', categories: ['Desktop'] },
  { id: 'Network', label: 'Switches & Routers', categories: ['Switch', 'Router'] },
  { id: 'Server', label: 'Servers', categories: ['Server'] },
  { id: 'Printer', label: 'Printers & Peripherals', categories: ['Printer'] },
];

export const inGroup = (h: HardwareAsset, group: HardwareGroup) => {
  const categories = HARDWARE_GROUPS.find(g => g.id === group)?.categories;
  return !categories || (h.category !== undefined && categories.includes(h.category));
};

// The API returns both the current names and legacy aliases; prefer the current ones.
export const assetName = (h: HardwareAsset) => h.assetName || h.name || '';
export const assignee = (h: HardwareAsset) => h.user || h.assignee || '';

export interface Filters {
  search: string;
  category: string;
  status: string;
  department: string;
}

export const EMPTY_FILTERS: Filters = { search: '', category: 'All', status: 'All', department: 'All' };

const matchesText = (query: string, values: (string | undefined)[]) => {
  const q = query.trim().toLowerCase();
  return !q || values.some(v => (v ?? '').toLowerCase().includes(q));
};
const matchesChoice = (choice: string, value: string | undefined) => choice === 'All' || value === choice;

export function filterHardware(list: HardwareAsset[], f: Filters, group: HardwareGroup) {
  return list.filter(
    h =>
      inGroup(h, group) &&
      matchesChoice(f.category, h.category) &&
      matchesChoice(f.status, h.lifecycleState) &&
      matchesChoice(f.department, h.department) &&
      matchesText(f.search, [
        h.id, assetName(h), assignee(h), h.condition, h.serialNumber, h.engravedNumber, h.model, h.location, h.operatingSystem,
        h.ipAddress, h.firmwareVersion, h.serverRole, h.ram, h.hardDisk, h.department, h.yearOfPurchase,
      ]),
  );
}

export function filterSoftware(list: SoftwareLicense[], f: Filters) {
  return list.filter(
    s =>
      matchesChoice(f.category, s.category) &&
      matchesChoice(f.status, s.status) &&
      matchesChoice(f.department, s.department) &&
      matchesText(f.search, [s.id, s.name, s.vendor, s.department]),
  );
}

export function filterServerComponents(list: ServerComponent[], f: Filters) {
  return list.filter(
    c =>
      matchesChoice(f.category, c.category) &&
      matchesChoice(f.status, c.status) &&
      matchesText(f.search, [c.id, c.partName, c.serverName, c.serialNumber]),
  );
}

/** Suggests the next ID in sequence, e.g. HW-082 → HW-083. */
export function nextId(prefix: string, ids: string[]): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  const max = ids.reduce((m, id) => Math.max(m, Number(re.exec(id)?.[1] ?? 0)), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** Quotes a CSV cell and neutralises values a spreadsheet would run as a formula. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n');
}
