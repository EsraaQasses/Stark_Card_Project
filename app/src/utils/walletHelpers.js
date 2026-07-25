// ================================================
// src/utils/walletHelpers.js  (نسخة منقّحة نهائية)
// ================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

/* =============================
 * مفاتيح التخزين المحلية
 * ============================= */
const DEFAULT_WALLET_KEY = "@default_wallet_id";
const WALLETS_CACHE_KEY = "@wallets_cache";

/* =============================
 * إدارة الكاش المحلي للمحافظ
 * ============================= */

/** يقرأ كاش المحافظ (لو موجود محلياً) */
export async function readWalletCache() {
  try {
    const raw = await AsyncStorage.getItem(WALLETS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** يحفظ كاش المحافظ (للاستخدام لاحقاً عند عدم توفر شبكة) */
export async function writeWalletCache(data) {
  try {
    if (!data) return false;
    await AsyncStorage.setItem(WALLETS_CACHE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/* =============================
 * إدارة المحفظة الافتراضية
 * ============================= */

/** يحفظ wallet_id الافتراضي محلياً */
export async function setDefaultWalletId(id) {
  try {
    if (id == null) return false;
    await AsyncStorage.setItem(DEFAULT_WALLET_KEY, String(id));
    return true;
  } catch {
    return false;
  }
}

/** يقرأ wallet_id الافتراضي من التخزين المحلي */
export async function getDefaultWalletId() {
  try {
    const id = await AsyncStorage.getItem(DEFAULT_WALLET_KEY);
    return id ? Number(id) : null;
  } catch {
    return null;
  }
}

/** يحذف wallet_id الافتراضي */
export async function clearDefaultWalletId() {
  try {
    await AsyncStorage.removeItem(DEFAULT_WALLET_KEY);
    return true;
  } catch {
    return false;
  }
}

/* =============================
 * منطق التخمين من الكاش
 * ============================= */

/** محاولة ذكية لاستخراج wallet_id من كاش المحافظ عند غياب الافتراضي */
export async function guessWalletIdFromCache() {
  const c = await readWalletCache();
  if (!c) return null;

  // إذا الشكل كائن عملات
  if (c?.USD?.id) return Number(c.USD.id);
  if (c?.SYP?.id) return Number(c.SYP.id);

  // إذا الشكل مصفوفة محافظ
  if (Array.isArray(c) && c.length && c[0]?.id) {
    return Number(c[0].id);
  }

  return null;
}

/* =============================
 * دالة الحل الموحّدة
 * ============================= */

/**
 * يعيد wallet_id الافتراضي أو يحاول استنتاجه من الكاش المحلي
 * تُستخدم في كل مكان عند الحاجة لمعرفة محفظة المستخدم الحالية
 */
export async function resolveWalletId() {
  const def = await getDefaultWalletId();
  if (def != null) return def;

  const guessed = await guessWalletIdFromCache();
  return guessed ?? null;
}

/* =============================
 * التصدير العام للمفاتيح (لمن يحتاجها)
 * ============================= */
export { DEFAULT_WALLET_KEY, WALLETS_CACHE_KEY };
