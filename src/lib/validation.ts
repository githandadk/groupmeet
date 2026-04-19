export const LIMITS = {
  NAME: 100,
  TITLE: 200,
  LABEL: 200,
  DESCRIPTION: 2000,
  EMAIL: 254,
  VOTER_NAME: 60,
  ITEMS: 200,
  POLL_OPTIONS_MIN: 2,
  POLL_OPTIONS_MAX: 10,
  POLL_OPTION_LABEL: 100,
} as const;

export class ValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = 'ValidationError';
  }
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function requireString(field: string, value: unknown, max: number): string {
  if (!isString(value)) throw new ValidationError(field, `${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ValidationError(field, `${field} is required`);
  if (trimmed.length > max) throw new ValidationError(field, `${field} must be ${max} characters or fewer`);
  return trimmed;
}

export function optionalString(field: string, value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (!isString(value)) throw new ValidationError(field, `${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new ValidationError(field, `${field} must be ${max} characters or fewer`);
  return trimmed;
}

export function optionalEmail(field: string, value: unknown): string | null {
  const s = optionalString(field, value, LIMITS.EMAIL);
  if (s === null) return null;
  // Lightweight format check — server-side is for sanity, not for delivery validation.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new ValidationError(field, `${field} must be a valid email`);
  }
  return s;
}

export function requireArray<T>(field: string, value: unknown, min: number, max: number): T[] {
  if (!Array.isArray(value)) throw new ValidationError(field, `${field} must be an array`);
  if (value.length < min) throw new ValidationError(field, `${field} requires at least ${min}`);
  if (value.length > max) throw new ValidationError(field, `${field} cannot have more than ${max}`);
  return value as T[];
}

export function requirePositiveInt(field: string, value: unknown, max: number = 99): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1) throw new ValidationError(field, `${field} must be at least 1`);
  if (n > max) throw new ValidationError(field, `${field} must be ${max} or fewer`);
  return Math.floor(n);
}

/** Convert a thrown ValidationError into a Next.js 400 response payload. */
export function validationErrorResponse(err: unknown): { status: 400; body: { error: string; field?: string } } | null {
  if (err instanceof ValidationError) {
    return { status: 400, body: { error: err.message, field: err.field } };
  }
  return null;
}
