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

## Stack (current)
React 19 + Vite + Tailwind (frontend), Express + TypeScript (`server.ts`), moving to SQLite (`better-sqlite3` + Drizzle). Firebase and Gemini are being removed.

## Commands
- `npm install`: install dependencies
- `npm run dev`: dev server with Vite middleware (port 3000)
- `npm run lint`: `tsc --noEmit` type check
- `npm run build`, then `npm start`: production build and run

## Coding standards
- TypeScript strict and typed. No `any` in new code.
- Validate every request body on the server with a schema.
- Keep components under ~400 lines. Split large files when you touch them.
- Small, focused commits in conventional style (`feat:`, `fix:`, `refactor:`, `docs:`).
