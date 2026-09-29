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
React 19 + Vite + Tailwind (`src/`). Express 5 + TypeScript (`server/`). SQLite via `better-sqlite3` + Drizzle (`server/db/schema.ts`, migrations in `drizzle/`). Tests: vitest + supertest (`tests/`).

## Commands
- `npm install`: install dependencies
- `npm run dev`: dev server with Vite middleware (port 3000, DB in `./storage`)
- `npm run lint`: strict `tsc --noEmit`
- `npm test`: API tests (in-memory DB)
- `npm run build`, then `npm start`: production build (`dist/`, `dist-server/`) and run
- `npm run db:generate`: create a migration after editing `server/db/schema.ts`. Never edit an applied migration.
- `npm run create-user`: create an account interactively (first Admin)
- `npm run import-json -- <file>`: import a legacy `inventory.json`

## Conventions
- Every API route declares `requirePermission(...)`. Roles are mapped to permissions in `server/auth/permissions.ts`.
- Every data change calls `recordAudit()` with before/after values. `audit_log` is append-only.
- Inventory deletes are soft deletes (`deleted_at`).
- The frontend calls the API through `src/api.ts` only.

## Coding standards
- TypeScript strict and typed. No `any` in new code.
- Validate every request body on the server with a schema.
- Keep components under ~400 lines. Split large files when you touch them.
- Small, focused commits in conventional style (`feat:`, `fix:`, `refactor:`, `docs:`).
