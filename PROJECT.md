# PROJECT.md — Persistent Plan & Memory

> This file is our external memory. Update it **before** writing code. Keep entries short.

## 1. Objective
Turn the internship prototype into a production-grade, **self-hosted** IT inventory system for Uganda Railways Corporation:
- Hosted on a URC **Windows Server** and reached by computers on the internal network.
- **Internal database** with no cloud dependency, plus **scheduled automatic backups** and a tested restore.
- Harden security, fix pitfalls, and add the features that established asset-management products provide.

## 2. Current state (after Phase 1+2, 2026-09-29)
| Area | Now |
|---|---|
| Frontend | React 19 + Vite + Tailwind. `App.tsx` decides which screen to show from the session. `MainApp.tsx` is about 700 lines and `InventoryTables.tsx` about 2,000; both still need splitting (Phase 4). |
| Backend | `server/`: Express 5, routes in separate files, each request body validated with zod, helmet security headers. |
| Data | SQLite via better-sqlite3 + Drizzle, in `storage/inventory.db` (or `DATA_DIR`). Migrations in `drizzle/` run at startup. Deletes are soft deletes. |
| Auth | Server-side sessions (httpOnly, SameSite=Strict cookie), argon2id password hashes, lockout after 5 failures, forced password change, 4 roles. |
| Audit | `audit_log` table records before and after values. SQLite triggers block UPDATE and DELETE. |
| AI / cloud | Removed (Firebase, Gemini). |
| Tests | `tests/api.test.ts` (16: auth, roles, validation, audit, import) and `tests/backup.test.ts` (10: retention, backup, second copy, API, restore drill). |
| Backups | `server/services/backup.ts`: nightly at 02:00 plus catch-up at startup, integrity-checked, 7/4/12 retention, optional second copy, Admin page, `npm run restore`. |

## 3. Findings: pitfalls and vulnerabilities
Severity: 🔴 critical · 🟠 high · 🟡 medium

| # | Sev | Finding | Where | Status |
|---|---|---|---|---|
| F1 | 🔴 | Admin password is hard-coded in the frontend bundle and in git history, so anyone who opens the page can read it. | `src/App.tsx:29` | ✅ fixed (password removed; **rotate it anywhere it is reused**) |
| F2 | 🔴 | The server trusts `x-user-role` / `x-user-email` headers from the client. Anyone on the LAN can send `x-user-role: Admin` and modify or delete data. | `server.ts` (every write route) | ✅ fixed |
| F3 | 🔴 | Firestore rules are `allow read, write: if true`. The cloud DB is world-readable and world-writable to anyone with the (committed) config. | `firestore.rules`, `firebase-applet-config.json` | ⚠️ code removed; **the Firebase project still exists and is open**, so lock it down or delete it |
| F4 | 🔴 | Self-registration creates **ADMIN** accounts, with a default password when none is supplied. | `src/App.tsx:111-122` | ✅ fixed |
| F5 | 🟠 | Passwords are stored in plaintext (`localStorage`). There is no hashing and no server-side user store. | `src/App.tsx` | ✅ fixed |
| F6 | 🟠 | Real staff names and serial numbers are committed to the repo. | `data/*.json` | ✅ untracked (still in git history) |
| F7 | 🟠 | The JSON-file DB has no transactions or locking. Concurrent writes or a crash mid-write can corrupt or lose data. | `server.ts:110` | ✅ fixed |
| F8 | 🟠 | Inventory data is sent to external services (Firebase, Gemini), which conflicts with the "internal only" goal. | `server.ts`, `src/firebase.ts` | ✅ fixed |
| F9 | 🟡 | No input validation, rate limiting, security headers (helmet), CSRF protection or HTTPS. | `server.ts` | ✅ validation, rate limit, helmet, SameSite cookie; HTTPS is ready but needs a certificate |
| F10 | 🟡 | The port is hard-coded (3000). `clean` uses `rm -rf`, which fails on Windows. The package is still named `react-example`. | `server.ts:18`, `package.json` | ✅ fixed |
| F11 | 🟡 | There is no backup or restore mechanism. | — | ✅ fixed (nightly verified backups, retention, restore script) |
| F12 | 🟡 | There are no tests, and components are too large to maintain. | `src/components/*` | ◐ tests added; component split is Phase 4 |

