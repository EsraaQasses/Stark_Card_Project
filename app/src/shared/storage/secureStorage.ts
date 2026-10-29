import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import {
  getItem as getFallbackItem,
  removeItem as removeFallbackItem,
  setItem as setFallbackItem,
} from "./appStorage";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function usesNativeSecureStorage() {
  return Platform.OS === "android" || Platform.OS === "ios";
}

/**
 * Native builds use Keychain/Keystore. The AsyncStorage fallback only keeps the
 * existing web build working; this feature is a mobile security boundary.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (!usesNativeSecureStorage()) return getFallbackItem(key);
  return SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (!usesNativeSecureStorage()) {
    await setFallbackItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
}

export async function removeSecureItem(key: string): Promise<void> {
  if (!usesNativeSecureStorage()) {
    await removeFallbackItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
}

export async function moveLegacyItemToSecureStorage(
  key: string,
): Promise<string | null> {
  if (!usesNativeSecureStorage()) return getFallbackItem(key);

  const secured = await getSecureItem(key);
  if (secured != null) {
    // Remove any stale plaintext copy left by an interrupted migration.
    await removeFallbackItem(key);
    return secured;
  }

  const legacyValue = await getFallbackItem(key);
  if (legacyValue == null) return null;

  // Write first, verify, and only then remove the recoverable legacy copy.
  await setSecureItem(key, legacyValue);
  const migratedValue = await getSecureItem(key);
  if (migratedValue !== legacyValue) {
    throw new Error(`Secure storage migration failed for ${key}`);
  }

  await removeFallbackItem(key);
  return migratedValue;
}
