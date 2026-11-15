import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  DollarSign,
  FileSpreadsheet,
  FolderKanban,
  Globe,
  History,
  LogIn,
  LogOut,
  Menu,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { apiFetch } from './utils/apiClient';
import { formatRoleLabel } from './utils/format';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { PublicPortal } from './components/PublicPortal';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { DepartmentsView } from './components/DepartmentsView';
import { BudgetsView } from './components/BudgetsView';
import { ProjectsView } from './components/ProjectsView';
import { ExpendituresView } from './components/ExpendituresView';
import { RevenuesView } from './components/RevenuesView';
import { ProcurementView } from './components/ProcurementView';
import { ReportsView } from './components/ReportsView';
import { ReviewFlagsView } from './components/ReviewFlagsView';
import { AuditTrailView } from './components/AuditTrailView';
import { UsersView } from './components/UsersView';
import type { UserRecord } from '../shared/types';

type NavTab =
  | 'public'
  | 'dashboard'
  | 'departments'
  | 'budgets'
  | 'projects'
  | 'expenditures'
  | 'revenues'
  | 'procurement'
  | 'reports'
  | 'review-flags'
  | 'audit-logs'
  | 'users';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [storageMode, setStorageMode] = useState<'mysql' | 'local-demo' | 'mysql-unconfigured' | undefined>(undefined);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('public');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ user: UserRecord | null }>('/api/auth/me'),
      apiFetch<{ mode: 'mysql' | 'local-demo' }>('/api/auth/mode'),
    ])
      .then(([meRes, modeRes]) => {
        setCurrentUser(meRes.user);
        setStorageMode(modeRes.mode);
        if (meRes.user && meRes.user.role !== 'citizen') {
          setActiveTab('dashboard');
        }
      })
      .catch((err) => {
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 503) {
          setStorageMode('mysql-unconfigured');
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const handleAuthenticated = (user: UserRecord) => {
    setCurrentUser(user);
    if (user.role === 'citizen') {
      setActiveTab('public');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setCurrentUser(null);
      setActiveTab('public');
      setMobileMenuOpen(false);
    }
  };

  const isInternalUser = Boolean(currentUser && currentUser.role !== 'citizen');

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
    section: 'public' | 'internal';
  }> = [
    {
      id: 'public',
      label: 'Public Portal',
      icon: Globe,
      visible: true,
      section: 'public',
    },
    {
      id: 'dashboard',
      label: 'Budget Dashboard',
      icon: BarChart3,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'departments',
      label: 'Departments',
      icon: Building2,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'budgets',
      label: 'Budgets & Allocations',
      icon: Wallet,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderKanban,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'expenditures',
      label: 'Expenditure Ledger',
      icon: ClipboardList,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'revenues',
      label: 'Revenues',
      icon: DollarSign,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'procurement',
      label: 'Procurement & Vendors',
      icon: Briefcase,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'reports',
      label: 'Reports & CSV',
      icon: FileSpreadsheet,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'review-flags',
      label: 'Review Indicators',
      icon: AlertCircle,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'audit-logs',
      label: 'Audit Trail',
      icon: History,
      visible: isInternalUser,
      section: 'internal',
    },
    {
      id: 'users',
      label: 'Users & Roles',
      icon: Users,
      visible: currentUser?.role === 'admin',
      section: 'internal',
    },
  ];

  const visibleNav = navItems.filter((item) => item.visible);

  const selectTab = (id: NavTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <DisclaimerBanner mode={storageMode} />

      {/* Top Navigation Bar (clean 3-zone contract) */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3 shrink-0">
            {isInternalUser && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle navigation menu"
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => selectTab(isInternalUser ? 'dashboard' : 'public')}
              className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              GovTrack AI
            </button>
          </div>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex"
          >
            <button
              type="button"
              onClick={() => selectTab('public')}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'public'
                  ? 'text-blue-700 underline underline-offset-4'
                  : 'hover:text-slate-900'
              }`}
            >
              Public Portal
            </button>
            {isInternalUser && (
              <>
                <button
                  type="button"
                  onClick={() => selectTab('dashboard')}
                  className={`whitespace-nowrap shrink-0 transition-colors ${
                    activeTab === 'dashboard'
                      ? 'text-blue-700 underline underline-offset-4'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Internal Workspace
                </button>
                <button
                  type="button"
                  onClick={() => selectTab('reports')}
                  className={`whitespace-nowrap shrink-0 transition-colors ${
                    activeTab === 'reports'
                      ? 'text-blue-700 underline underline-offset-4'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Reports
                </button>
                <button
                  type="button"
                  onClick={() => selectTab('review-flags')}
                  className={`whitespace-nowrap shrink-0 transition-colors ${
                    activeTab === 'review-flags'
                      ? 'text-blue-700 underline underline-offset-4'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Review Flags
                </button>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {authLoading ? (
              <span className="text-xs text-slate-400">Checking session...</span>
            ) : currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <div className="text-xs font-semibold text-slate-900">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {formatRoleLabel(currentUser.role)}
                    {currentUser.departmentName ? ` · ${currentUser.departmentName}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {!isInternalUser || activeTab === 'public' ? (
        <main className="flex-1">
          {isInternalUser && (
            <div className="border-b border-slate-200 bg-slate-100/70 px-4 py-2 sm:px-6">
              <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-slate-600">
                <span>
                  Viewing the <strong>Public Transparency Portal</strong> (publicly published records only).
                </span>
                <button
                  type="button"
                  onClick={() => selectTab('dashboard')}
                  className="font-medium text-blue-700 hover:underline"
                >
                  Return to Internal Workspace
                </button>
              </div>
            </div>
          )}
          <PublicPortal
            onOpenAuth={() => setAuthModalOpen(true)}
            isSignedIn={Boolean(currentUser)}
            userRole={currentUser?.role}
          />
        </main>
      ) : (
        <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
          {/* Desktop Sidebar */}
          <aside
            aria-label="Internal workspace navigation"
            className="hidden w-60 shrink-0 lg:block"
          >
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="px-3 pb-2 text-[11px] font-semibold text-slate-400">
                Internal Management
              </p>
              <ul className="space-y-1">
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectTab(item.id)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-blue-50 text-blue-800'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 flex lg:hidden">
              <div
                className="fixed inset-0 bg-slate-950/40"
                onClick={() => setMobileMenuOpen(false)}
              />
              <aside className="relative z-50 w-64 bg-white p-4 shadow-xl">
                <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="font-display text-sm font-bold text-slate-900">
                    Workspace Menu
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close navigation menu"
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <ul className="space-y-1">
                  {visibleNav.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => selectTab(item.id)}
                          className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                            active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            </div>
          )}

          {/* Main Workspace Content */}
          <main className="min-w-0 flex-1">
            {activeTab === 'dashboard' && (
              <DashboardView onNavigate={(t) => selectTab(t as NavTab)} />
            )}
            {activeTab === 'departments' && currentUser && (
              <DepartmentsView userRole={currentUser.role} />
            )}
            {activeTab === 'budgets' && currentUser && <BudgetsView currentUser={currentUser} />}
            {activeTab === 'projects' && currentUser && <ProjectsView currentUser={currentUser} />}
            {activeTab === 'expenditures' && currentUser && (
              <ExpendituresView currentUser={currentUser} />
            )}
            {activeTab === 'revenues' && currentUser && <RevenuesView currentUser={currentUser} />}
            {activeTab === 'procurement' && currentUser && (
              <ProcurementView currentUser={currentUser} />
            )}
            {activeTab === 'reports' && currentUser && <ReportsView currentUser={currentUser} />}
            {activeTab === 'review-flags' && currentUser && (
              <ReviewFlagsView currentUser={currentUser} />
            )}
            {activeTab === 'audit-logs' && <AuditTrailView />}
            {activeTab === 'users' && currentUser?.role === 'admin' && <UsersView />}
          </main>
        </div>
      )}

      {/* Footer Notice */}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <span>
            GovTrack AI — Student Mini Project for Public Finance Transparency & Expenditure Tracking.
          </span>
          <span>
            Disclaimer: Fictional demonstration data only. Not an official government portal.
          </span>
        </div>
      </footer>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
