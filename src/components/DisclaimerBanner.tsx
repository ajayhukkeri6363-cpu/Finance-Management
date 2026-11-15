import React from 'react';
import { Info } from 'lucide-react';

interface DisclaimerBannerProps {
  mode?: 'mysql' | 'local-demo' | 'mysql-unconfigured';
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ mode }) => {
  return (
    <div
      role="note"
      aria-label="Classroom demonstration notice"
      className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-700 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-slate-900">Classroom Demonstration Notice:</strong>{' '}
            All departments, budgets, projects, vendors, and figures shown in GovTrack AI are fictional educational examples, not official government spending.
          </span>
        </div>
        {mode && (
          <span className="font-mono text-[11px] text-slate-600">
            Storage:{' '}
            {mode === 'mysql'
              ? 'MySQL 8'
              : mode === 'mysql-unconfigured'
              ? 'MySQL 8 Setup Required'
              : 'Local Demo Seed'}
          </span>
        )}
      </div>
    </div>
  );
};
