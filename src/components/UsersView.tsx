import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { formatRoleLabel, formatTimestamp } from '../utils/format';
import type { Department, UserRecord, UserRole } from '../../shared/types';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('department_staff');
  const [departmentId, setDepartmentId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [uRes, dRes] = await Promise.all([
        apiFetch<{ users: UserRecord[] }>('/api/users'),
        apiFetch<{ departments: Department[] }>('/api/departments'),
      ]);
      setUsers(uRes.users);
      const activeDepts = dRes.departments.filter((d) => !d.isArchived);
      setDepartments(activeDepts);
      if (!departmentId && activeDepts.length > 0) {
        setDepartmentId(String(activeDepts[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load users.');
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
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          departmentId: role === 'department_staff' ? Number(departmentId) : null,
        }),
      });
      setFormOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: UserRecord) => {
    setError(null);
    try {
      await apiFetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">User & Role Administration</h1>
          <p className="text-xs text-slate-500">
            Manage internal staff, auditors, administrators, and registered citizens
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New User Account
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleCreate} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Create User Account</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="u-name" className="block text-xs font-medium text-slate-700">
                Full Name
              </label>
              <input
                id="u-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="u-email" className="block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                id="u-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="u-pass" className="block text-xs font-medium text-slate-700">
                Initial Password (min 8 chars)
              </label>
              <input
                id="u-pass"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="u-role" className="block text-xs font-medium text-slate-700">
                Role
              </label>
              <select
                id="u-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="department_staff">Department Staff</option>
                <option value="auditor">Auditor (Read-Only)</option>
                <option value="admin">Administrator</option>
                <option value="citizen">Citizen</option>
              </select>
            </div>
            {role === 'department_staff' && (
              <div>
                <label htmlFor="u-dept" className="block text-xs font-medium text-slate-700">
                  Assigned Department
                </label>
                <select
                  id="u-dept"
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading users...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{u.name}</div>
                      <div className="font-mono text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{formatRoleLabel(u.role)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {u.departmentName ?? (u.role === 'department_staff' ? 'Unassigned' : '—')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {formatTimestamp(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 font-medium ${
                          u.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
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
