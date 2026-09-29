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

| F13 | 🟠 | `npm audit`: 7 known vulnerabilities (2 high: `nanoid`, `browserslist`; 5 moderate incl. `express`/`qs`). All fixable via `npm audit fix`. | `package-lock.json` |

Line-by-line route review and the git-history secret check are still pending (T2).

## 4. Architecture decisions
| ID | Decision | Status |
|---|---|---|
| D1 | Keep React + Express/TypeScript and reuse the UI. | ✅ Agreed |
| D2 | **SQLite** via `better-sqlite3` (WAL mode) with **Drizzle ORM** and migrations. DB file lives outside the repo (e.g. `C:\URC-Inventory\data\inventory.db`, path from `.env`). 300 assets growing to tens of thousands is far below SQLite's limits. | ✅ Agreed |
| D3 | **Local accounts only**: about 4–5 users, so no Active Directory. The Admin creates accounts and there is **no self-registration**. Passwords are hashed with argon2id. Server-side sessions use an httpOnly cookie, with a 30-minute idle timeout. The account locks after 5 failed logins. Users must change the initial password on first login. | ✅ Agreed |
| D4 | Roles and permissions are enforced by server middleware. See §4a. | ✅ Agreed |
| D5 | Hosting: Node runs as a **Windows Service** via NSSM, self-contained, with no IIS dependency. HTTPS certificate files are configured through `.env`; the certificate itself comes from URC IT at deployment. The step-by-step runbook will be written for someone new to Windows Server. | ✅ Agreed |
| D6 | Backups: in-app scheduler (nightly, 02:00) using the SQLite online backup API. Files are timestamped and checked with `PRAGMA integrity_check`. Retention is 7 daily, 4 weekly and 12 monthly. There is an optional second copy path (network share or other disk), plus a "Backup now" button, a restore script and a restore drill. | ✅ Agreed |
| D7 | **Remove Firebase and the Gemini AI assistant.** The Gemini free tier has usage limits, needs the server to reach the internet, and Google's free-tier terms allow it to use submitted data to improve its products, so URC asset data would leave the organisation. Can be revisited later as an opt-in feature. | ✅ Agreed |

### 4a. Roles
| Role | Who | Permissions |
|---|---|---|
| **Admin** | The developer during build and handover, **plus one permanent URC IT staff member** (at least 2 admins so nobody gets locked out) | Everything, plus managing users, backups and restore, and settings. Use this account only for admin tasks. |
| **IT Officer** | The 2 IT technicians | Create and edit assets, check out and check in, run physical audits, import and export CSV, print labels. Cannot manage users or delete the audit log. Delete is a soft delete. |
| **Manager** | The system analyst (liaison to the board) | View everything, reports and dashboards, export, **approve disposals and write-offs**. No hands-on editing. Named "Manager" rather than "Department Head", which could be confused with other URC department heads. |
| **Auditor** | Internal audit | Read-only view of everything, including the full change history, plus export. |

## 5. Open questions
- **Q6** Where should backups be copied (a second disk or a network share)? Ask URC IT at deployment. The default is a local `backups` folder.
- **Q9** Who will be the permanent URC Admin after handover?
- **Q10** Does the server have internet access? It is no longer required.
- **Q11** Where are the email/SMTP settings for alerts? This only matters for a later feature.

## 6. Roadmap (phases)
0. **Discovery**: feature comparison, decisions, freeze v1 scope. ✅
1. **Security foundation**: ← *next* server-side auth and role-based access, remove hard-coded secrets, rotate the password, purge PII from the repo, validation and helmet.
2. **Internal database**: schema, ORM, migration script from `inventory.json`, remove Firebase.
3. **Backups**: scheduled backup, retention, restore script, restore drill.
4. **Refactor**: split `server.ts` into routes, services and db. Split large components. Add tests.
5. **v1 features**: from the comparison doc.
6. **Windows deployment**: Windows service, HTTPS, firewall rule, installation runbook (`docs/DEPLOYMENT.md`).

## 7. Tasks
### Active
- [ ] T2 Security scan: review each route and check git history for secrets. `npm audit` is done (F13).
- [ ] T4 Phase 1 and 2 together, because auth needs the DB for users: Drizzle schema, SQLite setup, JSON-to-SQLite migration script, auth with roles, remove Firebase and Gemini, remove the hard-coded password, validation with zod, helmet, `npm audit fix`.

### Completed
- [x] T0 Initial scan. Created `CLAUDE.md`, `PROJECT.md` and the draft `docs/FEATURE_COMPARISON.md`.
- [x] T1 v1 feature scope frozen: see the Priority column in `docs/FEATURE_COMPARISON.md`.
- [x] T3 Decisions D2–D7 and the roles table recorded (2026-09-29).
