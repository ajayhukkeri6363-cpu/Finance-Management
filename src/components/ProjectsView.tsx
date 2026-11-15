import React, { useEffect, useState } from 'react';
import { Archive, Edit2, Plus } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { formatCurrency, formatShortDate, statusBadgeClasses } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';
import type { Department, Project, ProjectStatus, UserRecord } from '../../shared/types';

interface ProjectsViewProps {
  currentUser: UserRecord;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ currentUser }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deptId, setDeptId] = useState('');
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('2026-03-01');
  const [targetEndDate, setTargetEndDate] = useState('2026-11-30');
  const [status, setStatus] = useState<ProjectStatus>('planned');
  const [progressPercent, setProgressPercent] = useState('0');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);

  const isAdmin = currentUser.role === 'admin';
  const canEdit = isAdmin || currentUser.role === 'department_staff';

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, dRes] = await Promise.all([
        apiFetch<{ projects: Project[] }>('/api/projects'),
        apiFetch<{ departments: Department[] }>('/api/departments'),
      ]);
      setProjects(pRes.projects);
      const activeDepts = dRes.departments.filter((d) => !d.isArchived);
      setDepartments(activeDepts);
      if (!deptId && activeDepts.length > 0) {
        setDeptId(
          currentUser.departmentId ? String(currentUser.departmentId) : String(activeDepts[0].id)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setLocation('');
    setStartDate('2026-03-01');
    setTargetEndDate('2026-11-30');
    setStatus('planned');
    setProgressPercent('0');
    setIsPublic(false);
    setFormOpen(true);
    setError(null);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setDeptId(String(p.departmentId));
    setFiscalYear(String(p.fiscalYear));
    setTitle(p.title);
    setDescription(p.description);
    setLocation(p.location);
    setStartDate(p.startDate);
    setTargetEndDate(p.targetEndDate);
    setStatus(p.status);
    setProgressPercent(String(p.progressPercent));
    setIsPublic(p.isPublic);
    setFormOpen(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          title,
          description,
          location,
          startDate,
          targetEndDate,
          status,
          progressPercent: Number(progressPercent),
        };
        if (isAdmin) body.isPublic = isPublic;
        await apiFetch(`/api/projects/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/api/projects', {
          method: 'POST',
          body: JSON.stringify({
            departmentId: Number(deptId),
            fiscalYear: Number(fiscalYear),
            title,
            description,
            location,
            startDate,
            targetEndDate,
            status,
            progressPercent: Number(progressPercent),
            isPublic: isAdmin ? isPublic : false,
          }),
        });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save project.');
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${archiveTarget.id}/archive`, { method: 'POST' });
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed.');
    } finally {
      setSaving(false);
    }
  };

  const visible = projects.filter((p) => showArchived || !p.isArchived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Capital & Public Projects</h1>
          <p className="text-xs text-slate-500">
            Track milestones, approved project allocations, recorded expenditure, and public portal visibility
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
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Project
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
        <form onSubmit={handleSave} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {editing ? `Edit Project: ${editing.title}` : 'Create Project'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="proj-dept" className="block text-xs font-medium text-slate-700">
                Department
              </label>
              <select
                id="proj-dept"
                disabled={Boolean(editing) || currentUser.role === 'department_staff'}
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
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
              <label htmlFor="proj-fy" className="block text-xs font-medium text-slate-700">
                Fiscal Year
              </label>
              <input
                id="proj-fy"
                type="number"
                required
                disabled={Boolean(editing)}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono disabled:bg-slate-100"
              />
            </div>
            <div>
              <label htmlFor="proj-location" className="block text-xs font-medium text-slate-700">
                Location
              </label>
              <input
                id="proj-location"
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Elm Street Corridor (Demo)"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="proj-title" className="block text-xs font-medium text-slate-700">
              Project Title
            </label>
            <input
              id="proj-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="proj-desc" className="block text-xs font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="proj-desc"
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="proj-start" className="block text-xs font-medium text-slate-700">
                Start Date
              </label>
              <input
                id="proj-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="proj-end" className="block text-xs font-medium text-slate-700">
                Target End Date
              </label>
              <input
                id="proj-end"
                type="date"
                required
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="proj-status" className="block text-xs font-medium text-slate-700">
                Status
              </label>
              <select
                id="proj-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="delayed">Delayed</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label htmlFor="proj-progress" className="block text-xs font-medium text-slate-700">
                Progress (%)
              </label>
              <input
                id="proj-progress"
                type="number"
                min={0}
                max={100}
                required
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          {isAdmin && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Publish this project to the Public Transparency Portal
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
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading projects...</p>
          ) : visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No projects found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 font-semibold">Project & Location</th>
                  <th className="px-4 py-3 font-semibold">Department · FY</th>
                  <th className="px-4 py-3 font-semibold">Schedule</th>
                  <th className="px-4 py-3 font-semibold">Status & Progress</th>
                  <th className="px-4 py-3 text-right font-semibold">Allocated Budget</th>
                  <th className="px-4 py-3 text-right font-semibold">Recorded Spend</th>
                  <th className="px-4 py-3 font-semibold">Visibility</th>
                  {canEdit && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{p.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{p.location}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div>{p.departmentName}</div>
                      <div className="font-mono text-slate-500">FY {p.fiscalYear}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      <div>{formatShortDate(p.startDate)}</div>
                      <div className="text-slate-400">to {formatShortDate(p.targetEndDate)}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-medium capitalize ${statusBadgeClasses(
                          p.status
                        )}`}
                      >
                        {p.status}
                      </span>
                      <div className="mt-1.5 font-mono tabular-nums text-slate-700">
                        {p.progressPercent}% complete
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(p.approvedAllocatedBudget ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(p.recordedExpenditure ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {p.isPublic ? 'Published' : 'Internal'}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        {!p.isArchived && (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              aria-label={`Edit ${p.title}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(p)}
                              aria-label={`Archive ${p.title}`}
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
        title="Archive Project?"
        description={`Archiving "${archiveTarget?.title}" removes it from active public listings while preserving its historical allocations and expenditures.`}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
        busy={saving}
      />
    </div>
  );
};
