import type { Response } from 'express';
import { z } from 'zod';
import { INITIAL_STATES, LIFECYCLE_STATES } from '../shared/lifecycle';
import { isPurchaseDate } from '../shared/purchase';

const text = (max = 200) => z.string().trim().max(max);
const count = z.coerce.number().int().min(0).max(1_000_000);
const money = z.coerce.number().min(0).max(1e13);
const isoDate = z.union([z.literal(''), z.iso.date()]);
/** Either a year ('2019', all the old register kept) or an exact date. Never a day invented from a year. */
const purchaseDate = z.string().trim().refine(isPurchaseDate, 'Use a year (e.g. 2019) or an exact date (e.g. 2019-03-14)');
/** A price that may be unknown: '' and null are stored as NULL, so "unknown" is never saved as 0. */
const optionalMoney = z.union([z.literal(''), z.null(), money]).transform(v => (typeof v === 'number' ? v : null));
/** A directory record id (department, location, staff); null clears the reference. */
const refId = z.number().int().positive().nullable();

export const idSchema = z
  .string()
  .trim()
  .min(1, 'ID is required')
  .max(64)
  .regex(/^[A-Za-z0-9._\/-]+$/, 'ID may only contain letters, digits, and . _ / -');

export const HARDWARE_CATEGORIES = ['Laptop', 'Desktop', 'Switch', 'Router', 'Server', 'Printer', 'Other'] as const;
export const SOFTWARE_CATEGORIES = ['Operating System', 'GIS', 'Office', 'Engineering', 'Database', 'Security'] as const;
export const COMPONENT_CATEGORIES = ['RAM', 'Storage', 'CPU', 'Power Supply', 'NIC'] as const;

// Accepts the field names the existing UI sends (`name` is a legacy alias). The assignee is set by check-out only.
export const hardwareFields = z.object({
  assetName: text().min(1),
  name: text().min(1),
  category: z.enum(HARDWARE_CATEGORIES),
  model: text(),
  serialNumber: text(100),
  engravedNumber: text(100),
  operatingSystem: text(100),
  ram: text(50),
  hardDisk: text(50),
  condition: text(100),
  departmentId: refId,
  locationId: refId,
  purchaseDate,
  purchaseCost: optionalMoney,
  orderNumber: text(100),
  supplier: text(),
  warrantyExpires: isoDate,
  warrantyNotes: text(500),
  stockLevel: count,
  reorderLevel: count,
  ipAddress: text(45),
  portCount: text(20),
  firmwareVersion: text(100),
  serverRole: text(100),
  cpuCores: text(20),
  connectionType: text(50),
  printTechnology: text(50),
}).partial();

// The lifecycle state is set on create only; later changes go through hardwareLifecycle.
// An assignee is accepted only for an asset that starts Deployed (it opens its first check-out).
export const hardwareCreate = hardwareFields.extend({ id: idSchema, lifecycleState: z.enum(INITIAL_STATES).optional(), assigneeId: refId.optional() });

/**
 * A CSV bulk update of the register. The file arrives as text and is parsed on the server, so the rules that
 * decide what may be written are the server's own. `dryRun` asks for the preview.
 */
export const hardwareImport = z.object({
  csv: z.string().min(1, 'Choose a CSV file to import.').max(5_000_000, 'That file is too large to import at once; split it up.'),
  dryRun: z.boolean(),
  createMissingDirectory: z.boolean().optional().default(false),
});

export const hardwareLifecycle = z.object({
  to: z.enum(LIFECYCLE_STATES),
  note: text(500).optional().default(''),
});

export const hardwareCheckout = z.object({
  // null deploys a shared device (switch, shared printer) with no individual assignee. It must be sent explicitly.
  staffId: z.number({ error: 'Pick a staff member, or deploy it as shared' }).int().positive().nullable(),
  dueBack: isoDate.optional().default(''),
  notes: text(500).optional().default(''),
});

export const hardwareCheckin = z.object({
  notes: text(500).optional().default(''),
});

export const softwareFields = z.object({
  name: text().min(1),
  category: z.enum(SOFTWARE_CATEGORIES),
  departmentId: refId,
  licenseKey: text(500),
  seatCapacity: count,
  activeSeats: count,
  expiryDate: isoDate,
  subscriptionCost: money,
  vendor: text(),
  status: text(50).min(1),
});

export const softwareCreate = softwareFields.partial().required({ name: true, category: true }).extend({ id: idSchema });
export const softwareUpdate = softwareFields.partial();

export const componentFields = z.object({
  serverName: text().min(1),
  partName: text().min(1),
  serialNumber: text(100),
  category: z.enum(COMPONENT_CATEGORIES),
  status: text(50).min(1),
  quantity: count,
  reorderLevel: count,
});

export const componentCreate = componentFields.partial({ serialNumber: true, status: true, quantity: true, reorderLevel: true }).extend({ id: idSchema });
export const componentUpdate = componentFields.partial();

const recordName = text(100).min(1, 'Name is required');

/** Merging a duplicate directory record into the one that is kept. */
export const mergeInput = z.object({ intoId: z.number({ error: 'Pick the record to keep' }).int().positive() });

export const departmentInput = z.object({ name: recordName });

export const locationInput = z.object({ name: recordName, parentId: refId.optional().default(null) });
export const locationUpdate = z.object({ name: recordName, parentId: refId }).partial();

export const staffInput = z.object({
  fullName: text(200).min(1, 'Full name is required'),
  staffNumber: text(50).optional().default(''),
  departmentId: refId.optional().default(null),
});
export const staffUpdate = z.object({ fullName: text(200).min(1, 'Full name is required'), staffNumber: text(50), departmentId: refId }).partial();

/** Parses a request body; on failure sends a 400 and returns null. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown, res: Response): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  res.status(400).json({
    error: 'Some fields are invalid.',
    fields: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
  });
  return null;
}
