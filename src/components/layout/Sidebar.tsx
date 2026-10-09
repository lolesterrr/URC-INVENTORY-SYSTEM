import type { LucideIcon } from 'lucide-react';
import { BellRing, BookOpen, Building2, DatabaseBackup, FileSpreadsheet, LayoutDashboard, ScanLine, User as UserIcon, Users, X } from 'lucide-react';
import type { Permission, User } from '../../types';
import urcLogo from '../../assets/images/company_logo.png';

export type AppTab = 'dashboard' | 'inventory' | 'directory' | 'barcode' | 'notifications' | 'users' | 'backups' | 'docs' | 'profile';

interface NavItem {
  id: AppTab;
  label: string;
  icon: LucideIcon;
  /** Hidden unless the signed-in user has this permission. */
  permission?: Permission;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operations Portal',
    items: [
      { id: 'dashboard', label: 'Management Dashboard', icon: LayoutDashboard },
      { id: 'inventory', label: 'Inventory Registers', icon: FileSpreadsheet },
      { id: 'directory', label: 'Departments, Locations & Staff', icon: Building2 },
      { id: 'barcode', label: 'Barcode Scan Center', icon: ScanLine },
      { id: 'notifications', label: 'Alert Center', icon: BellRing },
    ],
  },
  {
    title: 'Administration',
    items: [
      { id: 'users', label: 'User Accounts', icon: Users, permission: 'users:manage' },
      { id: 'backups', label: 'Backups', icon: DatabaseBackup, permission: 'backups:manage' },
      { id: 'docs', label: 'Operational User Guide', icon: BookOpen },
    ],
  },
  { title: 'My Account', items: [{ id: 'profile', label: 'Account Profile', icon: UserIcon }] },
];

export default function Sidebar({
  user,
  activeTab,
  unreadAlerts,
  open,
  onNavigate,
  onClose,
}: {
  user: User;
  activeTab: AppTab;
  unreadAlerts: number;
  open: boolean;
  onNavigate: (tab: AppTab) => void;
  onClose: () => void;
}) {
  const initials = user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <aside
      className={`bg-slate-900 text-slate-300 w-64 flex flex-col justify-between fixed lg:static inset-y-0 left-0 transform ${
        open ? 'translate-x-0' : '-translate-x-full hidden'
      } lg:translate-x-0 lg:flex z-30 transition-transform duration-300 shrink-0 border-r border-slate-950`}
    >
      <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
        <div className="p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={urcLogo} alt="URC logo" className="h-8 w-8 object-contain rounded-full bg-white p-0.5" />
              <h1 className="text-lg font-bold tracking-tighter text-yellow-500">
                URC <span className="text-white font-normal">IT ASSETS</span>
              </h1>
            </div>
            {open && (
              <button onClick={onClose} aria-label="Close menu" className="text-slate-400 hover:text-white lg:hidden">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-1.5 font-mono">Uganda Railways Corporation</p>
        </div>

        <div className="p-4 flex-1 space-y-6">
          {SECTIONS.map(section => (
            <div key={section.title} className="space-y-1">
              <span className="px-3 text-[10px] uppercase text-slate-500 font-bold tracking-wider font-mono">{section.title}</span>
              <nav className="space-y-1 mt-2">
                {section.items
                  .filter(item => !item.permission || user.permissions.includes(item.permission))
                  .map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      id={`tab-${id}`}
                      onClick={() => onNavigate(id)}
                      aria-current={activeTab === id ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-6 py-2 text-xs font-medium transition-all relative cursor-pointer ${
                        activeTab === id
                          ? 'bg-slate-800 text-yellow-400 border-l-4 border-yellow-500 font-bold'
                          : 'hover:bg-slate-800 hover:text-white text-slate-400'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                      {id === 'notifications' && unreadAlerts > 0 && (
                        <span className="absolute right-3 bg-red-600 text-white text-[9px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center font-bold">
                          {unreadAlerts}
                        </span>
                      )}
                    </button>
                  ))}
              </nav>
            </div>
          ))}
        </div>

        <button
          onClick={() => onNavigate('profile')}
          className="p-4 bg-slate-950 hover:bg-slate-900 cursor-pointer shrink-0 border-t border-slate-800 transition-colors text-left"
          title="Open your account profile"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow shrink-0">{initials}</div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
              <p className="text-[10px] text-slate-500 italic truncate font-mono">{user.role}</p>
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}
