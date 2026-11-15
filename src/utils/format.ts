export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const datePart = iso.slice(0, 10);
  const parsed = new Date(`${datePart}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function formatRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'department_staff':
      return 'Department Staff';
    case 'auditor':
      return 'Auditor (Read-Only)';
    case 'citizen':
      return 'Citizen';
    default:
      return role;
  }
}

export function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'approved':
    case 'paid':
    case 'received':
    case 'completed':
    case 'awarded':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'active':
    case 'open':
    case 'evaluating':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'pending':
    case 'draft':
    case 'planned':
    case 'expected':
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'delayed':
    case 'attention':
    case 'cancelled':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'archived':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}
