# URC IT Inventory System

Internal IT asset register for Uganda Railways Corporation. It covers hardware, software licences and server components, with role-based access and a tamper-proof change history. It runs on a URC Windows Server and is used from computers on the internal network.

## Quick start (development)

Requires Node.js 22 LTS or newer.

```
npm install
copy .env.example .env        (on Linux/macOS: cp .env.example .env)
npm run create-user           (creates the first Admin; the password must be changed at first sign-in)
npm run import-json -- path\to\inventory.json   (optional: loads legacy data)
npm run dev                   (then open http://localhost:3000)
```

Set `NODE_ENV=development` in `.env` for local work.

## Production

```
npm run build
npm start
```

The database lives in `DATA_DIR` (see `.env.example`). Keep it outside the application folder. A Windows Service setup guide is coming in a later phase; see `PROJECT.md`.

## Backups

The server backs up the database every night at `BACKUP_HOUR` (default 02:00). If the newest backup is more than a day old when the server starts, it also takes one straight away. Each backup is checked with `PRAGMA integrity_check` before it is kept.

- Folder: `BACKUP_DIR`, which defaults to `<DATA_DIR>\backups`. Set `BACKUP_COPY_DIR` to keep a second copy on another disk or a network share.
- Retention: the newest backup of each of the last 7 days, 4 weeks and 12 months. Older ones are deleted from both folders.
- Admins can see the list and click **Backup now** under *Administration → Backups*.

To restore, stop the service first, then run:

```
npm run restore -- --list
npm run restore -- inventory-20260929-020000.db
```

The script checks the backup and saves the current database as `pre-restore-<date>.db` in the backup folder. Then it replaces the database. Start the service again afterwards. Changes made after the backup was taken are lost. `pre-restore-*` files are never deleted automatically.

## Roles

| Role | Can do |
|---|---|
| Admin | Everything, including user accounts and backups |
| IT Officer | Add, edit and archive inventory; resolve alerts |
| Manager | View everything and reports |
| Auditor | Read-only, including the full change history |

See `PROJECT.md` for the plan and decisions, and `CLAUDE.md` for development rules.
