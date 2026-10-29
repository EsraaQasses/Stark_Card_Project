import { AUTH_STORAGE_KEYS } from "./storageKeys";
import { getItem, getJson, removeItem, removeMany, setItem, setJson } from "./appStorage";
import {
  moveLegacyItemToSecureStorage,
  removeSecureItem,
  setSecureItem,
  usesNativeSecureStorage,
} from "./secureStorage";

const SENSITIVE_SESSION_FIELD_NAMES = new Set([
  "access",
  "access_token",
  "accesstoken",
  "auth_token",
  "authtoken",
  "refresh",
  "refresh_token",
  "refreshtoken",
  "token",
]);

function removeSensitiveSessionFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeSensitiveSessionFields);
  }

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_SESSION_FIELD_NAMES.has(key.toLowerCase()))
      .map(([key, child]) => [key, removeSensitiveSessionFields(child)]),
  );
}

async function getSensitiveItem(key: string): Promise<string | null> {
  return moveLegacyItemToSecureStorage(key);
}

async function setSensitiveItem(key: string, value: string): Promise<void> {
  await setSecureItem(key, value);
  if (usesNativeSecureStorage()) await removeItem(key);
}

async function removeSensitiveItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map(removeSecureItem));
  // Also remove plaintext copies from installs predating this migration.
  await removeMany(keys);
}

export async function getAccessToken(): Promise<string | null> {
  return getSensitiveItem(AUTH_STORAGE_KEYS.access);
}

export async function setAccessToken(token: string): Promise<void> {
  await setSensitiveItem(AUTH_STORAGE_KEYS.access, String(token));
}

export async function removeAccessToken(): Promise<void> {
  await removeSensitiveItems([AUTH_STORAGE_KEYS.access]);
}

export async function getLegacyAuthToken(): Promise<string | null> {
  return getSensitiveItem(AUTH_STORAGE_KEYS.legacyAuthToken);
}

export async function setLegacyAuthToken(token: string): Promise<void> {
  await setSensitiveItem(AUTH_STORAGE_KEYS.legacyAuthToken, String(token));
}

export async function removeLegacyAuthToken(): Promise<void> {
  await removeSensitiveItems([AUTH_STORAGE_KEYS.legacyAuthToken]);
}

export async function getLegacyAccessToken(): Promise<string | null> {
  return getSensitiveItem(AUTH_STORAGE_KEYS.legacyAccessToken);
}

export async function setLegacyAccessToken(token: string): Promise<void> {
  await setSensitiveItem(AUTH_STORAGE_KEYS.legacyAccessToken, String(token));
}

export async function removeLegacyAccessToken(): Promise<void> {
  await removeSensitiveItems([AUTH_STORAGE_KEYS.legacyAccessToken]);
}

export async function getAuthorizationToken(): Promise<string | null> {
  return (await getAccessToken()) || (await getLegacyAuthToken());
}

export async function setAuthTokens({
  access,
  refresh,
}: {
  access?: string | null;
  refresh?: string | null;
}): Promise<void> {
  const writes: Promise<void>[] = [];

  if (access) {
    writes.push(setAccessToken(access));
    writes.push(setLegacyAuthToken(access));
  }

  if (refresh) {
    writes.push(setRefreshToken(refresh));
  }

  await Promise.all(writes);
}

export async function getRefreshToken(): Promise<string | null> {
  return getSensitiveItem(AUTH_STORAGE_KEYS.refresh);
}

export async function setRefreshToken(token: string): Promise<void> {
  await setSensitiveItem(AUTH_STORAGE_KEYS.refresh, String(token));
}

export async function removeRefreshToken(): Promise<void> {
  await removeSensitiveItems([AUTH_STORAGE_KEYS.refresh]);
}

export async function removeAccessAndRefreshTokens(): Promise<void> {
  await removeSensitiveItems([
    AUTH_STORAGE_KEYS.access,
    AUTH_STORAGE_KEYS.refresh,
  ]);
}

export async function clearAuthTokens(): Promise<void> {
  await removeSensitiveItems([
    AUTH_STORAGE_KEYS.access,
    AUTH_STORAGE_KEYS.refresh,
    AUTH_STORAGE_KEYS.legacyAuthToken,
    AUTH_STORAGE_KEYS.legacyAccessToken,
  ]);
}

export async function getUserSession<T = unknown>(): Promise<T | null> {
  const stored = await getJson<T>(AUTH_STORAGE_KEYS.user);
  if (!stored) return null;

  const sanitized = removeSensitiveSessionFields(stored) as T;
  await setJson(AUTH_STORAGE_KEYS.user, sanitized);
  return sanitized;
}

export async function getFirstCompatibleUserSession<T = unknown>(): Promise<T | null> {
  const keys = [
    AUTH_STORAGE_KEYS.user,
    AUTH_STORAGE_KEYS.authUser,
    AUTH_STORAGE_KEYS.profile,
  ];

  for (const key of keys) {
    const parsed = await getJson<T>(key);
    if (parsed && typeof parsed === "object") {
      const sanitized = removeSensitiveSessionFields(parsed) as T;
      await setJson(key, sanitized);
      return sanitized;
    }
  }

  return null;
}

export async function setUserSession(user: unknown): Promise<void> {
  await setJson(AUTH_STORAGE_KEYS.user, removeSensitiveSessionFields(user));
}

export async function setCompatibleUserSession(user: unknown): Promise<void> {
  const sanitized = removeSensitiveSessionFields(user);
  await Promise.all([
    setJson(AUTH_STORAGE_KEYS.user, sanitized),
    setJson(AUTH_STORAGE_KEYS.profile, sanitized),
    setJson(AUTH_STORAGE_KEYS.authUser, sanitized),
  ]);
}

export async function removeUserSession(): Promise<void> {
  await removeMany([
    AUTH_STORAGE_KEYS.user,
    AUTH_STORAGE_KEYS.authUser,
    AUTH_STORAGE_KEYS.profile,
  ]);
}

export async function getBootDoneForUser(userId?: string | number | null): Promise<string | null> {
  return getItem(`${AUTH_STORAGE_KEYS.bootDonePrefix}${userId || "anon"}`);
}

export async function setBootDoneForUser(userId?: string | number | null): Promise<void> {
  await setItem(`${AUTH_STORAGE_KEYS.bootDonePrefix}${userId || "anon"}`, "1");
}

export async function clearAuthStorage(): Promise<void> {
  await clearAuthTokens();
  await removeMany([
    AUTH_STORAGE_KEYS.user,
    AUTH_STORAGE_KEYS.authUser,
    AUTH_STORAGE_KEYS.profile,
  ]);
}
