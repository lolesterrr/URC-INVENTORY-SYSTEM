/** Directory records as options for RecordSelect. No React here. */
import type { Directory } from '../../types';
import type { RecordOption } from './ui';

export const departmentOptions = (dir: Directory): RecordOption[] => dir.departments.map(d => ({ id: d.id, label: d.name, archived: d.archived }));

/** Locations by full path, so "Jinja / Stores" and "Tororo / Stores" can be told apart. */
export const locationOptions = (dir: Directory): RecordOption[] => dir.locations.map(l => ({ id: l.id, label: l.path, archived: l.archived }));
