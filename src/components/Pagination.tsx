import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  totalItems,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
      <span className="font-mono tabular-nums">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Prev
        </button>
        <span className="font-mono tabular-nums text-slate-800">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
