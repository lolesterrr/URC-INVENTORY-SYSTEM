import { Laptop } from 'lucide-react';
import type { HardwareAsset } from '../types';

function BarcodeStripes({ id }: { id: string }) {
  const hash = [...id].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bars = Array.from({ length: 22 }, (_, i) => (
    <div key={i} className={`h-8 bg-slate-900 ${(hash + i) % 3 === 0 ? 'w-1' : 'w-0.5'} mr-0.5`} />
  ));
  return (
    <div className="flex flex-col items-center p-2 bg-white rounded border border-slate-200">
      <div className="flex items-center justify-center bg-white">{bars}</div>
      <span className="text-[8px] font-mono font-bold tracking-wider text-slate-500 mt-1">{id}</span>
    </div>
  );
}

/** Read-only summary of a scanned asset, shown in the Barcode Scan Center. */
export default function AssetPassportCard({ item }: { item: HardwareAsset }) {
  return (
    <div className="p-3 bg-slate-50 rounded border border-slate-100 space-y-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Laptop className="h-3 w-3" />
            <span className="text-[10px] font-mono font-bold text-slate-800">{item.id}</span>
          </div>
          <h4 className="text-[13px] font-bold text-slate-900">{item.assetName || item.name}</h4>
        </div>
        <div>
          <BarcodeStripes id={item.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Category</span>
          <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">{item.category || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Department</span>
          <span className="font-bold text-slate-800">{item.department || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">User / Assignee</span>
          <span className="font-bold text-slate-800">{item.assignee || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Location</span>
          <span className="font-semibold text-slate-700">{item.location || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Model</span>
          <span className="font-semibold text-slate-700">{item.model || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Serial No. / Tag</span>
          <span className="font-mono text-slate-700">{item.serialNumber}</span>
        </div>
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Engraved Number</span>
          <span className="font-mono text-slate-700">{item.engravedNumber || '—'}</span>
        </div>

        {/* Network / Switch / Router Unique Fields */}
        {item.ipAddress && (
          <div>
            <span className="text-slate-400 font-mono block uppercase text-[8.5px]">IP Address</span>
            <span className="font-mono font-bold text-blue-700">{item.ipAddress}</span>
          </div>
        )}
        {item.portCount && (
          <div>
            <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Port Count / Interface</span>
            <span className="font-semibold text-slate-700">{item.portCount}</span>
          </div>
        )}
        {item.firmwareVersion && (
          <div>
            <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Firmware / OS</span>
            <span className="font-mono text-slate-700">{item.firmwareVersion}</span>
          </div>
        )}

        {/* Server Unique Fields */}
        {item.serverRole && (
          <div>
            <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Server Role</span>
            <span className="font-semibold text-slate-700">{item.serverRole}</span>
          </div>
        )}
        {item.cpuCores && (
          <div>
            <span className="text-slate-400 font-mono block uppercase text-[8.5px]">CPU Cores</span>
            <span className="font-mono text-slate-700">{item.cpuCores}</span>
          </div>
        )}

        {/* Printer Unique Fields */}
        {item.printTechnology && (
          <div>
            <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Print Technology</span>
            <span className="font-semibold text-slate-700">{item.printTechnology}</span>
          </div>
        )}
        {item.connectionType && (
          <div>
            <span className="text-slate-400 font-mono block uppercase text-[8.5px]">Connection Type</span>
            <span className="font-semibold text-slate-700">{item.connectionType}</span>
          </div>
        )}

        {/* Standard Computer / Default Fields */}
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">OS / Firmware</span>
          <span className="font-semibold text-slate-700">{item.operatingSystem || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">RAM</span>
          <span className="font-mono text-slate-700">{item.ram || '—'}</span>
        </div>
        <div>
          <span className="text-slate-400 font-mono block uppercase text-[8.5px]">HARDDISK / Storage</span>
          <span className="font-mono text-slate-700">{item.hardDisk || '—'}</span>
        </div>
      </div>
    </div>
  );
}
