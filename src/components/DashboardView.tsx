import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import { formatCurrency } from '../utils/format';
import { BudgetComparisonChart, CategoryBreakdownChart } from './Charts';
import type { DashboardSummary, ReviewFlagRecord } from '../../shared/types';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [fiscalYear, setFiscalYear] = useState<string>('2026');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [flags, setFlags] = useState<ReviewFlagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<DashboardSummary>(`/api/dashboard?fiscalYear=${fiscalYear}`),
      apiFetch<{ flags: ReviewFlagRecord[] }>('/api/review-flags'),
    ])
      .then(([dash, flagRes]) => {
        if (active) {
          setSummary(dash);
          setFlags(flagRes.flags);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fiscalYear]);

  const unreviewedFlags = flags.filter((f) => !f.isReviewed);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Budget & Fiscal Dashboard
          </h1>
          <p className="text-xs text-slate-500">
            Department allocations, recorded expenditure, remaining balances, and revenue
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="dash-fy-select" className="text-xs font-medium text-slate-600">
            Fiscal Year
          </label>
          <select
            id="dash-fy-select"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
          >
            <option value="all">All Fiscal Years</option>
            {(summary?.availableFiscalYears ?? [2026, 2025]).map((yr) => (
              <option key={yr} value={String(yr)}>
                FY {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Approved Budget</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? '—' : formatCurrency(summary?.totalApprovedBudget ?? 0)}
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-slate-500">
            Allocated to projects: {loading ? '—' : formatCurrency(summary?.totalAllocatedToProjects ?? 0)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Recorded Expenditure</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? '—' : formatCurrency(summary?.totalRecordedExpenditure ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Non-archived ledger entries</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Remaining Budget</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? '—' : formatCurrency(summary?.remainingApprovedBudget ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Approved minus recorded spend</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Recorded Revenue</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? '—' : formatCurrency(summary?.totalRevenue ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Received revenue entries</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BudgetComparisonChart
          title="Approved Budget vs. Recorded Expenditure by Department"
          items={(summary?.byDepartment ?? []).map((d) => ({
            label: d.departmentName,
            approvedBudget: d.approvedBudget,
            recordedExpenditure: d.recordedExpenditure,
          }))}
        />
        <CategoryBreakdownChart
          title="Recorded Expenditure by Category"
          items={summary?.expenditureByCategory ?? []}
        />
      </div>

      {/* Department Summary Table & Review Indicator Summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Department Financial Standing</h2>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Open Full Reports
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Approved</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Allocated</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Expenditure</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(summary?.byDepartment ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No department data available for this fiscal year.
                    </td>
                  </tr>
                ) : (
                  summary?.byDepartment.map((d) => (
                    <tr key={d.departmentId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{d.departmentName}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                        {formatCurrency(d.approvedBudget)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(d.allocatedToProjects)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                        {formatCurrency(d.recordedExpenditure)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                        {formatCurrency(d.remainingBudget)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Spending Review Indicators</h2>
            <button
              type="button"
              onClick={() => onNavigate('review-flags')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              Review All ({flags.length})
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Transparent rule-based indicators requiring human verification (not proof of fraud).
          </p>
          <div className="mt-4 space-y-3">
            {unreviewedFlags.length === 0 ? (
              <p className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                All active rule indicators have been reviewed.
              </p>
            ) : (
              unreviewedFlags.slice(0, 4).map((f) => (
                <div key={f.id} className="rounded border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-900">{f.ruleTitle}</div>
                  <div className="mt-1 text-[11px] text-slate-600">{f.departmentName}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-700">{f.metricSummary}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
