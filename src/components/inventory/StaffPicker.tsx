import React, { useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import type { StaffMember } from '../../types';

const MAX_MATCHES = 8;

/**
 * Searchable pick-one list of active staff. When `onAddStaff` is given and nobody matches the typed
 * name exactly, it offers to add that person as a new staff record and selects them.
 */
export function StaffPicker({
  label,
  staff,
  value,
  onChange,
  onAddStaff,
}: {
  label: string;
  staff: StaffMember[];
  value: number | null;
  onChange: (id: number | null) => void;
  onAddStaff?: (fullName: string) => Promise<StaffMember>;
}) {
  const id = React.useId();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = staff.find(s => s.id === value);

  if (selected) {
    return (
      <div>
        <span className="block text-[10px] font-bold text-slate-500 uppercase font-mono">{label} <span className="text-red-500">*</span></span>
        <div className="mt-1 flex items-center justify-between gap-2 p-2 text-xs bg-green-50 border border-green-200 rounded-lg">
          <span>
            <Check className="inline h-3.5 w-3.5 text-green-600 mr-1" />
            <strong className="text-slate-900">{selected.fullName}</strong>
            {selected.department && <span className="text-slate-500"> · {selected.department}</span>}
            {selected.staffNumber && <span className="font-mono text-slate-400"> · {selected.staffNumber}</span>}
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold" aria-label="Change staff member">
            <X className="h-3.5 w-3.5" />Change
          </button>
        </div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const active = staff.filter(s => !s.archived);
  const matches = (q ? active.filter(s => `${s.fullName} ${s.staffNumber} ${s.department}`.toLowerCase().includes(q)) : active).slice(0, MAX_MATCHES);
  const exact = active.some(s => s.fullName.toLowerCase() === q);

  const add = async () => {
    if (!onAddStaff) return;
    setAdding(true);
    setError(null);
    try {
      const created = await onAddStaff(query.trim());
      setQuery('');
      onChange(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this staff member.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-bold text-slate-500 uppercase font-mono">{label} <span className="text-red-500">*</span></label>
      <input
        id={id}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by name, staff number or department"
        autoComplete="off"
        className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      <ul className="mt-1 max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white" aria-label="Matching staff">
        {matches.map(s => (
          <li key={s.id}>
            <button type="button" onClick={() => onChange(s.id)} className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-amber-50">
              <span className="font-bold text-slate-800">{s.fullName}</span>
              {s.department && <span className="text-slate-500"> · {s.department}</span>}
              {s.staffNumber && <span className="font-mono text-slate-400"> · {s.staffNumber}</span>}
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-2.5 py-1.5 text-xs text-slate-400">No matching staff.</li>}
      </ul>
      {onAddStaff && q && !exact && (
        <button type="button" onClick={add} disabled={adding} className="mt-1.5 text-xs font-bold text-green-700 hover:text-green-900 flex items-center gap-1 disabled:opacity-50">
          <UserPlus className="h-3.5 w-3.5" />
          {adding ? 'Adding…' : `Add “${query.trim()}” as a new staff member`}
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-700 font-semibold">{error}</p>}
    </div>
  );
}
