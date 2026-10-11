import { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { api } from '../../api';
import type { AuditLog } from '../../types';
import { ErrorNote, ModalShell } from './ui';

// Bookkeeping fields that change on every save, and record ids whose names are shown instead.
const IGNORED = new Set(['updatedAt', 'createdAt', 'lifecycleChangedAt', 'departmentId', 'locationId', 'assigneeId']);

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

/** Fields whose value differs between the before and after snapshots of an edit. */
export function changedFields(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  if (!before || !after) return [];
  return Object.keys(after)
    .filter(k => !IGNORED.has(k) && k in before && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map(k => ({ field: k, from: show(before[k]), to: show(after[k]) }));
}

/** Timeline of one hardware asset, from the append-only audit log, oldest first. */
export function HistoryDialog({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const [entries, setEntries] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AuditLog[]>(`/api/hardware/${encodeURIComponent(id)}/history`)
      .then(setEntries)
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load the history.'));
  }, [id]);

  return (
    <ModalShell wide onClose={onClose} title={<><History className="h-4 w-4 text-amber-600" />History: {name}</>}>
      <div className="space-y-3">
        <ErrorNote message={error} />
        {!entries && !error && (
          <p className="text-xs text-slate-500 flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Loading…</p>
        )}
        {entries?.length === 0 && <p className="text-xs text-slate-500">No recorded changes for this asset.</p>}
        {entries && entries.length > 0 && (
          <ol className="border-l-2 border-slate-200 ml-1.5 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {entries.map(e => {
              const changes = e.action === 'Update Hardware' ? changedFields(e.before, e.after) : [];
              return (
                <li key={e.id} className="pl-3 relative">
                  <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-amber-500" />
                  <div className="text-[10px] font-mono text-slate-400">
                    {new Date(e.timestamp).toLocaleString()} · {e.user} ({e.role})
                  </div>
                  <div className="text-xs font-bold text-slate-800">{e.action}</div>
                  <div className="text-[11px] text-slate-600">{e.details}</div>
                  {changes.length > 0 && (
                    <ul className="mt-1 text-[10.5px] text-slate-600 font-mono">
                      {changes.map(c => (
                        <li key={c.field}>{c.field}: {c.from} → {c.to}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <button onClick={onClose} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 rounded text-xs font-mono uppercase">
          Close
        </button>
      </div>
    </ModalShell>
  );
}
