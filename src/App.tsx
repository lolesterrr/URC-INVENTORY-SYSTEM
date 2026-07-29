/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, FileSpreadsheet, ScanLine, BellRing, Sparkles, BookOpen, 
  Menu, X, LogIn, User as UserIcon, Shield, Info, RefreshCw, Layers, Eye, EyeOff
} from 'lucide-react';
import { 
  UserRole, User, HardwareAsset, SoftwareLicense, ServerComponent, Alert, AuditLog, DashboardStats 
} from './types';

// Import our beautiful custom sub-views
import DashboardView from './components/DashboardView';
import InventoryTables from './components/InventoryTables';
import BarcodeScanner from './components/BarcodeScanner';
import NotificationCenter from './components/NotificationCenter';
import AICopilot from './components/AICopilot';
import HelpGuide from './components/HelpGuide';

// System Administrator Accounts
const PRESET_USERS: User[] = [
  { 
    id: 'u-1', 
    name: 'Lester Kajjabwangu (System Admin)', 
    email: 'kajjabwangulester@gmail.com', 
    password: 'Admin#Lester2026', 
    role: UserRole.ADMIN,
    department: 'INFORMATION COMMUNICATION AND TECHNOLOGY'
  },
  { 
    id: 'u-2', 
    name: 'Ahmad Mukasa (IT Administrator)', 
    email: 'mukasa.ahmad@urc.go.ug', 
    password: 'URC@Ahmad2026', 
    role: UserRole.ADMIN,
    department: 'INFORMATION COMMUNICATION AND TECHNOLOGY'
  },
  { 
    id: 'u-3', 
    name: 'Florence Namara (IT Administrator)', 
    email: 'namara.f@urc.go.ug', 
    password: 'URC@Florence2026', 
    role: UserRole.ADMIN,
    department: 'INFORMATION COMMUNICATION AND TECHNOLOGY'
  },
  { 
    id: 'u-4', 
    name: 'Martha Aturinda (Chief IT Officer)', 
    email: 'aturinda.m@urc.go.ug', 
    password: 'URC@Martha2026', 
    role: UserRole.ADMIN,
    department: 'INFORMATION COMMUNICATION AND TECHNOLOGY'
  }
];

