import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { apiFetch, downloadCsv } from '../utils/apiClient';
import { formatCurrency, statusBadgeClasses } from '../utils/format';
import { BudgetComparisonChart, CategoryBreakdownChart } from './Charts';
import type { Department, Procurement, Revenue, UserRecord } from '../../shared/types';

interface ProjectVarianceRow {
  id: number;
  fiscalYear: number;
  departmentId: number;
  departmentName: string;
  title: string;
  status: string;
  isPublic: boolean;
  approvedBudget: number;
  recordedExpenditure: number;
  variance: number;
  utilizationPct: number;
}

interface ReportsResponse {
  fiscalYear: number | 'all';
  departmentId: number | null;
  projectVariance: ProjectVarianceRow[];
  revenues: Revenue[];
  procurements: Procurement[];
}

interface ReportsViewProps {
  currentUser: UserRecord;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUser }) => {
  const [fiscalYear, setFiscalYear] = useState<string>('2026');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [exportType, setExportType] = useState<'projects' | 'revenues' | 'procurements'>('projects');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [report, setReport] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ departments: Department[] }>('/api/departments')
      .then((res) => setDepartments(res.departments.filter((d) => !d.isArchived)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ fiscalYear });
    if (departmentId) params.set('departmentId', departmentId);

    apiFetch<ReportsResponse>(`/api/reports?${params.toString()}`)
      .then((res) => {
        if (active) setReport(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to generate report.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fiscalYear, departmentId]);

  const handleExport = async () => {
    const params = new URLSearchParams({ fiscalYear, type: exportType });
    if (departmentId) params.set('departmentId', departmentId);
    try {
      await downloadCsv(
        `/api/reports/export?${params.toString()}`,
        `govtrack-${exportType}-fy-${fiscalYear}.csv`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    }
  };

  const revenueByCat = (report?.revenues ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = Math.round(((acc[r.category] ?? 0) + r.amount) * 100) / 100;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Financial Reports & CSV Exports
          </h1>
          <p className="text-xs text-slate-500">
            Filtered budget-to-actual project variance, revenue composition, and procurement status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Report fiscal year"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All Fiscal Years</option>
            <option value="2026">FY 2026</option>
            <option value="2025">FY 2025</option>
          </select>

          {currentUser.role !== 'department_staff' && (
            <select
              aria-label="Report department filter"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          <select
            aria-label="CSV export dataset"
            value={exportType}
            onChange={(e) =>
              setExportType(e.target.value as 'projects' | 'revenues' | 'procurements')
            }
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="projects">Export: Projects vs Budget</option>
            <option value="revenues">Export: Revenues</option>
            <option value="procurements">Export: Procurements</option>
          </select>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download CSV
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <BudgetComparisonChart
          title="Project Approved Budget vs. Recorded Expenditure"
          items={(report?.projectVariance ?? []).map((p) => ({
            label: p.title.length > 26 ? `${p.title.slice(0, 26)}…` : p.title,
            approvedBudget: p.approvedBudget,
            recordedExpenditure: p.recordedExpenditure,
          }))}
        />
        <CategoryBreakdownChart
          title="Revenue Distribution by Category"
          items={Object.entries(revenueByCat).map(([category, total]) => ({ category, total }))}
        />
      </div>

      {/* Project Variance Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Project Expenditure vs. Budget Report
          </h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Generating report...</p>
          ) : (report?.projectVariance ?? []).length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No projects match the selected filters.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-semibold">Project</th>
                  <th className="px-4 py-3 font-semibold">Department · FY</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Approved</th>
                  <th className="px-4 py-3 text-right font-semibold">Expenditure</th>
                  <th className="px-4 py-3 text-right font-semibold">Remaining</th>
                  <th className="px-4 py-3 text-right font-semibold">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report?.projectVariance.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.departmentName} · FY {p.fiscalYear}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-medium capitalize ${statusBadgeClasses(
                          p.status
                        )}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(p.approvedBudget)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(p.recordedExpenditure)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(p.variance)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {p.utilizationPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Procurement Status Report */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Procurement Status Summary</h2>
        </div>
        <div className="overflow-x-auto">
          {(report?.procurements ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No procurement records match the selected filters.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-2.5 font-semibold">Reference</th>
                  <th className="px-4 py-2.5 font-semibold">Contract Title</th>
                  <th className="px-4 py-2.5 font-semibold">Vendor</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Estimated</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Awarded</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report?.procurements.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-slate-700">{pr.referenceNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{pr.title}</td>
                    <td className="px-4 py-3 text-slate-600">{pr.vendorName ?? 'Unassigned'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(pr.estimatedAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                      {pr.awardedAmount !== null ? formatCurrency(pr.awardedAmount) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-medium capitalize ${statusBadgeClasses(
                          pr.status
                        )}`}
                      >
                        {pr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
