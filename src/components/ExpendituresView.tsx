import React, { useEffect, useState } from 'react';
import { Archive, Plus } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { formatCurrency, formatShortDate, statusBadgeClasses } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';
import { Pagination } from './Pagination';
import type { Expenditure, ExpenditureStatus, Project, UserRecord, Vendor } from '../../shared/types';

interface ExpendituresViewProps {
  currentUser: UserRecord;
}

export const ExpendituresView: React.FC<ExpendituresViewProps> = ({ currentUser }) => {
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('2026-09-15');
  const [category, setCategory] = useState('Materials');
  const [description, setDescription] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [status, setStatus] = useState<ExpenditureStatus>('pending');
  const [saving, setSaving] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Expenditure | null>(null);

  const isAdmin = currentUser.role === 'admin';
  const canCreate = isAdmin || currentUser.role === 'department_staff';

  const load = async () => {
    setLoading(true);
    try {
      const [eRes, pRes, vRes] = await Promise.all([
        apiFetch<{ expenditures: Expenditure[] }>('/api/expenditures'),
        apiFetch<{ projects: Project[] }>('/api/projects'),
        apiFetch<{ vendors: Vendor[] }>('/api/vendors'),
      ]);
      setExpenditures(eRes.expenditures);
      const activeProjs = pRes.projects.filter((p) => !p.isArchived);
      setProjects(activeProjs);
      setVendors(vRes.vendors.filter((v) => !v.isArchived));
      if (!projectId && activeProjs.length > 0) {
        setProjectId(String(activeProjs[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load expenditures.');
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
      await apiFetch('/api/expenditures', {
        method: 'POST',
        body: JSON.stringify({
          projectId: Number(projectId),
          vendorId: vendorId ? Number(vendorId) : null,
          amount: Number(amount),
          expenseDate,
          category,
          description,
          referenceNumber,
          status: isAdmin ? status : 'pending',
        }),
      });
      setFormOpen(false);
      setAmount('');
      setDescription('');
      setReferenceNumber('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record expenditure.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (exp: Expenditure, nextStatus: ExpenditureStatus) => {
    setError(null);
    try {
      await apiFetch(`/api/expenditures/${exp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/expenditures/${archiveTarget.id}/archive`, { method: 'POST' });
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive expenditure.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = expenditures.filter((e) => {
    if (!showArchived && e.isArchived) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.description.toLowerCase().includes(q) ||
      e.referenceNumber.toLowerCase().includes(q) ||
      (e.projectTitle ?? '').toLowerCase().includes(q) ||
      (e.vendorName ?? '').toLowerCase().includes(q)
    );
  });

  const pageSize = 8;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Expenditure Ledger</h1>
          <p className="text-xs text-slate-500">
            Immutable-history spending ledger. Entries are archived rather than deleted to preserve audit integrity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked);
                setPage(1);
              }}
            />
            Show archived
          </label>
          {canCreate && (
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Record Expenditure
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {formOpen && canCreate && (
        <form onSubmit={handleCreate} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Record Project Expenditure</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="exp-project" className="block text-xs font-medium text-slate-700">
                Project
              </label>
              <select
                id="exp-project"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp-vendor" className="block text-xs font-medium text-slate-700">
                Vendor (Optional)
              </label>
              <select
                id="exp-vendor"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">No linked vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp-ref" className="block text-xs font-medium text-slate-700">
                Reference / Invoice #
              </label>
              <input
                id="exp-ref"
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. INV-2026-1042"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-slate-700">
                Amount ($)
              </label>
              <input
                id="exp-amount"
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
              <label htmlFor="exp-date" className="block text-xs font-medium text-slate-700">
                Expense Date
              </label>
              <input
                id="exp-date"
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="exp-category" className="block text-xs font-medium text-slate-700">
                Category
              </label>
              <input
                id="exp-category"
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {isAdmin && (
              <div>
                <label htmlFor="exp-status" className="block text-xs font-medium text-slate-700">
                  Initial Status
                </label>
                <select
                  id="exp-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExpenditureStatus)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="exp-desc" className="block text-xs font-medium text-slate-700">
              Description
            </label>
            <input
              id="exp-desc"
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Concise description of goods or services..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

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
              {saving ? 'Recording...' : 'Record Expenditure'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <span className="text-xs font-medium text-slate-600">
            {filtered.length} expenditure entr{filtered.length === 1 ? 'y' : 'ies'}
          </span>
          <input
            type="search"
            aria-label="Search expenditures"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by reference, project, vendor..."
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-72"
          />
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading ledger...</p>
          ) : paged.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No expenditure entries match the current filter.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 font-semibold">Date & Reference</th>
                  <th className="px-4 py-3 font-semibold">Project & Description</th>
                  <th className="px-4 py-3 font-semibold">Vendor · Category</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canCreate && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((e) => (
                  <tr key={e.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono text-slate-700">{formatShortDate(e.expenseDate)}</div>
                      <div className="mt-0.5 font-mono text-slate-500">{e.referenceNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{e.description}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {e.projectTitle} · {e.departmentName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div>{e.vendorName ?? 'Direct / Unassigned'}</div>
                      <div className="text-slate-500">{e.category}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-medium capitalize ${statusBadgeClasses(
                          e.status
                        )}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    {canCreate && (
                      <td className="px-4 py-3 text-right">
                        {!e.isArchived && (
                          <div className="inline-flex items-center gap-2">
                            {isAdmin && e.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(e, 'approved')}
                                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                              >
                                Approve
                              </button>
                            )}
                            {isAdmin && e.status === 'approved' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(e, 'paid')}
                                className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                              >
                                Mark Paid
                              </button>
                            )}
                            {(isAdmin || e.status !== 'paid') && (
                              <button
                                type="button"
                                onClick={() => setArchiveTarget(e)}
                                aria-label={`Archive expenditure ${e.referenceNumber}`}
                                className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                              >
                                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                                Archive
                              </button>
                            )}
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

        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      </div>

      <ConfirmModal
        open={Boolean(archiveTarget)}
        title="Archive Expenditure Record?"
        description={`Archiving "${archiveTarget?.referenceNumber}" (${formatCurrency(
          archiveTarget?.amount ?? 0
        )}) excludes it from active spending totals while preserving full ledger and audit history.`}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
        busy={saving}
      />
    </div>
  );
};
