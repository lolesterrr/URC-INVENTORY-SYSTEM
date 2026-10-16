/**
 * Bulk update of the hardware register from a CSV file.
 *
 * Rows are matched on `Asset ID`: an id that exists updates that asset, a valid id that does not exist
 * creates one. A column missing from the file is never touched; a blank cell in a column that *is* present
 * clears that field, so an export → edit → import round trip is lossless.
 *
 * A dry run takes exactly the same path and is rolled back at the end, so the preview is what a commit does.
 */
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import type { DB } from '../db';
import { departments, hardware, locations } from '../db/schema';
import { parseCsv, unescapeCsvFormula } from '../../shared/csv';
import { isCalendarDate } from '../../shared/purchase';
import { HARDWARE_CATEGORIES, hardwareFields, idSchema } from '../validation';
import { recordAudit } from './audit';
import { checkReference, loadDirectory } from './directory';
import { resolveDirectory } from './hardwareImportDirectory';
import { detectCategory, hardwareSnapshot } from './hardware';
import { ID_HEADER, isIdHeader, matchHeader, type ImportField, type ValueField } from './hardwareImportColumns';

type Row = typeof hardware.$inferSelect;
/** The transaction handed to `db.transaction`. */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

/** Keeps one import bounded; well above URC's 82 assets, low enough to stay quick and to fit the body limit. */
export const MAX_IMPORT_ROWS = 5_000;

/** A whole-file problem: nothing was examined, so there is no row-by-row report. */
export class ImportError extends Error {}

export interface ImportOptions {
  csv: string;
  /** Apply nothing and report what would happen. */
  dryRun: boolean;
  /** Create the departments and locations the file names but the Directory does not hold. */
  createMissingDirectory: boolean;
}

export type RowStatus = 'create' | 'update' | 'unchanged' | 'rejected';

export interface ImportRow {
  /** Position among the data rows, 1-based. The header is not counted and blank lines are ignored. */
  row: number;
  id: string;
  status: RowStatus;
  /** Why the row was rejected. */
  error?: string;
  /** Headers whose values this row changes. Empty for an unchanged row. */
  changed?: string[];
}

export interface ImportResult {
  dryRun: boolean;
  rowsRead: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  /** Headers the import does not recognise. Reported, never fatal. */
  unknownColumns: string[];
  /** Headers read and deliberately left alone, with the reason shown to the user. */
  ignoredColumns: { header: string; reason: string }[];
  /** Records the file names that the Directory does not hold and that the import could create. */
  missingDepartments: string[];
  missingLocations: string[];
  /** True when records are missing and permission to create them was not given, so those rows were rejected. */
  needsDirectoryConsent: boolean;
  createdDepartments: string[];
  createdLocations: string[];
  rows: ImportRow[];
}

/** Rolls a dry run back while carrying its report out of the transaction. */
class DryRun extends Error {
  constructor(public result: ImportResult) {
    super('dry run');
  }
}

/** One column of the file that sets a field. */
interface Column {
  index: number;
  header: string;
  field: ImportField;
}

/** A value ready for the database, a reason the cell is unusable, or "leave this field alone". */
type Converted = { value: string | number | null } | { error: string } | { skip: true };

/**
 * Turns one cell into the value its column stores, using the very schema `PUT /api/hardware` validates with,
 * so the import can never write something the API would have refused.
 */
function convertValue(field: ValueField, text: string): Converted {
  if (field === 'assetName' && !text) return { error: 'An asset needs a name.' };
  if (field === 'category') {
    // The column is NOT NULL with no empty state, so a blank cell leaves the category as it is.
    if (!text) return { skip: true };
    const match = HARDWARE_CATEGORIES.find(c => c.toLowerCase() === text.toLowerCase());
    return match ? { value: match } : { error: `"${text}" is not a category. Use one of: ${HARDWARE_CATEGORIES.join(', ')}.` };
  }
  // A warranty is alerted on, so only an exact date will do. `purchase_date` accepts a bare year as well.
  if (field === 'warrantyExpires' && text && !isCalendarDate(text)) {
    return { error: 'Use an exact date (e.g. 2027-03-14). A year is not enough to raise a warranty alert from.' };
  }
  // Spreadsheets write money as "1,200,000" or "UGX 1,200,000"; both mean the same number.
  const cell = field === 'purchaseCost' ? text.replace(/^ugx/i, '').replace(/[\s,]/g, '') : text;
  const parsed = hardwareFields.shape[field].safeParse(cell);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'The value is not valid.' };
  return { value: (parsed.data ?? null) as string | number | null };
}

