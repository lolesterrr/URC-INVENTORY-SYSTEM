/** Column definitions shared by the on-screen tables and the CSV export. Empty values stay empty. */
import type { HardwareAsset, LifecycleState, ServerComponent, SoftwareLicense } from '../../types';
import { DEFAULT_WARRANTY_WARNING_DAYS, isYearOnly, warrantyStatus, warrantyWhen, type WarrantyState } from '../../../shared/purchase';
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
  // A purchase date may be just a year, which the register says plainly rather than implying a day.
  purchased: {
    header: 'Purchased',
    value: h => h.purchaseDate ?? '',
    className: 'font-mono text-slate-700 whitespace-nowrap',
    render: h => (h.purchaseDate ? <>{h.purchaseDate}{isYearOnly(h.purchaseDate) && <span className="text-slate-400"> (year)</span>}</> : null),
  },
  // Blank when no cost is recorded. Showing 0 would claim the asset was free.
  cost: {
    header: 'Purchase Cost (UGX)',
    value: h => (h.purchaseCost === null || h.purchaseCost === undefined ? '' : String(h.purchaseCost)),
    className: 'font-mono text-slate-700 whitespace-nowrap',
    render: h => (h.purchaseCost === null || h.purchaseCost === undefined ? null : `UGX ${h.purchaseCost.toLocaleString()}`),
  },
  order: { header: 'LPO / Order Ref.', value: h => h.orderNumber ?? '', className: 'font-mono text-slate-700 whitespace-nowrap' },
  supplier: { header: 'Supplier', value: h => h.supplier ?? '' },
} satisfies Record<string, HwCol | ((...args: never[]) => HwCol)>;

const WARRANTY_TONES: Record<Exclude<WarrantyState, 'none'>, Tone> = { ok: 'green', expiring: 'amber', expired: 'red' };

/**
 * Warranty end date, coloured by the same window the server raises alerts with, so the register and the
 * Alert Center never disagree. Empty when nothing is on record.
 */
function warrantyColumn(warningDays: number): HwCol {
  return {
    header: 'Warranty',
    value: h => h.warrantyExpires ?? '',
    className: 'whitespace-nowrap',
    render: h => {
      const { state, days } = warrantyStatus(h.warrantyExpires ?? '', new Date(), warningDays);
      if (state === 'none') return null;
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-slate-700">{h.warrantyExpires}</span>
          <Badge tone={WARRANTY_TONES[state]}>{state === 'expired' ? `expired ${warrantyWhen(days)}` : warrantyWhen(days)}</Badge>
        </span>
      );
    },
  };
}

/**
 * Columns for a register, in order. The same list builds the CSV export, so anything added here is
 * exported too. The purchase block sits at the end, keeping the day-to-day fields leftmost.
 */
export function hardwareColumns(group: HardwareGroup, warrantyWarningDays: number = DEFAULT_WARRANTY_WARNING_DAYS): HwCol[] {
  const purchase: HwCol[] = [hw.purchased, warrantyColumn(warrantyWarningDays), hw.cost, hw.order, hw.supplier];
  switch (group) {
    case 'Network':
      return [
        hw.id, hw.name('Device Name'), hw.department, hw.type, hw.model, hw.ip('Management IP'),
        hw.text('Port Capacity', h => h.portCount), hw.mono('Firmware / OS', h => h.firmwareVersion || h.operatingSystem),
        hw.serial('Serial No.'), hw.location('Rack / Room Location'), hw.condition, hw.state, ...purchase,
      ];
    case 'Server':
      return [
        hw.id, hw.name('Server Name'), hw.department, hw.model, hw.text('Server Role', h => h.serverRole), hw.ip('IP Address'),
        hw.mono('CPU Cores', h => h.cpuCores), hw.mono('RAM', h => h.ram), hw.mono('Storage Array', h => h.hardDisk),
        hw.text('OS / Hypervisor', h => h.operatingSystem), hw.location('DC Location'), hw.condition, hw.state, ...purchase,
      ];
    case 'Printer':
      return [
        hw.id, hw.name('Printer Name'), hw.department, hw.model, hw.text('Print Technology', h => h.printTechnology),
        hw.text('Connection Type', h => h.connectionType), hw.ip('IP Address'), hw.serial('Serial No.'),
        hw.location('Office Location'), hw.condition, hw.state, ...purchase,
      ];
    default:
      return [
        hw.id, ...(group === 'All' ? [hw.category] : []), hw.department, hw.assignee, hw.name('Asset Name'),
        hw.location('Location'), hw.model, hw.serial('S/N / Service Tag'),
        hw.mono('Engraved No.', h => h.engravedNumber), hw.text('OS / Details', h => h.operatingSystem || h.firmwareVersion),
        hw.mono('RAM', h => h.ram), hw.mono('Storage', h => h.hardDisk), hw.condition, hw.state, ...purchase,
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
