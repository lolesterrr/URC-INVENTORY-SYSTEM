/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Laptop, ShieldAlert, Award, RefreshCw, Cpu
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import { DashboardStats, AuditLog, UserRole, HardwareAsset, SoftwareLicense } from '../types.js';

import urcLogo from '../assets/images/company_logo.png';
import ugandaTrain from '../assets/images/uganda_train_1784095821816.jpg';

interface DashboardViewProps {
  stats: DashboardStats | null;
  auditLogs: AuditLog[];
  hardware?: HardwareAsset[];
  software?: SoftwareLicense[];
  onRefresh: () => void;
  currentUserRole: UserRole;
  onNavigateTo: (tab: string) => void;
  triggerAlertCheck: () => Promise<void>;
}

// Executive corporate color palette (Slates, Deep Charcoal, Muted Gold/Amber)
const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];

export default function DashboardView({
  stats,
  auditLogs,
  hardware = [],
  software = [],
  onRefresh,
  currentUserRole,
  onNavigateTo,
  triggerAlertCheck
}: DashboardViewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await triggerAlertCheck();
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Dynamically calculated real asset weight distribution by hardware category
  const hardwareValueData = useMemo(() => {
    if (hardware && hardware.length > 0) {
      const counts: Record<string, number> = {};
      hardware.forEach(h => {
        const cat = h.category || 'Other';
        counts[cat] = (counts[cat] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }
    return [];
  }, [hardware]);

  // Dynamically calculated real software seat deployments from the database
  const softwareSeatsData = useMemo(() => {
    if (software && software.length > 0) {
      return software.map(s => {
        const shortName = s.name.length > 18 ? s.name.slice(0, 16) + '...' : s.name;
        return {
          name: shortName,
          Active: s.activeSeats,
          Total: s.seatCapacity
        };
      });
    }
    return [];
  }, [software]);

  return (
    <div id="urc-dashboard" className="space-y-6 animate-fade-in text-slate-900">
      {/* Header Panel */}
      <div className="relative overflow-hidden bg-slate-950 text-white p-6 rounded-lg shadow-sm border border-slate-900 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src={ugandaTrain} 
            alt="Uganda Railways Passenger Train" 
            className="w-full h-full object-cover opacity-15 filter brightness-50 contrast-125"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent"></div>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <img 
            src={urcLogo} 
            alt="URC Logo" 
            className="h-16 w-16 object-contain rounded-full bg-white p-1 shadow-md border border-slate-800 shrink-0 self-start sm:self-center"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-mono">IT Administration</span>
              <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider font-mono">Operations Command</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1 text-white">
              UGANDA RAILWAYS CORPORATION
            </h1>
            <p className="text-slate-400 text-xs mt-1 max-w-xl font-medium leading-relaxed">
              Enterprise Asset Management Ledger & Real-Time IT Infrastructure Audit System.
            </p>
          </div>
        </div>
        
        <div className="relative z-10 flex items-center gap-3 self-start md:self-center shrink-0">
          <button
            id="refresh-stats-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-slate-800 hover:border-slate-700 px-4 py-2.5 rounded text-[11px] font-bold transition-all disabled:opacity-50 font-mono tracking-wider shadow-lg cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            SYNCHRONIZE LEDGER & SCAN
          </button>
        </div>
      </div>

      {/* Corporate Division Metrics Board */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          
          {/* Section 1: Hardware */}
          <div 
            id="kpi-hardware"
            onClick={() => onNavigateTo('hardware')}
            className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Hardware Inventory</span>
              <Laptop className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <div>
              <h3 className="text-3xl font-light tracking-tight text-slate-900">
                {stats ? stats.totalHardwareCount : '—'} <span className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider">Assets</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-2">
                Valuation: <span className="text-slate-950 font-mono font-bold">UGX {stats ? stats.totalHardwareValue.toLocaleString() : '—'}</span>
              </p>
            </div>
          </div>

          {/* Section 2: Software */}
          <div 
            id="kpi-software"
            onClick={() => onNavigateTo('software')}
            className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Software Licenses</span>
              <Award className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <div>
              <h3 className="text-3xl font-light tracking-tight text-slate-900">
                {stats ? stats.totalActiveLicenses : '—'} <span className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider">Licenses</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-2">
                Annual Cost: <span className="text-slate-950 font-mono font-bold">UGX {stats ? stats.totalLicenseCost.toLocaleString() : '—'}</span>
              </p>
            </div>
          </div>

          {/* Section 3: Server Parts */}
          <div 
            id="kpi-servers"
            onClick={() => onNavigateTo('servers')}
            className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Server Components</span>
              <Cpu className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <div>
              <h3 className="text-3xl font-light tracking-tight text-slate-900">
                {stats ? stats.totalServerComponents : '—'} <span className="text-xs text-slate-400 font-mono font-bold uppercase tracking-wider">Units</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-2">
                Spares in Datacenters
              </p>
            </div>
          </div>

          {/* Section 4: Operational Status */}
          <div 
            id="kpi-alerts"
            onClick={() => onNavigateTo('notifications')}
            className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Operational Health</span>
              <ShieldAlert className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <div>
              <h3 className="text-3xl font-light tracking-tight text-slate-900 flex items-baseline gap-1.5">
                {stats ? (stats.lowStockAlertCount + stats.expiringLicensesCount) : '—'}{' '}
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Alerts</span>
              </h3>
              <div className="text-[10px] text-slate-500 mt-2 flex gap-2 font-mono">
                <span className="bg-slate-100 px-1 rounded">LOW: {stats ? stats.lowStockAlertCount : 0}</span>
                <span className="bg-slate-100 px-1 rounded">EXP: {stats ? stats.expiringLicensesCount : 0}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Interactive Graphics & Diagnostics Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Column 1: Software Allocations */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-150">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                Software License Deployment Metrics
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Allocation seats versus allocated cap bounds.</p>
            </div>
            <span className="text-[10px] bg-slate-950 text-white font-bold font-mono px-2 py-0.5 rounded tracking-wider uppercase">Seat Status</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={softwareSeatsData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontFamily: 'monospace' }} 
                  itemStyle={{ color: '#fbbf24' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar dataKey="Active" fill="#334155" radius={[2, 2, 0, 0]} name="Allocated Seats" />
                <Bar dataKey="Total" fill="#e2e8f0" radius={[2, 2, 0, 0]} name="Total Seat Capacity" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Valuation Weights Distribution */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-150">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                Asset Allocation Weight Distribution
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Asset count proportional segmentation.</p>
            </div>
            <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider">Weight Analysis</span>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={hardwareValueData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={65}
                  innerRadius={30}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {hardwareValueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Modification Ledger */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-150">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Modification Ledger & Audit History
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Role-Based Access Control verified log entries.</p>
          </div>
          <span className="text-[9px] font-mono bg-slate-950 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">RBAC SECURE</span>
        </div>

        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 no-scrollbar">
          {auditLogs.map(log => (
            <div key={log.id} className="p-3 bg-slate-50 rounded border border-slate-150 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] bg-slate-900 text-white font-bold px-1.5 py-0.2 rounded uppercase font-mono">
                  {log.action}
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-700 leading-normal">{log.details}</p>
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1">
                <span>Officer: {log.user.split(' (')[0]}</span>
                <span>Role Authorization: {log.role}</span>
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">No modifications logged in this session.</p>
          )}
        </div>
        
        <div className="mt-4 pt-3 border-t border-slate-150 text-right">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">All ledger mutations require explicit Administrator or IT Manager signature.</span>
        </div>
      </div>
    </div>
  );
}
