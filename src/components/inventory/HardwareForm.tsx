import type { HardwareAsset } from '../../types';
import { FormModal, useDraft, type FormContext } from './FormModal';
import { assetName, assignee, HARDWARE_CATEGORIES, STATUSES, type HardwareCategory } from './model';
import { DepartmentField, Field, SelectField, StatusOptions } from './ui';

const DEFAULT_DEPARTMENT = 'INFORMATION COMMUNICATION AND TECHNOLOGY';

const blank = {
  id: '', category: 'Desktop', department: DEFAULT_DEPARTMENT, assetName: '', user: '', model: '', status: 'In Stock',
  yearOfPurchase: '', location: '', serialNumber: '', engravedNumber: '', operatingSystem: '', ram: '', hardDisk: '',
  ipAddress: '', portCount: '', firmwareVersion: '', serverRole: '', cpuCores: '', connectionType: '', printTechnology: '',
};
type Draft = typeof blank;
type Key = keyof Draft;

interface FieldSpec {
  key: Key;
  label: string;
  placeholder?: string;
  mono?: boolean;
  required?: boolean;
}

// Fields that depend on the device category. Only the asset name is required; the rest may be unknown.
const CATEGORY_FIELDS: Record<'network' | 'server' | 'printer' | 'standard', FieldSpec[]> = {
  network: [
    { key: 'assetName', label: 'Device name', placeholder: 'e.g. Cisco Catalyst 9300 switch', required: true },
    { key: 'user', label: 'Owner / assignee', placeholder: 'e.g. Server room core network' },
    { key: 'model', label: 'Model', placeholder: 'e.g. Catalyst 9300 48-port' },
    { key: 'ipAddress', label: 'Management IP address', placeholder: 'e.g. 10.100.1.1', mono: true },
    { key: 'portCount', label: 'Port count / capacity', placeholder: 'e.g. 48 GbE PoE+ / 4x 10G SFP+' },
    { key: 'firmwareVersion', label: 'Firmware / OS version', placeholder: 'e.g. Cisco IOS-XE 17.6', mono: true },
  ],
  server: [
    { key: 'assetName', label: 'Server name', placeholder: 'e.g. PowerEdge R750 DB host', required: true },
    { key: 'serverRole', label: 'Server role / function', placeholder: 'e.g. Active Directory & ERP database' },
    { key: 'model', label: 'Model', placeholder: 'e.g. PowerEdge R750' },
    { key: 'ipAddress', label: 'IP address', placeholder: 'e.g. 10.100.2.10', mono: true },
    { key: 'cpuCores', label: 'CPU cores', placeholder: 'e.g. 32 cores (dual Xeon)', mono: true },
    { key: 'ram', label: 'RAM capacity', placeholder: 'e.g. 128 GB ECC DDR4', mono: true },
    { key: 'hardDisk', label: 'Storage array', placeholder: 'e.g. 4 TB RAID-10 NVMe', mono: true },
    { key: 'operatingSystem', label: 'OS / hypervisor', placeholder: 'e.g. Windows Server 2022' },
  ],
  printer: [
    { key: 'assetName', label: 'Printer name', placeholder: 'e.g. HP LaserJet Enterprise printer', required: true },
    { key: 'user', label: 'Office / assignee', placeholder: 'e.g. Finance office' },
    { key: 'model', label: 'Model', placeholder: 'e.g. LaserJet M608dn' },
    { key: 'printTechnology', label: 'Print technology', placeholder: 'e.g. Monochrome laser / colour inkjet' },
    { key: 'connectionType', label: 'Connection type', placeholder: 'e.g. Ethernet / USB' },
    { key: 'ipAddress', label: 'IP address', placeholder: 'e.g. 10.100.4.50', mono: true },
  ],
  standard: [
    { key: 'assetName', label: 'Asset name', placeholder: 'e.g. Dell Latitude 5430 laptop', required: true },
    { key: 'user', label: 'User / assignee', placeholder: 'Full name of the staff member' },
    { key: 'model', label: 'Model', placeholder: 'e.g. Latitude 5430' },
    { key: 'operatingSystem', label: 'Operating system', placeholder: 'e.g. Windows 11 Pro 64-bit' },
    { key: 'ram', label: 'RAM', placeholder: 'e.g. 16 GB DDR4', mono: true },
    { key: 'hardDisk', label: 'Hard disk / SSD', placeholder: 'e.g. 512 GB NVMe SSD', mono: true },
  ],
};

const SHARED_FIELDS: FieldSpec[] = [
  { key: 'yearOfPurchase', label: 'Year of purchase', placeholder: `e.g. ${new Date().getFullYear()}`, mono: true },
  { key: 'location', label: 'Location / station', placeholder: 'e.g. HQ, Kampala / DC rack 04' },
  { key: 'serialNumber', label: 'Serial number / service tag', mono: true },
  { key: 'engravedNumber', label: 'Engraved tag number', mono: true },
];

function fieldsFor(category: string): FieldSpec[] {
  if (category === 'Switch' || category === 'Router') return CATEGORY_FIELDS.network;
  if (category === 'Server') return CATEGORY_FIELDS.server;
  if (category === 'Printer') return CATEGORY_FIELDS.printer;
  return CATEGORY_FIELDS.standard;
}

function toDraft(h: HardwareAsset): Draft {
  const draft = { ...blank };
  for (const key of Object.keys(blank) as Key[]) {
    const v = h[key as keyof HardwareAsset];
    if (typeof v === 'string') draft[key] = v;
  }
  return { ...draft, assetName: assetName(h), user: assignee(h), department: h.department || DEFAULT_DEPARTMENT };
}

export default function HardwareForm({
  ctx,
  initial,
  suggestedId,
  onSave,
}: {
  ctx: FormContext;
  initial: HardwareAsset | null;
  suggestedId: string;
  onSave: (item: HardwareAsset) => Promise<void>;
}) {
  const { draft, bind } = useDraft<Draft>(initial ? toDraft(initial) : { ...blank, id: suggestedId });

  const submit = () => {
    const values = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()])) as Draft;
    return onSave({
      ...initial,
      ...values,
      category: values.category as HardwareCategory,
      name: values.assetName,
      assignee: values.user,
    });
  };

  const renderField = (f: FieldSpec) => <Field key={f.key} label={f.label} placeholder={f.placeholder} mono={f.mono} required={f.required} {...bind(f.key)} />;

  return (
    <FormModal ctx={ctx} noun="hardware asset" onSubmit={submit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Asset ID" required mono disabled={ctx.mode === 'edit'} placeholder="e.g. HW-101" {...bind('id')} />
        <SelectField label="Device category" options={HARDWARE_CATEGORIES} value={draft.category as HardwareCategory} onChange={bind('category').onChange} />
        <DepartmentField {...bind('department')} />
        {fieldsFor(draft.category).map(renderField)}
        {SHARED_FIELDS.map(renderField)}
        <Field label="Status" required list="hardware-statuses" placeholder="e.g. In Use" {...bind('status')} />
        <StatusOptions id="hardware-statuses" statuses={STATUSES.hardware} />
      </div>
    </FormModal>
  );
}
