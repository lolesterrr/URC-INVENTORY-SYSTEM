/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LifecycleState } from '../shared/lifecycle';

export type { LifecycleState };

export enum UserRole {
  ADMIN = 'Admin',
  IT_OFFICER = 'IT Officer',
  MANAGER = 'Manager',
  AUDITOR = 'Auditor',
}

export type Permission =
  | 'assets:read'
  | 'assets:write'
  | 'assets:delete'
  | 'assets:dispose'
  | 'directory:manage'
  | 'alerts:manage'
  | 'audit:read'
  | 'users:manage'
  | 'backups:manage';

/** The signed-in user, as returned by /api/auth/me. */
export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
  permissions: Permission[];
}

/** A row in the Admin user-management list. */
export interface ManagedUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  disabled: boolean;
  mustChangePassword: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Response of GET /api/backups (Admin only). */
export interface BackupStatus {
  backups: { name: string; sizeBytes: number; createdAt: string; copied: boolean }[];
  last: { ok: boolean; name: string | null; finishedAt: string; error: string | null; copyError: string | null } | null;
  running: boolean;
  settings: {
    directory: string;
    copyDirectory: string | null;
    hour: number;
    retention: { daily: number; weekly: number; monthly: number };
  };
  nextRunAt: string;
}

/** Roles that may create, edit and archive inventory records. */
export const canEditInventory = (role: UserRole) => role === UserRole.ADMIN || role === UserRole.IT_OFFICER;

export interface HardwareAsset {
  id: string;
  user: string;
  assetName: string;
  yearOfPurchase: string;
  location: string;
  model: string;
  serialNumber: string;
  engravedNumber: string;
  operatingSystem: string;
  ram: string;
  hardDisk: string;
  lifecycleState: LifecycleState;
  lifecycleChangedAt?: string | null;
  /** Free-text condition note, e.g. "Faulty". */
  condition: string;
  department?: string;
  // Category-specific unique fields
  ipAddress?: string;
  portCount?: string;
  firmwareVersion?: string;
  serverRole?: string;
  cpuCores?: string;
  connectionType?: string;
  printTechnology?: string;
  // Additional helpful compatibility fields
  name?: string;
  assignee?: string;
  category?: 'Laptop' | 'Desktop' | 'Switch' | 'Router' | 'Server' | 'Printer' | 'Other';
  cost?: number;
  stockLevel?: number;
  reorderLevel?: number;
  dateAcquired?: string;
}

export interface SoftwareLicense {
  id: string;
  name: string;
  category: 'Operating System' | 'GIS' | 'Office' | 'Engineering' | 'Database' | 'Security';
  department?: string;
  licenseKey: string;
  seatCapacity: number;
  activeSeats: number;
  expiryDate: string;
  subscriptionCost: number;
  vendor: string;
  status: string;
}

export const URC_DEPARTMENTS = [
  "MD's Office",
  'HR OFFICE',
  'PLANNING OFFICE',
  'LEGAL OFFICE',
  'HEALTH & SAFETY',
  'AUDIT DEPARTMENT',
  'PROCUREMENT',
  'FINANCE DEPARTMENT',
  'INFORMATION COMMUNICATION AND TECHNOLOGY',
  'OPERATIONS DEPARTMENT',
] as const;

export interface ServerComponent {
  id: string;
  serverName: string;
  partName: string;
  serialNumber: string;
  category: 'RAM' | 'Storage' | 'CPU' | 'Power Supply' | 'NIC';
  status: string;
  quantity: number;
  reorderLevel: number;
}

export interface Alert {
  id: string;
  type: 'low_stock' | 'license_expiry' | 'maintenance';
  title: string;
  message: string;
  timestamp: string;
  itemType: 'hardware' | 'software' | 'server';
  itemId: string;
  emailSent: boolean;
  emailTo: string;
  status: 'unread' | 'resolved';
}

/** One check-out/check-in cycle for a hardware asset, from GET /api/hardware/:id/assignments. */
export interface AssetAssignment {
  id: number;
  hardwareId: string;
  assignee: string;
  checkedOutAt: string;
  checkedOutBy: string;
  dueBack: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  notes: string;
  open: boolean;
}

export interface AuditLog {
  id: string;
  user: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface DashboardStats {
  totalHardwareCount: number;
  totalHardwareValue: number;
  totalActiveLicenses: number;
  totalLicenseCost: number;
  totalServerComponents: number;
  lowStockAlertCount: number;
  expiringLicensesCount: number;
}
