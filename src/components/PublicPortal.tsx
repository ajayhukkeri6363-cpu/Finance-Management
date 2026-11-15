import React, { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { ApiError, apiFetch, downloadCsv } from '../utils/apiClient';
import { formatCurrency, formatShortDate, statusBadgeClasses } from '../utils/format';
import { BudgetComparisonChart } from './Charts';
import { Pagination } from './Pagination';
import type { PublicBudgetSummary, PublicProjectSummary } from '../../shared/types';

interface PublicOverviewResponse {
  mode: 'mysql' | 'local-demo';
  fiscalYear: number | 'all';
  availableFiscalYears: number[];
  totals: {
    publishedBudget: number;
    publishedProjectExpenditure: number;
    publishedRemaining: number;
    publishedRevenue: number;
  };
  byDepartment: Array<{
    departmentName: string;
    publishedBudget: number;
    projectExpenditure: number;
  }>;
  projects: PublicProjectSummary[];
  budgets: PublicBudgetSummary[];
}

interface PublicPortalProps {
  onOpenAuth: () => void;
  isSignedIn: boolean;
  userRole?: string;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  onOpenAuth,
  isSignedIn,
  userRole,
}) => {
  const [fiscalYear, setFiscalYear] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<PublicOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsProductionSetup, setNeedsProductionSetup] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNeedsProductionSetup(false);
    apiFetch<PublicOverviewResponse>(`/api/public/overview?fiscalYear=${fiscalYear}`)
      .then((res) => {
        if (active) {
          setData(res);
          setPage(1);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 503) {
          setNeedsProductionSetup(true);
        } else {
          setError(err instanceof Error ? err.message : 'Unable to load public records.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fiscalYear]);

  const filteredProjects = (data?.projects ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.departmentName.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q)
    );
  });

  const pageSize = 5;
  const pagedProjects = filteredProjects.slice((page - 1) * pageSize, page * pageSize);

  const handleExport = async () => {
    try {
      await downloadCsv(
        `/api/public/reports/export?fiscalYear=${fiscalYear}`,
        `govtrack-public-projects-fy-${fiscalYear}.csv`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      {/* Intro & Controls */}
      <section className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 md:flex-row md:items-end">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-medium text-blue-700">
            Public Transparency Portal · Read-Only Published Records
          </p>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Published Public Budgets & Capital Projects
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Browse explicitly published demonstration budgets, project milestones, and approved public summaries. Internal notes, draft plans, and vendor contact records are withheld from public views.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="public-fy-select" className="sr-only">
              Filter by fiscal year
            </label>
            <select
              id="public-fy-select"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <option value="all">All Fiscal Years</option>
              {(data?.availableFiscalYears ?? [2026, 2025]).map((yr) => (
                <option key={yr} value={String(yr)}>
                  FY {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export Public CSV
          </button>

          {!isSignedIn && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              Sign In / Register
            </button>
          )}
          {isSignedIn && userRole === 'citizen' && (
            <span className="text-xs text-slate-600">
              Signed in as Citizen (public records only)
            </span>
          )}
        </div>
      </section>

      {needsProductionSetup && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 space-y-2"
        >
          <p className="font-semibold">Production MySQL 8 Configuration Required</p>
          <p>
            GovTrack AI is running in production mode and does not fall back to temporary in-memory data. Configure{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">MYSQL_HOST</code>,{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">MYSQL_PORT</code>,{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">MYSQL_USER</code>,{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">MYSQL_PASSWORD</code>,{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">MYSQL_DATABASE</code>, and{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">SESSION_SECRET</code>, then run{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">npm run db:migrate</code> and{' '}
            <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">npm run create-admin</code>.
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {/* KPI Row */}
      <section aria-label="Published financial summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Published Approved Budgets</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? '—' : formatCurrency(data?.totals.publishedBudget ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Explicitly published departmental funds</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Published Project Spending</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? '—' : formatCurrency(data?.totals.publishedProjectExpenditure ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Recorded against public projects</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Published Remaining Balance</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? '—' : formatCurrency(data?.totals.publishedRemaining ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Unspent published budget capacity</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Published Revenue Received</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? '—' : formatCurrency(data?.totals.publishedRevenue ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Verified public revenue summaries</p>
        </div>
      </section>

      {/* Chart + Published Budgets */}
      <section className="grid gap-6 lg:grid-cols-2">
        <BudgetComparisonChart
          title="Published Budget vs. Project Expenditure by Department"
          items={(data?.byDepartment ?? []).map((d) => ({
            label: d.departmentName,
            approvedBudget: d.publishedBudget,
            recordedExpenditure: d.projectExpenditure,
          }))}
          budgetLabel="Published Budget"
          spendLabel="Public Project Spend"
        />

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Published Departmental Budgets
            </h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="p-6 text-sm text-slate-500">Loading published budgets...</p>
            ) : (data?.budgets ?? []).length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No published budgets match the selected fiscal year.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-4 py-2.5 font-semibold">Budget & Department</th>
                    <th className="px-4 py-2.5 font-semibold">FY</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Approved</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Allocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.budgets.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{b.title}</div>
                        <div className="text-slate-500">{b.departmentName}</div>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                        {b.fiscalYear}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                        {formatCurrency(b.amount, b.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(b.allocatedAmount, b.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* Published Projects Table */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Published Public Projects
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredProjects.length} published project{filteredProjects.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="public-project-search" className="sr-only">
              Search published projects
            </label>
            <input
              id="public-project-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search title, department, location..."
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-blue-700"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading published projects...</p>
          ) : pagedProjects.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No published projects match your search criteria.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 font-semibold">Project & Location</th>
                  <th className="px-4 py-3 font-semibold">Department · FY</th>
                  <th className="px-4 py-3 font-semibold">Timeline</th>
                  <th className="px-4 py-3 font-semibold">Status & Progress</th>
                  <th className="px-4 py-3 text-right font-semibold">Approved Budget</th>
                  <th className="px-4 py-3 text-right font-semibold">Recorded Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedProjects.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">{p.title}</div>
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600">
                        {p.description}
                      </p>
                      <div className="mt-1 text-xs text-slate-500">{p.location}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      <div>{p.departmentName}</div>
                      <div className="mt-0.5 font-mono text-slate-500">FY {p.fiscalYear}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                      <div>{formatShortDate(p.startDate)}</div>
                      <div className="text-slate-400">to {formatShortDate(p.targetEndDate)}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClasses(
                          p.status
                        )}`}
                      >
                        {p.status}
                      </span>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded bg-slate-200">
                          <div
                            className="h-full bg-blue-700"
                            style={{ width: `${p.progressPercent}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs tabular-nums text-slate-700">
                          {p.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(p.approvedBudget)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(p.recordedExpenditure)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={filteredProjects.length}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
};