| F13 | 🟠 | `npm audit`: 7 known vulnerabilities (2 high: `nanoid`, `browserslist`; 5 moderate incl. `express`/`qs`). All fixable via `npm audit fix`. | `package-lock.json` | ✅ fixed (4 moderate issues remain, all inside the dev-only drizzle-kit tool) |

| F14 | 🔴 | `GET /api/users` returns every user **including plaintext passwords** to anyone, and `POST /api/users` lets anyone create or overwrite accounts. | `server.ts:570-592` | ✅ fixed |
| F15 | 🟡 | Alerts are marked `emailSent: true`, but no email is ever sent. The alert check uses a hard-coded date (`2026-07-14`). | `server.ts` `runAlertChecks` | ✅ emailSent is honest; real date used |
| F16 | 🟡 | The audit log is capped at 500 entries and can be spoofed, so it is not tamper-proof. | `server.ts` `logAudit` | ✅ fixed |

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
1. **Security foundation**: ✅ server-side auth and role-based access, remove hard-coded secrets, rotate the password, purge PII from the repo, validation and helmet.
2. **Internal database**: ✅ schema, ORM, migration script from `inventory.json`, remove Firebase.
3. **Backups**: ✅ scheduled backup, retention, restore script, restore drill.
4. **Refactor**: ← *next* split `server.ts` into routes, services and db. Split large components. Add tests.
5. **v1 features**: from the comparison doc.
6. **Windows deployment**: Windows service, HTTPS, firewall rule, installation runbook (`docs/DEPLOYMENT.md`).

## 7. Tasks
### Active
- [ ] T8 Phase 4: split `MainApp.tsx` (~720 lines) and `InventoryTables.tsx` (~2,000 lines) into components under ~400 lines each.
- [ ] T6 User actions, outside the code: lock down or delete the Firebase project (F3). Rotate the old admin password wherever it is reused (F1).
- [ ] T7 Decide whether to purge `data/*.json` and the old password from git history. That needs a force-push, so only with the user's approval.
- [ ] T2 Security scan: review git history for other secrets.

### Completed
- [x] T0 Initial scan. Created `CLAUDE.md`, `PROJECT.md` and the draft `docs/FEATURE_COMPARISON.md`.
- [x] T1 v1 feature scope frozen: see the Priority column in `docs/FEATURE_COMPARISON.md`.
- [x] T3 Decisions D2–D7 and the roles table recorded (2026-09-29).
- [x] T4 Phase 1+2 (2026-09-29): SQLite, Drizzle migrations, auth, roles, user admin UI, append-only audit log, validation, helmet, Express 5, Firebase and Gemini removed, legacy import (82 hardware / 4 software / 4 components verified), 16 tests, production build verified in a browser. The server bundle moved to `dist-server/` so it is no longer served publicly from `dist/`.
- [x] T5 Phase 3, backups (2026-09-29): in-app nightly scheduler using the better-sqlite3 `.backup()` API, `PRAGMA integrity_check`, retention 7/4/12, optional second copy path, Admin "Backup now" button with a list of backups, `scripts/restore.ts`, restore drill test.
  - Design: `server/services/backup.ts` (`BackupService`). Files are named `inventory-YYYYMMDD-HHMMSS.db` (local time, safe on Windows), written as `.tmp`, checked, then renamed. Retention keeps the newest backup of each of the last 7 days, 4 ISO weeks and 12 months, applied to both folders. The scheduler runs at `BACKUP_HOUR` (default 2), and at startup it catches up if the newest backup is more than 24 h old. `GET/POST /api/backups` need `backups:manage` (Admin). No download endpoint, because backups contain password hashes.
  - Restore: `npm run restore -- <file>` with the service stopped. The server writes `server.pid` next to the database and restore refuses while that process is alive. Before overwriting, it checks the backup and saves the current DB as `pre-restore-*.db` in the backup folder.
  - Verified: 26/26 tests; a production build took a catch-up backup at startup and a manual one through the UI; restore refused while the server was running, then worked once it was stopped, and the server started again on the restored DB.
