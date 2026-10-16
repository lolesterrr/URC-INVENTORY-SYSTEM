/**
 * Print asset labels: pick the layout, check the address the codes will point at, preview the sheet, print.
 * Nothing is written, so there is nothing to audit and no permission beyond reading the register.
 */
import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import { AlertTriangle, Printer, QrCode as QrCodeIcon } from 'lucide-react';
import type { HardwareAsset } from '../../types';
import { assetLabelPayload, isLocalOnlyBase, normaliseLabelBase } from '../../../shared/labels';
import { DEFAULT_LAYOUT, LABEL_LAYOUTS, sheetGrid, type LabelLayout } from './labelLayout';
import { LabelSheet } from './LabelSheet';
import { ModalShell } from './ui';

const CUSTOM = 'custom';
const button = 'px-4 py-2 font-bold rounded-lg text-xs uppercase font-mono flex items-center gap-2 disabled:opacity-50';
const input = 'w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500';

export function LabelDialog({ assets, onClose }: { assets: HardwareAsset[]; onClose: () => void }) {
  const [layoutId, setLayoutId] = useState(DEFAULT_LAYOUT.id);
  const [custom, setCustom] = useState({ width: String(DEFAULT_LAYOUT.width), height: String(DEFAULT_LAYOUT.height) });
  // A browser that reached the app already knows an address that works, so no setting is needed.
  const [base, setBase] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin));

  const layout: LabelLayout = useMemo(() => {
    const preset = LABEL_LAYOUTS.find(l => l.id === layoutId);
    if (preset) return preset;
    const width = Number(custom.width);
    const height = Number(custom.height);
    return {
      ...DEFAULT_LAYOUT,
      id: CUSTOM,
      label: 'Custom',
      width: Number.isFinite(width) && width > 0 ? width : DEFAULT_LAYOUT.width,
      height: Number.isFinite(height) && height > 0 ? height : DEFAULT_LAYOUT.height,
    };
  }, [layoutId, custom]);

  const { perSheet } = sheetGrid(layout);
  const sheets = Math.ceil(assets.length / perSheet);
  const usesUrl = normaliseLabelBase(base) !== '';
  const localOnly = isLocalOnlyBase(base);

  const print = () => {
    document.body.classList.add('printing-labels');
    const clear = () => {
      document.body.classList.remove('printing-labels');
      window.removeEventListener('afterprint', clear);
    };
    window.addEventListener('afterprint', clear);
    window.print();
    // Safari and some Linux builds never fire afterprint; clear on the next tick as a safety net.
    window.setTimeout(clear, 1000);
  };

  return (
    <>
      <ModalShell wide onClose={onClose} title={<><QrCodeIcon className="h-4 w-4 text-yellow-600" />Print asset labels</>}>
        <div className="space-y-3">
          <p className="text-[11px] text-slate-600 leading-snug">
            {assets.length} label{assets.length === 1 ? '' : 's'} on {sheets} A4 sheet{sheets === 1 ? '' : 's'} ({perSheet} per sheet). Each label carries
            a QR code plus the asset ID and name in text, so a damaged or unreadable sticker can still be matched by hand.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Label size</span>
              <select value={layoutId} onChange={e => setLayoutId(e.target.value)} className={input}>
                {LABEL_LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                <option value={CUSTOM}>Custom size…</option>
              </select>
            </label>
            {layoutId === CUSTOM && (
              <div className="grid grid-cols-2 gap-2">
                {(['width', 'height'] as const).map(side => (
                  <label key={side} className="block">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">{side} (mm)</span>
                    <input type="number" min={8} step="0.1" value={custom[side]} onChange={e => setCustom(c => ({ ...c, [side]: e.target.value }))} className={input} />
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="block">
            <span className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Scanning a label opens</span>
            <input value={base} onChange={e => setBase(e.target.value)} placeholder="Leave empty to encode the asset ID only" className={`${input} font-mono`} />
            <span className="block mt-1 text-[10px] text-slate-500 leading-snug">
              {usesUrl ? (
                <>Codes will hold <span className="font-mono text-slate-700">{assetLabelPayload(base, assets[0]?.id ?? 'HW-001')}</span>, so a phone on the URC network opens the asset.</>
              ) : (
                <>Codes will hold the asset ID on its own. A scan will show the ID rather than opening the record.</>
              )}
            </span>
          </label>

          {localOnly && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-[11px] text-amber-900 leading-snug flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p>
                That address only works on this computer, so nobody else could use these labels. Open the app by its network name or IP address before
                printing, or clear the field to encode just the asset ID.
              </p>
            </div>
          )}

          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Preview — first sheet</span>
            <div className="border border-slate-200 rounded bg-slate-100 p-2 overflow-hidden">
              {/* Scaled to fit the dialog; printing uses the millimetre sizes untouched. */}
              <div className="origin-top-left" style={{ transform: 'scale(0.42)', width: '210mm', height: '297mm' }}>
                <LabelSheet assets={assets.slice(0, perSheet)} layout={layout} base={base} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-150">
            <button type="button" onClick={onClose} className={`${button} bg-slate-100 hover:bg-slate-200 text-slate-700`}>Cancel</button>
            <button type="button" onClick={print} disabled={!assets.length} className={`${button} bg-slate-900 hover:bg-slate-800 text-white`}>
              <Printer className="h-3.5 w-3.5" /> Print {sheets} sheet{sheets === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Portalled to <body> so the print stylesheet can hide everything except the sheets. */}
      {createPortal(
        <div className="label-sheet-root">
          <LabelSheet assets={assets} layout={layout} base={base} />
        </div>,
        document.body,
      )}
    </>
  );
}