/** What pass one worked out about a row, before any record is written. */
export interface Candidate {
  row: number;
  id: string;
  existing?: Row;
  values: Map<ValueField, string | number | null>;
  /** Cell text for the department and location columns, when the file has them. */
  department?: string;
  location?: string;
}

export function importHardwareCsv(db: DB, req: Request, opts: ImportOptions): ImportResult {
  const table = parseCsv(opts.csv);
  if (!table.length) throw new ImportError('The file is empty.');
  const [headerRow, ...dataRows] = table;
  if (!headerRow.some(isIdHeader)) throw new ImportError(`The file needs an "${ID_HEADER}" column to say which asset each row is about.`);
  if (!dataRows.length) throw new ImportError('The file has a header but no rows.');
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ImportError(`The file has ${dataRows.length} rows. At most ${MAX_IMPORT_ROWS} can be imported at once; split it up.`);
  }

  const idIndex = headerRow.findIndex(isIdHeader);
  const columns: Column[] = [];
  const unknownColumns: string[] = [];
  const ignoredColumns: { header: string; reason: string }[] = [];
  const fieldColumns = new Map<ImportField, string>();
  headerRow.forEach((raw, index) => {
    const header = raw.trim();
    if (index === idIndex) return;
    if (isIdHeader(header)) return ignoredColumns.push({ header, reason: `A second ID column; the first "${headerRow[idIndex].trim()}" is the one used.` });
    const match = matchHeader(header);
    if (!match) {
      if (header) unknownColumns.push(header);
      return;
    }
    if (match.field === null) return ignoredColumns.push({ header, reason: match.reason! });
    const earlier = fieldColumns.get(match.field);
    if (earlier) return ignoredColumns.push({ header, reason: `"${earlier}" already sets the same field, so this column is ignored.` });
    fieldColumns.set(match.field, header);
    columns.push({ index, header, field: match.field });
  });

  const headerOf = (field: ImportField) => fieldColumns.get(field) ?? field;
  let result: ImportResult | null = null;
  try {
    db.transaction(tx => {
      const built = run(tx, req, opts, { dataRows, columns, idIndex, headerOf, unknownColumns, ignoredColumns });
      if (opts.dryRun) throw new DryRun(built);
      result = built;
    });
  } catch (err) {
    if (!(err instanceof DryRun)) throw err;
    result = err.result;
  }
  return result!;
}

interface Parsed {
  dataRows: string[][];
  columns: Column[];
  idIndex: number;
  headerOf: (field: ImportField) => string;
  unknownColumns: string[];
  ignoredColumns: { header: string; reason: string }[];
}

