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

The database lives in `DATA_DIR` (see `.env.example`). Keep it outside the application folder. A Windows Service setup guide and the backup schedule are coming in later phases; see `PROJECT.md`.

## Roles

| Role | Can do |
|---|---|
| Admin | Everything, including user accounts |
| IT Officer | Add, edit and archive inventory; resolve alerts |
| Manager | View everything and reports |
| Auditor | Read-only, including the full change history |

See `PROJECT.md` for the plan and decisions, and `CLAUDE.md` for development rules.
