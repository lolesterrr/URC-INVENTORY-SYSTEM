/**
 * Purchase and warranty rules, shared by the server and the browser. Dependency-free, so it is safe
 * to bundle into the UI and to use from request validation at the same time.
 */

/** Days before a warranty expires that an alert is raised. Override with WARRANTY_WARNING_DAYS. */
export const DEFAULT_WARRANTY_WARNING_DAYS = 90;

const YEAR_ONLY = /^(19|20)\d{2}$/;
const FULL_DATE = /^(19|20)\d{2}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** True for a real calendar date written YYYY-MM-DD. Rejects 2026-02-30 and 2026-13-01. */
export function isCalendarDate(value: string): boolean {
  if (!FULL_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * A purchase date is unknown (''), a year ('2019') when that is all the old register recorded, or an
 * exact date ('2019-03-14'). Both forms sort correctly as text. A day is never invented from a year.
 */
export function isPurchaseDate(value: string): boolean {
  return value === '' || YEAR_ONLY.test(value) || isCalendarDate(value);
}

/** True when only the year is known, so the UI can say so instead of implying a precise day. */
export function isYearOnly(value: string): boolean {
  return YEAR_ONLY.test(value);
}

export type WarrantyState = 'none' | 'ok' | 'expiring' | 'expired';

export interface Warranty {
  state: WarrantyState;
  /** Whole days until it expires; negative once it has passed, 0 when no date is recorded. */
  days: number;
}

/**
 * Classifies a warranty end date. `none` covers both "no warranty recorded" and an unusable value,
 * so a blank field never produces an alert.
 */
export function warrantyStatus(
  expires: string,
  now: Date = new Date(),
  warningDays: number = DEFAULT_WARRANTY_WARNING_DAYS,
): Warranty {
  if (!isCalendarDate(expires)) return { state: 'none', days: 0 };
  const days = Math.ceil((Date.parse(`${expires}T00:00:00Z`) - now.getTime()) / DAY_MS);
  if (days < 0) return { state: 'expired', days };
  return { state: days <= warningDays ? 'expiring' : 'ok', days };
}

/** "in 12 days" / "14 days ago" / "today", for alert text and the register. */
export function warrantyWhen(days: number): string {
  if (days === 0) return 'today';
  return days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} ago`;
}
