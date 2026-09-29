# Feature Comparison — URC Inventory vs. Established Products

**Status: DRAFT for discussion.** Competitor features are summarised from each product's public documentation. Verify a feature before committing to it.

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
| Software licences and seat tracking | ✅ | ✅ | ✅ | ✅ | ◐ (licences, no seat allocation) | |
| Servers and components | ◐ | ✅ | ✅ | ✅ | ✅ | — |
| Accessories and consumables (toner, mice, cables) with stock levels | ✅ | ✅ | ❌ | ✅ | ❌ | |
| **Check-out / check-in** to staff with history | ✅ | ✅ | ◐ | ✅ | ❌ (free-text "user" field) | |
| Full asset history timeline (who had it, repairs, moves) | ✅ | ✅ | ✅ | ✅ | ◐ (global audit log only) | |
| Lifecycle states (in stock → deployed → in repair → retired → disposed) | ✅ | ✅ | ✅ | ✅ | ◐ (status only) | |
| Custom fields per category | ✅ | ✅ | ✅ | ✅ | ❌ | |
| Hierarchical locations (Region → Station → Office) | ✅ | ✅ | ✅ | ✅ | ◐ (flat text) | |
| Departments and staff as real records, not text | ✅ | ✅ | ✅ (via AD) | ✅ | ❌ | |
| File attachments (invoices, delivery notes, photos) | ✅ | ✅ | ✅ | ✅ | ❌ | |
| Bulk edit, bulk check-out | ✅ | ✅ | ◐ | ✅ | ❌ | |

## B. Procurement and finance
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Suppliers and manufacturers directory | ✅ | ✅ | ◐ | ✅ | ❌ | |
| Purchase date, cost, order number, LPO reference | ✅ | ✅ | ◐ | ✅ | ◐ (year of purchase only) | |
| **Warranty expiry tracking and alerts** | ✅ | ✅ | ✅ | ✅ | ❌ | |
| Depreciation (straight-line) and book value | ✅ | ✅ | ❌ | ✅ | ❌ | |
| Contracts (maintenance and support agreements) | ◐ | ✅ | ◐ | ✅ | ❌ | |
| Disposal and write-off records (board-of-survey) | ◐ | ✅ | ❌ | ✅ | ❌ | |

## C. Audit, labels and scanning
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Print asset labels with QR code or barcode | ✅ | ✅ | ❌ | ✅ | ◐ (scanner and print present, needs checking) | |
| Scan to look up an asset | ✅ | ✅ | ❌ | ✅ | ✅ (BarcodeScanner) | — |
| **Physical audit mode** (scan items per location, report missing ones) | ✅ | ◐ | ❌ | ✅ | ❌ | |
| Scheduled audit reminders ("not audited in 12 months") | ✅ | ◐ | ❌ | ◐ | ❌ | |
| Tamper-proof activity log (who changed what, before and after values) | ✅ | ✅ | ✅ | ✅ | ◐ (log exists, identity is spoofable) | |

## D. Discovery and automation
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Automatic discovery of PCs on the network | ❌ | ✅ (agent) | ✅ (agentless) | ✅ | ❌ | Later |
| Installed-software inventory per PC | ❌ | ✅ | ✅ | ✅ | ❌ | Later |
| Lightweight PowerShell inventory script that posts to our API | — | — | — | — | ❌ | Possible quick win |

## E. Users, security and administration
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Server-side login with hashed passwords | ✅ | ✅ | ✅ | ✅ | ❌ (**critical**) | Must |
| Role-based permissions enforced on the server | ✅ | ✅ | ✅ | ✅ | ❌ (**critical**) | Must |
| Active Directory / LDAP login and user sync | ✅ | ✅ | ✅ | ✅ | ❌ | |
| Password policy, account lockout, session timeout | ✅ | ✅ | ✅ | ✅ | ❌ | Must |
| Staff acceptance of assigned equipment (digital sign-off) | ✅ | ◐ | ❌ | ◐ | ❌ | |
| **Built-in backup and restore** | ✅ | ◐ (plugin) | ✅ | ✅ | ❌ | Must |
| REST API with tokens | ✅ | ✅ | ✅ | ✅ | ◐ (unauthenticated) | |
| Settings UI (company info, logo, label layout) | ✅ | ✅ | ✅ | ✅ | ❌ | |

## F. Reporting and notifications
| Feature | Snipe-IT | GLPI | Lansweeper | ManageEngine | **URC today** | Priority |
|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| CSV / Excel import with column mapping and validation | ✅ | ✅ | ✅ | ✅ | ◐ (one-off audit import) | |
| CSV / Excel / PDF export and custom reports | ✅ | ✅ | ✅ | ✅ | ◐ (CSV and print) | |
| Standard reports: by department, by age, due for replacement, licence compliance | ✅ | ✅ | ✅ | ✅ | ◐ | |
| Email notifications through the internal SMTP / Exchange server (warranty, licence expiry, overdue check-ins) | ✅ | ✅ | ✅ | ✅ | ◐ (UI only, verify) | |

## G. URC-specific ideas (not typical in competitors)
- Engraved number format `URC/ITO/...` validated and auto-generated.
- Station and region hierarchy matching the railway network.
- Replacement-planning report, for example "machines older than 5 years or still on Windows 10", to support budget requests.
- Offline-tolerant scanning for stations with poor connectivity (later).

## Draft v1 proposal (for discussion)
**Must:** server-side auth and role-based access · internal DB · automated backup and restore · check-out/check-in with history · lifecycle states · warranty and purchase fields · departments, staff and locations as real records · CSV import and export · QR labels · email alerts through the internal SMTP server.
**Should:** physical audit mode · attachments · Active Directory login · suppliers · depreciation.
**Later:** network discovery or PowerShell agent · helpdesk tickets · contracts.
