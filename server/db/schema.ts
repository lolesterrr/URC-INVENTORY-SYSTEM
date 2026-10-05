import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { LIFECYCLE_STATES, type LifecycleState } from '../../shared/lifecycle';

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

export const ROLES = ['Admin', 'IT Officer', 'Manager', 'Auditor'] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role', { enum: ROLES }).notNull(),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(true),
  disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: text('locked_until'),
  lastLoginAt: text('last_login_at'),
  ...timestamps,
});

export const sessions = sqliteTable(
  'sessions',
  {
    // SHA-256 of the cookie token; the raw token is never stored.
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  t => [index('sessions_user_idx').on(t.userId)],
);

// Hardware lifecycle states and allowed moves: shared/lifecycle.ts. Changes go through POST /api/hardware/:id/lifecycle.
export { LIFECYCLE_STATES, type LifecycleState };

export const hardware = sqliteTable(
  'hardware',
  {
    id: text('id').primaryKey(),
    assetName: text('asset_name').notNull(),
    category: text('category').notNull().default('Other'),
    model: text('model').notNull().default(''),
    serialNumber: text('serial_number').notNull().default(''),
    engravedNumber: text('engraved_number').notNull().default(''),
    operatingSystem: text('operating_system').notNull().default(''),
    ram: text('ram').notNull().default(''),
    hardDisk: text('hard_disk').notNull().default(''),
    lifecycleState: text('lifecycle_state', { enum: LIFECYCLE_STATES }).notNull().default('In Stock'),
    lifecycleChangedAt: text('lifecycle_changed_at'),
    /** Free-text condition note, e.g. "Faulty" or "Upgrade to 1TB". */
    condition: text('condition').notNull().default(''),
    department: text('department').notNull().default(''),
    location: text('location').notNull().default(''),
    assignedTo: text('assigned_to').notNull().default('Unassigned'),
    yearOfPurchase: text('year_of_purchase').notNull().default(''),
    dateAcquired: text('date_acquired').notNull().default(''),
    cost: real('cost').notNull().default(0),
    stockLevel: integer('stock_level').notNull().default(1),
    reorderLevel: integer('reorder_level').notNull().default(0),
    ipAddress: text('ip_address').notNull().default(''),
    portCount: text('port_count').notNull().default(''),
    firmwareVersion: text('firmware_version').notNull().default(''),
    serverRole: text('server_role').notNull().default(''),
    cpuCores: text('cpu_cores').notNull().default(''),
    connectionType: text('connection_type').notNull().default(''),
    printTechnology: text('print_technology').notNull().default(''),
    deletedAt: text('deleted_at'),
    ...timestamps,
  },
  t => [
    index('hardware_serial_idx').on(t.serialNumber),
    index('hardware_department_idx').on(t.department),
    index('hardware_lifecycle_idx').on(t.lifecycleState),
  ],
);

// One open row (checked_in_at IS NULL) per hardware asset at a time, enforced by a partial unique index.
// Changes go through POST /api/hardware/:id/checkout and /checkin.
export const assetAssignments = sqliteTable(
  'asset_assignments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    hardwareId: text('hardware_id').notNull().references(() => hardware.id),
    assignee: text('assignee').notNull(),
    checkedOutAt: text('checked_out_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    checkedOutBy: text('checked_out_by').notNull(),
    dueBack: text('due_back'),
    checkedInAt: text('checked_in_at'),
    checkedInBy: text('checked_in_by'),
    notes: text('notes').notNull().default(''),
  },
  t => [
    index('asset_assignments_hardware_idx').on(t.hardwareId),
    uniqueIndex('asset_assignments_open_idx').on(t.hardwareId).where(sql`${t.checkedInAt} is null`),
  ],
);

export const software = sqliteTable('software', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  department: text('department').notNull().default(''),
  licenseKey: text('license_key').notNull().default(''),
  seatCapacity: integer('seat_capacity').notNull().default(0),
  activeSeats: integer('active_seats').notNull().default(0),
  expiryDate: text('expiry_date').notNull().default(''),
  subscriptionCost: real('subscription_cost').notNull().default(0),
  vendor: text('vendor').notNull().default(''),
  status: text('status').notNull().default('Active'),
  deletedAt: text('deleted_at'),
  ...timestamps,
});

export const serverComponents = sqliteTable('server_components', {
  id: text('id').primaryKey(),
  serverName: text('server_name').notNull(),
  partName: text('part_name').notNull(),
  serialNumber: text('serial_number').notNull().default(''),
  category: text('category').notNull(),
  status: text('status').notNull().default('Healthy'),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  deletedAt: text('deleted_at'),
  ...timestamps,
});

export const alerts = sqliteTable(
  'alerts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: ['low_stock', 'license_expiry', 'maintenance'] }).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    itemType: text('item_type', { enum: ['hardware', 'software', 'server'] }).notNull(),
    itemId: text('item_id').notNull(),
    status: text('status', { enum: ['unread', 'resolved'] }).notNull().default('unread'),
    emailSent: integer('email_sent', { mode: 'boolean' }).notNull().default(false),
    resolvedBy: text('resolved_by'),
    resolvedAt: text('resolved_at'),
    createdAt: timestamps.createdAt,
  },
  t => [index('alerts_item_idx').on(t.itemId, t.type, t.status)],
);

// Append-only: UPDATE and DELETE are blocked by triggers in the migration.
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    timestamp: text('timestamp').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    userId: text('user_id'),
    username: text('username').notNull(),
    role: text('role').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    details: text('details').notNull(),
    before: text('before'),
    after: text('after'),
    ip: text('ip'),
  },
  t => [index('audit_entity_idx').on(t.entityType, t.entityId)],
);
