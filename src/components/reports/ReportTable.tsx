/** A read-only table for a report: no actions column, since reports only display data. */
import type { Column } from '../inventory/ui';

export function ReportTable<T>({ columns, rows, rowKey, emptyText }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; emptyText: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
            {columns.map(c => <th key={c.header} className="px-3 py-2.5">{c.header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-150 text-[11px] text-slate-600 font-semibold">
          {rows.map(row => (
            <tr key={rowKey(row)} className="hover:bg-slate-50 transition-colors">
              {columns.map(c => {
                const cell = c.render ? c.render(row) : c.value(row);
                return (
                  <td key={c.header} className={`px-3 py-2 ${c.className ?? 'whitespace-nowrap'}`}>
                    {cell || <span className="text-slate-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
