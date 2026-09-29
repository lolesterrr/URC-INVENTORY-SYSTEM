import React, { useState } from 'react';
import { api } from '../api';
import type { User } from '../types';
import { inputClass, labelClass } from './LoginPage';

/** Used both on the forced first-login screen and from the profile page. */
export default function ChangePasswordForm({ onChanged, onCancel }: { onChanged: (user: User) => void; onCancel?: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      onChanged(await api<User>('/api/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md font-semibold">{error}</div>
      )}
      <div>
        <label htmlFor="current-password" className={labelClass}>Current password</label>
        <input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="new-password" className={labelClass}>New password</label>
        <input id="new-password" type="password" autoComplete="new-password" required value={next} onChange={e => setNext(e.target.value)} className={inputClass} />
        <p className="text-[11px] text-slate-400 mt-1">At least 10 characters, mixing three of: lowercase, uppercase, digits, symbols.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className={labelClass}>Repeat new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold text-sm rounded-md hover:bg-slate-50">
            Cancel
          </button>
        )}
        <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-md">
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
