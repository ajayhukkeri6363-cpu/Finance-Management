import React, { useEffect, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import type { UserRecord } from '../../shared/types';

interface DemoAccountHint {
  label: string;
  email: string;
  password: string;
  role: string;
  departmentNote: string;
}

interface AuthModeResponse {
  mode: 'mysql' | 'local-demo';
  needsFirstAdmin: boolean;
  firstAdminTokenEnabled: boolean;
  demoAccounts: DemoAccountHint[];
}

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: UserRecord) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  onAuthenticated,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'setup'>('login');
  const [authInfo, setAuthInfo] = useState<AuthModeResponse | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    apiFetch<AuthModeResponse>('/api/auth/mode')
      .then((res) => {
        setAuthInfo(res);
        if (res.needsFirstAdmin && res.firstAdminTokenEnabled) {
          setTab('setup');
        }
      })
      .catch(() => {
        // ignore
      });
  }, [open]);

  if (!open) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ user: UserRecord }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ user: UserRecord }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ user: UserRecord }>('/api/auth/setup-first-admin', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, setupToken }),
      });
      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'First admin setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (hint: DemoAccountHint) => {
    setTab('login');
    setEmail(hint.email);
    setPassword(hint.password);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 id="auth-modal-title" className="text-base font-semibold text-slate-900">
              GovTrack AI Account Access
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign-in dialog"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mt-4 flex gap-1 rounded-md bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register Citizen
          </button>
          {authInfo?.needsFirstAdmin && (
            <button
              type="button"
              onClick={() => {
                setTab('setup');
                setError(null);
              }}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'setup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              First Admin Setup
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {error}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="mt-4 space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@govtrack.example"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>

            {authInfo?.mode === 'local-demo' && authInfo.demoAccounts.length > 0 && (
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-700">
                  Classroom Demo Accounts (Local Development Mode)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Select a fictional demonstration role to populate credentials for testing:
                </p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {authInfo.demoAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fillDemo(acc)}
                      className="rounded border border-slate-200 bg-slate-50 p-2 text-left hover:border-blue-300 hover:bg-blue-50/40"
                    >
                      <div className="text-xs font-medium text-slate-900">{acc.label}</div>
                      <div className="text-[11px] text-slate-500">{acc.departmentNote}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {authInfo?.needsFirstAdmin && !authInfo.firstAdminTokenEnabled && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                No administrator exists in MySQL yet. Run{' '}
                <code className="font-mono font-semibold">npm run create-admin</code> on the server to provision the first Admin account without a default password.
              </div>
            )}
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="mt-4 space-y-4">
            <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Public registration creates <strong>Citizen</strong> accounts only (browse published public records). Privileged internal roles are assigned exclusively by an Administrator.
            </p>
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700">
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700">
                Password (minimum 8 characters)
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Creating Account...' : 'Create Citizen Account'}
            </button>
          </form>
        )}

        {tab === 'setup' && authInfo?.needsFirstAdmin && (
          <form onSubmit={handleSetupAdmin} className="mt-4 space-y-4">
            <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              One-time setup for the initial MySQL Administrator. Requires the server&apos;s <code className="font-mono">FIRST_ADMIN_SETUP_TOKEN</code>.
            </p>
            <div>
              <label htmlFor="setup-token" className="block text-xs font-medium text-slate-700">
                Setup Token
              </label>
              <input
                id="setup-token"
                type="password"
                required
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="setup-name" className="block text-xs font-medium text-slate-700">
                Administrator Name
              </label>
              <input
                id="setup-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="setup-email" className="block text-xs font-medium text-slate-700">
                Administrator Email
              </label>
              <input
                id="setup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="setup-password" className="block text-xs font-medium text-slate-700">
                Password (minimum 10 characters)
              </label>
              <input
                id="setup-password"
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Provisioning...' : 'Create First Administrator'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
