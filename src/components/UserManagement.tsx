import React, { useEffect, useState } from 'react';
import { KeyRound, RefreshCw, UserPlus } from 'lucide-react';
import { api } from '../api';
import { UserRole, type ManagedUser } from '../types';
import { inputClass, labelClass } from './LoginPage';

const ROLE_HELP: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Everything, plus accounts, backups and settings.',
  [UserRole.IT_OFFICER]: 'Add, edit and archive inventory; resolve alerts.',
  [UserRole.MANAGER]: 'View everything and reports. No editing.',
  [UserRole.AUDITOR]: 'Read-only, including the full change history.',
};

const emptyForm = { username: '', fullName: '', role: UserRole.IT_OFFICER, temporaryPassword: '' };

export default function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setUsers(await api<ManagedUser[]>('/api/users'));
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not load users.' });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: success });
      await load();
      return true;
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Action failed.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(
      () => api('/api/users', { method: 'POST', body: form }),
      `Account "${form.username}" created. Give them the temporary password; they must change it at first sign-in.`,
    );
    if (ok) setForm(emptyForm);
  };

  const resetPassword = (u: ManagedUser) => {
    const temporaryPassword = window.prompt(`New temporary password for ${u.username} (min. 10 characters):`);
    if (!temporaryPassword) return;
    run(
      () => api(`/api/users/${u.id}/reset-password`, { method: 'POST', body: { temporaryPassword } }),
      `Password reset for "${u.username}". They must change it at next sign-in.`,
    );
  };

  const update = (u: ManagedUser, body: Partial<Pick<ManagedUser, 'role' | 'disabled'>>, text: string) =>
    run(() => api(`/api/users/${u.id}`, { method: 'PATCH', body }), text);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">User accounts</h2>
          <p className="text-xs text-slate-500">Only Admins can see this page. Accounts are never deleted, only disabled, so the change history stays intact.</p>
        </div>
        <button onClick={load} className="p-2 text-slate-500 hover:text-slate-900" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {message && (
        <div role="status" className={`p-3 text-xs rounded-md font-semibold border ${message.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px]">
            <tr>
              <th className="text-left p-3">Username</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Last sign-in</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="p-3 font-mono font-bold">{u.username}</td>
                <td className="p-3">{u.fullName}</td>
                <td className="p-3">
                  <select
                    value={u.role}
                    disabled={busy || u.id === currentUserId}
                    onChange={e => update(u, { role: e.target.value as UserRole }, `Role for "${u.username}" changed to ${e.target.value}.`)}
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1"
                  >
                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  {u.disabled ? <span className="text-red-600 font-bold">Disabled</span>
                    : u.locked ? <span className="text-amber-600 font-bold">Locked</span>
                    : u.mustChangePassword ? <span className="text-slate-500">Awaiting first sign-in</span>
                    : <span className="text-green-700 font-bold">Active</span>}
                </td>
                <td className="p-3 text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <button disabled={busy} onClick={() => resetPassword(u)} className="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded hover:bg-slate-50">
                    <KeyRound className="h-3 w-3" /> Reset password
                  </button>
                  {u.id !== currentUserId && (
                    <button
                      disabled={busy}
                      onClick={() => update(u, { disabled: !u.disabled }, `Account "${u.username}" ${u.disabled ? 'enabled' : 'disabled'}.`)}
                      className={`px-2 py-1 rounded border ${u.disabled ? 'border-green-300 text-green-700' : 'border-red-200 text-red-600'} hover:bg-slate-50`}
                    >
                      {u.disabled ? 'Enable' : 'Disable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={createUser} className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <h3 className="md:col-span-2 flex items-center gap-2 font-bold text-slate-900 text-sm">
          <UserPlus className="h-4 w-4" /> New account
        </h3>
        <div>
          <label htmlFor="nu-username" className={labelClass}>Username</label>
          <input id="nu-username" required placeholder="e.g. j.okello" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label htmlFor="nu-name" className={labelClass}>Full name</label>
          <input id="nu-name" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label htmlFor="nu-role" className={labelClass}>Role</label>
          <select id="nu-role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })} className={inputClass}>
            {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">{ROLE_HELP[form.role]}</p>
        </div>
        <div>
          <label htmlFor="nu-password" className={labelClass}>Temporary password</label>
          <input id="nu-password" required type="text" autoComplete="off" value={form.temporaryPassword} onChange={e => setForm({ ...form, temporaryPassword: e.target.value })} className={inputClass} />
          <p className="text-[11px] text-slate-400 mt-1">They will be asked to change it at first sign-in.</p>
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={busy} className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-md">
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}
