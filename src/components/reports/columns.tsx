/** Column definitions for the four standard reports, feeding both the on-screen tables and the CSV export. */
import type { AgeReportRow, DepartmentReportRow, LicenceReportRow, ReplacementReportRow } from '../../types';
import { Badge, type Column, type Tone } from '../inventory/ui';

const money = (v: number | null) => (v === null ? '' : `UGX ${v.toLocaleString()}`);

export const departmentColumns: Column<DepartmentReportRow>[] = [
  { header: 'Department', value: r => r.department, className: 'text-slate-900 font-bold' },
  { header: 'Assets', value: r => String(r.assetCount), className: 'font-mono' },
  { header: 'Assets with a cost', value: r => String(r.costedCount), className: 'font-mono text-slate-500' },
  { header: 'Total Value (UGX)', value: r => (r.totalValue === null ? '' : String(r.totalValue)), render: r => money(r.totalValue), className: 'font-mono' },
];

const AGE_TONES: Record<string, Tone> = {
  'Under 1 year': 'green', '1–2 years': 'blue', '2–4 years': 'slate', '4–6 years': 'amber', '6+ years': 'red', Unknown: 'slate',
};

export const ageColumns: Column<AgeReportRow>[] = [
  { header: 'Asset ID', value: r => r.id, className: 'font-mono font-bold text-slate-900 whitespace-nowrap' },
  { header: 'Asset Name', value: r => r.assetName, className: 'text-slate-800' },
  { header: 'Category', value: r => r.category },
  { header: 'Department', value: r => r.department },
  {
    header: 'Purchased',
    value: r => r.purchaseDate,
    className: 'font-mono text-slate-700 whitespace-nowrap',
    render: r => (r.purchaseDate ? <>{r.purchaseDate}{r.isYearOnly && <span className="text-slate-400"> (year)</span>}</> : null),
  },
  {
    header: 'Estimated Age',
    value: r => (r.ageYears === null ? '' : String(r.ageYears)),
    render: r => (r.ageYears === null ? null : <>{r.ageYears} year{r.ageYears === 1 ? '' : 's'}</>),
    className: 'font-mono',
  },
  { header: 'Age Bracket', value: r => r.bucket, render: r => <Badge tone={AGE_TONES[r.bucket] ?? 'slate'}>{r.bucket}</Badge> },
];

const REPLACEMENT_LABELS: Record<ReplacementReportRow['state'], string> = {
  no_policy: 'No policy for this category', unknown: 'Purchase date unknown', ok: 'OK', due_soon: 'Due soon', overdue: 'Overdue',
};
const REPLACEMENT_TONES: Record<ReplacementReportRow['state'], Tone> = {
  no_policy: 'slate', unknown: 'slate', ok: 'green', due_soon: 'amber', overdue: 'red',
};

export const replacementColumns: Column<ReplacementReportRow>[] = [
  { header: 'Asset ID', value: r => r.id, className: 'font-mono font-bold text-slate-900 whitespace-nowrap' },
  { header: 'Asset Name', value: r => r.assetName, className: 'text-slate-800' },
  { header: 'Category', value: r => r.category },
  { header: 'Department', value: r => r.department },
  { header: 'Purchased', value: r => r.purchaseDate, className: 'font-mono text-slate-700 whitespace-nowrap' },
  { header: 'Assumed Life (years)', value: r => (r.policyYears === null ? '' : String(r.policyYears)), className: 'font-mono' },
  { header: 'Estimated Due Date', value: r => r.dueDate ?? '', className: 'font-mono text-slate-700 whitespace-nowrap' },
  {
    header: 'Status',
    value: r => REPLACEMENT_LABELS[r.state],
    render: r => <Badge tone={REPLACEMENT_TONES[r.state]}>{REPLACEMENT_LABELS[r.state]}</Badge>,
  },
];

const LICENCE_LABELS: Record<LicenceReportRow['expiryState'], string> = { none: 'No expiry recorded', ok: 'OK', expiring: 'Expiring soon', expired: 'Expired' };
const LICENCE_TONES: Record<LicenceReportRow['expiryState'], Tone> = { none: 'slate', ok: 'green', expiring: 'amber', expired: 'red' };

export const licenceColumns: Column<LicenceReportRow>[] = [
  { header: 'Licence ID', value: r => r.id, className: 'font-mono font-bold text-slate-900 whitespace-nowrap' },
  { header: 'Licence Title', value: r => r.name, className: 'text-slate-800' },
  { header: 'Category', value: r => r.category },
  { header: 'Department', value: r => r.department },
  {
    header: 'Seats',
    value: r => `${r.activeSeats} / ${r.seatCapacity || '—'}`,
    render: r => (
      <span className={r.overCapacity ? 'text-red-600 font-bold' : ''}>
        {r.activeSeats} / {r.seatCapacity || '—'}
      </span>
    ),
    className: 'font-mono',
  },
  { header: 'Expiry Date', value: r => r.expiryDate, className: 'font-mono text-slate-700 whitespace-nowrap' },
  {
    header: 'Status',
    value: r => LICENCE_LABELS[r.expiryState],
    render: r => <Badge tone={LICENCE_TONES[r.expiryState]}>{LICENCE_LABELS[r.expiryState]}</Badge>,
  },
];
