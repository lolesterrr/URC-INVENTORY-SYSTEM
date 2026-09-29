import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import type { Permission, User } from '../types';
import ChangePasswordForm from './ChangePasswordForm';
import urcLogo from '../assets/images/company_logo.png';
import ugandaTrain from '../assets/images/uganda_train_1784095821816.jpg';

const PERMISSION_LABELS: Record<Permission, string> = {
  'assets:read': 'View inventory, dashboards and reports',
  'assets:write': 'Add and edit inventory records',
  'assets:delete': 'Archive inventory records',
  'alerts:manage': 'Resolve alerts and run inventory checks',
  'audit:read': 'View the change history',
  'users:manage': 'Manage user accounts',
  'backups:manage': 'Run and check database backups',
};

export default function ProfileView({ user, onUserChanged, onLogout }: { user: User; onUserChanged: (user: User) => void; onLogout: () => void }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);

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
            {user.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">{user.fullName}</h2>
            <p className="text-xs text-yellow-400 font-mono">{user.role} Authorization Status</p>
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
                <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">{user.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-slate-200">
                <span className="text-xs text-slate-400 font-semibold uppercase font-mono">Username:</span>
                <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">{user.username}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2">
                <span className="text-xs text-slate-400 font-semibold uppercase font-mono">Assigned Role:</span>
                <span className="text-xs text-slate-800 font-bold col-span-2 font-mono">{user.role}</span>
              </div>
            </div>
          </div>

          {/* Permissions granted by the server for this role */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">What your role can do</h3>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              {(Object.keys(PERMISSION_LABELS) as Permission[]).map(p => {
                const allowed = user.permissions.includes(p);
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
              onClick={onLogout}
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
}
