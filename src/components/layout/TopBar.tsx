import { BellRing, Menu, ScanLine, Shield, User as UserIcon } from 'lucide-react';
import type { User } from '../../types';
import type { AppTab } from './Sidebar';

export function TopBar({
  user,
  unreadAlerts,
  onToggleMenu,
  onNavigate,
  onLogout,
}: {
  user: User;
  unreadAlerts: number;
  onToggleMenu: () => void;
  onNavigate: (tab: AppTab) => void;
  onLogout: () => void;
}) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-xs">
      <div className="flex items-center gap-4">
        <button onClick={onToggleMenu} aria-label="Toggle menu" className="p-1.5 hover:bg-slate-100 rounded-lg lg:hidden text-slate-600 transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={() => onNavigate('barcode')}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded flex items-center gap-2 transition-colors shadow-xs"
        >
          <ScanLine className="h-3.5 w-3.5 text-yellow-400" />
          <span>Scan Barcode</span>
        </button>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <button onClick={() => onNavigate('notifications')} className="flex items-center gap-2 hover:bg-slate-50 p-1.5 px-2.5 rounded-lg transition-all">
          <span className="relative">
            <BellRing className="w-4 h-4 text-slate-500" />
            {unreadAlerts > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </span>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter hidden sm:inline">{unreadAlerts} Alerts</span>
        </button>

        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <Shield className="h-3.5 w-3.5 text-yellow-600" />
          <span>Role:</span>
          <span className="font-extrabold text-slate-800 uppercase tracking-tight">{user.role}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-lg p-1.5 px-3 border border-slate-200 transition-colors cursor-pointer"
            title="Open your account profile"
          >
            <UserIcon className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-bold text-slate-800">{user.fullName}</span>
          </button>
          <button
            onClick={onLogout}
            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

/** Bottom bar: shows whether the last load from the server worked, and when. */
export function StatusBar({ lastLoadedAt, loadError }: { lastLoadedAt: Date | null; loadError: string | null }) {
  return (
    <footer className="h-8 bg-slate-100 border-t border-slate-200 flex items-center px-6 justify-between shrink-0 text-slate-500 z-10 font-mono">
      <div className="flex items-center gap-4 text-[9px] uppercase font-bold">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${loadError ? 'bg-red-500' : 'bg-green-500'}`} />
          {loadError ? 'Server not reachable' : 'Connected'}
        </span>
        {lastLoadedAt && (
          <>
            <span className="text-slate-300">|</span>
            <span>Last updated: {lastLoadedAt.toLocaleTimeString()}</span>
          </>
        )}
      </div>
      <p className="text-[9px] font-medium tracking-tight hidden sm:block">© {new Date().getFullYear()} Uganda Railways Corporation IT Department</p>
    </footer>
  );
}
