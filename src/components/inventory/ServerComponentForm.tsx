import type { ServerComponent } from '../../types';
import { FormModal, useDraft, type FormContext } from './FormModal';
import { COMPONENT_CATEGORIES, STATUSES } from './model';
import { Field, SelectField, StatusOptions } from './ui';

type Category = ServerComponent['category'];

const blank = { id: '', serverName: '', partName: '', serialNumber: '', category: 'RAM', status: 'Active', quantity: '1', reorderLevel: '0' };
type Draft = typeof blank;

const toDraft = (c: ServerComponent): Draft => ({
  id: c.id,
  serverName: c.serverName,
  partName: c.partName,
  serialNumber: c.serialNumber,
  category: c.category,
  status: c.status,
  quantity: String(c.quantity ?? 0),
  reorderLevel: String(c.reorderLevel ?? 0),
});

export default function ServerComponentForm({
  ctx,
  initial,
  suggestedId,
  onSave,
}: {
  ctx: FormContext;
  initial: ServerComponent | null;
  suggestedId: string;
  onSave: (item: ServerComponent) => Promise<void>;
}) {
  const { draft, bind } = useDraft<Draft>(initial ? toDraft(initial) : { ...blank, id: suggestedId });

  const submit = () =>
    onSave({
      id: draft.id.trim(),
      serverName: draft.serverName.trim(),
      partName: draft.partName.trim(),
      serialNumber: draft.serialNumber.trim(),
      category: draft.category as Category,
      status: draft.status.trim(),
      quantity: Number(draft.quantity) || 0,
      reorderLevel: Number(draft.reorderLevel) || 0,
    });

  return (
    <FormModal ctx={ctx} noun="server spare part" onSubmit={submit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Part ID" required mono disabled={ctx.mode === 'edit'} {...bind('id')} />
        <Field label="Component serial no." mono {...bind('serialNumber')} />
        <Field label="Server / rack location" required wide placeholder="e.g. Kampala main DC, rack 4" {...bind('serverName')} />
        <Field label="Part name / specification" required wide placeholder="e.g. Dell 750 W hot-plug PSU" {...bind('partName')} />
        <SelectField label="Category" options={COMPONENT_CATEGORIES} value={draft.category as Category} onChange={bind('category').onChange} />
        <Field label="Status" required list="component-statuses" placeholder="e.g. Active" {...bind('status')} />
        <StatusOptions id="component-statuses" statuses={STATUSES.servers} />
        <Field label="Quantity available" type="number" min={0} {...bind('quantity')} />
        <Field label="Reorder alert level" type="number" min={0} {...bind('reorderLevel')} />
      </div>
    </FormModal>
  );
}
