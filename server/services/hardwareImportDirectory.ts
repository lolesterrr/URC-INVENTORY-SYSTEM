/**
 * Resolving the department and location a CSV row names to directory records, and creating the missing ones
 * when the import was told it may. Kept apart from the row machinery in `hardwareImport.ts` because this is
 * the only part that writes to the Directory rather than to the register.
 */
import { departments, locations } from '../db/schema';
import { locationPath, PATH_SEPARATOR } from './directory';
import type { Candidate, Tx } from './hardwareImport';

interface DirectoryRecord {
  id: number;
  /** Lower-cased name for a department, lower-cased full path for a location: what a cell is matched against. */
  key: string;
  /** The same thing as it is really spelt, so a message names the record the way the Directory shows it. */
  label: string;
  archived: boolean;
  /** Lower-cased bare name, used to resolve a location given without its parents. */
  name: string;
}

/** Prefers an active record: a name may also belong to one that was archived and later re-used. */
const preferActive = (rows: DirectoryRecord[]) => rows.find(r => !r.archived) ?? rows[0];

type Resolved = { id: number | null } | { error: string };

/**
 * Looks up every department and location the surviving rows name, creating the missing ones when that was
 * allowed. Done in one go before any asset is written, so the name lookup used for the audit snapshots
 * already knows about anything new.
 */
export function resolveDirectory(tx: Tx, candidates: Candidate[], createMissing: boolean) {
  const departmentRows = () =>
    tx
      .select({ id: departments.id, name: departments.name, deletedAt: departments.deletedAt })
      .from(departments)
      .all()
      .map<DirectoryRecord>(d => ({ id: d.id, key: d.name.toLowerCase(), label: d.name, name: d.name.toLowerCase(), archived: d.deletedAt !== null }));
  const locationRows = () => {
    const all = tx.select().from(locations).all();
    const byId = new Map(all.map(l => [l.id, l]));
    return all.map<DirectoryRecord>(l => {
      const path = locationPath(byId, l.id);
      return { id: l.id, key: path.toLowerCase(), label: path, name: l.name.toLowerCase(), archived: l.deletedAt !== null };
    });
  };

  let department = departmentRows();
  let location = locationRows();
  const missingDepartments: string[] = [];
  const missingLocations: string[] = [];
  const createdDepartments: string[] = [];
  const createdLocations: string[] = [];
  const cache = new Map<string, Resolved>();

  const find = (records: DirectoryRecord[], text: string): Resolved | null => {
    const wanted = text.toLowerCase();
    const byKey = records.filter(r => r.key === wanted);
    if (byKey.length) return { id: preferActive(byKey).id };
    // A location may be written without its parents. That is only usable when it picks out exactly one record.
    const byName = records.filter(r => r.name === wanted);
    const active = byName.filter(r => !r.archived);
    const choices = active.length ? active : byName;
    if (choices.length === 1) return { id: choices[0].id };
    if (choices.length > 1) {
      const paths = records.filter(r => r.name === wanted).map(r => r.label);
      return { error: `"${text}" could be any of ${paths.join(', ')}. Write the full path, e.g. ${paths[0]}.` };
    }
    return null;
  };

  const resolve = (kind: 'department' | 'location', text: string): Resolved => {
    const trimmed = text.trim();
    if (!trimmed) return { id: null };
    const cacheKey = `${kind}:${trimmed.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const records = kind === 'department' ? department : location;
    const found = find(records, trimmed);
    let answer: Resolved;
    if (found) {
      answer = found;
    } else if (kind === 'location' && trimmed.includes(PATH_SEPARATOR.trim())) {
      // Creating would have to invent a hierarchy, which an import must never do.
      answer = { error: `no location "${trimmed}" exists. Add it on the Directory screen, then import again.` };
    } else if (!createMissing) {
      (kind === 'department' ? missingDepartments : missingLocations).push(trimmed);
      answer = { error: `"${trimmed}" is not in the Directory. Tick "create missing departments and locations", or add it first.` };
    } else {
      const table = kind === 'department' ? departments : locations;
      const inserted = tx.insert(table).values({ name: trimmed }).returning({ id: table.id }).get();
      (kind === 'department' ? createdDepartments : createdLocations).push(trimmed);
      if (kind === 'department') department = departmentRows();
      else location = locationRows();
      answer = { id: inserted.id };
    }
    cache.set(cacheKey, answer);
    return answer;
  };

  // Resolve in row order so the preview lists missing records the way they appear in the file.
  for (const candidate of candidates) {
    if (candidate.department !== undefined) resolve('department', candidate.department);
    if (candidate.location !== undefined) resolve('location', candidate.location);
  }
  return { resolve, missingDepartments, missingLocations, createdDepartments, createdLocations };
}
