export const APP_LOCK_PIN_LENGTH = 6;
export const APP_LOCK_FAILURES_BEFORE_DELAY = 5;

export interface AppLockRateLimit {
  failedAttempts: number;
  lockedUntil: number;
  lastFailureAt: number;
}

export const EMPTY_RATE_LIMIT: AppLockRateLimit = {
  failedAttempts: 0,
  lockedUntil: 0,
  lastFailureAt: 0,
};

const LOCKOUT_DELAYS_MS = [
  30_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
] as const;

export function normalizePin(value: string): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";

  return String(value)
    .split("")
    .map((character) => {
      const arabicIndex = arabicIndic.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);

      const easternIndex = easternArabicIndic.indexOf(character);
      if (easternIndex >= 0) return String(easternIndex);

      return character;
    })
    .join("")
    .replace(/\D/g, "")
    .slice(0, APP_LOCK_PIN_LENGTH);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${APP_LOCK_PIN_LENGTH}}$`).test(normalizePin(pin));
}

export function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export function sanitizeRateLimit(value: unknown): AppLockRateLimit {
  const input = value && typeof value === "object"
    ? value as Partial<AppLockRateLimit>
    : EMPTY_RATE_LIMIT;

  const failedAttempts = Number.isFinite(input.failedAttempts)
    ? Math.max(0, Math.floor(input.failedAttempts as number))
    : 0;
  const lockedUntil = Number.isFinite(input.lockedUntil)
    ? Math.max(0, Math.floor(input.lockedUntil as number))
    : 0;
  const lastFailureAt = Number.isFinite(input.lastFailureAt)
    ? Math.max(0, Math.floor(input.lastFailureAt as number))
    : 0;

  return { failedAttempts, lockedUntil, lastFailureAt };
}

export function getLockoutDelayMs(failedAttempts: number): number {
  if (failedAttempts < APP_LOCK_FAILURES_BEFORE_DELAY) return 0;

  const delayIndex = Math.min(
    failedAttempts - APP_LOCK_FAILURES_BEFORE_DELAY,
    LOCKOUT_DELAYS_MS.length - 1,
  );
  return LOCKOUT_DELAYS_MS[delayIndex];
}

export function recordFailedAttempt(
  current: AppLockRateLimit,
  now = Date.now(),
): AppLockRateLimit {
  const safeCurrent = sanitizeRateLimit(current);
  if (safeCurrent.lockedUntil > now) return safeCurrent;

  const failedAttempts = safeCurrent.failedAttempts + 1;
  const delay = getLockoutDelayMs(failedAttempts);

  return {
    failedAttempts,
    lastFailureAt: now,
    lockedUntil: delay > 0 ? now + delay : 0,
  };
}

export function resetRateLimit(): AppLockRateLimit {
  return { ...EMPTY_RATE_LIMIT };
}

export function getLockoutRemainingMs(
  rateLimit: AppLockRateLimit,
  now = Date.now(),
): number {
  return Math.max(0, sanitizeRateLimit(rateLimit).lockedUntil - now);
}
