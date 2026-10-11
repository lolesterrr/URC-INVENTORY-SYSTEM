import { INITIAL_STATES } from '../../../shared/lifecycle';
import { useState } from 'react';
import type { Directory, HardwareAsset, LifecycleState, StaffMember } from '../../types';
import { departmentOptions, locationOptions } from './directoryOptions';
import { FormModal, useDraft, type FormContext } from './FormModal';
import { assetName, HARDWARE_CATEGORIES, type HardwareCategory } from './model';
import { SharedDeviceToggle, StaffPicker } from './StaffPicker';
import { Field, RecordSelect, SelectField } from './ui';

const blank = {
  id: '', category: 'Desktop', assetName: '', model: '', condition: '', lifecycleState: 'In Stock',
  yearOfPurchase: '', serialNumber: '', engravedNumber: '', operatingSystem: '', ram: '', hardDisk: '',
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
    { key: 'model', label: 'Model', placeholder: 'e.g. LaserJet M608dn' },
    { key: 'printTechnology', label: 'Print technology', placeholder: 'e.g. Monochrome laser / colour inkjet' },
    { key: 'connectionType', label: 'Connection type', placeholder: 'e.g. Ethernet / USB' },
    { key: 'ipAddress', label: 'IP address', placeholder: 'e.g. 10.100.4.50', mono: true },
  ],
  standard: [
    { key: 'assetName', label: 'Asset name', placeholder: 'e.g. Dell Latitude 5430 laptop', required: true },
    { key: 'model', label: 'Model', placeholder: 'e.g. Latitude 5430' },
    { key: 'operatingSystem', label: 'Operating system', placeholder: 'e.g. Windows 11 Pro 64-bit' },
    { key: 'ram', label: 'RAM', placeholder: 'e.g. 16 GB DDR4', mono: true },
    { key: 'hardDisk', label: 'Hard disk / SSD', placeholder: 'e.g. 512 GB NVMe SSD', mono: true },
  ],
};

const SHARED_FIELDS: FieldSpec[] = [
  { key: 'yearOfPurchase', label: 'Year of purchase', placeholder: `e.g. ${new Date().getFullYear()}`, mono: true },
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
  return { ...draft, assetName: assetName(h) };
}

export default function HardwareForm({
  ctx,
  initial,
  suggestedId,
  directory,
  onAddStaff,
  onSave,
}: {
  ctx: FormContext;
  initial: HardwareAsset | null;
  suggestedId: string;
  directory: Directory;
  onAddStaff?: (fullName: string) => Promise<StaffMember>;
  onSave: (item: HardwareAsset) => Promise<void>;
}) {
  const { draft, bind } = useDraft<Draft>(initial ? toDraft(initial) : { ...blank, id: suggestedId });
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? null);
  const [locationId, setLocationId] = useState(initial?.locationId ?? null);
  // Only a new asset that starts Deployed takes an assignee here; otherwise use check-out.
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [shared, setShared] = useState(false);
  const startsDeployed = ctx.mode === 'add' && draft.lifecycleState === 'Deployed';

  const submit = async () => {
    if (startsDeployed && !shared && assigneeId === null) throw new Error('Pick who has this asset, or mark it as a shared device.');
    const values = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()])) as Draft;
    return onSave({
      ...initial,
      ...values,
      departmentId,
      department: initial?.department ?? '',
      locationId,
      location: initial?.location ?? '',
      // The server ignores the assignee on edits; on create it opens the first check-out.
      assigneeId: startsDeployed && !shared ? assigneeId : initial?.assigneeId ?? null,
      assignee: initial?.assignee ?? '',
      category: values.category as HardwareCategory,
      lifecycleState: values.lifecycleState as LifecycleState,
      name: values.assetName,
    });
  };

  const renderField = (f: FieldSpec) => <Field key={f.key} label={f.label} placeholder={f.placeholder} mono={f.mono} required={f.required} {...bind(f.key)} />;

  return (
    <FormModal ctx={ctx} noun="hardware asset" onSubmit={submit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Asset ID" required mono disabled={ctx.mode === 'edit'} placeholder="e.g. HW-101" {...bind('id')} />
        <SelectField label="Device category" options={HARDWARE_CATEGORIES} value={draft.category as HardwareCategory} onChange={bind('category').onChange} />
        <RecordSelect label="Department" value={departmentId} options={departmentOptions(directory)} onChange={setDepartmentId} />
        <RecordSelect label="Location" value={locationId} options={locationOptions(directory)} onChange={setLocationId} />
        {fieldsFor(draft.category).map(renderField)}
        {SHARED_FIELDS.map(renderField)}
        <Field label="Condition" placeholder="e.g. Good, Faulty, Needs 1 TB upgrade" {...bind('condition')} />
        {ctx.mode === 'add' ? (
          <SelectField label="Starting state" options={INITIAL_STATES} value={draft.lifecycleState as (typeof INITIAL_STATES)[number]} onChange={bind('lifecycleState').onChange} />
        ) : (
          <p className="text-[10px] text-slate-500 self-end pb-2">
            State: <strong className="text-slate-800">{initial?.lifecycleState}</strong>
            {initial?.assignee && <>, with <strong className="text-slate-800">{initial.assignee}</strong></>}. Use “Change state”, “Check out” or “Check in” in the register.
          </p>
        )}
        {startsDeployed && (
          <div className="sm:col-span-2 space-y-2">
            {!shared && <StaffPicker label="Assignee (starts Deployed)" staff={directory.staff} value={assigneeId} onChange={setAssigneeId} onAddStaff={onAddStaff} />}
            <SharedDeviceToggle checked={shared} onChange={setShared} />
          </div>
        )}
      </div>
    </FormModal>
  );
}
