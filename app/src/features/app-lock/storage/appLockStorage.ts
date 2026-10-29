import * as Crypto from "expo-crypto";

import {
  type AppLockRateLimit,
  constantTimeEqual,
  isValidPin,
  resetRateLimit,
  sanitizeRateLimit,
} from "../model/appLockPolicy";
import {
  getSecureItem,
  removeSecureItem,
  setSecureItem,
} from "../../../shared/storage/secureStorage";

const APP_LOCK_RECORD_VERSION = 1;
const APP_LOCK_KEY_PREFIX = "stark.app-lock.v1.";

export interface AppLockRecord extends AppLockRateLimit {
  version: typeof APP_LOCK_RECORD_VERSION;
  pinHash: string;
  salt: string;
  biometricsEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AppLockRecordResult =
  | { status: "missing" }
  | { status: "corrupt" }
  | { status: "ready"; record: AppLockRecord };

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA512, value);
}

async function getStorageKey(accountId: string) {
  const accountDigest = await digest(`stark-app-lock-account:${accountId}`);
  return `${APP_LOCK_KEY_PREFIX}${accountDigest.slice(0, 48)}`;
}

async function hashPin(accountId: string, pin: string, salt: string) {
  return digest(`stark-app-lock-pin:v1:${accountId}:${salt}:${pin}`);
}

function isValidRecord(value: unknown): value is AppLockRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AppLockRecord>;

  return record.version === APP_LOCK_RECORD_VERSION
    && typeof record.pinHash === "string"
    && /^[a-f\d]{128}$/i.test(record.pinHash)
    && typeof record.salt === "string"
    && /^[a-f\d]{32}$/i.test(record.salt)
    && typeof record.biometricsEnabled === "boolean"
    && Number.isFinite(record.createdAt)
    && Number.isFinite(record.updatedAt);
}

function normalizeRecord(record: AppLockRecord): AppLockRecord {
  return {
    ...record,
    ...sanitizeRateLimit(record),
  };
}

export async function loadAppLockRecord(accountId: string): Promise<AppLockRecordResult> {
  const key = await getStorageKey(accountId);
  const raw = await getSecureItem(key);
  if (raw == null) return { status: "missing" };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidRecord(parsed)) return { status: "corrupt" };
    return { status: "ready", record: normalizeRecord(parsed) };
  } catch {
    return { status: "corrupt" };
  }
}

export async function createAppLockRecord(
  accountId: string,
  pin: string,
  biometricsEnabled: boolean,
): Promise<AppLockRecord> {
  if (!isValidPin(pin)) throw new Error("PIN must contain exactly six digits.");

  const now = Date.now();
  const salt = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const record: AppLockRecord = {
    version: APP_LOCK_RECORD_VERSION,
    pinHash: await hashPin(accountId, pin, salt),
    salt,
    biometricsEnabled,
    createdAt: now,
    updatedAt: now,
    ...resetRateLimit(),
  };

  await saveAppLockRecord(accountId, record);
  return record;
}

export async function saveAppLockRecord(
  accountId: string,
  record: AppLockRecord,
): Promise<void> {
  const key = await getStorageKey(accountId);
  const next = normalizeRecord({ ...record, updatedAt: Date.now() });
  await setSecureItem(key, JSON.stringify(next));
}

export async function verifyAppLockPin(
  accountId: string,
  pin: string,
  record: AppLockRecord,
): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const candidate = await hashPin(accountId, pin, record.salt);
  return constantTimeEqual(candidate, record.pinHash);
}

export async function removeAppLockRecord(accountId: string): Promise<void> {
  const key = await getStorageKey(accountId);
  await removeSecureItem(key);
}
