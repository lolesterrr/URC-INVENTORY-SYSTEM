/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileSpreadsheet, ScanLine, BellRing, BookOpen,
  Menu, X, User as UserIcon, Shield, Info, RefreshCw, Layers, Users, KeyRound, DatabaseBackup
} from 'lucide-react';
import {
  UserRole, User, HardwareAsset, SoftwareLicense, ServerComponent, Alert, AuditLog, DashboardStats, Permission
} from './types';
import { api } from './api';

import DashboardView from './components/DashboardView';
import InventoryTables from './components/InventoryTables';
import BarcodeScanner from './components/BarcodeScanner';
import NotificationCenter from './components/NotificationCenter';
import HelpGuide from './components/HelpGuide';
import UserManagement from './components/UserManagement';
import BackupManagement from './components/BackupManagement';
import ChangePasswordForm from './components/ChangePasswordForm';

import urcLogo from './assets/images/company_logo.png';
import ugandaTrain from './assets/images/uganda_train_1784095821816.jpg';

const PERMISSION_LABELS: Record<Permission, string> = {
  'assets:read': 'View inventory, dashboards and reports',
  'assets:write': 'Add and edit inventory records',
  'assets:delete': 'Archive inventory records',
  'alerts:manage': 'Resolve alerts and run inventory checks',
  'audit:read': 'View the change history',
  'users:manage': 'Manage user accounts',
  'backups:manage': 'Run and check database backups',
};

interface MainAppProps {
  currentUser: User;
  onLogout: () => void;
  onUserChanged: (user: User) => void;
}

