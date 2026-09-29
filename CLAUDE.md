# CLAUDE.md — URC Inventory System

IT asset inventory for Uganda Railways Corporation (URC). Target: self-hosted on a URC **Windows Server**, reached by LAN clients only.

## Source of truth
- `PROJECT.md` — plan, decisions, active tasks. Read it first; update it before writing code.
- `docs/FEATURE_COMPARISON.md` — feature backlog derived from existing products.

## Hard constraints
- **No external cloud dependencies at runtime** (no Firebase, no hosted AI) unless PROJECT.md records an explicit decision.
- **Must run on Windows Server.** No bash-only scripts; use cross-platform Node scripts. Paths via `path.join`.
- **Authorization is enforced on the server.** Never trust client-sent role/identity headers.
- Never commit secrets, `.env`, real passwords, or DB/backup files.
- Staff names and serial numbers are internal data: keep them out of logs, fixtures and commits.

## Stack
React 19 + Vite + Tailwind (`src/`). Express 5 + TypeScript (`server/`). `shared/`: dependency-free rules used by both (bundled into the browser, so never import server code there). SQLite via `better-sqlite3` + Drizzle (`server/db/schema.ts`, migrations in `drizzle/`). Tests: vitest + supertest (`tests/`).

## Commands
- `npm install`: install dependencies
- `npm run dev`: dev server with Vite middleware (port 3000, DB in `./storage`)
- `npm run lint`: strict `tsc --noEmit`
- `npm test`: API and backup tests (in-memory or temp-folder DBs)
- `npm run build`, then `npm start`: production build (`dist/`, `dist-server/`) and run
- `npm run db:generate`: create a migration after editing `server/db/schema.ts`. Never edit an applied migration.
- `npm run create-user`: create an account interactively (first Admin)
- `npm run import-json -- <file>`: import a legacy `inventory.json`
- `npm run restore -- <backup file>`: restore the DB from a backup (service stopped). Backup logic lives in `server/services/backup.ts`.

## Conventions
- Every API route declares `requirePermission(...)`. Roles are mapped to permissions in `server/auth/permissions.ts`.
- Every data change calls `recordAudit()` with before/after values. `audit_log` is append-only.
- Inventory deletes are soft deletes (`deleted_at`).
- Hardware lifecycle states change only through `POST /api/hardware/:id/lifecycle` (rules in `shared/lifecycle.ts`). `PUT` ignores `lifecycleState`, and disposed assets are read-only.
- A migration that needs data changes: `npx drizzle-kit generate --custom --name <name>`, write the SQL, then regenerate that migration's snapshot from the schema, because `--custom` copies the previous one. `npx drizzle-kit generate` must then report "No schema changes".
- The frontend calls the API through `src/api.ts` only (data loading and saving: `src/hooks/useInventoryData.ts`).
- Inventory tables are column-driven: add or change a column in `src/components/inventory/columns.tsx` and it appears in both the table and the CSV export.
- Never display or save invented placeholder values (fake IPs, serials, "N/A") for empty fields. Leave them empty; the UI shows `—`.

## Coding standards
- TypeScript strict and typed. No `any` in new code.
- Validate every request body on the server with a schema.
- Keep components under ~400 lines. Split large files when you touch them.
- Small, focused commits in conventional style (`feat:`, `fix:`, `refactor:`, `docs:`).
