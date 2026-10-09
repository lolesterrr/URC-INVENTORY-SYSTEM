import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import { api } from '../../api';
import type { AssetAssignment, HardwareAsset, StaffMember } from '../../types';
import { assetName } from './model';
import { StaffPicker } from './StaffPicker';
import { ErrorNote, Field, ModalShell } from './ui';

const noteField = (id: string, value: string, onChange: (v: string) => void, placeholder: string) => (
  <div>
    <label htmlFor={id} className="block text-[10px] font-bold text-slate-500 uppercase font-mono">Note</label>
    <textarea
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      maxLength={500}
      rows={2}
      placeholder={placeholder}
      className="mt-1 w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
    />
  </div>
);

/** Deploys a hardware asset: In Stock or In Repair → Deployed. The only way to set an assignee and get there. */
export function CheckoutDialog({
  asset,
  staff,
  onAddStaff,
  onSubmit,
  onClose,
}: {
  asset: HardwareAsset;
  staff: StaffMember[];
  /** Given when the user may add staff records (directory:manage). */
  onAddStaff?: (fullName: string) => Promise<StaffMember>;
  onSubmit: (staffId: number, dueBack: string, notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const [staffId, setStaffId] = useState<number | null>(null);
  const [dueBack, setDueBack] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (staffId === null) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(staffId, dueBack, notes.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check out this asset.');
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} title={<><LogOut className="h-4 w-4 text-green-600" />Check out</>}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-slate-700">
          <span className="font-bold text-slate-900">{assetName(asset) || asset.id}</span> <span className="font-mono text-slate-400">({asset.id})</span> is{' '}
          <strong>{asset.lifecycleState}</strong>.
        </p>
        <StaffPicker label="Assignee" staff={staff} value={staffId} onChange={setStaffId} onAddStaff={onAddStaff} />
        <Field label="Due back" type="date" value={dueBack} onChange={setDueBack} />
        {noteField('checkout-notes', notes, setNotes, 'Optional')}
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs uppercase font-mono">
            Cancel
          </button>
          <button type="submit" disabled={busy || staffId === null} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase font-mono flex items-center gap-2 disabled:opacity-50">
            {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Checking out…' : 'Check out'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Returns a hardware asset: Deployed → In Stock, or releases the assignee of one that is In Repair. */
export function CheckinDialog({
  asset,
  onSubmit,
  onClose,
}: {
  asset: HardwareAsset;
  onSubmit: (notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const [assignment, setAssignment] = useState<AssetAssignment | null | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AssetAssignment[]>(`/api/hardware/${encodeURIComponent(asset.id)}/assignments`)
      .then(rows => setAssignment(rows.find(a => a.open) ?? null))
      .catch(() => setAssignment(null));
  }, [asset.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(notes.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check in this asset.');
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} title={<><LogIn className="h-4 w-4 text-blue-600" />Check in</>}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-slate-700">
          <span className="font-bold text-slate-900">{assetName(asset) || asset.id}</span> <span className="font-mono text-slate-400">({asset.id})</span> is{' '}
          <strong>{asset.lifecycleState}</strong>.
        </p>
        {assignment === undefined && (
          <p className="text-xs text-slate-500 flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Loading…</p>
        )}
        {assignment && (
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs text-slate-700">
            Checked out to <strong>{assignment.assignee}</strong> on {new Date(assignment.checkedOutAt).toLocaleDateString()}
            {assignment.dueBack && <>, due back {assignment.dueBack}</>}.
          </div>
        )}
        {noteField('checkin-notes', notes, setNotes, 'e.g. condition on return')}
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs uppercase font-mono">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase font-mono flex items-center gap-2 disabled:opacity-50">
            {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Checking in…' : 'Check in'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
