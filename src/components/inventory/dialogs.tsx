import { useState } from 'react';
import { Printer, RefreshCw, Tag, Trash2 } from 'lucide-react';
import { assetLabelPayload } from '../../../shared/labels';
import { QrCode } from './QrCode';
import { ErrorNote, ModalShell } from './ui';

export interface ArchiveTarget {
  kind: 'hardware asset' | 'software licence' | 'server spare part';
  id: string;
  name: string;
}

/** Inventory deletes are soft deletes: the record is hidden but kept, with its history. */
export function ArchiveDialog({ target, onConfirm, onClose }: { target: ArchiveTarget; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive this record.');
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} title={<><Trash2 className="h-4 w-4 text-red-600" />Archive {target.kind}</>}>
      <div className="space-y-4">
        <p className="text-xs text-slate-700">
          Remove this {target.kind} from the registers? It stays in the database and in the change history, so an Admin can still trace it.
        </p>
        <div className="bg-red-50/60 p-2.5 rounded border border-red-200 text-xs font-mono font-bold text-slate-800">
          <span className="text-red-700">{target.name}</span> <span className="text-slate-400">({target.id})</span>
        </div>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs uppercase font-mono">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={busy} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs uppercase font-mono flex items-center gap-2 disabled:opacity-50">
            {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {busy ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * The on-screen asset pass. This used to draw stripes derived from the asset ID: it looked like a barcode
 * and decoded to nothing, so anyone who scanned it got nothing back. It is a real QR code now, holding the
 * same thing a printed label holds.
 */
function AssetPass({ id, base }: { id: string; base: string }) {
  return (
    <div className="flex flex-col items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm max-w-[240px]">
      <QrCode value={assetLabelPayload(base, id)} size="120px" title={`QR code for asset ${id}`} />
      <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-slate-700 mt-2">{id}</span>
      <span className="text-[9px] text-slate-400 font-medium mt-1">URC IT ASSET PASS</span>
    </div>
  );
}

export function BarcodeDialog({ id, onPrintLabel, onClose }: { id: string; onPrintLabel?: () => void; onClose: () => void }) {
  const base = typeof window === 'undefined' ? '' : window.location.origin;
  return (
    <ModalShell onClose={onClose} title={<><Tag className="h-4 w-4 text-yellow-600" />Asset pass</>}>
      <div className="space-y-3">
        <div className="flex justify-center py-2 bg-slate-50 border border-slate-100 rounded">
          <AssetPass id={id} base={base} />
        </div>
        <p className="text-[10px] text-slate-400 text-center">
          Scanning this code opens the asset on a phone on the URC network. The ID also works in the search box.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 rounded text-xs font-mono uppercase">
            Close
          </button>
          {onPrintLabel && (
            <button onClick={onPrintLabel} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 rounded text-xs font-mono uppercase flex items-center justify-center gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print label
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
