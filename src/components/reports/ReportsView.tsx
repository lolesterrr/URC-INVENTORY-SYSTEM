/**
 * Standard reports: by department, by age, due for replacement, licence compliance. Read-only for every
 * role that can see the register (assets:read), so the Auditor and the Manager see the same figures.
 */
import { useMemo, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import type { ReplacementState } from '../../types';
import { useReports } from '../../hooks/useReports';
import { downloadCsv } from '../../lib/downloadCsv';
import { ReportTable } from './ReportTable';
import { ageColumns, departmentColumns, licenceColumns, replacementColumns } from './columns';

const sectionBox = 'bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3';
const toolButton =
  'px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50 flex items-center gap-1.5 font-semibold transition-colors font-mono';

function SectionHeader({
  title, note, coverage, onExport,
}: { title: string; note: string; coverage?: string; onExport: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-150 pb-3">
      <div>
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">{title}</h3>
        <p className="text-[11px] text-slate-500 mt-1 max-w-2xl">{note}</p>
        {coverage && <p className="text-[10px] text-slate-400 mt-1 font-mono">{coverage}</p>}
      </div>
      <button onClick={onExport} className={toolButton}>CSV EXPORT</button>
    </div>
  );
}

const REPLACEMENT_FILTERS: { id: ReplacementState | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'overdue', label: 'Overdue' }, { id: 'due_soon', label: 'Due soon' },
  { id: 'ok', label: 'OK' }, { id: 'unknown', label: 'Unknown' }, { id: 'no_policy', label: 'No policy' },
];

export default function ReportsView() {
  const { data, isLoading, error, refresh } = useReports();
  const [replacementFilter, setReplacementFilter] = useState<ReplacementState | 'all'>('overdue');

  const filteredReplacement = useMemo(
    () => (!data ? [] : replacementFilter === 'all' ? data.dueForReplacement.assets : data.dueForReplacement.assets.filter(a => a.state === replacementFilter)),
    [data, replacementFilter],
  );

  if (isLoading && !data) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="h-6 w-6 text-amber-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Building the reports…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-4 text-xs rounded-md font-semibold border bg-red-50 border-red-200 text-red-700 flex justify-between gap-4">
        <span>{error ?? 'Could not load the reports.'}</span>
        <button onClick={refresh} className="underline shrink-0">Try again</button>
      </div>
    );
  }

  const policyText = Object.entries(data.dueForReplacement.policyYears)
    .filter((entry): entry is [string, number] => entry[1] !== null && entry[1] !== undefined)
    .map(([category, years]) => `${category} ${years}y`)
    .join(', ');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Standard Reports</h2>
          <p className="text-xs text-slate-500">Generated {new Date(data.generatedAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className={toolButton}><RefreshCw className="h-3.5 w-3.5 text-slate-400" /> REFRESH</button>
          <button onClick={() => window.print()} className={toolButton}><Printer className="h-3.5 w-3.5 text-slate-400" /> PRINT PDF</button>
        </div>
      </div>

      <div className={sectionBox}>
        <SectionHeader
          title="By Department"
          note="Live hardware assets grouped by department, with the total purchase value where it is known."
          coverage={`${data.byDepartment.coverage.withDepartment} of ${data.byDepartment.coverage.total} assets have a department recorded.`}
          onExport={() => downloadCsv('URC_Report_By_Department.csv', departmentColumns, data.byDepartment.rows)}
        />
        <ReportTable columns={departmentColumns} rows={data.byDepartment.rows} rowKey={r => r.department} emptyText="No hardware recorded yet." />
      </div>

      <div className={sectionBox}>
        <SectionHeader
          title="By Age"
          note="Age is estimated from the purchase date: a year-only date (most of the register) is read as 1 July of that year, not an exact day."
          coverage={`${data.byAge.coverage.withPurchaseDate} of ${data.byAge.coverage.total} assets have a purchase date recorded; the rest show as Unknown.`}
          onExport={() => downloadCsv('URC_Report_By_Age.csv', ageColumns, data.byAge.assets)}
        />
        <div className="flex flex-wrap gap-2 text-[10px] font-mono">
          {data.byAge.buckets.map(b => (
            <span key={b.bucket} className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-bold">{b.bucket}: {b.count}</span>
          ))}
        </div>
        <ReportTable columns={ageColumns} rows={data.byAge.assets} rowKey={r => r.id} emptyText="No hardware recorded yet." />
      </div>

      <div className={sectionBox}>
        <SectionHeader
          title="Due for Replacement"
          note={`Assumed replacement life by category (${policyText || 'none set'}) — common defaults, not a policy URC has confirmed (see PROJECT.md Q13). "No policy" means the category has no assumed life; "Unknown" means the purchase date is not recorded.`}
          coverage={`${data.dueForReplacement.coverage.evaluable} of ${data.dueForReplacement.coverage.total} assets could be evaluated against a policy.`}
          onExport={() => downloadCsv('URC_Report_Due_For_Replacement.csv', replacementColumns, filteredReplacement)}
        />
        <div className="flex flex-wrap gap-2" role="tablist">
          {REPLACEMENT_FILTERS.map(f => (
            <button
              key={f.id}
              role="tab"
              aria-selected={replacementFilter === f.id}
              onClick={() => setReplacementFilter(f.id)}
              className={`px-2.5 py-1 text-[10px] font-bold font-mono uppercase rounded border ${
                replacementFilter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <ReportTable columns={replacementColumns} rows={filteredReplacement} rowKey={r => r.id} emptyText="No assets match this filter." />
      </div>

      <div className={sectionBox}>
        <SectionHeader
          title="Licence Compliance"
          note="Software licences with their seat usage and expiry status. A licence with no seat capacity recorded shows a dash rather than 0 seats allowed."
          coverage={`${data.licenceCompliance.coverage.withExpiryDate} of ${data.licenceCompliance.coverage.total} licences have an expiry date recorded.`}
          onExport={() => downloadCsv('URC_Report_Licence_Compliance.csv', licenceColumns, data.licenceCompliance.licences)}
        />
        <ReportTable columns={licenceColumns} rows={data.licenceCompliance.licences} rowKey={r => r.id} emptyText="No software licences recorded yet." />
      </div>
    </div>
  );
}
