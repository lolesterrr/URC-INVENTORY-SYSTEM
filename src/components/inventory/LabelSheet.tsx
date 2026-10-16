/**
 * The printable sheet itself: absolute positions in millimetres on an A4 page, one page per sheet.
 * Rendered both as an on-screen preview and, through a portal on <body>, as the only thing the printer
 * sees (see the print rules in src/index.css).
 */
import type { HardwareAsset } from '../../types';
import { assetLabelPayload } from '../../../shared/labels';
import { A4_HEIGHT_MM, A4_WIDTH_MM, labelPosition, paginate, sheetGrid, type LabelLayout } from './labelLayout';
import { assetName } from './model';
import { QrCode } from './QrCode';

/** One sticker: the code, then the id and name in text so a failed scan or a damaged label is still usable. */
function Label({ asset, layout, base }: { asset: HardwareAsset; layout: LabelLayout; base: string }) {
  // The code takes the label's height less the padding; the text column gets whatever is left.
  const padding = 1.5;
  const codeSize = Math.max(8, layout.height - padding * 2);
  return (
    <div className="flex items-center overflow-hidden" style={{ width: `${layout.width}mm`, height: `${layout.height}mm`, padding: `${padding}mm`, gap: `${padding}mm` }}>
      <QrCode value={assetLabelPayload(base, asset.id)} size={`${codeSize}mm`} title={`QR code for asset ${asset.id}`} />
      <div className="min-w-0 leading-tight">
        <div className="font-mono font-bold text-black truncate" style={{ fontSize: `${Math.min(3.6, layout.height / 7)}mm` }}>{asset.id}</div>
        <div className="text-black truncate" style={{ fontSize: `${Math.min(2.8, layout.height / 9)}mm` }}>{assetName(asset)}</div>
        <div className="text-neutral-600 truncate" style={{ fontSize: `${Math.min(2.4, layout.height / 11)}mm` }}>URC IT</div>
      </div>
    </div>
  );
}

export function LabelSheet({
  assets,
  layout,
  base,
  className = '',
}: {
  assets: HardwareAsset[];
  layout: LabelLayout;
  base: string;
  className?: string;
}) {
  const { columns, perSheet } = sheetGrid(layout);
  const pages = paginate(assets, perSheet);
  return (
    <div className={className}>
      {pages.map((page, pageIndex) => (
        <div key={pageIndex} className="label-sheet relative bg-white" style={{ width: `${A4_WIDTH_MM}mm`, height: `${A4_HEIGHT_MM}mm` }}>
          {page.map((asset, i) => {
            const { left, top } = labelPosition(layout, i, columns);
            return (
              <div key={`${asset.id}-${i}`} className="absolute" style={{ left: `${left}mm`, top: `${top}mm` }}>
                <Label asset={asset} layout={layout} base={base} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
