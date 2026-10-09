/** Small building blocks shared by the inventory registers, forms and dialogs. */
import React, { type ReactNode } from 'react';
import { Edit2, History, LogIn, LogOut, Tag, Trash2, Workflow, X } from 'lucide-react';

export interface Column<T> {
  header: string;
  /** Plain value, used for the CSV export and as the default cell content. */
  value: (row: T) => string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  actions,
  emptyText,
  minWidth,
}: {
  columns: Column<T>[];
  rows: T[];
  actions: (row: T) => ReactNode;
  emptyText: string;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
            {columns.map(c => (
              <th key={c.header} className="px-3 py-2.5">{c.header}</th>
            ))}
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-150 text-[11px] text-slate-600 font-semibold">
          {rows.map(row => (
            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
              {columns.map(c => (
                <td key={c.header} className={`px-3 py-2 ${c.className ?? 'whitespace-nowrap'}`}>
                  {c.render ? c.render(row) : c.value(row) || <span className="text-slate-300">—</span>}
                </td>
              ))}
              <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">{actions(row)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const TONES = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
};
export type Tone = keyof typeof TONES;

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide ${TONES[tone]}`}>{children}</span>;
}

/** Status badge: known statuses get a colour, anything else is shown in red. */
export function StatusBadge({ status, tones }: { status: string; tones: Record<string, Tone> }) {
  return <Badge tone={tones[status] ?? 'red'}>{status}</Badge>;
}

export function RowActions({
  canEdit,
  label,
  onEdit,
  onArchive,
  onBarcode,
  onLifecycle,
  onHistory,
  onCheckout,
  onCheckin,
  editLocked,
}: {
  canEdit: boolean;
  label: string;
  onEdit: () => void;
  onArchive: () => void;
  onBarcode?: () => void;
  onLifecycle?: () => void;
  onHistory?: () => void;
  onCheckout?: () => void;
  onCheckin?: () => void;
  /** Record is read-only (e.g. a disposed asset): editing is off, archiving stays available. */
  editLocked?: boolean;
}) {
  return (
    <>
      {onCheckout && (
        <button onClick={onCheckout} title="Check out" aria-label={`Check out ${label}`} className="p-1 hover:bg-green-50 text-green-700 rounded transition-colors">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      )}
      {onCheckin && (
        <button onClick={onCheckin} title="Check in" aria-label={`Check in ${label}`} className="p-1 hover:bg-blue-50 text-blue-700 rounded transition-colors">
          <LogIn className="h-3.5 w-3.5" />
        </button>
      )}
      {onLifecycle && (
        <button onClick={onLifecycle} title="Change state" aria-label={`Change state of ${label}`} className="p-1 hover:bg-amber-50 text-amber-700 rounded transition-colors">
          <Workflow className="h-3.5 w-3.5" />
        </button>
      )}
      {onHistory && (
        <button onClick={onHistory} title="History" aria-label={`History of ${label}`} className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors">
          <History className="h-3.5 w-3.5" />
        </button>
      )}
      {onBarcode && (
        <button onClick={onBarcode} title="Show barcode" aria-label={`Show barcode for ${label}`} className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors">
          <Tag className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={onEdit} disabled={!canEdit || editLocked} title={editLocked ? 'Read-only' : 'Edit'} aria-label={`Edit ${label}`} className="p-1 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors disabled:opacity-30">
        <Edit2 className="h-3.5 w-3.5" />
      </button>
      <button onClick={onArchive} disabled={!canEdit} title="Archive" aria-label={`Archive ${label}`} className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors disabled:opacity-30">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

export function ModalShell({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className={`bg-white rounded-lg p-5 w-full border border-slate-200 shadow-md relative my-4 ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-150 flex items-center gap-2 uppercase font-mono">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="p-2.5 text-xs rounded-md font-semibold border bg-red-50 border-red-200 text-red-700">{message}</div>;
}

const inputBase =
  'mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50';
const labelBase = 'block text-[10px] font-bold text-slate-500 uppercase font-mono';

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  mono?: boolean;
  type?: 'text' | 'number' | 'date';
  min?: number;
  /** id of a <datalist> with suggestions. */
  list?: string;
  wide?: boolean;
}

export function Field({ label, value, onChange, placeholder, required, disabled, mono, type = 'text', min, list, wide }: FieldProps) {
  const id = React.useId();
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={id} className={labelBase}>{label}{required && <span className="text-red-500"> *</span>}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        list={list}
        className={`${inputBase} ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

export function SelectField<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: readonly V[]; onChange: (value: V) => void }) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className={labelBase}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value as V)} className={`${inputBase} font-bold`}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export interface RecordOption {
  id: number;
  label: string;
  archived: boolean;
}

/**
 * Picks a directory record (department, location). Archived records are not offered, except the one
 * already selected, so editing an old asset never silently drops it.
 */
export function RecordSelect({
  label,
  value,
  options,
  onChange,
  wide,
}: {
  label: string;
  value: number | null;
  options: RecordOption[];
  onChange: (value: number | null) => void;
  wide?: boolean;
}) {
  const id = React.useId();
  const shown = options.filter(o => !o.archived || o.id === value);
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={id} className={labelBase}>{label}</label>
      <select id={id} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)} className={`${inputBase} font-bold`}>
        <option value="">—</option>
        {shown.map(o => <option key={o.id} value={o.id}>{o.label}{o.archived ? ' (archived)' : ''}</option>)}
      </select>
    </div>
  );
}

/** <datalist> of standard statuses; the status field still accepts free text. */
export function StatusOptions({ id, statuses }: { id: string; statuses: string[] }) {
  return (
    <datalist id={id}>
      {statuses.map(s => <option key={s} value={s} />)}
    </datalist>
  );
}