function run(tx: Tx, req: Request, opts: ImportOptions, parsed: Parsed): ImportResult {
  const { dataRows, columns, idIndex, headerOf } = parsed;
  const rows: ImportRow[] = [];
  const candidates: Candidate[] = [];
  const seenIds = new Map<string, number>();

  // Pass one reads and checks every row without writing anything, so the records a rejected row names are
  // never created.
  dataRows.forEach((cells, i) => {
    const row = i + 1;
    const cellAt = (index: number) => unescapeCsvFormula((cells[index] ?? '').trim());
    const id = cellAt(idIndex);
    const reject = (error: string) => rows.push({ row, id, status: 'rejected', error });

    const validId = idSchema.safeParse(id);
    if (!validId.success) return reject(id ? validId.error.issues[0].message : `The "${ID_HEADER}" cell is empty.`);
    const duplicate = seenIds.get(id);
    if (duplicate !== undefined) return reject(`${id} also appears on row ${duplicate}. Each asset may appear once.`);
    seenIds.set(id, row);

    const existing = tx.select().from(hardware).where(eq(hardware.id, id)).get();
    if (existing?.deletedAt) return reject(`${id} is archived. Restore it before importing changes to it.`);
    if (existing?.lifecycleState === 'Disposed') return reject(`${id} is Disposed, and a disposed asset is read-only.`);

    const candidate: Candidate = { row, id, existing, values: new Map() };
    for (const column of columns) {
      const text = cellAt(column.index);
      if (column.field === 'department' || column.field === 'location') {
        candidate[column.field] = text;
        continue;
      }
      const converted = convertValue(column.field, text);
      if ('error' in converted) return reject(`${column.header}: ${converted.error}`);
      if ('skip' in converted) continue;
      candidate.values.set(column.field, converted.value);
    }
    // A new asset needs a name, and the file has to carry a column that can give it one.
    if (!existing && !candidate.values.has('assetName')) {
      return reject(`${id} is not in the register yet, so the file needs an "Asset Name" column to add it.`);
    }
    candidates.push(candidate);
  });

  const dir = resolveDirectory(tx, candidates, opts.createMissingDirectory);

  // Pass two applies the rows that survived, each with its own audit entry.
  const names = loadDirectory(tx);
  const snapshot = (r: Row) => hardwareSnapshot(r, names);
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const candidate of candidates) {
    const { row, id, existing } = candidate;
    const reject = (error: string) => rows.push({ row, id, status: 'rejected', error });
    const cols: Partial<Row> = {};
    for (const [field, value] of candidate.values) Object.assign(cols, { [field]: value });

    let refError: string | null = null;
    for (const kind of ['department', 'location'] as const) {
      const text = candidate[kind];
      if (text === undefined) continue;
      const resolved = dir.resolve(kind, text);
      if ('error' in resolved) {
        refError = `${headerOf(kind)}: ${resolved.error}`;
        break;
      }
      const field = kind === 'department' ? 'departmentId' : 'locationId';
      const problem = checkReference(tx, kind, resolved.id, existing ? existing[field] : null);
      if (problem) {
        refError = `${headerOf(kind)}: ${problem}`;
        break;
      }
      Object.assign(cols, { [field]: resolved.id });
    }
    if (refError) {
      reject(refError);
      continue;
    }

    if (!existing) {
      const assetName = String(cols.assetName);
      const values = {
        ...cols,
        id,
        assetName,
        lifecycleState: 'In Stock' as const,
        lifecycleChangedAt: new Date().toISOString(),
        category: cols.category ?? detectCategory(assetName, cols.model ?? ''),
      };
      tx.insert(hardware).values(values).run();
      const inserted = tx.select().from(hardware).where(eq(hardware.id, id)).get()!;
      recordAudit(tx, req, {
        action: 'Import Hardware',
        details: `Added hardware asset ${inserted.assetName} (${id}) from a CSV import (row ${row}). It starts In Stock.`,
        entityType: 'hardware',
        entityId: id,
        after: snapshot(inserted),
      });
      created++;
      rows.push({ row, id, status: 'create', changed: [...candidate.values.keys()].map(headerOf) });
      continue;
    }

    const changedFields = (Object.keys(cols) as (keyof Row)[]).filter(k => existing[k] !== cols[k]);
    if (!changedFields.length) {
      unchanged++;
      rows.push({ row, id, status: 'unchanged', changed: [] });
      continue;
    }
    tx.update(hardware).set({ ...cols, updatedAt: new Date().toISOString() }).where(eq(hardware.id, id)).run();
    const after = tx.select().from(hardware).where(eq(hardware.id, id)).get()!;
    const changed = changedFields.map(f => headerOf(fieldOfColumn(f)));
    recordAudit(tx, req, {
      action: 'Import Hardware',
      details: `Updated hardware asset ${after.assetName} (${id}) from a CSV import (row ${row}). Changed: ${changed.join(', ')}.`,
      entityType: 'hardware',
      entityId: id,
      before: snapshot(existing),
      after: snapshot(after),
    });
    updated++;
    rows.push({ row, id, status: 'update', changed });
  }

  rows.sort((a, b) => a.row - b.row);
  const rejected = rows.filter(r => r.status === 'rejected').length;
  const result: ImportResult = {
    dryRun: opts.dryRun,
    rowsRead: dataRows.length,
    created,
    updated,
    unchanged,
    rejected,
    unknownColumns: parsed.unknownColumns,
    ignoredColumns: parsed.ignoredColumns,
    missingDepartments: dir.missingDepartments,
    missingLocations: dir.missingLocations,
    needsDirectoryConsent: !opts.createMissingDirectory && (dir.missingDepartments.length > 0 || dir.missingLocations.length > 0),
    createdDepartments: dir.createdDepartments,
    createdLocations: dir.createdLocations,
    rows,
  };
  recordAudit(tx, req, {
    action: 'CSV Import',
    details:
      `Imported the hardware register from CSV: ${result.rowsRead} rows read, ${created} added, ${updated} updated, ` +
      `${unchanged} unchanged, ${rejected} rejected.` +
      (dir.createdDepartments.length ? ` Departments created: ${dir.createdDepartments.join(', ')}.` : '') +
      (dir.createdLocations.length ? ` Locations created: ${dir.createdLocations.join(', ')}.` : ''),
    entityType: 'hardware',
    after: { created, updated, unchanged, rejected, rowsRead: result.rowsRead },
  });
  return result;
}

/** Column name back to the field it came from, so a changed-field list reads in the file's own headers. */
function fieldOfColumn(column: keyof Row): ImportField {
  if (column === 'departmentId') return 'department';
  if (column === 'locationId') return 'location';
  return column as ImportField;
}
