# Feature Comparison — URC Inventory vs. Established Products

**Status: v1 scope frozen 2026-09-29.** Priority: **Must** = v1 · Should = v1.1 · Later = backlog. Competitor features are summarised from each product's public documentation. Verify a feature before committing to it.

## Products compared
| Product | Type | Why it's relevant |
|---|---|---|
| **Snipe-IT** | Open source (PHP/Laravel), self-hosted | The most popular self-hosted IT asset manager. The closest match to our scope. |
| **GLPI** | Open source (PHP), self-hosted | Full IT service management (ITSM): assets plus helpdesk. Widely used by African public institutions. |
| **OCS Inventory NG** | Open source, agent-based | Automatic hardware and software discovery. Often paired with GLPI. |
| **Lansweeper** | Commercial, Windows-native | Agentless network discovery, strong on Windows and Active Directory. |
| **ManageEngine AssetExplorer** | Commercial, Windows-native | Full asset lifecycle and procurement, runs on Windows Server. |

Legend: ✅ has it · ◐ partial or basic · ❌ missing · — not applicable

## A. Core asset management
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority (to decide) |
|---|---|---|---|---|---|---|
| Hardware register (serial, model, location, department) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Software licences and seat tracking | ✅ | ✅ | ✅ | ✅ | ◐ (licences, no seat allocation) | Should |
| Servers and components | ◐ | ✅ | ✅ | ✅ | ✅ | — |
| Accessories and consumables (toner, mice, cables) with stock levels | ✅ | ✅ | ❌ | ✅ | ❌ | Later |
| **Check-out / check-in** to staff with history | ✅ | ✅ | ◐ | ✅ | ❌ (free-text "user" field) | **Must** |
| Full asset history timeline (who had it, repairs, moves) | ✅ | ✅ | ✅ | ✅ | ◐ (global audit log only) | **Must** |
| Lifecycle states (in stock → deployed → in repair → retired → disposed) | ✅ | ✅ | ✅ | ✅ | ◐ (status only) | **Must** |
| Custom fields per category | ✅ | ✅ | ✅ | ✅ | ❌ | Later |
| Hierarchical locations (Region → Station → Office) | ✅ | ✅ | ✅ | ✅ | ◐ (flat text) | **Must** |
| Departments and staff as real records, not text | ✅ | ✅ | ✅ (via AD) | ✅ | ❌ | **Must** |
| File attachments (invoices, delivery notes, photos) | ✅ | ✅ | ✅ | ✅ | ❌ | Should |
| Bulk edit, bulk check-out | ✅ | ✅ | ◐ | ✅ | ❌ | Should |

## B. Procurement and finance
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Suppliers and manufacturers directory | ✅ | ✅ | ◐ | ✅ | ❌ | Should |
| Purchase date, cost, order number, LPO reference | ✅ | ✅ | ◐ | ✅ | ◐ (year of purchase only) | **Must** |
| **Warranty expiry tracking and alerts** | ✅ | ✅ | ✅ | ✅ | ❌ | **Must** |
| Depreciation (straight-line) and book value | ✅ | ✅ | ❌ | ✅ | ❌ | Later |
| Contracts (maintenance and support agreements) | ◐ | ✅ | ◐ | ✅ | ❌ | Later |
| Disposal and write-off records (board-of-survey) | ◐ | ✅ | ❌ | ✅ | ❌ | Should (Manager approves) |

## C. Audit, labels and scanning
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Print asset labels with QR code or barcode | ✅ | ✅ | ❌ | ✅ | ◐ (scanner and print present, needs checking) | **Must** |
| Scan to look up an asset | ✅ | ✅ | ❌ | ✅ | ✅ (BarcodeScanner) | — |
| **Physical audit mode** (scan items per location, report missing ones) | ✅ | ◐ | ❌ | ✅ | ❌ | Should |
| Scheduled audit reminders ("not audited in 12 months") | ✅ | ◐ | ❌ | ◐ | ❌ | Later |
| Tamper-proof activity log (who changed what, before and after values) | ✅ | ✅ | ✅ | ✅ | ◐ (log exists, identity is spoofable) | **Must** |

## D. Discovery and automation
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Automatic discovery of PCs on the network | ❌ | ✅ (agent) | ✅ (agentless) | ✅ | ❌ | Later |
| Installed-software inventory per PC | ❌ | ✅ | ✅ | ✅ | ❌ | Later |
| Lightweight PowerShell inventory script that posts to our API | — | — | — | — | ❌ | Later |

## E. Users, security and administration
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Server-side login with hashed passwords | ✅ | ✅ | ✅ | ✅ | ❌ (**critical**) | Must |
| Role-based permissions enforced on the server | ✅ | ✅ | ✅ | ✅ | ❌ (**critical**) | Must |
| Active Directory / LDAP login and user sync | ✅ | ✅ | ✅ | ✅ | ❌ | Later (only 4–5 users) |
| Password policy, account lockout, session timeout | ✅ | ✅ | ✅ | ✅ | ❌ | Must |
| Staff acceptance of assigned equipment (digital sign-off) | ✅ | ◐ | ❌ | ◐ | ❌ | Later |
| **Built-in backup and restore** | ✅ | ◐ (plugin) | ✅ | ✅ | ❌ | Must |
| REST API with tokens | ✅ | ✅ | ✅ | ✅ | ◐ (unauthenticated) | **Must** (authenticated, internal) |
| Settings UI (company info, logo, label layout) | ✅ | ✅ | ✅ | ✅ | ❌ | Should |

## F. Reporting and notifications
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| CSV / Excel import with column mapping and validation | ✅ | ✅ | ✅ | ✅ | ◐ (one-off audit import) | **Must** |
| CSV / Excel / PDF export and custom reports | ✅ | ✅ | ✅ | ✅ | ◐ (CSV and print) | **Must** |
| Standard reports: by department, by age, due for replacement, licence compliance | ✅ | ✅ | ✅ | ✅ | ◐ | **Must** (department, age, replacement planning) |
| Email notifications through the internal SMTP / Exchange server (warranty, licence expiry, overdue check-ins) | ✅ | ✅ | ✅ | ✅ | ◐ (UI only, verify) | Should (in-app alerts are a Must) |

## G. URC-specific ideas (not typical in competitors)
- Engraved number format `URC/ITO/...` validated and auto-generated.
- Station and region hierarchy matching the railway network.
- Replacement-planning report, for example "machines older than 5 years or still on Windows 10", to support budget requests.
- Offline-tolerant scanning for stations with poor connectivity (later).

## Agreed v1 scope
**Must (v1):** server-side auth with 4 roles · SQLite · automated backup and restore · tamper-proof change log · check-out/check-in with per-asset history · lifecycle states · departments, staff and locations as real records · purchase and warranty fields with in-app expiry alerts · CSV import and export · QR labels · standard reports, including replacement planning.

**Should (v1.1):** physical audit mode · licence seats · attachments · suppliers · disposal approval workflow · bulk edit · email alerts · settings UI.

**Later:** Active Directory login · depreciation · consumables · custom fields · PowerShell inventory agent · contracts · helpdesk.

**Removed:** AI assistant (see PROJECT.md D7).
