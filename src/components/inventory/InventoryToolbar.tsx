import { Download, Plus, Printer, Search } from 'lucide-react';
import { URC_DEPARTMENTS } from '../../types';
import { COMPONENT_CATEGORIES, HARDWARE_CATEGORIES, SOFTWARE_CATEGORIES, STATUSES, type Filters, type InventoryTab } from './model';

const TABS: { id: InventoryTab; label: string }[] = [
  { id: 'hardware', label: 'Hardware Register' },
  { id: 'software', label: 'Software Licences' },
  { id: 'servers', label: 'Server Spares' },
];

const CATEGORIES: Record<InventoryTab, readonly string[]> = {
  hardware: HARDWARE_CATEGORIES,
  software: SOFTWARE_CATEGORIES,
  servers: COMPONENT_CATEGORIES,
};

const selectClass =
  'w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white text-slate-700 cursor-pointer';
const toolButton =
  'px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50 flex items-center gap-1.5 font-semibold transition-colors font-mono';

export default function InventoryToolbar({
  tab,
  onTabChange,
  filters,
  onFiltersChange,
  canEdit,
  onExport,
  onAdd,
}: {
  tab: InventoryTab;
  onTabChange: (tab: InventoryTab) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  canEdit: boolean;
  onExport: () => void;
  onAdd: () => void;
}) {
  const set = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 pb-2">
        <div className="flex gap-6" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => onTabChange(t.id)}
              className={`text-sm pb-1.5 transition-colors border-b-2 font-mono uppercase tracking-wider ${
                tab === t.id ? 'border-slate-900 text-slate-900 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-700 font-bold'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExport} className={toolButton}>
            <Download className="h-3.5 w-3.5 text-slate-400" /> CSV EXPORT
          </button>
          <button onClick={() => window.print()} className={toolButton}>
            <Printer className="h-3.5 w-3.5 text-slate-400" /> PRINT PDF
          </button>
          <button
            onClick={onAdd}
            disabled={!canEdit}
            title={canEdit ? undefined : 'Your role cannot add records.'}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 font-mono"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3px]" /> NEW ASSET
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            aria-label="Search the register"
            placeholder="Search by ID, name, serial number, user…"
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white text-slate-700"
          />
        </div>
        <select aria-label="Category" value={filters.category} onChange={e => set({ category: e.target.value })} className={selectClass}>
          <option value="All">All categories</option>
          {CATEGORIES[tab].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className={`grid gap-3 ${tab === 'servers' ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {tab !== 'servers' && (
            <select aria-label="Department" value={filters.department} onChange={e => set({ department: e.target.value })} className={selectClass}>
              <option value="All">All departments</option>
              {URC_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select aria-label={tab === 'hardware' ? 'Lifecycle state' : 'Status'} value={filters.status} onChange={e => set({ status: e.target.value })} className={selectClass}>
            <option value="All">{tab === 'hardware' ? 'All states' : 'All statuses'}</option>
            {STATUSES[tab].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
