import React, { useEffect, useState } from 'react';
import { Archive, Award, Plus } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { formatCurrency, formatShortDate, statusBadgeClasses } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';
import type { Department, Procurement, Project, UserRecord, Vendor } from '../../shared/types';

interface ProcurementViewProps {
  currentUser: UserRecord;
}

export const ProcurementView: React.FC<ProcurementViewProps> = ({ currentUser }) => {
  const [tab, setTab] = useState<'procurements' | 'vendors'>('procurements');
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [procFormOpen, setProcFormOpen] = useState(false);
  const [pDeptId, setPDeptId] = useState('');
  const [pProjectId, setPProjectId] = useState('');
  const [pFiscalYear, setPFiscalYear] = useState('2026');
  const [pTitle, setPTitle] = useState('');
  const [pRef, setPRef] = useState('');
  const [pEstimated, setPEstimated] = useState('');
  const [pNotes, setPNotes] = useState('');

  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [vName, setVName] = useState('');
  const [vCode, setVCode] = useState('');
  const [vCategory, setVCategory] = useState('');
  const [vContactName, setVContactName] = useState('');
  const [vContactEmail, setVContactEmail] = useState('');
  const [vContactPhone, setVContactPhone] = useState('');

  const [awardTarget, setAwardTarget] = useState<Procurement | null>(null);
  const [awardVendorId, setAwardVendorId] = useState('');
  const [awardAmount, setAwardAmount] = useState('');
  const [awardDate, setAwardDate] = useState('2026-09-20');

  const [archiveTarget, setArchiveTarget] = useState<{
    type: 'procurement' | 'vendor';
    id: number;
    label: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser.role === 'admin';
  const canEdit = isAdmin || currentUser.role === 'department_staff';

  const load = async () => {
    setLoading(true);
    try {
      const [prRes, vRes, dRes, pRes] = await Promise.all([
        apiFetch<{ procurements: Procurement[] }>('/api/procurements'),
        apiFetch<{ vendors: Vendor[] }>('/api/vendors'),
        apiFetch<{ departments: Department[] }>('/api/departments'),
        apiFetch<{ projects: Project[] }>('/api/projects'),
      ]);
      setProcurements(prRes.procurements);
      setVendors(vRes.vendors);
      const activeDepts = dRes.departments.filter((d) => !d.isArchived);
      setDepartments(activeDepts);
      setProjects(pRes.projects.filter((p) => !p.isArchived));
      if (!pDeptId && activeDepts.length > 0) {
        setPDeptId(
          currentUser.departmentId ? String(currentUser.departmentId) : String(activeDepts[0].id)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load procurement data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/procurements', {
        method: 'POST',
        body: JSON.stringify({
          departmentId: Number(pDeptId),
          projectId: pProjectId ? Number(pProjectId) : null,
          fiscalYear: Number(pFiscalYear),
          title: pTitle,
          referenceNumber: pRef,
          estimatedAmount: Number(pEstimated),
          notes: pNotes,
        }),
      });
      setProcFormOpen(false);
      setPTitle('');
      setPRef('');
      setPEstimated('');
      setPNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create procurement.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: vName,
          registrationCode: vCode,
          category: vCategory,
          contactName: vContactName,
          contactEmail: vContactEmail,
          contactPhone: vContactPhone,
        }),
      });
      setVendorFormOpen(false);
      setVName('');
      setVCode('');
      setVCategory('');
      setVContactName('');
      setVContactEmail('');
      setVContactPhone('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register vendor.');
    } finally {
      setSaving(false);
    }
  };

  const handleAwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardTarget) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/procurements/${awardTarget.id}/award`, {
        method: 'POST',
        body: JSON.stringify({
          vendorId: Number(awardVendorId),
          awardedAmount: Number(awardAmount),
          awardDate,
        }),
      });
      setAwardTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to award procurement.');
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      const endpoint =
        archiveTarget.type === 'procurement'
          ? `/api/procurements/${archiveTarget.id}/archive`
          : `/api/vendors/${archiveTarget.id}/archive`;
      await apiFetch(endpoint, { method: 'POST' });
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed.');
    } finally {
      setSaving(false);
    }
  };

  const activeVendors = vendors.filter((v) => !v.isArchived);
  const deptProjects = projects.filter((p) => String(p.departmentId) === pDeptId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Procurement & Vendors
          </h1>
          <p className="text-xs text-slate-500">
            Manage vendor directory and contract awards. Awarding a contract never automatically records an expenditure.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-md bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab('procurements')}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                tab === 'procurements' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Procurements
            </button>
            <button
              type="button"
              onClick={() => setTab('vendors')}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                tab === 'vendors' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Vendors
            </button>
          </div>

          {canEdit && tab === 'procurements' && (
            <button
              type="button"
              onClick={() => setProcFormOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Procurement
            </button>
          )}
          {canEdit && tab === 'vendors' && (
            <button
              type="button"
              onClick={() => setVendorFormOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Register Vendor
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {tab === 'procurements' && procFormOpen && canEdit && (
        <form onSubmit={handleCreateProcurement} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Create Procurement Solicitation</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="proc-dept" className="block text-xs font-medium text-slate-700">
                Department
              </label>
              <select
                id="proc-dept"
                disabled={currentUser.role === 'department_staff'}
                value={pDeptId}
                onChange={(e) => {
                  setPDeptId(e.target.value);
                  setPProjectId('');
                }}
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
              <label htmlFor="proc-proj" className="block text-xs font-medium text-slate-700">
                Linked Project (Optional)
              </label>
              <select
                id="proc-proj"
                value={pProjectId}
                onChange={(e) => setPProjectId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">General department contract</option>
                {deptProjects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="proc-fy" className="block text-xs font-medium text-slate-700">
                Fiscal Year
              </label>
              <input
                id="proc-fy"
                type="number"
                required
                value={pFiscalYear}
                onChange={(e) => setPFiscalYear(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="proc-ref" className="block text-xs font-medium text-slate-700">
                Reference #
              </label>
              <input
                id="proc-ref"
                type="text"
                required
                value={pRef}
                onChange={(e) => setPRef(e.target.value)}
                placeholder="RFP-DEMO-2026-12"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label htmlFor="proc-title" className="block text-xs font-medium text-slate-700">
                Contract Title
              </label>
              <input
                id="proc-title"
                type="text"
                required
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="proc-est" className="block text-xs font-medium text-slate-700">
                Estimated Value ($)
              </label>
              <input
                id="proc-est"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={pEstimated}
                onChange={(e) => setPEstimated(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="proc-notes" className="block text-xs font-medium text-slate-700">
              Notes
            </label>
            <input
              id="proc-notes"
              type="text"
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setProcFormOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Procurement'}
            </button>
          </div>
        </form>
      )}

      {tab === 'vendors' && vendorFormOpen && canEdit && (
        <form onSubmit={handleCreateVendor} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Register Vendor (Internal Registry)</h2>
          <p className="text-xs text-slate-500">
            Vendor contact fields are internal-only and never exposed on the Public Transparency Portal.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="v-code" className="block text-xs font-medium text-slate-700">
                Registration Code
              </label>
              <input
                id="v-code"
                type="text"
                required
                value={vCode}
                onChange={(e) => setVCode(e.target.value)}
                placeholder="VND-DEMO-410"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label htmlFor="v-name" className="block text-xs font-medium text-slate-700">
                Vendor Name
              </label>
              <input
                id="v-name"
                type="text"
                required
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="v-cat" className="block text-xs font-medium text-slate-700">
                Category
              </label>
              <input
                id="v-cat"
                type="text"
                required
                value={vCategory}
                onChange={(e) => setVCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="v-cname" className="block text-xs font-medium text-slate-700">
                Contact Name
              </label>
              <input
                id="v-cname"
                type="text"
                required
                value={vContactName}
                onChange={(e) => setVContactName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="v-cemail" className="block text-xs font-medium text-slate-700">
                Contact Email
              </label>
              <input
                id="v-cemail"
                type="email"
                required
                value={vContactEmail}
                onChange={(e) => setVContactEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="v-cphone" className="block text-xs font-medium text-slate-700">
                Contact Phone
              </label>
              <input
                id="v-cphone"
                type="text"
                required
                value={vContactPhone}
                onChange={(e) => setVContactPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setVendorFormOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Register Vendor'}
            </button>
          </div>
        </form>
      )}

      {/* Award Modal / Inline Panel */}
      {awardTarget && canEdit && (
        <form onSubmit={handleAwardSubmit} className="rounded-lg border border-blue-200 bg-blue-50/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Award Contract: {awardTarget.title} ({awardTarget.referenceNumber})
          </h2>
          <p className="text-xs text-slate-600">
            Note: Awarding this procurement records the contract obligation only. Actual payments must be logged separately in the Expenditure Ledger after verification.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="aw-vendor" className="block text-xs font-medium text-slate-700">
                Selected Vendor
              </label>
              <select
                id="aw-vendor"
                required
                value={awardVendorId}
                onChange={(e) => setAwardVendorId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select vendor...</option>
                {activeVendors.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.name} ({v.registrationCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="aw-amount" className="block text-xs font-medium text-slate-700">
                Awarded Amount ($)
              </label>
              <input
                id="aw-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={awardAmount}
                onChange={(e) => setAwardAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="aw-date" className="block text-xs font-medium text-slate-700">
                Award Date
              </label>
              <input
                id="aw-date"
                type="date"
                required
                value={awardDate}
                onChange={(e) => setAwardDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAwardTarget(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Awarding...' : 'Confirm Contract Award'}
            </button>
          </div>
        </form>
      )}

      {tab === 'procurements' ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            {loading ? (
              <p className="p-8 text-center text-sm text-slate-500">Loading procurements...</p>
            ) : procurements.filter((p) => !p.isArchived).length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No active procurements.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                    <th className="px-4 py-3 font-semibold">Reference · FY</th>
                    <th className="px-4 py-3 font-semibold">Title & Department</th>
                    <th className="px-4 py-3 font-semibold">Awarded Vendor</th>
                    <th className="px-4 py-3 text-right font-semibold">Estimated</th>
                    <th className="px-4 py-3 text-right font-semibold">Awarded</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    {canEdit && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {procurements
                    .filter((p) => !p.isArchived)
                    .map((p) => (
                      <tr key={p.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">
                          <div>{p.referenceNumber}</div>
                          <div className="text-slate-400">FY {p.fiscalYear}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{p.title}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {p.departmentName}
                            {p.projectTitle ? ` · ${p.projectTitle}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          <div>{p.vendorName ?? 'Pending selection'}</div>
                          {p.awardDate && (
                            <div className="font-mono text-slate-400">
                              Awarded {formatShortDate(p.awardDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
                          {formatCurrency(p.estimatedAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-900">
                          {p.awardedAmount !== null ? formatCurrency(p.awardedAmount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span
                            className={`inline-block rounded border px-2 py-0.5 font-medium capitalize ${statusBadgeClasses(
                              p.status
                            )}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              {(p.status === 'open' || p.status === 'evaluating') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAwardTarget(p);
                                    setAwardAmount(String(p.estimatedAmount));
                                    setAwardVendorId(
                                      activeVendors[0] ? String(activeVendors[0].id) : ''
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                                >
                                  <Award className="h-3.5 w-3.5" aria-hidden="true" />
                                  Award
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setArchiveTarget({
                                    type: 'procurement',
                                    id: p.id,
                                    label: p.referenceNumber,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                              >
                                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                                Archive
                              </button>
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
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Vendor Name & Category</th>
                  <th className="px-4 py-3 font-semibold">Internal Contact</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {v.registrationCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{v.name}</div>
                      <div className="text-xs text-slate-500">{v.category}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{v.contactName}</div>
                      <div className="font-mono text-slate-500">
                        {v.contactEmail} · {v.contactPhone}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setArchiveTarget({ type: 'vendor', id: v.id, label: v.name })
                          }
                          className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          Archive
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(archiveTarget)}
        title={`Archive ${archiveTarget?.type === 'vendor' ? 'Vendor' : 'Procurement'}?`}
        description={`Confirm archiving "${archiveTarget?.label}". Existing historical records remain linked.`}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
        busy={saving}
      />
    </div>
  );
};
