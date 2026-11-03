/**
 * Rules for the standard reports (by department, by age, due for replacement, licence compliance),
 * shared by the server and the browser. Dependency-free, so it is safe to bundle into the UI.
 */
import { isYearOnly } from './purchase';

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;

/**
 * Replacement-life defaults in years, per hardware category. These are common industry assumptions
 * (laptops/desktops replaced roughly every 4 years, servers 5, printers 6, network gear 7), not a
 * URC-confirmed policy (see PROJECT.md Q13) — callers must label them as assumptions. A category with
 * no entry (e.g. "Other") has no policy, so it is reported as such rather than given an invented number.
 */
export const DEFAULT_REPLACEMENT_LIFE_YEARS: Partial<Record<string, number>> = {
  Laptop: 4,
  Desktop: 4,
  Server: 5,
  Printer: 6,
  Switch: 7,
  Router: 7,
};

/**
 * A purchase date that is only a year ('2019') has no day to anchor age on, so it is read as 1 July of
 * that year — the midpoint of the year, rather than implying the asset was bought on 1 January. An exact
 * date is used as-is. '' (unknown) returns null, and age must never be invented for it.
 */
export function estimatedAcquisitionDate(purchaseDate: string): Date | null {
  if (purchaseDate === '') return null;
  if (isYearOnly(purchaseDate)) return new Date(Date.UTC(Number(purchaseDate), 6, 1));
  const ms = Date.parse(`${purchaseDate}T00:00:00Z`);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Age in whole years (fractional part dropped), or null when the purchase date is unknown or unusable. */
export function ageInYears(purchaseDate: string, now: Date = new Date()): number | null {
  const acquired = estimatedAcquisitionDate(purchaseDate);
  if (!acquired) return null;
  return Math.floor((now.getTime() - acquired.getTime()) / YEAR_MS);
}

export const AGE_BUCKETS = ['Under 1 year', '1–2 years', '2–4 years', '4–6 years', '6+ years', 'Unknown'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** Which bucket an age falls into, for the age-distribution summary. null (unknown age) is its own bucket. */
export function ageBucket(ageYears: number | null): AgeBucket {
  if (ageYears === null) return 'Unknown';
  if (ageYears < 1) return 'Under 1 year';
  if (ageYears < 2) return '1–2 years';
  if (ageYears < 4) return '2–4 years';
  if (ageYears < 6) return '4–6 years';
  return '6+ years';
}

export type ReplacementState = 'no_policy' | 'unknown' | 'ok' | 'due_soon' | 'overdue';

export interface ReplacementStatus {
  state: ReplacementState;
  /** Years in DEFAULT_REPLACEMENT_LIFE_YEARS for this category, or null when the category has no policy. */
  policyYears: number | null;
  ageYears: number | null;
  /** When the asset reaches its replacement life, or null when it cannot be computed. */
  dueDate: Date | null;
}

/** Due within this many years counts as "due soon" rather than "ok" (mirrors the warranty warning window idea). */
export const REPLACEMENT_DUE_SOON_YEARS = 1;

/**
 * Classifies an asset against its category's replacement-life policy. `no_policy` covers a category with
 * no default (e.g. "Other"); `unknown` covers a policy that exists but an acquisition date that does not.
 * Neither produces a made-up due date.
 */
export function replacementStatus(
  category: string,
  purchaseDate: string,
  now: Date = new Date(),
  policy: Partial<Record<string, number>> = DEFAULT_REPLACEMENT_LIFE_YEARS,
): ReplacementStatus {
  const policyYears = policy[category] ?? null;
  const ageYears = ageInYears(purchaseDate, now);
  if (policyYears === null) return { state: 'no_policy', policyYears, ageYears, dueDate: null };
  const acquired = estimatedAcquisitionDate(purchaseDate);
  if (!acquired) return { state: 'unknown', policyYears, ageYears, dueDate: null };
  const dueDate = new Date(acquired.getTime() + policyYears * YEAR_MS);
  const yearsUntilDue = (dueDate.getTime() - now.getTime()) / YEAR_MS;
  const state: ReplacementState = yearsUntilDue < 0 ? 'overdue' : yearsUntilDue <= REPLACEMENT_DUE_SOON_YEARS ? 'due_soon' : 'ok';
  return { state, policyYears, ageYears, dueDate };
}

export type LicenceExpiryState = 'none' | 'ok' | 'expiring' | 'expired';

/** Days before a licence expires that it counts as "expiring" (matches LICENSE_EXPIRY_WARNING_DAYS used by alerts). */
export const DEFAULT_LICENCE_EXPIRY_WARNING_DAYS = 30;

export interface LicenceStatus {
  state: LicenceExpiryState;
  /** Negative once expired, 0 when there is no date on record. */
  days: number;
}

/** Classifies a licence's expiry date. `none` covers both "no date recorded" and an unusable value. */
export function licenceExpiryStatus(expiryDate: string, now: Date = new Date(), warningDays = DEFAULT_LICENCE_EXPIRY_WARNING_DAYS): LicenceStatus {
  const ms = Date.parse(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(ms)) return { state: 'none', days: 0 };
  const days = Math.ceil((ms - now.getTime()) / DAY_MS);
  if (days < 0) return { state: 'expired', days };
  return { state: days <= warningDays ? 'expiring' : 'ok', days };
}

/** Allocated seats beyond capacity. A capacity of 0 means seats are not tracked for this licence, not "zero seats". */
export function isOverCapacity(seatCapacity: number, activeSeats: number): boolean {
  return seatCapacity > 0 && activeSeats > seatCapacity;
}
