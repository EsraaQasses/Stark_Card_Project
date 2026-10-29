export interface AppLockUserIdentity {
  id?: string | number | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  raw?: unknown;
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function getAppLockAccountId(user: AppLockUserIdentity | null): string | null {
  if (!user) return null;

  const raw = user.raw && typeof user.raw === "object"
    ? user.raw as Record<string, unknown>
    : {};
  const nested = raw.user && typeof raw.user === "object"
    ? raw.user as Record<string, unknown>
    : {};
  const id = firstNonEmpty(user.id, raw.id, raw.pk, nested.id, nested.pk);
  if (id) return `id:${id}`;

  const username = firstNonEmpty(user.username, raw.username, nested.username);
  if (username) return `username:${username.toLowerCase()}`;

  const email = firstNonEmpty(user.email, raw.email, nested.email);
  if (email) return `email:${email.toLowerCase()}`;

  const phone = firstNonEmpty(user.phone, raw.phone, raw.phone_number, nested.phone);
  return phone ? `phone:${phone}` : null;
}
