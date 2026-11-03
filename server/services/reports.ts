/** Builds the standard reports (by department, by age, due for replacement, licence compliance) from the register. */
import { isNull } from 'drizzle-orm';
import type { DB } from '../db';
import { hardware, software } from '../db/schema';
import { loadDirectory } from './directory';
import { isYearOnly } from '../../shared/purchase';
import {
  ageBucket, ageInYears, AGE_BUCKETS, DEFAULT_LICENCE_EXPIRY_WARNING_DAYS, DEFAULT_REPLACEMENT_LIFE_YEARS,
  isOverCapacity, licenceExpiryStatus, replacementStatus, type AgeBucket, type LicenceExpiryState, type ReplacementState,
} from '../../shared/reports';

export interface DepartmentRow {
  department: string;
  assetCount: number;
  costedCount: number;
  totalValue: number | null;
}

export interface AgeRow {
  id: string;
  assetName: string;
  category: string;
  department: string;
  purchaseDate: string;
  isYearOnly: boolean;
  ageYears: number | null;
  bucket: AgeBucket;
}

export interface ReplacementRow {
  id: string;
  assetName: string;
  category: string;
  department: string;
  purchaseDate: string;
  ageYears: number | null;
  policyYears: number | null;
  dueDate: string | null;
  state: ReplacementState;
}

export interface LicenceRow {
  id: string;
  name: string;
  category: string;
  department: string;
  seatCapacity: number;
  activeSeats: number;
  overCapacity: boolean;
  expiryDate: string;
  expiryState: LicenceExpiryState;
  expiryDays: number;
}

export interface ReportsResponse {
  generatedAt: string;
  byDepartment: {
    /** How many of the live hardware assets have a department recorded, so the table is read as a subset when it is one. */
    coverage: { withDepartment: number; total: number };
    rows: DepartmentRow[];
  };
  byAge: {
    /** Year-only dates are read as 1 July of that year; callers must say so rather than imply an exact day. */
    ageMethod: 'mid-year-estimate';
    coverage: { withPurchaseDate: number; total: number };
    buckets: { bucket: AgeBucket; count: number }[];
    assets: AgeRow[];
  };
  dueForReplacement: {
    /** The assumed replacement life per category (years); not a URC-confirmed policy. See PROJECT.md Q13. */
    policyYears: Partial<Record<string, number>>;
    coverage: { evaluable: number; total: number };
    assets: ReplacementRow[];
  };
  licenceCompliance: {
    coverage: { withExpiryDate: number; total: number };
    licences: LicenceRow[];
  };
}

export interface ReportsOptions {
  now?: Date;
  replacementPolicy?: Partial<Record<string, number>>;
  licenceExpiryWarningDays?: number;
}

export function buildReports(db: DB, options: ReportsOptions = {}): ReportsResponse {
  const now = options.now ?? new Date();
  const policy = options.replacementPolicy ?? DEFAULT_REPLACEMENT_LIFE_YEARS;
  const licenceWarningDays = options.licenceExpiryWarningDays ?? DEFAULT_LICENCE_EXPIRY_WARNING_DAYS;
  const dir = loadDirectory(db);

  const hw = db.select().from(hardware).where(isNull(hardware.deletedAt)).all();
  const sw = db.select().from(software).where(isNull(software.deletedAt)).all();

  const byDept = new Map<string, DepartmentRow>();
  for (const h of hw) {
    const department = dir.department(h.departmentId) || 'No department recorded';
    const row = byDept.get(department) ?? { department, assetCount: 0, costedCount: 0, totalValue: null };
    row.assetCount++;
    if (h.purchaseCost !== null) {
      row.costedCount++;
      row.totalValue = (row.totalValue ?? 0) + h.purchaseCost;
    }
    byDept.set(department, row);
  }

  const ageRows: AgeRow[] = hw.map(h => {
    const years = ageInYears(h.purchaseDate, now);
    return {
      id: h.id,
      assetName: h.assetName,
      category: h.category,
      department: dir.department(h.departmentId),
      purchaseDate: h.purchaseDate,
      isYearOnly: isYearOnly(h.purchaseDate),
      ageYears: years,
      bucket: ageBucket(years),
    };
  });
  const bucketCounts = new Map<AgeBucket, number>(AGE_BUCKETS.map(b => [b, 0]));
  for (const r of ageRows) bucketCounts.set(r.bucket, (bucketCounts.get(r.bucket) ?? 0) + 1);

  const replacementRows: ReplacementRow[] = hw.map(h => {
    const status = replacementStatus(h.category, h.purchaseDate, now, policy);
    return {
      id: h.id,
      assetName: h.assetName,
      category: h.category,
      department: dir.department(h.departmentId),
      purchaseDate: h.purchaseDate,
      ageYears: status.ageYears,
      policyYears: status.policyYears,
      dueDate: status.dueDate ? status.dueDate.toISOString().slice(0, 10) : null,
      state: status.state,
    };
  });

  const licenceRows: LicenceRow[] = sw.map(s => {
    const expiry = licenceExpiryStatus(s.expiryDate, now, licenceWarningDays);
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      department: dir.department(s.departmentId),
      seatCapacity: s.seatCapacity,
      activeSeats: s.activeSeats,
      overCapacity: isOverCapacity(s.seatCapacity, s.activeSeats),
      expiryDate: s.expiryDate,
      expiryState: expiry.state,
      expiryDays: expiry.days,
    };
  });

  return {
    generatedAt: now.toISOString(),
    byDepartment: {
      coverage: { withDepartment: hw.filter(h => h.departmentId !== null).length, total: hw.length },
      rows: [...byDept.values()].sort((a, b) => a.department.localeCompare(b.department)),
    },
    byAge: {
      ageMethod: 'mid-year-estimate',
      coverage: { withPurchaseDate: ageRows.filter(r => r.ageYears !== null).length, total: hw.length },
      buckets: AGE_BUCKETS.map(bucket => ({ bucket, count: bucketCounts.get(bucket) ?? 0 })),
      assets: ageRows,
    },
    dueForReplacement: {
      policyYears: policy,
      coverage: { evaluable: replacementRows.filter(r => r.state !== 'no_policy' && r.state !== 'unknown').length, total: hw.length },
      assets: replacementRows,
    },
    licenceCompliance: {
      coverage: { withExpiryDate: licenceRows.filter(r => r.expiryState !== 'none').length, total: sw.length },
      licences: licenceRows,
    },
  };
}
