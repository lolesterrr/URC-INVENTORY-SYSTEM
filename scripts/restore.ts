/**
 * Restores the database from a backup file. Stop the URC Inventory service first.
 *   npm run restore -- <backup file>            (asks for confirmation)
 *   npm run restore -- <backup file> --yes      (no prompt)
 *   npm run restore -- --list                   (shows the available backups)
 * The current database is saved as pre-restore-<date>.db in the backup folder before it is replaced.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { loadConfig } from '../server/config';
import { isServerRunning, pidFileFor, restoreBackup } from '../server/services/backup';

function confirm(question: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();
  const { dir } = config.backup;

  const arg = args.find(a => !a.startsWith('--'));
  if (args.includes('--list') || !arg) {
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n.endsWith('.db')).sort().reverse() : [];
    console.log(`Backups in ${dir}:`);
    for (const n of names) console.log(`  ${n}`);
    if (names.length === 0) console.log('  (none)');
    if (!arg) console.log('\nUsage: npm run restore -- <backup file> [--yes]');
    return;
  }

  // A bare file name refers to the backup folder.
  const backupFile = fs.existsSync(arg) ? arg : path.join(dir, arg);

  if (isServerRunning(config.dbFile) && !args.includes('--force')) {
    throw new Error(
      `The server appears to be running (${pidFileFor(config.dbFile)}). Stop the service first.\n` +
        'If you are sure it is stopped, run again with --force.',
    );
  }

  console.log(`Database to replace: ${config.dbFile}`);
  console.log(`Restore from:        ${path.resolve(backupFile)}`);
  if (!args.includes('--yes') && !(await confirm('Changes made after this backup will be lost. Type "yes" to continue: '))) {
    console.log('Cancelled.');
    return;
  }

  const { safetyCopy, counts } = await restoreBackup({ backupFile, dbFile: config.dbFile, safetyDir: dir });
  if (safetyCopy) console.log(`Previous database saved as ${safetyCopy}`);
  console.log(
    `Restored: ${counts.users} users, ${counts.hardware} hardware, ${counts.software} software, ${counts.serverComponents} server components.`,
  );
  console.log('Start the service again.');
}

main().catch(err => {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
