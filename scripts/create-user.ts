/**
 * Creates a user account from the command line (used to create the first Admin).
 *   npm run create-user
 * The password is typed hidden, and the user must change it at first sign-in.
 */
import readline from 'readline';
import { loadConfig } from '../server/config';
import { openDatabase } from '../server/db';
import { ROLES, type Role } from '../server/db/schema';
import { recordAudit } from '../server/services/audit';
import { createUser, UserError } from '../server/services/users';

function ask(question: string, hidden = false): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Suppress echo of typed characters.
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, answer => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const config = loadConfig();
  const db = openDatabase(config.dbFile);
  console.log(`Database: ${config.dbFile}\n`);

  const username = await ask('Username (e.g. j.okello): ');
  const fullName = await ask('Full name: ');
  const roleAnswer = await ask(`Role [${ROLES.join(' / ')}] (default Admin): `);
  const role = (roleAnswer || 'Admin') as Role;
  if (!ROLES.includes(role)) throw new UserError(`Unknown role "${roleAnswer}".`);
  const password = await ask('Temporary password: ', true);
  const confirm = await ask('Repeat password: ', true);
  if (password !== confirm) throw new UserError('Passwords do not match.');

  const user = await createUser(db, { username, fullName, role, password, mustChangePassword: true });
  recordAudit(db, null, {
    action: 'Create User',
    details: `Created ${user.role} account "${user.username}" from the command line.`,
    entityType: 'user',
    entityId: user.id,
  });
  console.log(`\nCreated ${user.role} "${user.username}". They must change the password at first sign-in.`);
  db.$client.close();
}

main().catch(err => {
  console.error(err instanceof UserError ? `Error: ${err.message}` : err);
  process.exit(1);
});
