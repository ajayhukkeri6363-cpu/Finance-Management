import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import { formatRoleLabel, formatTimestamp } from '../utils/format';
import { Pagination } from './Pagination';
import type { AuditLogEntry } from '../../shared/types';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ logs: AuditLogEntry[] }>('/api/audit-logs')
      .then((res) => setLogs(res.logs))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load audit trail.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((l) => {
    if (entityFilter !== 'all' && l.entityType !== entityFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      l.summary.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.actorName.toLowerCase().includes(q)
    );
  });

  const pageSize = 10;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Append-Only Audit Trail</h1>
          <p className="text-xs text-slate-500">
            Immutable activity history covering approvals, fund allocations, archival, and publication changes (passwords and secrets are never logged)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter audit logs by entity type"
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="all">All Entities</option>
            <option value="budget">Budgets</option>
            <option value="allocation">Allocations</option>
            <option value="project">Projects</option>
            <option value="expenditure">Expenditures</option>
            <option value="revenue">Revenues</option>
            <option value="procurement">Procurements</option>
            <option value="review_flag">Review Flags</option>
            <option value="user">Users</option>
          </select>

          <input
            type="search"
            aria-label="Search audit logs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search actor, action, summary..."
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm sm:w-64"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading audit history...</p>
          ) : paged.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No audit entries match your filter.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action · Entity</th>
                  <th className="px-4 py-3 font-semibold">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((entry) => (
                  <tr key={entry.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {formatTimestamp(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{entry.actorName}</div>
                      <div className="text-slate-500">{formatRoleLabel(entry.actorRole)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-medium text-slate-800">{entry.action}</div>
                      <div className="text-slate-500">
                        {entry.entityType}
                        {entry.entityId !== null ? ` #${entry.entityId}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} />
      </div>
    </div>
  );
};
