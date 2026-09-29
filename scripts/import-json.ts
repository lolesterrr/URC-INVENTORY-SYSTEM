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
import { hardware, LIFECYCLE_STATES, serverComponents, software } from '../server/db/schema';
import { detectCategory } from '../server/routes/hardware';
import { recordAudit } from '../server/services/audit';
import { runAlertChecks } from '../server/services/alerts';
import { legacyStatusToLifecycle } from '../server/services/lifecycle';
import { componentCreate, hardwareCreate, HARDWARE_CATEGORIES, softwareCreate } from '../server/validation';

// Imported records may already be Disposed, which the create form does not allow.
const hardwareImport = hardwareCreate.extend({ lifecycleState: z.enum(LIFECYCLE_STATES) });

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
      const assetName = r.assetName || r.name || 'Unnamed asset';
      tx.insert(hardware).values({
        ...r,
        name: undefined, user: undefined, assignee: undefined,
        assetName,
        assignedTo: r.user || r.assignee || 'Unassigned',
        category: r.category ?? detectCategory(assetName, r.model ?? ''),
      } as typeof hardware.$inferInsert).run();
    });
    const sw = importRows('software', arr(data.software), softwareCreate, id => Boolean(tx.select({ id: software.id }).from(software).where(eqId(software.id, id)).get()), r => {
      tx.insert(software).values(r).run();
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
