import React, { useState } from 'react';
import { GitMerge, RefreshCw } from 'lucide-react';
import type { Directory, DirectoryKind, LocationRecord } from '../../types';
import { ErrorNote, ModalShell, RecordSelect, type RecordOption } from '../inventory/ui';
import { subtree, type DirectoryRecord } from './RecordDialog';

const label = (kind: DirectoryKind, r: DirectoryRecord) =>
  kind === 'staff' ? `${(r as { fullName: string }).fullName}` : kind === 'locations' ? (r as LocationRecord).path : (r as { name: string }).name;

const WHAT_MOVES: Record<DirectoryKind, string> = {
  departments: 'Its assets, software licences and staff',
  locations: 'Its assets and sub-locations',
  staff: 'The assets they hold and their check-out history (each record keeps the name used at the time)',
};

/** Moves everything from a duplicate onto the record kept, then archives the duplicate. */
export function MergeDialog({
  kind,
  record,
  directory,
  onMerge,
  onClose,
}: {
  kind: DirectoryKind;
  record: DirectoryRecord;
  directory: Directory;
  onMerge: (intoId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [intoId, setIntoId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A location cannot be merged into one of its own sub-locations.
  const excluded = kind === 'locations' ? subtree(directory.locations, record.id) : new Set([record.id]);
  const options: RecordOption[] = (directory[kind] as DirectoryRecord[])
    .filter(r => !r.archived && !excluded.has(r.id))
    .map(r => {
      const staffInfo = kind === 'staff' ? [(r as { department: string }).department, (r as { staffNumber: string }).staffNumber].filter(Boolean).join(', ') : '';
      return { id: r.id, label: staffInfo ? `${label(kind, r)} (${staffInfo})` : label(kind, r), archived: false };
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (intoId === null) return;
    setBusy(true);
    setError(null);
    try {
      await onMerge(intoId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not merge.');
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} title={<><GitMerge className="h-4 w-4 text-amber-600" />Merge duplicate</>}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-slate-700">
          Merge <strong>{label(kind, record)}</strong> into another record. {WHAT_MOVES[kind]} move to the record you keep, and{' '}
          <strong>{label(kind, record)}</strong> is archived. This is recorded in the change history.
        </p>
        <RecordSelect label="Keep" value={intoId} options={options} onChange={setIntoId} />
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs uppercase font-mono">
            Cancel
          </button>
          <button type="submit" disabled={busy || intoId === null} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase font-mono flex items-center gap-2 disabled:opacity-50">
            {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Merging…' : 'Merge'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
