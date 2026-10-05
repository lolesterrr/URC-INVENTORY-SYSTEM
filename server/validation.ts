import type { Response } from 'express';
import { z } from 'zod';
import { INITIAL_STATES, LIFECYCLE_STATES } from '../shared/lifecycle';

const text = (max = 200) => z.string().trim().max(max);
const count = z.coerce.number().int().min(0).max(1_000_000);
const money = z.coerce.number().min(0).max(1e13);
const isoDate = z.union([z.literal(''), z.iso.date()]);

export const idSchema = z
  .string()
  .trim()
  .min(1, 'ID is required')
  .max(64)
  .regex(/^[A-Za-z0-9._\/-]+$/, 'ID may only contain letters, digits, and . _ / -');

export const HARDWARE_CATEGORIES = ['Laptop', 'Desktop', 'Switch', 'Router', 'Server', 'Printer', 'Other'] as const;
export const SOFTWARE_CATEGORIES = ['Operating System', 'GIS', 'Office', 'Engineering', 'Database', 'Security'] as const;
export const COMPONENT_CATEGORIES = ['RAM', 'Storage', 'CPU', 'Power Supply', 'NIC'] as const;

// Accepts the field names the existing UI sends (`name`/`assignee` are legacy aliases).
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
  department: text(),
  location: text(),
  user: text(),
  assignee: text(),
  yearOfPurchase: z.union([z.literal(''), z.string().regex(/^(19|20)\d{2}$/, 'Year must be four digits')]),
  dateAcquired: isoDate,
  cost: money,
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
export const hardwareCreate = hardwareFields.extend({ id: idSchema, lifecycleState: z.enum(INITIAL_STATES).optional() });

export const hardwareLifecycle = z.object({
  to: z.enum(LIFECYCLE_STATES),
  note: text(500).optional().default(''),
});

export const hardwareCheckout = z.object({
  assignee: text(200).min(1, 'Assignee is required'),
  dueBack: isoDate.optional().default(''),
  notes: text(500).optional().default(''),
});

export const hardwareCheckin = z.object({
  notes: text(500).optional().default(''),
});

export const softwareFields = z.object({
  name: text().min(1),
  category: z.enum(SOFTWARE_CATEGORIES),
  department: text(),
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
