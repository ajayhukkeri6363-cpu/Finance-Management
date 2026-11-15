export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractErrorMessage(text: string, status: number, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) return `${fallback} (${status})`;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      const errVal = (parsed as { error: unknown }).error;
      if (typeof errVal === 'string' && errVal.trim()) {
        return errVal.trim();
      }
    }
  } catch {
    // Fall through to plain-text handling
  }
  if (trimmed.startsWith('<')) {
    return `${fallback} (${status})`;
  }
  return trimmed;
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new ApiError(extractErrorMessage(text, res.status, 'Request failed'), res.status);
  }

  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export async function downloadCsv(url: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(extractErrorMessage(errText, res.status, 'Failed to export CSV'), res.status);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="([^"]+)"/);
  link.download = match ? match[1] : fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
