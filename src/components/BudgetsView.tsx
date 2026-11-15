import React, { useEffect, useState } from 'react';
import { Archive, CheckCircle2, Plus } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { formatCurrency, statusBadgeClasses } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';
import type { Budget, Department, Project, ProjectAllocation, UserRecord } from '../../shared/types';

interface EnrichedBudget extends Budget {
  allocatedAmount: number;
  remainingAllocatable: number;
}

interface EnrichedAllocation extends ProjectAllocation {
  budgetTitle: string;
  departmentId: number;
  fiscalYear: number;
  projectTitle: string;
}

interface BudgetsViewProps {
  currentUser: UserRecord;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({ currentUser }) => {
  const [budgets, setBudgets] = useState<EnrichedBudget[]>([]);
  const [allocations, setAllocations] = useState<EnrichedAllocation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fyFilter, setFyFilter] = useState<string>('all');

  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [bDeptId, setBDeptId] = useState('');
  const [bFiscalYear, setBFiscalYear] = useState('2026');
  const [bTitle, setBTitle] = useState('');
  const [bAmount, setBAmount] = useState('');
  const [bCurrency, setBCurrency] = useState('USD');
  const [bNotes, setBNotes] = useState('');
  const [bStatus, setBStatus] = useState<'draft' | 'approved'>('draft');
  const [bPublic, setBPublic] = useState(false);

  const [allocFormOpen, setAllocFormOpen] = useState(false);
  const [aBudgetId, setABudgetId] = useState('');
  const [aProjectId, setAProjectId] = useState('');
  const [aAmount, setAAmount] = useState('');
  const [aNotes, setANotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    type: 'budget' | 'allocation';
    id: number;
    label: string;
  } | null>(null);

  const isAdmin = currentUser.role === 'admin';
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'department_staff';

