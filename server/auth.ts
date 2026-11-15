import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserRecord, UserRole } from '../shared/types.ts';

export const SESSION_COOKIE_NAME = 'govtrack_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString('hex');

export function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 24 && !configured.startsWith('REPLACE_WITH')) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET environment variable (at least 24 characters) is required in production.'
    );
  }
  return EPHEMERAL_DEV_SECRET;
}

export function hashPassword(password: string): string {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, originalHex] = parts;
  if (!salt || !originalHex) return false;

  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

interface SessionPayload {
  userId: number;
  exp: number;
}

export function signSessionToken(userId: number): string {
  const payload: SessionPayload = {
    userId,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || typeof parsed.userId !== 'number' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

export function setSessionCookie(res: Response, req: Request, token: string): void {
  const isSecure =
    process.env.NODE_ENV === 'production' &&
    (req.secure || req.headers['x-forwarded-proto'] === 'https');
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isSecure) {
    attrs.push('Secure');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
}

export interface AuthenticatedRequest extends Request {
  currentUser?: UserRecord;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  if (!req.currentUser.isActive) {
    res.status(403).json({ error: 'This user account is deactivated.' });
    return;
  }
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.currentUser.role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}

export function assertDepartmentWriteAccess(
  user: UserRecord,
  departmentId: number
): { ok: true } | { ok: false; status: number; error: string } {
  if (user.role === 'admin') return { ok: true };
  if (user.role === 'department_staff') {
    if (user.departmentId === null || user.departmentId !== departmentId) {
      return {
        ok: false,
        status: 403,
        error: 'Department staff can only create or modify records within their assigned department.',
      };
    }
    return { ok: true };
  }
  return {
    ok: false,
    status: 403,
    error: 'Read-only or citizen roles cannot modify internal department records.',
  };
}

export function assertDepartmentReadAccess(
  user: UserRecord,
  departmentId: number
): boolean {
  if (user.role === 'admin' || user.role === 'auditor') return true;
  if (user.role === 'department_staff') {
    return user.departmentId === departmentId;
  }
  return false;
}

export function validatePositiveMoney(raw: unknown, fieldName: string): number {
  const num = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(num) || num <= 0 || num > 999_999_999_999) {
    throw new ValidationError(`${fieldName} must be a positive monetary amount.`);
  }
  return Math.round(num * 100) / 100;
}

export function validateNonEmptyString(raw: unknown, fieldName: string, maxLen = 200): string {
  if (typeof raw !== 'string') {
    throw new ValidationError(`${fieldName} is required.`);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ValidationError(`${fieldName} cannot be empty.`);
  }
  if (trimmed.length > maxLen) {
    throw new ValidationError(`${fieldName} must be ${maxLen} characters or fewer.`);
  }
  return trimmed;
}

export function validateOptionalString(raw: unknown, maxLen = 1000): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

export function validateFiscalYear(raw: unknown): number {
  const yr = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isInteger(yr) || yr < 2000 || yr > 2100) {
    throw new ValidationError('Fiscal year must be a valid 4-digit year between 2000 and 2100.');
  }
  return yr;
}

export function validateIsoDate(raw: unknown, fieldName: string): string {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    throw new ValidationError(`${fieldName} must be a valid date in YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${raw.trim()}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${fieldName} is not a valid calendar date.`);
  }
  return raw.trim();
}

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
