/**
 * Signed-in shell: sidebar, top bar and the active screen. Data loading lives in useInventoryData.
 */
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from './api';
import type { User } from './types';
import { useInventoryData } from './hooks/useInventoryData';
import Sidebar, { type AppTab } from './components/layout/Sidebar';
import { StatusBar, TopBar } from './components/layout/TopBar';
import DashboardView from './components/DashboardView';
import InventoryTables from './components/InventoryTables';
import type { InventoryTab } from './components/inventory/model';
import BarcodeScanner from './components/BarcodeScanner';
import NotificationCenter from './components/NotificationCenter';
import HelpGuide from './components/HelpGuide';
import UserManagement from './components/UserManagement';
import BackupManagement from './components/BackupManagement';
import ProfileView from './components/ProfileView';

interface MainAppProps {
  currentUser: User;
  onLogout: () => void;
  onUserChanged: (user: User) => void;
}

const INVENTORY_TABS: readonly string[] = ['hardware', 'software', 'servers'] satisfies InventoryTab[];

export default function MainApp({ currentUser, onLogout, onUserChanged }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>('hardware');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const data = useInventoryData();
  const { actions } = data;
  const unreadAlerts = data.alerts.filter(a => a.status === 'unread').length;

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      onLogout();
    }
  };

  const navigate = (tab: AppTab) => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  // The dashboard links straight to a register as well as to other screens.
  const navigateFromDashboard = (tab: string) => {
    if (INVENTORY_TABS.includes(tab)) {
      setInventoryTab(tab as InventoryTab);
      navigate('inventory');
    } else {
      navigate(tab as AppTab);
    }
  };

  // Screens that don't show their own errors report them in the banner.
  const reportErrors = (action: () => Promise<void>) => async () => {
    try {
      setNotice(null);
      await action();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'The action failed.');
    }
  };
  const runAlertChecks = reportErrors(actions.runAlertChecks);
  const resolveAlert = (id: string) => reportErrors(() => actions.resolveAlert(id))();

  const can = (permission: 'users:manage' | 'backups:manage') => currentUser.permissions.includes(permission);
  const noAccess = <div>You do not have access to this page.</div>;

  const renderContent = () => {
    if (data.isLoading) {
      return (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading the inventory…</p>
        </div>
      );
    }
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            stats={data.stats}
            auditLogs={data.auditLogs}
            hardware={data.hardware}
            software={data.software}
            onRefresh={data.refresh}
            currentUserRole={currentUser.role}
            onNavigateTo={navigateFromDashboard}
            triggerAlertCheck={runAlertChecks}
          />
        );
      case 'inventory':
        return (
          <InventoryTables
            hardware={data.hardware}
            software={data.software}
            serverComponents={data.serverComponents}
            currentUserRole={currentUser.role}
            permissions={currentUser.permissions}
            username={currentUser.username}
            onAddHardware={actions.addHardware}
            onUpdateHardware={actions.updateHardware}
            onDeleteHardware={actions.deleteHardware}
            onChangeLifecycle={actions.changeLifecycle}
            onAddSoftware={actions.addSoftware}
            onUpdateSoftware={actions.updateSoftware}
            onDeleteSoftware={actions.deleteSoftware}
            onAddServerComponent={actions.addServerComponent}
            onUpdateServerComponent={actions.updateServerComponent}
            onDeleteServerComponent={actions.deleteServerComponent}
            selectedSubTab={inventoryTab}
            setSelectedSubTab={setInventoryTab}
          />
        );
      case 'barcode':
        return <BarcodeScanner hardware={data.hardware} currentUserRole={currentUser.role} onUpdateHardware={actions.updateHardware} onChangeLifecycle={actions.changeLifecycle} />;
      case 'notifications':
        return (
          <NotificationCenter
            alerts={data.alerts}
            onResolveAlert={resolveAlert}
            onTriggerAlertCheck={runAlertChecks}
            currentUserRole={currentUser.role}
          />
        );
      case 'users':
        return can('users:manage') ? <UserManagement currentUserId={currentUser.id} /> : noAccess;
      case 'backups':
        return can('backups:manage') ? <BackupManagement /> : noAccess;
      case 'docs':
        return <HelpGuide />;
      case 'profile':
        return <ProfileView user={currentUser} onUserChanged={onUserChanged} onLogout={handleLogout} />;
    }
  };

  return (
    <div id="urc-app-root" className="h-screen w-screen bg-slate-100 font-sans text-slate-800 flex overflow-hidden">
      <Sidebar
        user={currentUser}
        activeTab={activeTab}
        unreadAlerts={unreadAlerts}
        open={menuOpen}
        onNavigate={navigate}
        onClose={() => setMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopBar
          user={currentUser}
          unreadAlerts={unreadAlerts}
          onToggleMenu={() => setMenuOpen(o => !o)}
          onNavigate={navigate}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-6 no-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {(notice || data.loadError) && (
              <div role="alert" className="p-3 text-xs rounded-md font-semibold border bg-red-50 border-red-200 text-red-700 flex justify-between gap-4">
                <span>{notice ?? `Could not load the latest data: ${data.loadError}`}</span>
                <button onClick={() => (notice ? setNotice(null) : data.refresh())} className="underline shrink-0">
                  {notice ? 'Dismiss' : 'Try again'}
                </button>
              </div>
            )}
            {renderContent()}
          </div>
        </div>

        <StatusBar lastLoadedAt={data.lastLoadedAt} loadError={data.loadError} />
      </div>
    </div>
  );
}
