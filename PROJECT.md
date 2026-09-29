# PROJECT.md — Persistent Plan & Memory

> This file is our external memory. Update it **before** writing code. Keep entries short.

## 1. Objective
Turn the internship prototype into a production-grade, **self-hosted** IT inventory system for Uganda Railways Corporation:
- Hosted on a URC **Windows Server** and reached by computers on the internal network.
- **Internal database** with no cloud dependency, plus **scheduled automatic backups** and a tested restore.
- Harden security, fix pitfalls, and add the features that established asset-management products provide.

## 2. Current state (scan of 2026-09-29)
| Area | Today |
|---|---|
| Frontend | React 19 + Vite + Tailwind. Monolithic files (`InventoryTables.tsx` is about 2,100 lines, `App.tsx` about 1,000). |
| Backend | Single `server.ts` (about 900 lines), Express, CRUD for hardware, software, server components, alerts, audit logs and AI copilot. |
| Data | `data/inventory.json` rewritten with `writeFileSync`, **and** Google Firestore (cloud). |
| Auth | Client-side only: users kept in `localStorage`, admin password hard-coded in `src/App.tsx`. |
| AI | Google Gemini (`/api/copilot/*`), which needs internet and sends inventory data outside URC. |
| Tests / CI | None. |

## 3. Findings: pitfalls and vulnerabilities (preliminary)
Severity: 🔴 critical · 🟠 high · 🟡 medium

| # | Sev | Finding | Where |
|---|---|---|---|
| F1 | 🔴 | Admin password is hard-coded in the frontend bundle and in git history, so anyone who opens the page can read it. | `src/App.tsx:29` |
| F2 | 🔴 | The server trusts `x-user-role` / `x-user-email` headers from the client. Anyone on the LAN can send `x-user-role: Admin` and modify or delete data. | `server.ts` (every write route) |
| F3 | 🔴 | Firestore rules are `allow read, write: if true`. The cloud DB is world-readable and world-writable to anyone with the (committed) config. | `firestore.rules`, `firebase-applet-config.json` |
| F4 | 🔴 | Self-registration creates **ADMIN** accounts, with a default password when none is supplied. | `src/App.tsx:111-122` |
| F5 | 🟠 | Passwords are stored in plaintext (`localStorage`). There is no hashing and no server-side user store. | `src/App.tsx` |
| F6 | 🟠 | Real staff names and serial numbers are committed to the repo. | `data/*.json` |
| F7 | 🟠 | The JSON-file DB has no transactions or locking. Concurrent writes or a crash mid-write can corrupt or lose data. | `server.ts:110` |
| F8 | 🟠 | Inventory data is sent to external services (Firebase, Gemini), which conflicts with the "internal only" goal. | `server.ts`, `src/firebase.ts` |
| F9 | 🟡 | No input validation, rate limiting, security headers (helmet), CSRF protection or HTTPS. | `server.ts` |
| F10 | 🟡 | The port is hard-coded (3000). `clean` uses `rm -rf`, which fails on Windows. The package is still named `react-example`. | `server.ts:18`, `package.json` |
| F11 | 🟡 | There is no backup or restore mechanism. | — |
| F12 | 🟡 | There are no tests, and components are too large to maintain. | `src/components/*` |

A full dependency audit (`npm audit`) and a line-by-line review are pending. See task T2.

## 4. Architecture decisions
| ID | Decision | Status |
|---|---|---|
| D1 | Keep React + Express/TypeScript and reuse the UI. | ✅ Proposed |
| D2 | Database engine: **SQLite** (WAL mode, single file, easy backup) behind an ORM (Drizzle or Prisma), so we can move to PostgreSQL or SQL Server later. | ❓ Needs user input (Q1) |
| D3 | Auth: server-side sessions, argon2 or bcrypt hashes, role-based access control enforced in middleware. Active Directory/LDAP login optional later. | ❓ Q2 |
| D4 | Hosting: Node app runs as a **Windows Service** (NSSM or node-windows), optionally behind IIS or Caddy for HTTPS on the LAN. | ❓ Q3 |
| D5 | Backups: nightly job (Windows Task Scheduler or in-app scheduler) using the SQLite online backup API. Timestamped files, retention policy (e.g. 7 daily, 4 weekly, 12 monthly), copy to a network share, restore script. | ✅ Proposed |
| D6 | Remove Firebase entirely. Gemini copilot: remove it or make it optional and off by default. | ❓ Q4 |

## 5. Open questions for the user
- **Q1** Does URC IT already run **SQL Server** or **PostgreSQL** on that server? If not, SQLite is the simplest and most reliable choice at this scale.
- **Q2** Does URC use **Active Directory** (domain logins)? If so, staff could sign in with their Windows accounts.
- **Q3** Does the server run **IIS**? Does URC have an internal certificate authority for HTTPS?
- **Q4** Should the AI copilot stay? It needs internet and sends data to Google.
- **Q5** Roughly how many users, and how many assets expected in 3–5 years?
- **Q6** Where should backups go (second drive, NAS or network share), and who restores them?
- **Q7** Which roles are needed? For example Admin, IT Officer, Auditor (read-only) and Department Head.
- **Q8** Which features from `docs/FEATURE_COMPARISON.md` are must-have for version 1?

## 6. Roadmap (phases)
0. **Discovery**: feature comparison, answer Q1–Q8, freeze v1 scope. ← *we are here*
1. **Security foundation**: server-side auth and role-based access, remove hard-coded secrets, rotate the password, purge PII from the repo, validation and helmet.
2. **Internal database**: schema, ORM, migration script from `inventory.json`, remove Firebase.
3. **Backups**: scheduled backup, retention, restore script, restore drill.
4. **Refactor**: split `server.ts` into routes, services and db. Split large components. Add tests.
5. **v1 features**: from the comparison doc.
6. **Windows deployment**: Windows service, HTTPS, firewall rule, installation runbook (`docs/DEPLOYMENT.md`).

## 7. Tasks
### Active
- [ ] T1 Review `docs/FEATURE_COMPARISON.md` together and mark must-have, should-have and later.
- [ ] T2 Full security scan: `npm audit`, review each route, check git history for secrets.
- [ ] T3 Answer the open questions Q1–Q8.

### Completed
- [x] T0 Initial scan of the codebase. Created `CLAUDE.md`, `PROJECT.md` and the draft `docs/FEATURE_COMPARISON.md`.
