/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, Key, ScanLine, BellRing, Printer, Sparkles, HelpCircle } from 'lucide-react';

export default function HelpGuide() {
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-4 max-w-5xl mx-auto animate-fade-in">
      
      {/* Help Hero Banner */}
      <div className="border-b border-slate-150 pb-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase font-mono tracking-tight">
          <BookOpen className="h-4.5 w-4.5 text-yellow-500" />
          URC IT Inventory User Manual & Help Center
        </h2>
        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          Operational guide for Uganda Railways Corporation's IT asset management portal. Secure access privileges, physical barcode workflows, automated alerts, and backend AI intelligence.
        </p>
      </div>

      {/* STEP-BY-STEP Walkthroughs */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
          Step-by-Step Walkthroughs
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Section 1: RBAC */}
          <div className="p-3 bg-slate-50 rounded border border-slate-150 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-yellow-100 text-yellow-900 rounded">
                <Key className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-[11.5px] font-bold text-slate-850 uppercase font-mono">1. Role-Based Access Control (RBAC)</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal font-sans">
              To secure railroad inventory records, URC implements strict administrative roles. Test active privileges in the navbar selector:
            </p>
            <ul className="text-[11px] text-slate-600 space-y-1 pl-4 list-disc font-sans leading-normal">
              <li><strong className="font-semibold text-slate-800">Admin</strong>: Full privileges. Can register, edit, or delete items across all registers.</li>
              <li><strong className="font-semibold text-slate-800">IT Manager</strong>: Can create or modify hardware, software, or server parts. Restrained from deleting records.</li>
              <li><strong className="font-semibold text-slate-800">Technician</strong>: Can scan barcode assets, perform dispatch overrides, and view SMTP outboxes. Restricted deletions.</li>
              <li><strong className="font-semibold text-slate-800">Viewer</strong>: Read-only access. Disallowed from making modifications, but can export data reports.</li>
            </ul>
          </div>

          {/* Section 2: Filtering & Inventories */}
          <div className="p-3 bg-slate-50 rounded border border-slate-150 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-150 text-slate-800 rounded">
                <BookOpen className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-[11.5px] font-bold text-slate-850 uppercase font-mono">2. Inventory Searching & Filters</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal font-sans">
              Navigate between primary tables using the "Inventory Registers" sub-tabs:
            </p>
            <ul className="text-[11px] text-slate-600 space-y-1 pl-4 list-disc font-sans leading-normal">
              <li><strong className="font-semibold text-slate-800">Hardware Assets</strong>: Monitors physical laptops, routers, switches, and workstations.</li>
              <li><strong className="font-semibold text-slate-800">Software Licenses</strong>: Track subscription contracts, product keys, and active seats.</li>
              <li><strong className="font-semibold text-slate-800">Server Parts</strong>: Monitors CPU cores, NICs, and redundant hot-plug PSUs inside rack slots.</li>
              <li><strong className="font-semibold text-slate-800">Filter Console</strong>: Search dynamically by item ID, specification, category, status, or assignee.</li>
              <li><strong className="font-semibold text-slate-800">Lifecycle states</strong>: Each hardware asset is In Stock, Deployed, In Repair, Retired or Disposed. Use the “Change state” button on a row; retiring or disposing needs a reason, and only an Admin or the Manager can mark an asset Disposed, which is final. The History button shows every change to that asset.</li>
            </ul>
          </div>

          {/* Section 3: Barcode Passport Scanning */}
          <div className="p-3 bg-slate-50 rounded border border-slate-150 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-800 rounded border border-blue-100">
                <ScanLine className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-[11.5px] font-bold text-slate-850 uppercase font-mono">3. Barcode Passports & Scanning</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal font-sans">
              Designed for rapid dispatch updates when deploying hardware to regional offices:
            </p>
            <ol className="text-[11px] text-slate-600 space-y-1 pl-4 list-decimal font-sans leading-normal">
              <li>Click the barcode icon on any hardware asset row to view its **IT Asset Passport**.</li>
              <li>Open the **Barcode Scan Center** from the primary sidebar to trigger simulated scans.</li>
              <li>Select a Mock Asset ID from the dropdown list and click **Scan Barcode** to decode.</li>
              <li>The system instantly retrieves live dispatch logs, so you can check it out or in, update its lifecycle state, or correct its location in one click.</li>
            </ol>
          </div>

          {/* Section 4: SMTP Alerts */}
          <div className="p-3 bg-slate-50 rounded border border-slate-150 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-50 text-red-800 rounded border border-red-100">
                <BellRing className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-[11.5px] font-bold text-slate-850 uppercase font-mono">4. SMTP Automated Alerts</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal font-sans">
              The system automatically watches inventory safety limits to trigger notifications:
            </p>
            <ul className="text-[11px] text-slate-600 space-y-1 pl-4 list-disc font-sans leading-normal">
              <li><strong className="font-semibold text-slate-800">Low Stock Warnings</strong>: Generated when hardware counts or server parts fall below safety limits.</li>
              <li><strong className="font-semibold text-slate-800">License Expirations</strong>: Dispatched when software seat limits are breached or contracts face expiry within 30 days.</li>
              <li><strong className="font-semibold text-slate-800">SMTP outbox</strong>: View the exact simulated email envelope received by URC admins. Click "Force Alert Check" to execute immediate scans.</li>
            </ul>
          </div>

          {/* Section 5: Reports Export */}
          <div className="p-3 bg-slate-50 rounded border border-slate-150 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-100">
                <Printer className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-[11.5px] font-bold text-slate-850 uppercase font-mono">5. Data Reports & Exports</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal font-sans">
              To complete physical railway audits, URC supports instant digital reporting exports:
            </p>
            <ul className="text-[11px] text-slate-600 space-y-1 pl-4 list-disc font-sans leading-normal">
              <li><strong className="font-semibold text-slate-800">CSV Export</strong>: Click "Export CSV" to compile active filtered grid records into a clean download spreadsheet.</li>
              <li><strong className="font-semibold text-slate-800">Printable PDF Layouts</strong>: Click "Print PDF" to invoke standard printing. The system invokes high-contrast styling, stripping out sidebars and menus automatically.</li>
            </ul>
          </div>


        </div>
      </div>

      {/* Operational Best Practices */}
      <div className="p-3 bg-yellow-50/20 border border-yellow-150 rounded space-y-1">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase font-mono">
          <HelpCircle className="h-4 w-4 text-yellow-550" />
          IT Department Recommended Procedures
        </h3>
        <p className="text-[11px] text-slate-600 leading-normal font-sans">
          To maintain railway asset integrity:
        </p>
        <ul className="text-[11px] text-slate-500 list-disc pl-5 font-sans space-y-0.5 leading-normal">
          <li>Always log modifications. The system writes automated Audit logs containing the active operator's email and role stamp.</li>
          <li>Ensure every hardware component has a correct **Reorder limit** configured to prevent regional stock-out.</li>
          <li>Keep software license active seats up to date so that capacity warnings do not trigger railway compliance violations under software audits.</li>
        </ul>
      </div>

    </div>
  );
}
