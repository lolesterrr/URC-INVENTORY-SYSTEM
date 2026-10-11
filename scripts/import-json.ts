/**
 * One-off import of the legacy JSON database (inventory.json) into SQLite.
 *   npm run import-json -- "C:\path\to\inventory.json"
 * Rows whose ID already exists are skipped, so it is safe to run twice.
 * Legacy users and audit logs are NOT imported (passwords were plaintext; log identities were unverified).
 */
import fs from 'fs';
import { eq as eqId } from 'drizzle-orm';
import { z } from 'zod';
import { loadConfig } from '../server/config';
import { openDatabase, type DB } from '../server/db';
import { assetAssignments, hardware, LIFECYCLE_STATES, serverComponents, software } from '../server/db/schema';
import { detectCategory } from '../server/routes/hardware';
import { recordAudit } from '../server/services/audit';
import { runAlertChecks } from '../server/services/alerts';
import { legacyStatusToLifecycle } from '../server/services/lifecycle';
import { findOrCreateDepartment, findOrCreateLocation, findOrCreateStaff } from '../server/services/directory';
import { componentCreate, hardwareCreate, HARDWARE_CATEGORIES, softwareCreate } from '../server/validation';

// Imported records may already be Disposed, which the create form does not allow. The legacy file names its
// department, location and assignee as text; they are matched to (or create) directory records by name.
const legacyText = z.string().trim().max(200).optional();
const hardwareImport = hardwareCreate.extend({ lifecycleState: z.enum(LIFECYCLE_STATES), department: legacyText, location: legacyText, user: legacyText, assignee: legacyText });
const softwareImport = softwareCreate.extend({ department: legacyText });

type Result = { imported: number; skipped: number; invalid: string[] };

/** Legacy data used placeholders like "N/A"; treat them as empty. */
function clean(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, v === 'N/A' ? '' : v]),
  );
}

function importRows<S extends z.ZodType>(
  label: string,
  rows: unknown[],
  schema: S,
  exists: (id: string) => boolean,
  insert: (row: z.infer<S>) => void,
): Result {
  const result: Result = { imported: 0, skipped: 0, invalid: [] };
  rows.forEach((raw, i) => {
    const parsed = schema.safeParse(clean(raw));
    if (!parsed.success) {
      const id = (raw as { id?: unknown })?.id ?? `row ${i + 1}`;
      result.invalid.push(`${label} ${String(id)}: ${parsed.error.issues.map(x => `${x.path.join('.')} ${x.message}`).join(', ')}`);
      return;
    }
    const row = parsed.data as z.infer<S> & { id: string };
    if (exists(row.id)) {
      result.skipped++;
      return;
    }
    insert(row);
    result.imported++;
  });
  return result;
}

export function importLegacy(db: DB, data: Record<string, unknown>) {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  // Legacy category values outside the allowed list become "Other" rather than failing the row.
  const legacyHardware = arr(data.hardware).map(h => {
    const r = (clean(h) ?? {}) as Record<string, unknown>;
    const cat = r.category as string | undefined;
    // A legacy free-text status becomes a lifecycle state plus a condition note (same rules as migration 0002),
    // unless the file already has them.
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const lifecycle = legacyStatusToLifecycle(str(r.status), str(r.user) || str(r.assignee));
    return {
      ...r,
      lifecycleState: r.lifecycleState ?? lifecycle.lifecycleState,
      condition: str(r.condition) || lifecycle.condition,
      category: cat && (HARDWARE_CATEGORIES as readonly string[]).includes(cat) ? cat : undefined,
    };
  });

  return db.transaction(tx => {
    const hw = importRows('hardware', legacyHardware, hardwareImport, id => Boolean(tx.select({ id: hardware.id }).from(hardware).where(eqId(hardware.id, id)).get()), r => {
      const { name, user, assignee, department, location, assigneeId: _ignored, ...fields } = r;
      const assetName = fields.assetName || name || 'Unnamed asset';
      const departmentId = findOrCreateDepartment(tx, department);
      const assigneeId = findOrCreateStaff(tx, user || assignee, departmentId);
      const now = new Date().toISOString();
      tx.insert(hardware).values({
        ...fields,
        assetName,
        departmentId,
        locationId: findOrCreateLocation(tx, location),
        assigneeId,
        lifecycleChangedAt: now,
        category: fields.category ?? detectCategory(assetName, fields.model ?? ''),
      }).run();
      // Same rule as the app: a Deployed asset always has an open check-out (with nobody named, it is a shared
      // device), and an assigned asset In Repair keeps its check-out.
      if (r.lifecycleState === 'Deployed' || (assigneeId !== null && r.lifecycleState === 'In Repair')) {
        const name = assigneeId === null ? '' : (user || assignee || '').trim();
        tx.insert(assetAssignments).values({ hardwareId: r.id, staffId: assigneeId, assignee: name, checkedOutAt: now, checkedOutBy: 'system', notes: 'Imported from the legacy file.' }).run();
      }
    });
    const sw = importRows('software', arr(data.software), softwareImport, id => Boolean(tx.select({ id: software.id }).from(software).where(eqId(software.id, id)).get()), r => {
      const { department, ...fields } = r;
      tx.insert(software).values({ ...fields, departmentId: findOrCreateDepartment(tx, department) }).run();
    });
    const sc = importRows('server component', arr(data.serverComponents), componentCreate, id => Boolean(tx.select({ id: serverComponents.id }).from(serverComponents).where(eqId(serverComponents.id, id)).get()), r => {
      tx.insert(serverComponents).values(r).run();
    });
    return { hw, sw, sc };
  });
}


function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npm run import-json -- <path to inventory.json>');
    process.exit(1);
  }
  const config = loadConfig();
  const db = openDatabase(config.dbFile);
  const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  const { hw, sw, sc } = importLegacy(db, data);

  const summary = `hardware ${hw.imported} imported / ${hw.skipped} skipped / ${hw.invalid.length} invalid; ` +
    `software ${sw.imported}/${sw.skipped}/${sw.invalid.length}; server components ${sc.imported}/${sc.skipped}/${sc.invalid.length}`;
  recordAudit(db, null, { action: 'Legacy Import', details: `Imported legacy JSON: ${summary}.` });
  runAlertChecks(db);

  console.log(`Database: ${config.dbFile}`);
  console.log(summary);
  for (const line of [...hw.invalid, ...sw.invalid, ...sc.invalid]) console.log(`  invalid: ${line}`);
  db.$client.close();
}

if (process.argv[1] && /import-json\.(ts|js|cjs)$/.test(process.argv[1])) main();
