import React, { useState } from 'react';
import { Building2, MapPin, RefreshCw, UserRound } from 'lucide-react';
import type { Department, Directory, DirectoryKind, LocationRecord, StaffMember } from '../../types';
import type { DepartmentInput, LocationInput, StaffInput } from '../../hooks/useInventoryData';
import { departmentOptions } from '../inventory/directoryOptions';
import { ErrorNote, Field, ModalShell, RecordSelect, type RecordOption } from '../inventory/ui';

export type DirectoryRecord = Department | LocationRecord | StaffMember;

export interface DirectorySavers {
  saveDepartment: (input: DepartmentInput, id?: number) => Promise<unknown>;
  saveLocation: (input: LocationInput, id?: number) => Promise<unknown>;
  saveStaff: (input: StaffInput, id?: number) => Promise<unknown>;
}

const TITLES: Record<DirectoryKind, { noun: string; icon: typeof Building2 }> = {
  departments: { noun: 'department', icon: Building2 },
  locations: { noun: 'location', icon: MapPin },
  staff: { noun: 'staff member', icon: UserRound },
};

/** A location and all of its sub-locations, at any depth. */
export function subtree(locations: LocationRecord[], id: number): Set<number> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of locations) {
      if (l.parentId !== null && ids.has(l.parentId) && !ids.has(l.id)) {
        ids.add(l.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** A location cannot sit inside itself or its own sub-locations, so those are not offered as a parent. */
function parentOptions(dir: Directory, editing: LocationRecord | null): RecordOption[] {
  const excluded = editing ? subtree(dir.locations, editing.id) : new Set<number>();
  return dir.locations.filter(l => !excluded.has(l.id)).map(l => ({ id: l.id, label: l.path, archived: l.archived }));
}

/** Add or edit one department, location or staff member. */
export function RecordDialog({
  kind,
  record,
  directory,
  savers,
  onClose,
}: {
  kind: DirectoryKind;
  record: DirectoryRecord | null;
  directory: Directory;
  savers: DirectorySavers;
  onClose: () => void;
}) {
  const location = kind === 'locations' ? (record as LocationRecord | null) : null;
  const person = kind === 'staff' ? (record as StaffMember | null) : null;
  const [name, setName] = useState(person?.fullName ?? (record as Department | LocationRecord | null)?.name ?? '');
  const [staffNumber, setStaffNumber] = useState(person?.staffNumber ?? '');
  const [departmentId, setDepartmentId] = useState(person?.departmentId ?? null);
  const [parentId, setParentId] = useState(location?.parentId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { noun, icon: Icon } = TITLES[kind];
  // Two people can share a name, so this only warns; a real duplicate can be merged later.
  const namesake = kind === 'staff' && name.trim()
    ? directory.staff.find(s => !s.archived && s.id !== record?.id && s.fullName.toLowerCase() === name.trim().toLowerCase())
    : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = record?.id;
      if (kind === 'departments') await savers.saveDepartment({ name: name.trim() }, id);
      else if (kind === 'locations') await savers.saveLocation({ name: name.trim(), parentId }, id);
      else await savers.saveStaff({ fullName: name.trim(), staffNumber: staffNumber.trim(), departmentId }, id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save this ${noun}.`);
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={busy ? () => undefined : onClose} title={<><Icon className="h-4 w-4 text-amber-600" />{record ? 'Edit' : 'Add'} {noun}</>}>
      <form onSubmit={submit} className="space-y-3">
        <Field label={kind === 'staff' ? 'Full name' : 'Name'} required value={name} onChange={setName} placeholder={kind === 'locations' ? 'e.g. Jinja Station' : undefined} />
        {kind === 'locations' && (
          <>
            <RecordSelect label="Inside (parent location)" value={parentId} options={parentOptions(directory, location)} onChange={setParentId} />
            <p className="text-[10px] text-slate-500">Leave empty for a top-level location such as a region.</p>
          </>
        )}
        {kind === 'staff' && (
          <>
            {namesake && (
              <p role="status" className="p-2 text-[11px] rounded-md border bg-amber-50 border-amber-200 text-amber-800">
                {namesake.fullName}
                {namesake.department && ` (${namesake.department})`}
                {namesake.staffNumber && `, ${namesake.staffNumber},`} is already a staff member. Save only if this is a different person; a duplicate can be merged later.
              </p>
            )}
            <Field label="Staff number" mono value={staffNumber} onChange={setStaffNumber} placeholder="Optional" />
            <RecordSelect label="Department" value={departmentId} options={departmentOptions(directory)} onChange={setDepartmentId} />
          </>
        )}
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs uppercase font-mono">
            Cancel
          </button>
          <button type="submit" disabled={busy || !name.trim()} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase font-mono flex items-center gap-2 disabled:opacity-50">
            {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