  const load = async () => {
    setLoading(true);
    try {
      const [bRes, aRes, dRes, pRes] = await Promise.all([
        apiFetch<{ budgets: EnrichedBudget[] }>('/api/budgets'),
        apiFetch<{ allocations: EnrichedAllocation[] }>('/api/allocations'),
        apiFetch<{ departments: Department[] }>('/api/departments'),
        apiFetch<{ projects: Project[] }>('/api/projects'),
      ]);
      setBudgets(bRes.budgets);
      setAllocations(aRes.allocations);
      setDepartments(dRes.departments.filter((d) => !d.isArchived));
      setProjects(pRes.projects.filter((p) => !p.isArchived));
      if (!bDeptId && dRes.departments.length > 0) {
        setBDeptId(
          currentUser.departmentId
            ? String(currentUser.departmentId)
            : String(dRes.departments[0].id)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load budgets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({
          departmentId: Number(bDeptId),
          fiscalYear: Number(bFiscalYear),
          title: bTitle,
          amount: Number(bAmount),
          currency: bCurrency,
          notes: bNotes,
          status: isAdmin ? bStatus : 'draft',
          isPublic: isAdmin && bStatus === 'approved' ? bPublic : false,
        }),
      });
      setBudgetFormOpen(false);
      setBTitle('');
      setBAmount('');
      setBNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/allocations', {
        method: 'POST',
        body: JSON.stringify({
          budgetId: Number(aBudgetId),
          projectId: Number(aProjectId),
          amount: Number(aAmount),
          notes: aNotes,
        }),
      });
      setAllocFormOpen(false);
      setAAmount('');
      setANotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to allocate funds.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveBudget = async (b: EnrichedBudget) => {
    setError(null);
    try {
      await apiFetch(`/api/budgets/${b.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve budget.');
    }
  };

  const handleTogglePublic = async (b: EnrichedBudget) => {
    setError(null);
    try {
      await apiFetch(`/api/budgets/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: !b.isPublic }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update publication flag.');
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      if (archiveTarget.type === 'budget') {
        await apiFetch(`/api/budgets/${archiveTarget.id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'archived' }),
        });
      } else {
        await apiFetch(`/api/allocations/${archiveTarget.id}/archive`, {
          method: 'POST',
        });
      }
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive operation failed.');
    } finally {
      setSaving(false);
    }
  };

  const approvedBudgets = budgets.filter((b) => b.status === 'approved');
  const selectedBudget = approvedBudgets.find((b) => String(b.id) === aBudgetId);
  const matchingProjects = selectedBudget
    ? projects.filter((p) => p.departmentId === selectedBudget.departmentId)
    : [];

  const filteredBudgets = budgets.filter(
    (b) => fyFilter === 'all' || String(b.fiscalYear) === fyFilter
  );
  const filteredAllocs = allocations.filter(
    (a) => !a.isArchived && (fyFilter === 'all' || String(a.fiscalYear) === fyFilter)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Budget Planning & Fund Allocation
          </h1>
          <p className="text-xs text-slate-500">
            Manage departmental budgets by fiscal year and allocate approved funds to projects
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter budgets by fiscal year"
            value={fyFilter}
            onChange={(e) => setFyFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">All Fiscal Years</option>
            <option value="2026">FY 2026</option>
            <option value="2025">FY 2025</option>
            <option value="2027">FY 2027</option>
          </select>

          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => {
                  setAllocFormOpen((v) => !v);
                  setBudgetFormOpen(false);
                  if (approvedBudgets.length > 0 && !aBudgetId) {
                    setABudgetId(String(approvedBudgets[0].id));
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Allocate to Project
              </button>
              <button
                type="button"
                onClick={() => {
                  setBudgetFormOpen((v) => !v);
                  setAllocFormOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Budget
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Create Budget Form */}
      {budgetFormOpen && canEdit && (
        <form onSubmit={handleCreateBudget} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Create Departmental Budget</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label htmlFor="budget-dept" className="block text-xs font-medium text-slate-700">
                Department
              </label>
              <select
                id="budget-dept"
                disabled={currentUser.role === 'department_staff'}
                value={bDeptId}
                onChange={(e) => setBDeptId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="budget-fy" className="block text-xs font-medium text-slate-700">
                Fiscal Year
              </label>
              <input
                id="budget-fy"
                type="number"
                required
                min={2000}
                max={2100}
                value={bFiscalYear}
                onChange={(e) => setBFiscalYear(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="budget-currency" className="block text-xs font-medium text-slate-700">
                Currency
              </label>
              <input
                id="budget-currency"
                type="text"
                maxLength={3}
                value={bCurrency}
                onChange={(e) => setBCurrency(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="budget-title" className="block text-xs font-medium text-slate-700">
                Budget Title
              </label>
              <input
                id="budget-title"
                type="text"
                required
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                placeholder="e.g. FY2026 Pedestrian Crosswalk Safety Program (Demo)"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="budget-amount" className="block text-xs font-medium text-slate-700">
                Amount
              </label>
              <input
                id="budget-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={bAmount}
                onChange={(e) => setBAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="budget-notes" className="block text-xs font-medium text-slate-700">
              Internal Planning Notes
            </label>
            <textarea
              id="budget-notes"
              rows={2}
              value={bNotes}
              onChange={(e) => setBNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <label htmlFor="budget-status" className="text-xs font-medium text-slate-700">
                  Initial Status:
                </label>
                <select
                  id="budget-status"
                  value={bStatus}
                  onChange={(e) => setBStatus(e.target.value as 'draft' | 'approved')}
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                >
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              {bStatus === 'approved' && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={bPublic}
                    onChange={(e) => setBPublic(e.target.checked)}
                  />
                  Publish summary on Public Portal
                </label>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setBudgetFormOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Budget'}
            </button>
          </div>
        </form>
      )}

      {/* Allocate Funds Form */}
      {allocFormOpen && canEdit && (
        <form onSubmit={handleCreateAllocation} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Allocate Approved Budget Funds to Project
          </h2>
          <p className="text-xs text-slate-500">
            Only approved budgets can be allocated, and total allocations cannot exceed the approved budget amount.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="alloc-budget" className="block text-xs font-medium text-slate-700">
                Approved Budget
              </label>
              <select
                id="alloc-budget"
                required
                value={aBudgetId}
                onChange={(e) => {
                  setABudgetId(e.target.value);
                  setAProjectId('');
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select approved budget...</option>
                {approvedBudgets.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.title} (Remaining: {formatCurrency(b.remainingAllocatable)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="alloc-project" className="block text-xs font-medium text-slate-700">
                Department Project
              </label>
              <select
                id="alloc-project"
                required
                value={aProjectId}
                onChange={(e) => setAProjectId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select project...</option>
                {matchingProjects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title} (FY {p.fiscalYear})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="alloc-amount" className="block text-xs font-medium text-slate-700">
                Allocation Amount
              </label>
              <input
                id="alloc-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={aAmount}
                onChange={(e) => setAAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label htmlFor="alloc-notes" className="block text-xs font-medium text-slate-700">
              Allocation Notes
            </label>
            <input
              id="alloc-notes"
              type="text"
              value={aNotes}
              onChange={(e) => setANotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAllocFormOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Allocating...' : 'Confirm Allocation'}
            </button>
          </div>
        </form>
      )}

      {/* Budgets Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Departmental Budgets</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading budgets...</p>
          ) : filteredBudgets.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No budgets match the filter.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 font-semibold">Budget & Department</th>
                  <th className="px-4 py-3 font-semibold">FY</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-right font-semibold">Allocated</th>
                  <th className="px-4 py-3 text-right font-semibold">Unallocated</th>
                  <th className="px-4 py-3 font-semibold">Status & Visibility</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBudgets.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{b.title}</div>
                      <div className="text-xs text-slate-500">{b.departmentName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                      {b.fiscalYear}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(b.amount, b.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
                      {formatCurrency(b.allocatedAmount, b.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(b.remainingAllocatable, b.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 font-medium capitalize ${statusBadgeClasses(
                            b.status
                          )}`}
                        >
                          {b.status}
                        </span>
                        <span className="text-slate-500">
                          {b.isPublic ? 'Public' : 'Internal'}
                        </span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {b.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handleApproveBudget(b)}
                              className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Approve
                            </button>
                          )}
                          {b.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleTogglePublic(b)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {b.isPublic ? 'Unpublish' : 'Publish'}
                            </button>
                          )}
                          {b.status !== 'archived' && (
                            <button
                              type="button"
                              onClick={() =>
                                setArchiveTarget({ type: 'budget', id: b.id, label: b.title })
                              }
                              aria-label={`Archive ${b.title}`}
                              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                            >
                              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Allocations Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Project Fund Allocations</h2>
        </div>
        <div className="overflow-x-auto">
          {filteredAllocs.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No active fund allocations for this filter.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-2.5 font-semibold">Source Budget</th>
                  <th className="px-4 py-2.5 font-semibold">Target Project</th>
                  <th className="px-4 py-2.5 font-semibold">Notes</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Allocated Amount</th>
                  {isAdmin && <th className="px-4 py-2.5 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAllocs.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.budgetTitle}</td>
                    <td className="px-4 py-3 text-slate-700">{a.projectTitle}</td>
                    <td className="px-4 py-3 text-slate-500">{a.notes || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(a.amount)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setArchiveTarget({
                              type: 'allocation',
                              id: a.id,
                              label: `${a.projectTitle} (${formatCurrency(a.amount)})`,
                            })
                          }
                          className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Archive
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(archiveTarget)}
        title={
          archiveTarget?.type === 'budget' ? 'Archive Budget?' : 'Archive Fund Allocation?'
        }
        description={`Confirm archiving "${archiveTarget?.label}". Historical records remain preserved in the ledger and audit trail.`}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
        busy={saving}
      />
    </div>
  );
};