import urcLogo from './assets/images/company_logo.png';
import ugandaTrain from './assets/images/uganda_train_1784095821816.jpg';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [inventorySubTab, setInventorySubTab] = useState<'hardware' | 'software' | 'servers'>('hardware');
  
  // Custom accounts persistence
  const [customUsers, setCustomUsers] = useState<User[]>(() => {
    try {
      const stored = localStorage.getItem('urc_custom_users');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const allUsers = [...PRESET_USERS, ...customUsers];

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('urc_logged_in') === 'true';
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUserId = localStorage.getItem('urc_current_user_id');
    const matched = allUsers.find(u => u.id === savedUserId);
    return matched || PRESET_USERS[0];
  });

  // Login & Registration state
  const [loginTab, setLoginTab] = useState<'password' | 'register'>('password');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);

  const handleLoginUser = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    setLoginError('');
    localStorage.setItem('urc_logged_in', 'true');
    localStorage.setItem('urc_current_user_id', user.id);
  };

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const matched = allUsers.find(
      u => u.email.toLowerCase().trim() === loginEmail.toLowerCase().trim()
    );
    if (!matched) {
      setLoginError('No system administrator account found with this email.');
      return;
    }
    if (matched.password && matched.password !== loginPassword) {
      setLoginError('Incorrect administrator password.');
      return;
    }
    handleLoginUser(matched);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.setItem('urc_logged_in', 'false');
  };

  const handleCreateAccount = async (name: string, email: string, password: string) => {
    const newUser: User = {
      id: `u-admin-${Date.now()}`,
      name: name.includes('Admin') ? name : `${name} (System Admin)`,
      email,
      password: password || 'URC@Admin2026',
      role: UserRole.ADMIN,
      department: 'INFORMATION COMMUNICATION AND TECHNOLOGY'
    };
    const updated = [...customUsers, newUser];
    setCustomUsers(updated);
    localStorage.setItem('urc_custom_users', JSON.stringify(updated));
    handleLoginUser(newUser);

    // Save user to Firestore Cloud DB
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
    } catch (err) {
      console.error('Failed to save admin user to cloud database:', err);
    }

    // Reset fields
    setRegName('');
    setRegEmail('');
    setRegPassword('');
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
      // Parallelize fetches
      const [resHw, resSw, resSc, resAlerts, resLogs, resStats, resUsers] = await Promise.all([
        fetch('/api/hardware'),
        fetch('/api/software'),
        fetch('/api/server-components'),
        fetch('/api/alerts'),
        fetch('/api/audit-logs'),
        fetch('/api/analytics'),
        fetch('/api/users')
      ]);

      const dataHw = await resHw.json();
      const dataSw = await resSw.json();
      const dataSc = await resSc.json();
      const dataAlerts = await resAlerts.json();
      const dataLogs = await resLogs.json();
      const dataStats = await resStats.json();
      const dataUsers = await resUsers.json();

      setHardware(dataHw);
      setSoftware(dataSw);
      setServerComponents(dataSc);
      setAlerts(dataAlerts);
      setAuditLogs(dataLogs);
      setStats(dataStats);

      if (Array.isArray(dataUsers) && dataUsers.length > 0) {
        setCustomUsers(prev => {
          const merged = [...prev];
          dataUsers.forEach((u: User) => {
            if (!merged.some(p => p.id === u.id || p.email.toLowerCase() === u.email.toLowerCase())) {
              merged.push(u);
            }
          });
          return merged;
        });
      }
    } catch (err) {
      console.error('Failed to synchronize with Express database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync headers for API requests enforcing RBAC
  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'x-user-email': currentUser.email,
      'x-user-role': currentUser.role
    };
  };

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
            userEmail={currentUser.email}
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
      case 'copilot':
        return <AICopilot />;
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
                  {currentUser.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white tracking-tight">{currentUser.name.split(' (')[0]}</h2>
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
                      <span className="text-xs text-slate-400 font-semibold uppercase font-mono">Registered Email:</span>
                      <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">{currentUser.email}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-200">
                      <span className="text-xs text-slate-400 font-semibold uppercase font-mono">Account Password:</span>
                      <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">••••••••••••</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 py-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase font-mono">Assigned Role:</span>
                      <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">{currentUser.role}</span>
                    </div>
                  </div>
                </div>

                {/* Role-Based Authority Grid */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">System Administrator Clearances</h3>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span>Can register new assets: <strong className="text-slate-900">APPROVED</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span>Can modify asset registry keys: <strong className="text-slate-900">APPROVED</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span>Can delete hardware assets & software licenses: <strong className="text-slate-900">APPROVED</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span>System Settings Configuration: <strong className="text-slate-900">APPROVED</strong></span>
                    </div>
                  </div>
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
                    Logout Session
                  </button>
                  <p className="text-[9px] text-slate-400">Terminating the active session resets your cached auth signature keys.</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <div>Tab not found.</div>;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen flex bg-slate-900 overflow-hidden font-sans">
        {/* Left column: Beautiful highquality Uganda train image banner */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src={ugandaTrain} 
              alt="Uganda Railways Passenger Train" 
              className="w-full h-full object-cover opacity-30 filter brightness-75 transition-all duration-700 hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-bl-full blur-2xl"></div>
          
          <div className="relative z-10 max-w-lg text-white space-y-6">
            <div className="flex items-center gap-3">
              <span className="bg-yellow-500 text-slate-950 text-[10px] font-black uppercase font-mono px-2.5 py-1 rounded tracking-widest shadow-md">URC Operations</span>
              <span className="text-slate-300 text-xs font-bold tracking-widest font-mono">EST. 1901</span>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
                Uganda Railways <span className="text-yellow-400">Corporation</span>
              </h1>
              <p className="text-base text-slate-300 leading-relaxed font-light">
                Enterprise asset ledger, granular role authorization, real-time node monitoring, and AI-powered infrastructure diagnostics.
              </p>
            </div>

            <div className="border-l-2 border-yellow-500 pl-4 py-2 space-y-1.5 bg-slate-900/40 backdrop-blur-xs p-3 rounded">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-mono font-bold">Kampala Transit Operations</p>
              <p className="text-[11px] text-slate-300">
                Authorized operators can register, verify inventory serial keys, log server diagnostics, and process immediate custom asset audits.
              </p>
            </div>
            
            <div className="pt-4 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
              <span>SYSTEM: v2.4.0-STABLE</span>
              <span>•</span>
              <span>HOST: KAMPALA DC 1</span>
            </div>
          </div>
        </div>

        {/* Right column: Login / Register Form */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 bg-white text-slate-950">
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            {/* Logo and title */}
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <img 
                  src={urcLogo} 
                  alt="Uganda Railways Corporation Logo" 
                  className="h-20 w-20 object-contain rounded-full border border-slate-200 p-1 shadow-sm bg-white"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">URC IT ASSET COMMAND</h2>
                <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">Sign in to active operator session</p>
              </div>
            </div>

            {/* Login Modes Tabs */}
            <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200">
              <button 
                onClick={() => { setLoginTab('password'); setLoginError(''); }}
                className={`flex-1 text-center py-2 text-xs font-bold rounded transition-all ${
                  loginTab === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Administrator Sign-In
              </button>
              <button 
                onClick={() => { setLoginTab('register'); setLoginError(''); }}
                className={`flex-1 text-center py-2 text-xs font-bold rounded transition-all ${
                  loginTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Register New Admin
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 font-mono">
                {loginError}
              </div>
            )}

            {loginTab === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Administrator Email</label>
                  <input 
                    type="email" 
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. kajjabwangulester@gmail.com"
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Administrator Password</label>
                  <div className="relative">
                    <input 
                      type={showLoginPassword ? 'text' : 'password'} 
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter administrator password"
                      className="w-full p-2.5 pr-10 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded focus:outline-none cursor-pointer"
                      title={showLoginPassword ? "Hide password" : "Show password"}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-slate-950 hover:bg-slate-850 text-white font-bold rounded-lg text-xs uppercase tracking-wider font-mono shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-amber-400" />
                  Sign In as Administrator
                </button>
              </form>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!regName.trim() || !regEmail.trim()) return;
                  handleCreateAccount(regName, regEmail, regPassword);
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Full Officer Name</label>
                  <input 
                    type="text" 
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Martha Aturinda"
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Official Email</label>
                  <input 
                    type="email" 
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. aturinda.m@urc.go.ug"
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Set Password</label>
                  <div className="relative">
                    <input 
                      type={showRegPassword ? 'text' : 'password'} 
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create admin password"
                      className="w-full p-2.5 pr-10 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded focus:outline-none cursor-pointer"
                      title={showRegPassword ? "Hide password" : "Show password"}
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-slate-950 hover:bg-slate-850 text-white font-bold rounded-lg text-xs uppercase tracking-wider font-mono shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-amber-400" />
                  Create Admin Account & Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

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
                  SMTP & Alert Center
                  {alerts.filter(a => a.status === 'unread').length > 0 && (
                    <span className="absolute right-3 bg-red-600 text-white font-extrabold text-[9px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
                      {alerts.filter(a => a.status === 'unread').length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            <div className="space-y-1">
              <span className="px-3 text-[10px] uppercase text-slate-500 font-bold tracking-wider font-mono font-bold">Intelligent Analytics</span>
              
              <nav className="space-y-1 mt-2">
                <button
                  id="tab-copilot"
                  onClick={() => { setActiveTab('copilot'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'copilot' 
                      ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <Sparkles className="h-4 w-4 text-yellow-500 shrink-0" />
                  Intelligent AI Copilot
                </button>

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
                {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{currentUser.name.split(' (')[0]}</p>
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

            {/* Active Administrator Indicator */}
            <button
              onClick={() => navigateToTab('profile')}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-lg p-1.5 px-3 border border-slate-200 transition-colors cursor-pointer"
              title="View Active Administrator Profile"
            >
              <UserIcon className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-bold text-slate-800">{currentUser.name.split(' (')[0]}</span>
              <span className="text-[9px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">Admin</span>
            </button>
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
