/** Column definitions shared by the on-screen tables and the CSV export. Empty values stay empty. */
import type { HardwareAsset, LifecycleState, ServerComponent, SoftwareLicense } from '../../types';
import { assetName, assignee, type HardwareGroup } from './model';
import { Badge, StatusBadge, type Column, type Tone } from './ui';

const LIFECYCLE_TONES: Record<LifecycleState, Tone> = { 'In Stock': 'blue', Deployed: 'green', 'In Repair': 'amber', Retired: 'slate', Disposed: 'slate' };
const SOFTWARE_TONES: Record<string, Tone> = { Active: 'green', 'Expiring Soon': 'amber' };
const COMPONENT_TONES: Record<string, Tone> = { Active: 'green', Spare: 'blue' };

type HwCol = Column<HardwareAsset>;

const hw = {
  id: { header: 'Asset ID', value: h => h.id, className: 'font-mono font-bold text-slate-900 whitespace-nowrap' },
  name: (header: string): HwCol => ({ header, value: assetName, className: 'text-slate-900 font-bold' }),
  department: { header: 'Department', value: h => h.department ?? '', className: 'text-slate-800 whitespace-nowrap' },
  category: { header: 'Category', value: h => h.category ?? '', render: h => <Badge tone="slate">{h.category ?? '—'}</Badge> },
  type: { header: 'Type', value: h => h.category ?? '', render: h => <Badge tone="blue">{h.category ?? '—'}</Badge> },
  assignee: { header: 'User / Assignee', value: assignee, className: 'text-slate-800 font-bold whitespace-nowrap' },
  model: { header: 'Model', value: h => h.model },
  ip: (header: string): HwCol => ({ header, value: h => h.ipAddress ?? '', className: 'font-mono text-blue-700 font-bold whitespace-nowrap' }),
  serial: (header: string): HwCol => ({ header, value: h => h.serialNumber, className: 'font-mono text-slate-500 whitespace-nowrap' }),
  location: (header: string): HwCol => ({ header, value: h => h.location }),
  mono: (header: string, value: (h: HardwareAsset) => string | undefined): HwCol => ({ header, value: h => value(h) ?? '', className: 'font-mono text-slate-700 whitespace-nowrap' }),
  text: (header: string, value: (h: HardwareAsset) => string | undefined): HwCol => ({ header, value: h => value(h) ?? '' }),
  state: { header: 'State', value: h => h.lifecycleState, render: h => <StatusBadge status={h.lifecycleState} tones={LIFECYCLE_TONES} /> },
  condition: { header: 'Condition', value: h => h.condition ?? '' },
} satisfies Record<string, HwCol | ((...args: never[]) => HwCol)>;

export function hardwareColumns(group: HardwareGroup): HwCol[] {
  switch (group) {
    case 'Network':
      return [
        hw.id, hw.name('Device Name'), hw.department, hw.type, hw.model, hw.ip('Management IP'),
        hw.text('Port Capacity', h => h.portCount), hw.mono('Firmware / OS', h => h.firmwareVersion || h.operatingSystem),
        hw.serial('Serial No.'), hw.location('Rack / Room Location'), hw.condition, hw.state,
      ];
    case 'Server':
      return [
        hw.id, hw.name('Server Name'), hw.department, hw.model, hw.text('Server Role', h => h.serverRole), hw.ip('IP Address'),
        hw.mono('CPU Cores', h => h.cpuCores), hw.mono('RAM', h => h.ram), hw.mono('Storage Array', h => h.hardDisk),
        hw.text('OS / Hypervisor', h => h.operatingSystem), hw.location('DC Location'), hw.condition, hw.state,
      ];
    case 'Printer':
      return [
        hw.id, hw.name('Printer Name'), hw.department, hw.model, hw.text('Print Technology', h => h.printTechnology),
        hw.text('Connection Type', h => h.connectionType), hw.ip('IP Address'), hw.serial('Serial No.'),
        hw.location('Office Location'), hw.condition, hw.state,
      ];
    default:
      return [
        hw.id, ...(group === 'All' ? [hw.category] : []), hw.department, hw.assignee, hw.name('Asset Name'),
        hw.mono('Year', h => h.yearOfPurchase), hw.location('Location'), hw.model, hw.serial('S/N / Service Tag'),
        hw.mono('Engraved No.', h => h.engravedNumber), hw.text('OS / Details', h => h.operatingSystem || h.firmwareVersion),
        hw.mono('RAM', h => h.ram), hw.mono('Storage', h => h.hardDisk), hw.condition, hw.state,
      ];
  }
}

export const softwareColumns: Column<SoftwareLicense>[] = [
  { header: 'License ID', value: s => s.id, className: 'font-mono font-bold text-slate-900 whitespace-nowrap' },
  { header: 'License Title', value: s => s.name, className: 'text-slate-800' },
  { header: 'Department', value: s => s.department ?? '' },
  { header: 'Category', value: s => s.category, render: s => <Badge tone="slate">{s.category}</Badge> },
  { header: 'Vendor', value: s => s.vendor },
  { header: 'License Key', value: s => s.licenseKey, className: 'font-mono text-slate-500 whitespace-nowrap' },
  { header: 'Seat Capacity', value: s => String(s.seatCapacity ?? 0) },
  { header: 'Allocated Seats', value: s => String(s.activeSeats ?? 0) },
  { header: 'Expiry Date', value: s => s.expiryDate, className: 'font-mono text-slate-500 whitespace-nowrap' },
  {
    header: 'Annual Cost (UGX)',
    value: s => String(s.subscriptionCost ?? 0),
    render: s => `UGX ${Number(s.subscriptionCost || 0).toLocaleString()}`,
  },
  { header: 'Status', value: s => s.status, render: s => <StatusBadge status={s.status} tones={SOFTWARE_TONES} /> },
];

export const componentColumns: Column<ServerComponent>[] = [
  { header: 'Part ID', value: c => c.id, className: 'font-mono font-bold text-slate-900 whitespace-nowrap' },
  { header: 'Server Node', value: c => c.serverName, className: 'text-slate-800' },
  { header: 'Part Name', value: c => c.partName, className: 'text-slate-700' },
  { header: 'Serial No.', value: c => c.serialNumber, className: 'font-mono text-slate-500 whitespace-nowrap' },
  { header: 'Category', value: c => c.category, render: c => <Badge tone="slate">{c.category}</Badge> },
  { header: 'Status', value: c => c.status, render: c => <StatusBadge status={c.status} tones={COMPONENT_TONES} /> },
  { header: 'Quantity', value: c => String(c.quantity ?? 0), className: 'text-slate-800 font-bold' },
  { header: 'Reorder Level', value: c => String(c.reorderLevel ?? 0), className: 'text-slate-400' },
];
