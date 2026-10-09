/**
 * Departments, locations and staff: the records assets point to. Everyone can view them; Admin and
 * IT Officer (directory:manage) can add, edit, archive and restore. The server enforces the same rules.
 */
import { useState } from 'react';
import { ArchiveRestore, Building2, Edit2, MapPin, Plus, Search, Trash2, UserRound } from 'lucide-react';
import type { Department, Directory, DirectoryKind, LocationRecord, StaffMember } from '../../types';
import { Badge, DataTable, ErrorNote, type Column } from '../inventory/ui';
import { RecordDialog, type DirectoryRecord, type DirectorySavers } from './RecordDialog';

const TABS: { id: DirectoryKind; label: string; icon: typeof Building2; noun: string }[] = [
  { id: 'departments', label: 'Departments', icon: Building2, noun: 'department' },
  { id: 'locations', label: 'Locations', icon: MapPin, noun: 'location' },
  { id: 'staff', label: 'Staff', icon: UserRound, noun: 'staff member' },
];

const status = (r: { archived: boolean }) => (r.archived ? <Badge tone="slate">Archived</Badge> : <Badge tone="green">Active</Badge>);
const count = (n: number) => (n ? String(n) : '');

const DEPARTMENT_COLUMNS: Column<Department>[] = [
  { header: 'Name', value: d => d.name, className: 'text-slate-800 font-bold' },
  { header: 'Staff', value: d => count(d.staffCount) },
  { header: 'Assets', value: d => count(d.assetCount) },
  { header: 'Status', value: d => (d.archived ? 'Archived' : 'Active'), render: status },
];

// Indented by depth, so the list reads as a tree (rows arrive sorted by full path).
const LOCATION_COLUMNS: Column<LocationRecord>[] = [
  {
    header: 'Name',
    value: l => l.name,
    render: l => <span style={{ paddingLeft: `${(l.path.split(' / ').length - 1) * 1.25}rem` }} className="text-slate-800 font-bold">{l.name}</span>,
  },
  { header: 'Full path', value: l => l.path, className: 'text-slate-500' },
  { header: 'Assets', value: l => count(l.assetCount) },
  { header: 'Status', value: l => (l.archived ? 'Archived' : 'Active'), render: status },
];

const STAFF_COLUMNS: Column<StaffMember>[] = [
  { header: 'Name', value: s => s.fullName, className: 'text-slate-800 font-bold whitespace-nowrap' },
  { header: 'Staff no.', value: s => s.staffNumber, className: 'font-mono whitespace-nowrap' },
  { header: 'Department', value: s => s.department },
  { header: 'Holding', value: s => (s.assetCount ? `${s.assetCount} asset${s.assetCount === 1 ? '' : 's'}` : '') },
  { header: 'Status', value: s => (s.archived ? 'Archived' : 'Active'), render: status },
];

const searchText = (kind: DirectoryKind, r: DirectoryRecord) => {
  if (kind === 'staff') {
    const s = r as StaffMember;
    return `${s.fullName} ${s.staffNumber} ${s.department}`;
  }
  return kind === 'locations' ? (r as LocationRecord).path : (r as Department).name;
};

export default function DirectoryView({
  directory,
  canManage,
  savers,
  onArchive,
  onRestore,
}: {
  directory: Directory;
  canManage: boolean;
  savers: DirectorySavers;
  onArchive: (kind: DirectoryKind, id: number) => Promise<void>;
  onRestore: (kind: DirectoryKind, id: number) => Promise<void>;
}) {
  const [tab, setTab] = useState<DirectoryKind>('departments');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ record: DirectoryRecord | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = TABS.find(t => t.id === tab)!;

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The action failed.');
    }
  };

  const q = query.trim().toLowerCase();
  const visible = <T extends DirectoryRecord>(rows: T[]) => rows.filter(r => (showArchived || !r.archived) && (!q || searchText(tab, r).toLowerCase().includes(q)));

  const actions = (r: DirectoryRecord) => {
    const label = searchText(tab, r);
    if (!canManage) return null;
    return (
      <>
        <button onClick={() => setEditing({ record: r })} title="Edit" aria-label={`Edit ${label}`} className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors">
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        {r.archived ? (
          <button onClick={() => run(() => onRestore(tab, r.id))} title="Restore" aria-label={`Restore ${label}`} className="p-1 hover:bg-green-50 text-green-700 rounded transition-colors">
            <ArchiveRestore className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button onClick={() => run(() => onArchive(tab, r.id))} title="Archive" aria-label={`Archive ${label}`} className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </>
    );
  };

  const changeTab = (next: DirectoryKind) => {
    setTab(next);
    setQuery('');
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-150 pb-2">
          <div className="flex gap-6" role="tablist">
            {TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => changeTab(t.id)}
                className={`pb-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors font-mono ${
                  tab === t.id ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                <span className="text-[9.5px] px-1.5 rounded bg-slate-100 text-slate-600">{directory[t.id].filter(r => !r.archived).length}</span>
              </button>
            ))}
          </div>
          {canManage && (
            <button onClick={() => setEditing({ record: null })} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded flex items-center gap-1.5 font-bold font-mono uppercase">
              <Plus className="h-3.5 w-3.5" />
              Add {meta.noun}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              aria-label={`Search ${meta.label.toLowerCase()}`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${meta.label.toLowerCase()}…`}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white text-slate-700"
            />
          </div>
          <label className="text-xs text-slate-600 flex items-center gap-1.5 font-semibold">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
        <p className="text-[10px] text-slate-500">
          {tab === 'locations' && 'Nest locations to any depth, e.g. Region → Station → Office. '}
          {tab === 'staff' && 'Staff are the people who hold equipment; they do not need a sign-in account. '}
          Archived records stay on old assets and in the history, but are no longer offered for new entries.
        </p>
        <ErrorNote message={error} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {tab === 'departments' && <DataTable columns={DEPARTMENT_COLUMNS} rows={visible(directory.departments)} actions={actions} emptyText="No departments match." />}
        {tab === 'locations' && <DataTable columns={LOCATION_COLUMNS} rows={visible(directory.locations)} actions={actions} emptyText="No locations match." />}
        {tab === 'staff' && <DataTable columns={STAFF_COLUMNS} rows={visible(directory.staff)} actions={actions} emptyText="No staff match." />}
      </div>

      {editing && <RecordDialog kind={tab} record={editing.record} directory={directory} savers={savers} onClose={() => setEditing(null)} />}
    </div>
  );
}
