import { eq, sql } from 'drizzle-orm';
import type { DB } from '../db';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { departments, locations, staff } from '../db/schema';

type LocationRow = typeof locations.$inferSelect;
/** The database or a transaction on it. */
type Queryable = Pick<DB, 'select' | 'insert'>;

/** Display names for every department, location (full path) and staff member, including archived ones. */
export interface Directory {
  department: (id: number | null) => string;
  location: (id: number | null) => string;
  staff: (id: number | null) => string;
}

export const PATH_SEPARATOR = ' / ';

/** "Region / Station / Office" for a location; stops on a broken or cyclic parent chain. */
export function locationPath(byId: Map<number, LocationRow>, id: number): string {
  const names: string[] = [];
  const seen = new Set<number>();
  for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = cur.parentId === null ? undefined : byId.get(cur.parentId)) {
    seen.add(cur.id);
    names.unshift(cur.name);
  }
  return names.join(PATH_SEPARATOR);
}

export function loadDirectory(db: DB): Directory {
  const deps = new Map(db.select({ id: departments.id, name: departments.name }).from(departments).all().map(d => [d.id, d.name]));
  const locs = new Map(db.select().from(locations).all().map(l => [l.id, l]));
  const people = new Map(db.select({ id: staff.id, name: staff.fullName }).from(staff).all().map(s => [s.id, s.name]));
  const paths = new Map<number, string>();
  return {
    department: id => (id === null ? '' : deps.get(id) ?? ''),
    location: id => {
      if (id === null) return '';
      if (!paths.has(id)) paths.set(id, locationPath(locs, id));
      return paths.get(id)!;
    },
    staff: id => (id === null ? '' : people.get(id) ?? ''),
  };
}

const TABLES = { department: departments, location: locations, staff } as const;
export type DirectoryKind = keyof typeof TABLES;

/**
 * Checks a reference sent by a client. A new value must be an existing, active record; keeping the value
 * an asset already has is always fine, even if that record has since been archived.
 * Returns an error message, or null when the reference is acceptable.
 */
export function checkReference(db: DB, kind: DirectoryKind, id: number | null | undefined, current: number | null = null): string | null {
  if (id === undefined || id === null || id === current) return null;
  const table = TABLES[kind];
  const row = db.select({ deletedAt: table.deletedAt }).from(table).where(eq(table.id, id)).get();
  const label = kind === 'staff' ? 'staff member' : kind;
  if (!row) return `That ${label} does not exist.`;
  if (row.deletedAt) return `That ${label} is archived. Restore it first, or pick another.`;
  return null;
}

export const sameText = (column: SQLiteColumn, value: string) => sql`lower(${column}) = lower(${value.trim()})`;

/** Used by the legacy import: the record with this name (case-insensitive), created if missing. Empty → null. */
export function findOrCreateDepartment(db: Queryable, name: string | undefined): number | null {
  const v = (name ?? '').trim();
  if (!v) return null;
  const found = db.select({ id: departments.id }).from(departments).where(sameText(departments.name, v)).get();
  return found?.id ?? db.insert(departments).values({ name: v }).returning({ id: departments.id }).get().id;
}

export function findOrCreateLocation(db: Queryable, name: string | undefined): number | null {
  const v = (name ?? '').trim();
  if (!v) return null;
  const found = db.select({ id: locations.id }).from(locations).where(sameText(locations.name, v)).get();
  return found?.id ?? db.insert(locations).values({ name: v }).returning({ id: locations.id }).get().id;
}

/** "Unassigned" was a placeholder in the legacy data, not a person. */
export function findOrCreateStaff(db: Queryable, name: string | undefined, departmentId: number | null): number | null {
  const v = (name ?? '').trim();
  if (!v || v.toLowerCase() === 'unassigned') return null;
  const found = db.select({ id: staff.id }).from(staff).where(sameText(staff.fullName, v)).get();
  return found?.id ?? db.insert(staff).values({ fullName: v, departmentId }).returning({ id: staff.id }).get().id;
}
