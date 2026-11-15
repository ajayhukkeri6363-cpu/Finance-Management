import React, { useEffect, useState } from 'react';
import { Archive, Plus } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { formatCurrency, formatShortDate, statusBadgeClasses } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';
import type { Department, Revenue, RevenueStatus, UserRecord } from '../../shared/types';

interface RevenuesViewProps {
  currentUser: UserRecord;
}

export const RevenuesView: React.FC<RevenuesViewProps> = ({ currentUser }) => {
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [deptId, setDeptId] = useState('');
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('Dedicated Tax');
  const [amount, setAmount] = useState('');
  const [receivedDate, setReceivedDate] = useState('2026-09-01');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<RevenueStatus>('received');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Revenue | null>(null);

  const isAdmin = currentUser.role === 'admin';
  const canEdit = isAdmin || currentUser.role === 'department_staff';

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, dRes] = await Promise.all([
        apiFetch<{ revenues: Revenue[] }>('/api/revenues'),
        apiFetch<{ departments: Department[] }>('/api/departments'),
      ]);
      setRevenues(rRes.revenues);
      const activeDepts = dRes.departments.filter((d) => !d.isArchived);
      setDepartments(activeDepts);
      if (!deptId && currentUser.departmentId) {
        setDeptId(String(currentUser.departmentId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load revenue records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/revenues', {
        method: 'POST',
        body: JSON.stringify({
          departmentId: deptId ? Number(deptId) : null,
          fiscalYear: Number(fiscalYear),
          source,
          category,
          amount: Number(amount),
          receivedDate,
          notes,
          status,
          isPublic: isAdmin ? isPublic : false,
        }),
      });
      setFormOpen(false);
      setSource('');
      setAmount('');
      setNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record revenue.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async (r: Revenue) => {
    try {
      await apiFetch(`/api/revenues/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: !r.isPublic }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update public flag.');
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/revenues/${archiveTarget.id}/archive`, { method: 'POST' });
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed.');
    } finally {
      setSaving(false);
    }
  };

  const visible = revenues.filter((r) => showArchived || !r.isArchived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Revenue Tracking</h1>
          <p className="text-xs text-slate-500">
            Track taxes, grants, and user fee inflows by fiscal year and department
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          {canEdit && (
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Record Revenue
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {formOpen && canEdit && (
        <form onSubmit={handleCreate} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Record Revenue Entry</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="rev-dept" className="block text-xs font-medium text-slate-700">
                Department
              </label>
              <select
                id="rev-dept"
                disabled={currentUser.role === 'department_staff'}
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                {isAdmin && <option value="">General Fund (All Departments)</option>}
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rev-fy" className="block text-xs font-medium text-slate-700">
                Fiscal Year
              </label>
              <input
                id="rev-fy"
                type="number"
                required
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="rev-category" className="block text-xs font-medium text-slate-700">
                Category
              </label>
              <input
                id="rev-category"
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label htmlFor="rev-source" className="block text-xs font-medium text-slate-700">
                Revenue Source
              </label>
              <input
                id="rev-source"
                type="text"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. Regional Transit Excise Grant (Demo)"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="rev-amount" className="block text-xs font-medium text-slate-700">
                Amount ($)
              </label>
              <input
                id="rev-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="rev-date" className="block text-xs font-medium text-slate-700">
                Date
              </label>
              <input
                id="rev-date"
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="rev-notes" className="block text-xs font-medium text-slate-700">
                Notes
              </label>
              <input
                id="rev-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="rev-status" className="block text-xs font-medium text-slate-700">
                Status
              </label>
              <select
                id="rev-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as RevenueStatus)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="expected">Expected</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>

          {isAdmin && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Include in Public Transparency Portal totals
            </label>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Revenue'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading revenues...</p>
          ) : visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No revenue records found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 font-semibold">Date · FY</th>
                  <th className="px-4 py-3 font-semibold">Source & Notes</th>
                  <th className="px-4 py-3 font-semibold">Department · Category</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canEdit && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      <div>{formatShortDate(r.receivedDate)}</div>
                      <div className="text-slate-400">FY {r.fiscalYear}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.source}</div>
                      {r.notes && <div className="mt-0.5 text-xs text-slate-500">{r.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div>{r.departmentName}</div>
                      <div className="text-slate-500">{r.category}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-medium capitalize ${statusBadgeClasses(
                          r.status
                        )}`}
                      >
                        {r.status}
                      </span>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {r.isPublic ? 'Public' : 'Internal'}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        {!r.isArchived && (
                          <div className="inline-flex items-center gap-2">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleTogglePublic(r)}
                                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                {r.isPublic ? 'Unpublish' : 'Publish'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(r)}
                              aria-label={`Archive ${r.source}`}
                              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                            >
                              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                              Archive
                            </button>
                          </div>
                        )}
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
        title="Archive Revenue Entry?"
        description={`Archiving "${archiveTarget?.source}" (${formatCurrency(
          archiveTarget?.amount ?? 0
        )}) removes it from active totals while retaining history.`}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
        busy={saving}
      />
    </div>
  );
};
