/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, Check, BellRing, RefreshCw, AlertTriangle, Clock, Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Alert, UserRole } from '../types';

interface NotificationCenterProps {
  alerts: Alert[];
  onResolveAlert: (id: string) => Promise<void>;
  onTriggerAlertCheck: () => Promise<void>;
  currentUserRole: UserRole;
}

export default function NotificationCenter({
  alerts,
  onResolveAlert,
  onTriggerAlertCheck,
  currentUserRole
}: NotificationCenterProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Alert | null>(null);

  const handleTriggerAuditScan = async () => {
    setIsScanning(true);
    await onTriggerAlertCheck();
    setTimeout(() => {
      setIsScanning(false);
    }, 1000);
  };

  const activeAlerts = alerts.filter(a => a.status === 'unread');
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved');

  return (
    <div className="space-y-4">
      
      {/* Alert Header and manual scan triggers */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BellRing className="h-4.5 w-4.5 text-red-500 animate-bounce" />
            Automated Alert Center & SMTP Email Gateway
          </h2>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xl leading-relaxed">
            Monitors real-time URC IT inventory parameters. Generates automated system alerts when stock falls below safety margins or license contracts face expiry.
          </p>
        </div>

        <button
          onClick={handleTriggerAuditScan}
          disabled={isScanning}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-colors disabled:opacity-50 self-start sm:self-center font-mono uppercase"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          Force Alert Check
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left: Active Warnings List */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase font-mono">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              Active System Warnings ({activeAlerts.length})
            </h3>
            <span className="text-[9px] bg-red-100 text-red-800 font-extrabold px-1.5 py-0.5 rounded font-mono uppercase">
              REALTIME_ALERTS
            </span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {activeAlerts.map(alert => (
              <div 
                key={alert.id} 
                className={`p-3 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  alert.type === 'license_expiry' 
                    ? 'bg-red-50/40 border-red-200 hover:bg-red-50' 
                    : alert.type === 'maintenance' 
                      ? 'bg-amber-50/30 border-amber-200 hover:bg-amber-50'
                      : 'bg-orange-50/30 border-orange-200 hover:bg-orange-50'
                }`}
              >
                <div className="space-y-1 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                      alert.type === 'license_expiry' 
                        ? 'bg-red-200 text-red-950' 
                        : alert.type === 'maintenance'
                          ? 'bg-amber-200 text-amber-955'
                          : 'bg-orange-200 text-orange-955'
                    }`}>
                      {alert.type === 'low_stock' ? 'Low Stock' : alert.type === 'license_expiry' ? 'License Expiry' : 'Faulty Hardware'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : '—'}
                    </span>
                  </div>

                  <h4 className="text-[11.5px] font-bold text-slate-850">{alert.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">{alert.message}</p>
                  
                  {alert.emailSent && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      <p className="text-[9px] font-semibold text-slate-500 font-mono">
                        SMTP Mail dispatched to: <span className="text-slate-700 underline">{alert.emailTo}</span>
                      </p>
                      <button
                        onClick={() => setSelectedEmail(alert)}
                        className="text-[9px] font-bold text-red-600 hover:underline flex items-center gap-0.5 ml-1 font-mono uppercase"
                      >
                        [View Mail Log]
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onResolveAlert(alert.id)}
                  disabled={currentUserRole === UserRole.VIEWER}
                  className="bg-white hover:bg-slate-50 border border-slate-350 hover:border-slate-400 text-slate-700 font-bold px-2 py-1 rounded text-[10px] transition-colors flex items-center gap-1 font-mono uppercase self-start sm:self-center disabled:opacity-50 whitespace-nowrap"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3px]" />
                  Acknowledge
                </button>
              </div>
            ))}

            {activeAlerts.length === 0 && (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded bg-slate-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1.5 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-700 uppercase font-mono tracking-wide">All Parameters Secure</p>
                <p className="text-[10px] text-slate-400 max-w-[200px] text-center mt-0.5">No low stock levels or contract expiries found. URC network is stable.</p>
              </div>
            )}
          </div>

          {/* Resolved History panel */}
          {resolvedAlerts.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase font-mono tracking-wider">Recently Resolved Alerts ({resolvedAlerts.length})</h4>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {resolvedAlerts.map(alert => (
                  <div key={alert.id} className="p-2 bg-slate-50 border border-slate-150 rounded flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-semibold text-slate-650">{alert.title}</span>
                    </div>
                    <span className="text-[8px] font-mono font-extrabold bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded uppercase">Resolved</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right: SMTP Email Sandbox Viewer */}
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-850 shadow-sm text-white flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase font-mono">
                <Mail className="h-4 w-4 text-yellow-500" />
                SMTP Outbox Terminal
              </h3>
              <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 font-bold px-1.5 py-0.5 rounded font-mono">
                SMTP_SANDBOX
              </span>
            </div>

            {selectedEmail ? (
              <div className="space-y-2.5 animate-fade-in text-xs">
                <div className="space-y-0.5 bg-slate-950 p-2.5 rounded border border-slate-800 text-[9px] font-mono text-slate-400 leading-relaxed">
                  <p><span className="text-yellow-500 font-bold">Relay:</span> smtp.urc.go.ug (Port 587)</p>
                  <p><span className="text-slate-200 font-bold">To:</span> {selectedEmail.emailTo}</p>
                  <p><span className="text-slate-200 font-bold">From:</span> alerts-gateway@urc.go.ug</p>
                  <p><span className="text-slate-200 font-bold">Subject:</span> [URC-IT-ALARM] {selectedEmail.title}</p>
                </div>

                <div className="p-3 bg-slate-950 rounded border border-slate-850 text-[11px] font-sans leading-normal text-slate-300">
                  <p className="font-bold text-slate-200">Dear IT Support team,</p>
                  <p className="mt-1.5 text-slate-400 leading-relaxed">{selectedEmail.message}</p>
                  <p className="mt-2 text-[9px] text-slate-500 italic">
                    Automated asset scan diagnostic dispatched securely under URC IT protocol.
                  </p>
                  <p className="mt-3 text-slate-400">Uganda Railways Corporation IT Gateway.</p>
                </div>

                <button
                  onClick={() => setSelectedEmail(null)}
                  className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold py-1.5 rounded text-xs transition-colors font-mono uppercase"
                >
                  Clear Terminal
                </button>
              </div>
            ) : (
              <div className="py-24 flex flex-col items-center text-center space-y-2">
                <Mail className="h-8 w-8 text-slate-700" />
                <p className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wide">Terminal Empty</p>
                <p className="text-[10px] text-slate-500 max-w-[170px] leading-relaxed">Select "View Mail Log" from an active warning alert to inspect the SMTP payload envelope.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-2.5 border-t border-slate-800 text-[9px] text-slate-500 text-center font-mono">
            URC Mail Queue Sandbox. Only authorized operations permitted.
          </div>
        </div>

      </div>

    </div>
  );
}
