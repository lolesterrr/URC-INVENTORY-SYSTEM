/**
 * Which CSV columns the hardware import understands. The headers are the ones the export writes, so a
 * register exported, edited in a spreadsheet and imported again lines up without being renamed.
 * `src/components/inventory/columns.tsx` is where the export headers come from; keep the two in step.
 */
import { normaliseHeader } from '../../shared/csv';

/** A field whose value comes straight from the cell, validated by the same schema `PUT /api/hardware` uses. */
export const VALUE_FIELDS = [
  'assetName', 'category', 'model', 'serialNumber', 'engravedNumber', 'operatingSystem', 'firmwareVersion',
  'ram', 'hardDisk', 'condition', 'purchaseDate', 'purchaseCost', 'orderNumber', 'supplier', 'warrantyExpires',
  'warrantyNotes', 'ipAddress', 'portCount', 'serverRole', 'cpuCores', 'connectionType', 'printTechnology',
] as const;

export type ValueField = (typeof VALUE_FIELDS)[number];
/** Resolved to a directory record by name, not stored as text. */
export type DirectoryField = 'department' | 'location';
export type ImportField = ValueField | DirectoryField;

/**
 * Header text → the field it sets. Several headers can mean the same field because each register names its
 * columns for its own kit ("Device Name", "Server Name"), and all of them are the asset name.
 */
const HEADER_FIELDS: Record<string, ImportField> = {
  'asset name': 'assetName',
  'device name': 'assetName',
  'server name': 'assetName',
  'printer name': 'assetName',
  name: 'assetName',
  category: 'category',
  type: 'category',
  department: 'department',
  location: 'location',
  'rack / room location': 'location',
  'dc location': 'location',
  'office location': 'location',
  model: 'model',
  's/n / service tag': 'serialNumber',
  'serial no.': 'serialNumber',
  'serial number': 'serialNumber',
  'engraved no.': 'engravedNumber',
  'engraved number': 'engravedNumber',
  'operating system': 'operatingSystem',
  'os / hypervisor': 'operatingSystem',
  'firmware version': 'firmwareVersion',
  ram: 'ram',
  storage: 'hardDisk',
  'storage array': 'hardDisk',
  'hard disk': 'hardDisk',
  condition: 'condition',
  purchased: 'purchaseDate',
  'purchase date': 'purchaseDate',
  warranty: 'warrantyExpires',
  'warranty expires': 'warrantyExpires',
  'warranty notes': 'warrantyNotes',
  'purchase cost (ugx)': 'purchaseCost',
  'purchase cost': 'purchaseCost',
  'lpo / order ref.': 'orderNumber',
  'order number': 'orderNumber',
  lpo: 'orderNumber',
  supplier: 'supplier',
  'management ip': 'ipAddress',
  'ip address': 'ipAddress',
  'port capacity': 'portCount',
  'port count': 'portCount',
  'server role': 'serverRole',
  'cpu cores': 'cpuCores',
  'connection type': 'connectionType',
  'print technology': 'printTechnology',
};

/** The column that says which asset a row is about. */
export const ID_HEADER = 'Asset ID';

/**
 * Columns an export writes that the import reads and then leaves alone, each with the reason shown in the
 * preview. Two kinds: fields with an endpoint of their own, and columns that merge two fields and so cannot
 * be written back without guessing which one the editor meant.
 */
const IGNORED_HEADERS: Record<string, string> = {
  state: 'A lifecycle state changes through "Change state", check-out or check-in, so the import leaves it alone.',
  'lifecycle state': 'A lifecycle state changes through "Change state", check-out or check-in, so the import leaves it alone.',
  'user / assignee': 'The assignee changes through check-out and check-in, so the import leaves it alone.',
  assignee: 'The assignee changes through check-out and check-in, so the import leaves it alone.',
  'os / details': 'This column merges Operating System and Firmware Version. Use either of those headers to set one.',
  'firmware / os': 'This column merges Firmware Version and Operating System. Use either of those headers to set one.',
};

export interface HeaderMatch {
  /** The field this column sets, or null when the column is read and left alone. */
  field: ImportField | null;
  /** Why the column is left alone, for the preview. */
  reason?: string;
}

/** Matches one header, ignoring case and surrounding spaces. Returns null when the column is unknown. */
export function matchHeader(header: string): HeaderMatch | null {
  const key = normaliseHeader(header);
  if (key === normaliseHeader(ID_HEADER) || key === 'id') return { field: null, reason: 'identifies the asset' };
  const field = HEADER_FIELDS[key];
  if (field) return { field };
  const reason = IGNORED_HEADERS[key];
  return reason ? { field: null, reason } : null;
}

export const isIdHeader = (header: string) => {
  const key = normaliseHeader(header);
  return key === normaliseHeader(ID_HEADER) || key === 'id';
};
