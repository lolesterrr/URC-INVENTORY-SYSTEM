/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 'Admin',
  IT_MANAGER = 'IT Manager',
  TECHNICIAN = 'Technician',
  VIEWER = 'Viewer',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  department?: string;
}

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
  status: string;
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

export interface AuditLog {
  id: string;
  user: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
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
