import { AUTH_STORAGE_KEYS } from "./storageKeys";
import { getItem, getJson, removeItem, removeMany, setItem, setJson } from "./appStorage";

// TODO: migrate sensitive auth tokens from AsyncStorage to expo-secure-store in a later security migration.

export async function getAccessToken(): Promise<string | null> {
  return getItem(AUTH_STORAGE_KEYS.access);
}

export async function setAccessToken(token: string): Promise<void> {
  await setItem(AUTH_STORAGE_KEYS.access, String(token));
}

export async function removeAccessToken(): Promise<void> {
  await removeItem(AUTH_STORAGE_KEYS.access);
}

export async function getLegacyAuthToken(): Promise<string | null> {
  return getItem(AUTH_STORAGE_KEYS.legacyAuthToken);
}

export async function setLegacyAuthToken(token: string): Promise<void> {
  await setItem(AUTH_STORAGE_KEYS.legacyAuthToken, String(token));
}

export async function removeLegacyAuthToken(): Promise<void> {
  await removeItem(AUTH_STORAGE_KEYS.legacyAuthToken);
}

export async function getLegacyAccessToken(): Promise<string | null> {
  return getItem(AUTH_STORAGE_KEYS.legacyAccessToken);
}

export async function setLegacyAccessToken(token: string): Promise<void> {
  await setItem(AUTH_STORAGE_KEYS.legacyAccessToken, String(token));
}

export async function removeLegacyAccessToken(): Promise<void> {
  await removeItem(AUTH_STORAGE_KEYS.legacyAccessToken);
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
  return getItem(AUTH_STORAGE_KEYS.refresh);
}

export async function setRefreshToken(token: string): Promise<void> {
  await setItem(AUTH_STORAGE_KEYS.refresh, String(token));
}

export async function removeRefreshToken(): Promise<void> {
  await removeItem(AUTH_STORAGE_KEYS.refresh);
}

export async function removeAccessAndRefreshTokens(): Promise<void> {
  await removeMany([
    AUTH_STORAGE_KEYS.access,
    AUTH_STORAGE_KEYS.refresh,
  ]);
}

export async function clearAuthTokens(): Promise<void> {
  await removeMany([
    AUTH_STORAGE_KEYS.access,
    AUTH_STORAGE_KEYS.refresh,
    AUTH_STORAGE_KEYS.legacyAuthToken,
  ]);
}

export async function getUserSession<T = unknown>(): Promise<T | null> {
  return getJson<T>(AUTH_STORAGE_KEYS.user);
}

export async function getFirstCompatibleUserSession<T = unknown>(): Promise<T | null> {
  const keys = [
    AUTH_STORAGE_KEYS.user,
    AUTH_STORAGE_KEYS.authUser,
    AUTH_STORAGE_KEYS.profile,
  ];

  for (const key of keys) {
    const parsed = await getJson<T>(key);
    if (parsed && typeof parsed === "object") return parsed;
  }

  return null;
}

export async function setUserSession(user: unknown): Promise<void> {
  await setJson(AUTH_STORAGE_KEYS.user, user);
}

export async function setCompatibleUserSession(user: unknown): Promise<void> {
  await Promise.all([
    setJson(AUTH_STORAGE_KEYS.user, user),
    setJson(AUTH_STORAGE_KEYS.profile, user),
    setJson(AUTH_STORAGE_KEYS.authUser, user),
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
  await removeMany([
    AUTH_STORAGE_KEYS.access,
    AUTH_STORAGE_KEYS.refresh,
    AUTH_STORAGE_KEYS.legacyAuthToken,
    AUTH_STORAGE_KEYS.user,
    AUTH_STORAGE_KEYS.authUser,
    AUTH_STORAGE_KEYS.profile,
  ]);
}
