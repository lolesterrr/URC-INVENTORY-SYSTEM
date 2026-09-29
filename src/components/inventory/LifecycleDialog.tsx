import React, { useState } from 'react';
import { ArrowRight, RefreshCw, Workflow } from 'lucide-react';
import { LIFECYCLE_TRANSITIONS, NOTE_REQUIRED } from '../../../shared/lifecycle';
import type { HardwareAsset, LifecycleState } from '../../types';
import { assetName } from './model';
import { ErrorNote, ModalShell } from './ui';

const HINTS: Record<LifecycleState, string> = {
  'In Stock': 'In the store, ready to issue.',
  Deployed: 'In use by staff or in service.',
  'In Repair': 'With a technician or supplier for repair.',
  Retired: 'Out of service, waiting for disposal or reuse.',
  Disposed: 'Written off and gone. This is final.',
};

/**
 * Moves a hardware asset to another lifecycle state. Only moves the server allows are offered;
 * Disposed is shown only to roles that may approve disposals.
 */
export function LifecycleDialog({
  asset,
  canWrite,
  canDispose,
  onSubmit,
  onClose,
}: {
  asset: HardwareAsset;
  canWrite: boolean;
  canDispose: boolean;
  onSubmit: (to: LifecycleState, note: string) => Promise<void>;
  onClose: () => void;
}) {
  const from = asset.lifecycleState;
  const options = LIFECYCLE_TRANSITIONS[from].filter(s => (s === 'Disposed' ? canDispose : canWrite));
  const [to, setTo] = useState<LifecycleState | null>(options[0] ?? null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRequired = to !== null && NOTE_REQUIRED.includes(to);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(to, note.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the state.');
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} title={<><Workflow className="h-4 w-4 text-amber-600" />Change state</>}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-slate-700">
          <span className="font-bold text-slate-900">{assetName(asset) || asset.id}</span> <span className="font-mono text-slate-400">({asset.id})</span> is{' '}
          <strong>{from}</strong>.
        </p>

        {options.length === 0 ? (
          <p className="text-xs text-slate-500">
            {from === 'Disposed' ? 'Disposed is final: this asset cannot change state.' : 'Your role cannot move this asset to another state.'}
          </p>
        ) : (
          <fieldset className="space-y-1.5">
            <legend className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Move to</legend>
            {options.map(s => (
              <label key={s} className={`flex items-start gap-2 p-2 rounded border cursor-pointer text-xs ${to === s ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="to" value={s} checked={to === s} onChange={() => setTo(s)} className="mt-0.5" />
                <span>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    {from} <ArrowRight className="h-3 w-3" /> {s}
                  </span>
                  <span className="text-slate-500">{HINTS[s]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {options.length > 0 && (
          <div>
            <label htmlFor="lifecycle-note" className="block text-[10px] font-bold text-slate-500 uppercase font-mono">
              {noteRequired ? 'Reason' : 'Note'}
              {noteRequired && <span className="text-red-500"> *</span>}
            </label>
            <textarea
              id="lifecycle-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              required={noteRequired}
              maxLength={500}
              rows={2}
              placeholder={to === 'Disposed' ? 'e.g. Board of survey ref. and disposal method' : noteRequired ? 'Why is it being retired?' : 'Optional'}
              className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        )}

        <ErrorNote message={error} />
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs uppercase font-mono">
            Cancel
          </button>
          {options.length > 0 && (
            <button type="submit" disabled={busy || !to} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase font-mono flex items-center gap-2 disabled:opacity-50">
              {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {busy ? 'Saving…' : `Move to ${to ?? ''}`}
            </button>
          )}
        </div>
      </form>
    </ModalShell>
  );
}
