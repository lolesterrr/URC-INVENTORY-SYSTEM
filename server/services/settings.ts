/** Organisation-wide settings an Admin can change without a code deploy. The row/table always exist (seeded by migration 0006). */
import { eq } from 'drizzle-orm';
import type { DB } from '../db';
import { replacementPolicies, settings } from '../db/schema';
import { HARDWARE_CATEGORIES } from '../validation';

export interface AppSettings {
  companyName: string;
  defaultLabelPreset: string;
  defaultLabelWidthMm: number | null;
  defaultLabelHeightMm: number | null;
  /** Years per hardware category; null means that category has no replacement-life policy. Every category is present. */
  replacementPolicy: Record<string, number | null>;
}

const SETTINGS_ROW_ID = 1;

export function loadSettings(db: Pick<DB, 'select'>): AppSettings {
  const row = db.select().from(settings).where(eq(settings.id, SETTINGS_ROW_ID)).get();
  const policyRows = db.select().from(replacementPolicies).all();
  const replacementPolicy: Record<string, number | null> = Object.fromEntries(HARDWARE_CATEGORIES.map(c => [c, null]));
  for (const r of policyRows) replacementPolicy[r.category] = r.lifeYears;
  return {
    companyName: row?.companyName ?? 'Uganda Railways Corporation',
    defaultLabelPreset: row?.defaultLabelPreset ?? '24',
    defaultLabelWidthMm: row?.defaultLabelWidthMm ?? null,
    defaultLabelHeightMm: row?.defaultLabelHeightMm ?? null,
    replacementPolicy,
  };
}

export interface SettingsUpdate {
  companyName?: string;
  defaultLabelPreset?: string;
  defaultLabelWidthMm?: number | null;
  defaultLabelHeightMm?: number | null;
  replacementPolicy?: Record<string, number | null>;
}

/** Returns the category names in the update that are not real hardware categories, so the route can reject them by name. */
export function unknownCategories(replacementPolicy: Record<string, number | null> | undefined): string[] {
  if (!replacementPolicy) return [];
  const known = new Set<string>(HARDWARE_CATEGORIES);
  return Object.keys(replacementPolicy).filter(c => !known.has(c));
}

export function updateSettings(db: Pick<DB, 'update'>, patch: SettingsUpdate): void {
  const fields: Partial<typeof settings.$inferInsert> = {};
  if (patch.companyName !== undefined) fields.companyName = patch.companyName;
  if (patch.defaultLabelPreset !== undefined) fields.defaultLabelPreset = patch.defaultLabelPreset;
  if (patch.defaultLabelWidthMm !== undefined) fields.defaultLabelWidthMm = patch.defaultLabelWidthMm;
  if (patch.defaultLabelHeightMm !== undefined) fields.defaultLabelHeightMm = patch.defaultLabelHeightMm;
  if (Object.keys(fields).length) {
    fields.updatedAt = new Date().toISOString();
    db.update(settings).set(fields).where(eq(settings.id, SETTINGS_ROW_ID)).run();
  }
  if (patch.replacementPolicy) {
    for (const [category, years] of Object.entries(patch.replacementPolicy)) {
      db.update(replacementPolicies).set({ lifeYears: years }).where(eq(replacementPolicies.category, category)).run();
    }
  }
}
