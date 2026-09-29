import type { Role } from '../db/schema';

export const PERMISSIONS = {
  'assets:read': ['Admin', 'IT Officer', 'Manager', 'Auditor'],
  'assets:write': ['Admin', 'IT Officer'],
  'assets:delete': ['Admin', 'IT Officer'],
  // Marking an asset Disposed is the disposal approval (Manager approves write-offs).
  'assets:dispose': ['Admin', 'Manager'],
  'alerts:manage': ['Admin', 'IT Officer'],
  'audit:read': ['Admin', 'IT Officer', 'Manager', 'Auditor'],
  'users:manage': ['Admin'],
  'backups:manage': ['Admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter(p => can(role, p));
}
