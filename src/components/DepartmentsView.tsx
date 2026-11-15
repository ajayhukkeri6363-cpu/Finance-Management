import React, { useEffect, useState } from 'react';
import { Archive, Edit2, Plus } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { ConfirmModal } from './ConfirmModal';
import type { Department, UserRole } from '../../shared/types';

interface DepartmentsViewProps {
  userRole: UserRole;
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({ userRole }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [editing, setEditing] = useState<Department | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Department | null>(null);
  const [archiving, setArchiving] = useState(false);

  const canManage = userRole === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ departments: Department[] }>('/api/departments');
      setDepartments(res.departments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDescription('');
    setFormOpen(true);
    setError(null);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setCode(d.code);
    setName(d.name);
    setDescription(d.description);
    setFormOpen(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await apiFetch(`/api/departments/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ code, name, description }),
        });
      } else {
        await apiFetch('/api/departments', {
          method: 'POST',
          body: JSON.stringify({ code, name, description }),
        });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save department.');
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await apiFetch(`/api/departments/${archiveTarget.id}/archive`, { method: 'POST' });
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive department.');
    } finally {
      setArchiving(false);
    }
  };

  const visible = departments.filter((d) => showArchived || !d.isArchived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Departments</h1>
          <p className="text-xs text-slate-500">
            Organizational units governing budgets, projects, and staff permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show archived
          </label>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Department
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {formOpen && canManage && (
        <form
          onSubmit={handleSave}
          className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">
            {editing ? `Edit Department: ${editing.name}` : 'Create Department'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="dept-code" className="block text-xs font-medium text-slate-700">
                Department Code
              </label>
              <input
                id="dept-code"
                type="text"
                required
                maxLength={24}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. ENG-01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="dept-name" className="block text-xs font-medium text-slate-700">
                Department Name
              </label>
              <input
                id="dept-name"
                type="text"
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Public Works & Engineering (Demo)"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="dept-desc" className="block text-xs font-medium text-slate-700">
              Mandate / Description
            </label>
            <textarea
              id="dept-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading departments...</p>
          ) : visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No active departments found.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Department Name</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canManage && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{d.description || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-medium ${
                          d.isArchived
                            ? 'border-slate-200 bg-slate-100 text-slate-600'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {d.isArchived ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        {!d.isArchived && (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(d)}
                              aria-label={`Edit ${d.name}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(d)}
                              aria-label={`Archive ${d.name}`}
                              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
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
        title="Archive Department?"
        description={`Archiving "${archiveTarget?.name}" preserves all historical budgets, projects, and expenditures linked to it, while preventing new assignments.`}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
        busy={archiving}
      />
    </div>
  );
};
