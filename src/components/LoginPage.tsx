import React, { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { api } from '../api';
import type { User } from '../types';
import AuthLayout from './AuthLayout';

export const inputClass =
  'w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500';
export const labelClass = 'block text-xs font-bold text-slate-600 uppercase tracking-wider font-mono mb-1.5';

export default function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      onLogin(await api<User>('/api/auth/login', { method: 'POST', body: { username, password } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="URC IT Asset Register" subtitle="Sign in with your staff account">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md font-semibold">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="username" className={labelClass}>Username</label>
          <input
            id="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={e => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-md transition-colors"
        >
          <LogIn className="h-4 w-4" />
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-[11px] text-slate-400 text-center">
          No account, or forgot your password? Ask the system Admin in the ICT department.
        </p>
      </form>
    </AuthLayout>
  );
}
