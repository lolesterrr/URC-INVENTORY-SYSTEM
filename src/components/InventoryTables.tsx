/**
 * Inventory registers page: hardware, software licences and server spare parts.
 * Building blocks live in ./inventory/.
 */
import { useState } from 'react';
import type { Directory, HardwareAsset, LifecycleState, Permission, ServerComponent, SoftwareLicense, StaffMember, UserRole } from '../types';
import { CheckinDialog, CheckoutDialog } from './inventory/AssignmentDialogs';
import { componentColumns, hardwareColumns, softwareColumns } from './inventory/columns';
import { ArchiveDialog, BarcodeDialog, type ArchiveTarget } from './inventory/dialogs';
import type { FormContext } from './inventory/FormModal';
import HardwareForm from './inventory/HardwareForm';
import { HistoryDialog } from './inventory/HistoryDialog';
import InventoryToolbar from './inventory/InventoryToolbar';
import { LifecycleDialog } from './inventory/LifecycleDialog';
import {
  assetName, EMPTY_FILTERS, filterHardware, filterServerComponents, filterSoftware, HARDWARE_GROUPS, inGroup, nextId, toCsv,
  type Filters, type HardwareGroup, type InventoryTab,
} from './inventory/model';
import ServerComponentForm from './inventory/ServerComponentForm';
import SoftwareForm from './inventory/SoftwareForm';
import { DataTable, RowActions, type Column } from './inventory/ui';

interface InventoryTablesProps {
  hardware: HardwareAsset[];
  software: SoftwareLicense[];
  serverComponents: ServerComponent[];
  directory: Directory;
  currentUserRole: UserRole;
  permissions: Permission[];
  username: string;
  onAddHardware: (item: HardwareAsset) => Promise<void>;
  onUpdateHardware: (item: HardwareAsset) => Promise<void>;
  onDeleteHardware: (id: string) => Promise<void>;
  onChangeLifecycle: (id: string, to: LifecycleState, note: string) => Promise<void>;
  onCheckoutHardware: (id: string, staffId: number, dueBack: string, notes: string) => Promise<void>;
  onCheckinHardware: (id: string, notes: string) => Promise<void>;
  /** Adds a staff record from a picker (needs directory:manage). */
  onAddStaff: (fullName: string) => Promise<StaffMember>;
  onAddSoftware: (item: SoftwareLicense) => Promise<void>;
  onUpdateSoftware: (item: SoftwareLicense) => Promise<void>;
  onDeleteSoftware: (id: string) => Promise<void>;
  onAddServerComponent: (item: ServerComponent) => Promise<void>;
  onUpdateServerComponent: (item: ServerComponent) => Promise<void>;
  onDeleteServerComponent: (id: string) => Promise<void>;
  selectedSubTab: InventoryTab;
  setSelectedSubTab: (tab: InventoryTab) => void;
}

type Dialog =
  | { kind: 'hardware'; item: HardwareAsset | null }
  | { kind: 'software'; item: SoftwareLicense | null }
  | { kind: 'servers'; item: ServerComponent | null }
  | { kind: 'archive'; target: ArchiveTarget; run: () => Promise<void> }
  | { kind: 'barcode'; id: string }
  | { kind: 'lifecycle'; item: HardwareAsset }
  | { kind: 'history'; id: string; name: string }
  | { kind: 'checkout'; item: HardwareAsset }
  | { kind: 'checkin'; item: HardwareAsset };

