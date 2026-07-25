// src/utils/cache.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@cache:";

function now() {
  return Date.now();
}

export async function getCache(key, maxAgeMs) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (maxAgeMs && parsed.ts && now() - parsed.ts > maxAgeMs) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export async function setCache(key, data) {
  try {
    const payload = JSON.stringify({ ts: now(), data });
    await AsyncStorage.setItem(PREFIX + key, payload);
  } catch {
    // ignore cache write failures
  }
}

export async function clearCache(key) {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export function cacheKey(...parts) {
  return parts.filter(Boolean).join(":");
}