export default function MainApp({ currentUser, onLogout, onUserChanged }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [inventorySubTab, setInventorySubTab] = useState<'hardware' | 'software' | 'servers'>('hardware');
  
  const [showPasswordForm, setShowPasswordForm] = useState<boolean>(false);

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      onLogout();
    }
  };

  // Data State
  const [hardware, setHardware] = useState<HardwareAsset[]>([]);
  const [software, setSoftware] = useState<SoftwareLicense[]>([]);
  const [serverComponents, setServerComponents] = useState<ServerComponent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Load all assets initially
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [dataHw, dataSw, dataSc, dataAlerts, dataLogs, dataStats] = await Promise.all([
        api<HardwareAsset[]>('/api/hardware'),
        api<SoftwareLicense[]>('/api/software'),
        api<ServerComponent[]>('/api/server-components'),
        api<Alert[]>('/api/alerts'),
        api<AuditLog[]>('/api/audit-logs'),
        api<DashboardStats>('/api/analytics'),
      ]);
      setHardware(dataHw);
      setSoftware(dataSw);
      setServerComponents(dataSc);
      setAlerts(dataAlerts);
      setAuditLogs(dataLogs);
      setStats(dataStats);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);

  // The session cookie is sent automatically; identity and role are decided by the server.
  const getAuthHeaders = () => ({ 'Content-Type': 'application/json' });

  // --- HARDWARE ACTIONS ---
  const handleAddHardware = async (item: HardwareAsset) => {
    const res = await fetch('/api/hardware', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register hardware asset.');
    }
    await fetchData();
  };

  const handleUpdateHardware = async (item: HardwareAsset) => {
    const res = await fetch(`/api/hardware/${item.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update hardware asset.');
    }
    await fetchData();
  };

  const handleDeleteHardware = async (id: string) => {
    const res = await fetch(`/api/hardware/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete hardware.');
    }
    await fetchData();
  };

  // --- SOFTWARE ACTIONS ---
  const handleAddSoftware = async (item: SoftwareLicense) => {
    const res = await fetch('/api/software', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register license.');
    }
    await fetchData();
  };

  const handleUpdateSoftware = async (item: SoftwareLicense) => {
    const res = await fetch(`/api/software/${item.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to modify license.');
    }
    await fetchData();
  };

  const handleDeleteSoftware = async (id: string) => {
    const res = await fetch(`/api/software/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete license.');
    }
    await fetchData();
  };

  // --- SERVER PARTS ACTIONS ---
  const handleAddServerComponent = async (item: ServerComponent) => {
    const res = await fetch('/api/server-components', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register component.');
    }
    await fetchData();
  };

  const handleUpdateServerComponent = async (item: ServerComponent) => {
    const res = await fetch(`/api/server-components/${item.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to modify component.');
    }
    await fetchData();
  };

  const handleDeleteServerComponent = async (id: string) => {
    const res = await fetch(`/api/server-components/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete component.');
    }
    await fetchData();
  };

  // --- ALERT ACTIONS ---
  const handleResolveAlert = async (id: string) => {
    const res = await fetch(`/api/alerts/resolve/${id}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleTriggerAlertCheck = async () => {
    const res = await fetch('/api/alerts/check-triggers', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      await fetchData();
    }
  };

  // Navigate to particular tab helper
  const navigateToTab = (tab: string) => {
    if (tab === 'hardware' || tab === 'software' || tab === 'servers') {
      setInventorySubTab(tab as any);
      setActiveTab('inventory');
    } else {
      setActiveTab(tab);
    }
  };

  // Render correct panel
  const renderActiveContent = () => {
    if (isLoading) {
      return (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Synchronizing database assets...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView 
            stats={stats}
            auditLogs={auditLogs}
            hardware={hardware}
            software={software}
            onRefresh={fetchData}
            currentUserRole={currentUser.role}
            onNavigateTo={navigateToTab}
            triggerAlertCheck={handleTriggerAlertCheck}
          />
        );
      case 'inventory':
        return (
          <InventoryTables 
            hardware={hardware}
            software={software}
            serverComponents={serverComponents}
            currentUserRole={currentUser.role}
            userEmail={currentUser.username}
            onAddHardware={handleAddHardware}
            onUpdateHardware={handleUpdateHardware}
            onDeleteHardware={handleDeleteHardware}
            onAddSoftware={handleAddSoftware}
            onUpdateSoftware={handleUpdateSoftware}
            onDeleteSoftware={handleDeleteSoftware}
            onAddServerComponent={handleAddServerComponent}
            onUpdateServerComponent={handleUpdateServerComponent}
            onDeleteServerComponent={handleDeleteServerComponent}
            selectedSubTab={inventorySubTab}
            setSelectedSubTab={setInventorySubTab}
          />
        );
      case 'barcode':
        return (
          <BarcodeScanner 
            hardware={hardware}
            currentUserRole={currentUser.role}
            onUpdateHardware={handleUpdateHardware}
          />
        );
      case 'notifications':
        return (
          <NotificationCenter 
            alerts={alerts}
            onResolveAlert={handleResolveAlert}
            onTriggerAlertCheck={handleTriggerAlertCheck}
            currentUserRole={currentUser.role}
          />
        );
      case 'users':
        return currentUser.permissions.includes('users:manage')
          ? <UserManagement currentUserId={currentUser.id} />
          : <div>You do not have access to this page.</div>;
      case 'backups':
        return currentUser.permissions.includes('backups:manage')
          ? <BackupManagement />
          : <div>You do not have access to this page.</div>;
      case 'docs':
        return <HelpGuide />;
      case 'profile':
        return (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs animate-fade-in max-w-4xl mx-auto text-slate-950">
            {/* Cover image (Uganda passenger train) */}
            <div className="h-48 relative overflow-hidden bg-slate-950">
              <img 
                src={ugandaTrain} 
                alt="Uganda Railways Passenger Train cover" 
                className="w-full h-full object-cover opacity-40 filter brightness-90"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
              <div className="absolute bottom-4 left-6 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-yellow-500 border-2 border-white text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white tracking-tight">{currentUser.fullName}</h2>
                  <p className="text-xs text-yellow-400 font-mono">{currentUser.role} Authorization Status</p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Account Details */}
              <div className="md:col-span-2 space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">Operator Profile Registry</h3>
                  <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-200">
                      <span className="text-xs text-slate-400 font-semibold uppercase font-mono">Operator ID:</span>
                      <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">{currentUser.id}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-200">
                      <span className="text-xs text-slate-400 font-semibold uppercase font-mono">Username:</span>
                      <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">{currentUser.username}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 py-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase font-mono">Assigned Role:</span>
                      <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">{currentUser.role}</span>
                    </div>
                  </div>
                </div>

                {/* Permissions granted by the server for this role */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">What your role can do</h3>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    {(Object.keys(PERMISSION_LABELS) as Permission[]).map(p => {
                      const allowed = currentUser.permissions.includes(p);
                      return (
                        <div key={p} className="flex items-center gap-2 text-xs text-slate-700">
                          <span className={`w-2 h-2 rounded-full ${allowed ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                          <span>{PERMISSION_LABELS[p]}: <strong className="text-slate-900">{allowed ? 'Yes' : 'No'}</strong></span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">Password</h3>
                  {showPasswordForm ? (
                    <ChangePasswordForm
                      onChanged={u => { setShowPasswordForm(false); onUserChanged(u); }}
                      onCancel={() => setShowPasswordForm(false)}
                    />
                  ) : (
                    <button
                      onClick={() => setShowPasswordForm(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <KeyRound className="h-4 w-4" /> Change my password
                    </button>
                  )}
                </div>
              </div>

              {/* URC Official Emblem Panel */}
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between items-center text-center">
                <div className="space-y-4">
                  <img 
                    src={urcLogo} 
                    alt="URC Official Emblem" 
                    className="h-24 w-24 object-contain mx-auto rounded-full border border-slate-200 p-1 bg-white shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-xs font-black text-slate-900 tracking-tight font-mono uppercase">Uganda Railways Corporation</h4>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-mono">Official Authority Seal</p>
                  </div>
                </div>

                <div className="w-full pt-4 border-t border-slate-200 space-y-2">
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs font-mono uppercase tracking-wider rounded transition-colors"
                  >
                    Sign out
                  </button>
                  <p className="text-[9px] text-slate-400">Signs you out on this computer.</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <div>Tab not found.</div>;
    }
  };

  return (
    <div id="urc-app-root" className="h-screen w-screen bg-slate-100 font-sans text-slate-800 flex overflow-hidden">
      
      {/* Left Sidebar Menu */}
      <aside className={`bg-slate-900 text-slate-300 w-64 flex flex-col justify-between fixed lg:static inset-y-0 left-0 transform ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full hidden'
      } lg:translate-x-0 lg:flex z-30 transition-transform duration-300 shrink-0 border-r border-slate-950`}>
        
        <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
          {/* Brand header */}
          <div className="p-5 border-b border-slate-800 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src={urcLogo} 
                  alt="URC Logo" 
                  className="h-8 w-8 object-contain rounded-full bg-white p-0.5"
                  referrerPolicy="no-referrer"
                />
                <h1 className="text-lg font-bold tracking-tighter text-yellow-500">
                  URC <span className="text-white font-normal">IT ASSETS</span>
                </h1>
              </div>
              {mobileMenuOpen && (
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-slate-400 hover:text-white lg:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-1.5 font-mono">
              Uganda Railways Corporation
            </p>
          </div>

          <div className="p-4 flex-1 space-y-6">
            <div className="space-y-1">
              <span className="px-3 text-[10px] uppercase text-slate-500 font-bold tracking-wider font-mono font-bold">Operations Portal</span>
              
              <nav className="space-y-1 mt-2">
                <button
                  id="tab-dashboard"
                  onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'dashboard' 
                      ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  Management Dashboard
                </button>

                <button
                  id="tab-inventory"
                  onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'inventory' 
                      ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  Inventory Registers
                </button>

                <button
                  id="tab-barcode"
                  onClick={() => { setActiveTab('barcode'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'barcode' 
                      ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <ScanLine className="h-4 w-4 shrink-0" />
                  Barcode Scan Center
                </button>

                <button
                  id="tab-notifications"
                  onClick={() => { setActiveTab('notifications'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all relative cursor-pointer ${
                    activeTab === 'notifications' 
                      ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <BellRing className="h-4 w-4 shrink-0" />
                  Alert Center
                  {alerts.filter(a => a.status === 'unread').length > 0 && (
                    <span className="absolute right-3 bg-red-600 text-white font-extrabold text-[9px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
                      {alerts.filter(a => a.status === 'unread').length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            <div className="space-y-1">
              <span className="px-3 text-[10px] uppercase text-slate-500 font-bold tracking-wider font-mono font-bold">Administration</span>
              
              <nav className="space-y-1 mt-2">
                {currentUser.permissions.includes('users:manage') && (
                  <button
                    id="tab-users"
                    onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'users'
                        ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold'
                        : 'hover:bg-slate-800 hover:text-white text-slate-400'
                    }`}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    User Accounts
                  </button>
                )}

                {currentUser.permissions.includes('backups:manage') && (
                  <button
                    id="tab-backups"
                    onClick={() => { setActiveTab('backups'); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'backups'
                        ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold'
                        : 'hover:bg-slate-800 hover:text-white text-slate-400'
                    }`}
                  >
                    <DatabaseBackup className="h-4 w-4 shrink-0" />
                    Backups
                  </button>
                )}

                <button
                  id="tab-docs"
                  onClick={() => { setActiveTab('docs'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'docs' 
                      ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  Operational User Guide
                </button>
              </nav>
            </div>

            <div className="space-y-1">
              <span className="px-3 text-[10px] uppercase text-slate-500 font-bold tracking-wider font-mono font-bold font-mono">My Account</span>
              
              <nav className="space-y-1 mt-2">
                <button
                  id="tab-profile"
                  onClick={() => { setActiveTab('profile'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'profile' 
                      ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <UserIcon className="h-4 w-4 shrink-0 text-yellow-500" />
                  Account Profile
                </button>
              </nav>
            </div>
          </div>

          {/* Active operator card at bottom of sidebar (clickable shortcut to profile!) */}
          <div 
            onClick={() => { setActiveTab('profile'); setMobileMenuOpen(false); }}
            className="p-4 bg-slate-950 hover:bg-slate-900 cursor-pointer shrink-0 border-t border-slate-850 transition-colors"
            title="Click to view full Account Profile"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow shrink-0">
                {currentUser.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{currentUser.fullName}</p>
                <p className="text-[10px] text-slate-500 italic truncate font-mono">{currentUser.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header / Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 hover:bg-slate-100 rounded-lg lg:hidden text-slate-600 transition-colors"
              title="Toggle Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Quick search display */}
            <div className="relative hidden sm:block">
              <input 
                type="text" 
                placeholder="Active dynamic inventory monitoring..." 
                disabled
                className="pl-8 pr-4 py-1.5 bg-slate-100 rounded border-transparent text-xs text-slate-500 w-64 focus:outline-none"
              />
              <div className="absolute left-2.5 top-4 text-slate-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>

            <button 
              onClick={() => navigateToTab('barcode')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-2 transition-colors shadow-xs"
            >
              <ScanLine className="h-3.5 w-3.5 text-yellow-400" />
              <span>Scan Barcode</span>
            </button>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            
            {/* Interactive Bell / Alerts info */}
            <button 
              onClick={() => navigateToTab('notifications')}
              className="flex items-center gap-2 hover:bg-slate-50 p-1.5 px-2.5 rounded-lg transition-all"
            >
              <span className="relative">
                <BellRing className="w-4 h-4 text-slate-500" />
                {alerts.filter(a => a.status === 'unread').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </span>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter hidden sm:inline">
                {alerts.filter(a => a.status === 'unread').length} Alerts
              </span>
            </button>

            {/* User Permissions Label */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
              <Shield className="h-3.5 w-3.5 text-yellow-600" />
              <span>Active:</span>
              <span className="font-extrabold text-slate-800 uppercase tracking-tight">{currentUser.role}</span>
            </div>

            {/* Active Administrator Indicator & Sign Out */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigateToTab('profile')}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-lg p-1.5 px-3 border border-slate-200 transition-colors cursor-pointer"
                title="View Active Administrator Profile"
              >
                <UserIcon className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-bold text-slate-800">{currentUser.fullName}</span>
                <span className="text-[9px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">Admin</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer"
                title="Sign Out of Session"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic content scrollable container */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-6 no-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {renderActiveContent()}
          </div>
        </div>

        {/* Bottom Status Bar */}
        <footer className="h-8 bg-slate-100 border-t border-slate-200 flex items-center px-6 justify-between shrink-0 text-slate-500 z-10 font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[9px] uppercase font-bold">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              DB Server Connected
            </span>
            <span className="text-[9px] text-slate-300">|</span>
            <span className="text-[9px] uppercase font-bold">Last Sync: {new Date().toLocaleTimeString()}</span>
          </div>
          <p className="text-[9px] font-medium tracking-tight hidden sm:block">
            © {new Date().getFullYear()} Uganda Railways Corporation IT Department. v2.4.0-Stable
          </p>
        </footer>

      </div>

    </div>
  );
}
