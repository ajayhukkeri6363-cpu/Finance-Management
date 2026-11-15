import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { formatTimestamp, statusBadgeClasses } from '../utils/format';
import { RULE_LABELS, SEVERITY_LABELS } from '../../shared/financeRules';
import type { ReviewFlagRecord, UserRecord } from '../../shared/types';

interface ReviewFlagsViewProps {
  currentUser: UserRecord;
}

export const ReviewFlagsView: React.FC<ReviewFlagsViewProps> = ({ currentUser }) => {
  const [flags, setFlags] = useState<ReviewFlagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterReviewed, setFilterReviewed] = useState<'all' | 'pending' | 'reviewed'>('all');

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const canReview = currentUser.role === 'admin' || currentUser.role === 'department_staff';

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ flags: ReviewFlagRecord[] }>('/api/review-flags');
      setFlags(res.flags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load review indicators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkReviewed = async (e: React.FormEvent, flagId: string) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/review-flags/${encodeURIComponent(flagId)}/review`, {
        method: 'POST',
        body: JSON.stringify({ reviewNote }),
      });
      setReviewingId(null);
      setReviewNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review note.');
    } finally {
      setSaving(false);
    }
  };

  const visible = flags.filter((f) => {
    if (filterReviewed === 'pending') return !f.isReviewed;
    if (filterReviewed === 'reviewed') return f.isReviewed;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Transparent Spending Review Indicators
          </h1>
          <p className="text-xs text-slate-500">
            Deterministic, rule-based checks over budgets, schedules, and ledger references
          </p>
        </div>

        <div className="flex rounded-md bg-slate-100 p-1">
          {(['all', 'pending', 'reviewed'] as const).map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setFilterReviewed(state)}
              className={`rounded px-3 py-1.5 text-xs font-medium capitalize ${
                filterReviewed === state ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {state === 'pending' ? 'Needs Review' : state}
            </button>
          ))}
        </div>
      </div>

      <div
        role="note"
        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <strong className="font-semibold text-slate-900">Human Review Policy:</strong>{' '}
          These indicators use explicit arithmetic thresholds (such as 85% budget utilization, duplicate reference strings, 2.5x peer variance, or passed target dates). Every indicator requires human verification and is <strong>never</strong> proof of fraud or wrongdoing. Marking an indicator reviewed records an audit note without altering underlying financial records.
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-500">Evaluating spending rules...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No rule-based indicators match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((flag) => (
            <article
              key={flag.id}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 font-medium ${statusBadgeClasses(
                        flag.severity
                      )}`}
                    >
                      {SEVERITY_LABELS[flag.severity]}
                    </span>
                    <span className="font-medium text-slate-700">
                      {RULE_LABELS[flag.ruleCode]}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="text-slate-600">{flag.departmentName}</span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-mono text-slate-500">FY {flag.fiscalYear}</span>
                  </div>
                  <h2 className="text-base font-semibold text-slate-900">{flag.ruleTitle}</h2>
                </div>

                {flag.isReviewed ? (
                  <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Reviewed
                  </span>
                ) : (
                  canReview && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewingId(flag.id);
                        setReviewNote('');
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                    >
                      Mark Reviewed
                    </button>
                  )
                )}
              </div>

              <p className="text-sm text-slate-700">{flag.explanation}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="font-mono text-slate-700">Computed Values: {flag.metricSummary}</span>
                <span>{flag.requiresHumanReviewNotice}</span>
              </div>

              {flag.isReviewed && flag.reviewNote && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <div>
                    <strong className="font-semibold text-slate-900">
                      Human Review Note ({flag.reviewedByName}):
                    </strong>{' '}
                    {flag.reviewNote}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">
                    Recorded {formatTimestamp(flag.reviewedAt)}
                  </div>
                </div>
              )}

              {reviewingId === flag.id && canReview && (
                <form
                  onSubmit={(e) => handleMarkReviewed(e, flag.id)}
                  className="mt-3 space-y-3 border-t border-slate-200 pt-3"
                >
                  <div>
                    <label
                      htmlFor={`note-${flag.id}`}
                      className="block text-xs font-medium text-slate-700"
                    >
                      Human Verification Note (financial records remain untouched)
                    </label>
                    <textarea
                      id={`note-${flag.id}`}
                      required
                      rows={2}
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Document your verification findings (e.g. verified duplicate invoice was corrected or confirmed valid split billing)..."
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewingId(null)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      {saving ? 'Saving Note...' : 'Save Review Note'}
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