function downloadCsv<T>(fileName: string, columns: Column<T>[], rows: T[]) {
  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿' + toCsv(columns.map(c => c.header), rows.map(r => columns.map(c => c.value(r))))], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function InventoryTables(props: InventoryTablesProps) {
  const { hardware, software, serverComponents, directory, currentUserRole, permissions, username, selectedSubTab: tab } = props;
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [group, setGroup] = useState<HardwareGroup>('All');
  const [dialog, setDialog] = useState<Dialog | null>(null);

  // UI hints only; the server enforces the same rules.
  const canEdit = permissions.includes('assets:write');
  const canDispose = permissions.includes('assets:dispose');
  const canReadHistory = permissions.includes('audit:read');
  const addStaff = permissions.includes('directory:manage') ? props.onAddStaff : undefined;
  const close = () => setDialog(null);

  const shownHardware = filterHardware(hardware, filters, group);
  const shownSoftware = filterSoftware(software, filters);
  const shownComponents = filterServerComponents(serverComponents, filters);

  const changeTab = (next: InventoryTab) => {
    props.setSelectedSubTab(next);
    setFilters(EMPTY_FILTERS);
  };

  const exportCsv = () => {
    if (tab === 'hardware') downloadCsv(`URC_Hardware_${group}_Register.csv`, hardwareColumns(group), shownHardware);
    else if (tab === 'software') downloadCsv('URC_Software_Licences.csv', softwareColumns, shownSoftware);
    else downloadCsv('URC_Server_Spares.csv', componentColumns, shownComponents);
  };

  const openNew = () =>
    setDialog(tab === 'hardware' ? { kind: 'hardware', item: null } : tab === 'software' ? { kind: 'software', item: null } : { kind: 'servers', item: null });

  const archive = (target: ArchiveTarget, run: () => Promise<void>) => setDialog({ kind: 'archive', target, run });

  const formCtx = (mode: FormContext['mode']): FormContext => ({ mode, username, role: currentUserRole, onClose: close });

  const renderDialog = () => {
    if (!dialog) return null;
    switch (dialog.kind) {
      case 'hardware':
        return (
          <HardwareForm
            ctx={formCtx(dialog.item ? 'edit' : 'add')}
            initial={dialog.item}
            suggestedId={nextId('HW-', hardware.map(h => h.id))}
            directory={directory}
            onAddStaff={addStaff}
            onSave={dialog.item ? props.onUpdateHardware : props.onAddHardware}
          />
        );
      case 'software':
        return (
          <SoftwareForm
            ctx={formCtx(dialog.item ? 'edit' : 'add')}
            initial={dialog.item}
            suggestedId={nextId('SW-', software.map(s => s.id))}
            directory={directory}
            onSave={dialog.item ? props.onUpdateSoftware : props.onAddSoftware}
          />
        );
      case 'servers':
        return (
          <ServerComponentForm
            ctx={formCtx(dialog.item ? 'edit' : 'add')}
            initial={dialog.item}
            suggestedId={nextId('SC-', serverComponents.map(c => c.id))}
            onSave={dialog.item ? props.onUpdateServerComponent : props.onAddServerComponent}
          />
        );
      case 'archive':
        return <ArchiveDialog target={dialog.target} onConfirm={dialog.run} onClose={close} />;
      case 'barcode':
        return <BarcodeDialog id={dialog.id} onClose={close} />;
      case 'lifecycle':
        return (
          <LifecycleDialog
            asset={dialog.item}
            canWrite={canEdit}
            canDispose={canDispose}
            onSubmit={(to, note) => props.onChangeLifecycle(dialog.item.id, to, note)}
            onClose={close}
          />
        );
      case 'history':
        return <HistoryDialog id={dialog.id} name={dialog.name} onClose={close} />;
      case 'checkout':
        return (
          <CheckoutDialog
            asset={dialog.item}
            staff={directory.staff}
            onAddStaff={addStaff}
            onSubmit={(staffId, dueBack, notes) => props.onCheckoutHardware(dialog.item.id, staffId, dueBack, notes)}
            onClose={close}
          />
        );
      case 'checkin':
        return <CheckinDialog asset={dialog.item} onSubmit={notes => props.onCheckinHardware(dialog.item.id, notes)} onClose={close} />;
    }
  };

  return (
    <div className="space-y-4">
      <InventoryToolbar
        tab={tab}
        onTabChange={changeTab}
        filters={filters}
        onFiltersChange={setFilters}
        canEdit={canEdit}
        onExport={exportCsv}
        onAdd={openNew}
        departments={directory.departments.map(d => d.name)}
      />

      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {tab === 'hardware' && (
          <>
            <div className="flex flex-wrap items-center gap-1.5 p-3 bg-slate-50 border-b border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mr-2">Device register:</span>
              {HARDWARE_GROUPS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGroup(g.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1.5 ${
                    group === g.id ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>{g.label}</span>
                  <span className={`text-[9.5px] px-1.5 rounded font-mono ${group === g.id ? 'bg-slate-700 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                    {hardware.filter(h => inGroup(h, g.id)).length}
                  </span>
                </button>
              ))}
            </div>
            <DataTable
              columns={hardwareColumns(group)}
              rows={shownHardware}
              minWidth={1000}
              emptyText="No hardware matches the current filters."
              actions={h => (
                <RowActions
                  canEdit={canEdit}
                  label={assetName(h) || h.id}
                  onBarcode={() => setDialog({ kind: 'barcode', id: h.id })}
                  onCheckout={canEdit && (h.lifecycleState === 'In Stock' || h.lifecycleState === 'In Repair') ? () => setDialog({ kind: 'checkout', item: h }) : undefined}
                  onCheckin={canEdit && (h.lifecycleState === 'Deployed' || h.lifecycleState === 'In Repair') ? () => setDialog({ kind: 'checkin', item: h }) : undefined}
                  onLifecycle={canEdit || canDispose ? () => setDialog({ kind: 'lifecycle', item: h }) : undefined}
                  onHistory={canReadHistory ? () => setDialog({ kind: 'history', id: h.id, name: assetName(h) || h.id }) : undefined}
                  editLocked={h.lifecycleState === 'Disposed'}
                  onEdit={() => setDialog({ kind: 'hardware', item: h })}
                  onArchive={() => archive({ kind: 'hardware asset', id: h.id, name: assetName(h) || h.id }, () => props.onDeleteHardware(h.id))}
                />
              )}
            />
          </>
        )}

        {tab === 'software' && (
          <DataTable
            columns={softwareColumns}
            rows={shownSoftware}
            emptyText="No software licences match the current filters."
            actions={s => (
              <RowActions
                canEdit={canEdit}
                label={s.name || s.id}
                onEdit={() => setDialog({ kind: 'software', item: s })}
                onArchive={() => archive({ kind: 'software licence', id: s.id, name: s.name || s.id }, () => props.onDeleteSoftware(s.id))}
              />
            )}
          />
        )}

        {tab === 'servers' && (
          <DataTable
            columns={componentColumns}
            rows={shownComponents}
            emptyText="No server parts match the current filters."
            actions={c => (
              <RowActions
                canEdit={canEdit}
                label={c.partName || c.id}
                onEdit={() => setDialog({ kind: 'servers', item: c })}
                onArchive={() => archive({ kind: 'server spare part', id: c.id, name: c.partName || c.id }, () => props.onDeleteServerComponent(c.id))}
              />
            )}
          />
        )}
      </div>

      {renderDialog()}
    </div>
  );
}
