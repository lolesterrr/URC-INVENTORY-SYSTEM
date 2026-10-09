import { useState } from 'react';
import type { Directory, SoftwareLicense } from '../../types';
import { departmentOptions } from './directoryOptions';
import { FormModal, useDraft, type FormContext } from './FormModal';
import { SOFTWARE_CATEGORIES, STATUSES } from './model';
import { Field, RecordSelect, SelectField, StatusOptions } from './ui';

type Category = SoftwareLicense['category'];

const blank = {
  id: '', name: '', category: 'Office', licenseKey: '', vendor: '',
  seatCapacity: '1', activeSeats: '0', subscriptionCost: '0', expiryDate: '', status: 'Active',
};
type Draft = typeof blank;

const toDraft = (s: SoftwareLicense): Draft => ({
  id: s.id,
  name: s.name,
  category: s.category,
  licenseKey: s.licenseKey,
  vendor: s.vendor,
  seatCapacity: String(s.seatCapacity ?? 0),
  activeSeats: String(s.activeSeats ?? 0),
  subscriptionCost: String(s.subscriptionCost ?? 0),
  expiryDate: s.expiryDate,
  status: s.status,
});

export default function SoftwareForm({
  ctx,
  initial,
  suggestedId,
  directory,
  onSave,
}: {
  ctx: FormContext;
  initial: SoftwareLicense | null;
  suggestedId: string;
  directory: Directory;
  onSave: (item: SoftwareLicense) => Promise<void>;
}) {
  const { draft, bind } = useDraft<Draft>(initial ? toDraft(initial) : { ...blank, id: suggestedId });
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? null);

  const submit = () =>
    onSave({
      id: draft.id.trim(),
      name: draft.name.trim(),
      category: draft.category as Category,
      departmentId,
      department: initial?.department ?? '',
      licenseKey: draft.licenseKey.trim(),
      vendor: draft.vendor.trim(),
      seatCapacity: Number(draft.seatCapacity) || 0,
      activeSeats: Number(draft.activeSeats) || 0,
      subscriptionCost: Number(draft.subscriptionCost) || 0,
      expiryDate: draft.expiryDate,
      status: draft.status.trim(),
    });

  return (
    <FormModal ctx={ctx} noun="software licence" onSubmit={submit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Licence ID" required mono disabled={ctx.mode === 'edit'} {...bind('id')} />
        <Field label="Licence key" mono {...bind('licenseKey')} />
        <Field label="Licence / subscription title" required wide {...bind('name')} />
        <RecordSelect label="Department" wide value={departmentId} options={departmentOptions(directory)} onChange={setDepartmentId} />
        <SelectField label="Category" options={SOFTWARE_CATEGORIES} value={draft.category as Category} onChange={bind('category').onChange} />
        <Field label="Vendor / partner" {...bind('vendor')} />
        <Field label="Total seats" type="number" min={0} {...bind('seatCapacity')} />
        <Field label="Allocated seats" type="number" min={0} {...bind('activeSeats')} />
        <Field label="Annual cost (UGX)" type="number" min={0} {...bind('subscriptionCost')} />
        <Field label="Expiry date" type="date" {...bind('expiryDate')} />
        <Field label="Status" required wide list="software-statuses" placeholder="e.g. Active" {...bind('status')} />
        <StatusOptions id="software-statuses" statuses={STATUSES.software} />
      </div>
    </FormModal>
  );
}
