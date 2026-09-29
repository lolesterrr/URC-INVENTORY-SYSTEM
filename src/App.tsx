import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, SESSION_EXPIRED_EVENT } from './api';
import type { User } from './types';
import LoginPage from './components/LoginPage';
import AuthLayout from './components/AuthLayout';
import ChangePasswordForm from './components/ChangePasswordForm';
import MainApp from './MainApp';

/** Decides which screen to show based on the server-side session. */
export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api<User>('/api/auth/me').then(setUser).catch(() => setUser(null));
    const expired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, []);

  if (user === undefined) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500 gap-2">
        <RefreshCw className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (user === null) return <LoginPage onLogin={setUser} />;

  if (user.mustChangePassword) {
    return (
      <AuthLayout title="Choose a new password" subtitle={`Welcome, ${user.fullName}. Replace your temporary password to continue.`}>
        <ChangePasswordForm onChanged={setUser} onCancel={() => api('/api/auth/logout', { method: 'POST' }).finally(() => setUser(null))} />
      </AuthLayout>
    );
  }

  return <MainApp currentUser={user} onLogout={() => setUser(null)} onUserChanged={setUser} />;
}
