// /src/api/wallets.js
import api from "./client";
import { writeWalletCache } from "../utils/walletHelpers";
import { listDepositRequests, getDepositCounts as getDepositCountsFromAPI } from "./deposits";

// Compatibility API: existing screens still import these throwing functions.
// New wallet API integrations should prefer src/features/wallet/api/walletApi.ts.

/**
 * normalizeWalletPayload:
 * - يوحّد keys
 * - يحسب totals
 * - يوحّد اسم العملة المفضلة preferred_currency
 * - يولّد ids محلية للاستخدام بالواجهة فقط (ليست wallet_id حقيقية من الباك)
 */
function normalizeWalletPayload(raw) {
  const data = raw || {};

  const USD = data.USD || {};
  const SYP = data.SYP || {};

  const toNum = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    const n = Number(String(v).replace(/[^\d.\-]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const usdTotal = toNum(USD.total ?? (toNum(USD.available) + toNum(USD.pending)));
  const sypTotal = toNum(SYP.total ?? (toNum(SYP.available) + toNum(SYP.pending)));

  const preferred_currency =
    data.preferred_currency ??
    data.currency_preference ?? // ✅ الباك بيرجعها هيك
    "USD";

  // ids محلية ثابتة للـ UI (مش صالحة للباك)
  // الهدف: تخلي واجهة "محفظتين" تشتغل بدون nulls
  const localUsdId = `LOCAL-USD`;
  const localSypId = `LOCAL-SYP`;

  return {
    ...data,
    USD: { currency: "USD", ...USD },
    SYP: { currency: "SYP", ...SYP },

    preferred_currency,
    recent_transactions: data?.recent_transactions || [], // Preserve recent transactions

    totals: {
      usd: toNum(data?.totals?.usd ?? usdTotal),
      syp: toNum(data?.totals?.syp ?? sypTotal),
    },

    // فقط للـ UI
    wallet_ids: {
      usd: data?.wallet_ids?.usd ?? USD?.id ?? localUsdId,
      syp: data?.wallet_ids?.syp ?? SYP?.id ?? localSypId,
      // مؤشر واضح أنه IDs محلية وليست من الباك
      is_local: !(USD?.id || SYP?.id),
    },
  };
}

export async function getWallet() {
  const { data } = await api.get("/wallets/wallet/"); // /api/wallets/wallet/
  const normalized = normalizeWalletPayload(data);

  try {
    await writeWalletCache(normalized);
  } catch {}

  return normalized;
}

export async function getExchangeRate() {
  const { data } = await api.get("/wallets/exchange-rate/"); // /api/wallets/exchange-rate/
  return data;
}

export async function changeUserCurrency(currency) {
  const { data } = await api.put("/wallets/change-currency/", { currency }); // /api/wallets/change-currency/
  return data;
}

export async function getDeposits(params = {}) {
  return listDepositRequests(params);
}

export async function getDepositCounts() {
  return getDepositCountsFromAPI();
}

/**
 * normalizeWalletsResponse:
 * - دعم شكل الكائن حسب العملة
 * - الآن يدعم أيضًا wallet_ids من normalizeWalletPayload
 */
export function normalizeWalletsResponse(data) {
  if (!data) return [];

  // إذا كانت مصفوفة
  if (Array.isArray(data)) {
    return data.map((w) => ({
      id: w?.id ?? null,
      currency: (w?.currency || w?.code || w?.curr || "").toString().toUpperCase(),
      available: w?.available ?? w?.available_balance ?? w?.balance ?? 0,
      pending: w?.pending ?? w?.pending_balance ?? 0,
      total:
        w?.total ??
        ((w?.available ?? w?.available_balance ?? 0) +
          (w?.pending ?? w?.pending_balance ?? 0)),
      raw: w,
    }));
  }

  const out = [];

  // مرجع IDs محلية لو موجودة
  const wid = data?.wallet_ids || {};

  for (const key of Object.keys(data)) {
    const v = data[key];
    if (
      key === "totals" ||
      key === "exchange_rates" ||
      key === "preferred_currency" ||
      key === "currency_preference" ||
      key === "wallet_ids"
    ) {
      continue;
    }

    const cur = (v?.currency || key || "").toString().toUpperCase();
    const id =
      v?.id ??
      (cur === "USD" ? wid.usd : cur === "SYP" ? wid.syp : null) ??
      null;

    out.push({
      id,
      currency: cur,
      available: v?.available ?? v?.available_balance ?? v?.balance ?? 0,
      pending: v?.pending ?? v?.pending_balance ?? 0,
      total:
        v?.total ??
        ((v?.available ?? v?.available_balance ?? 0) +
          (v?.pending ?? v?.pending_balance ?? 0)),
      raw: { ...v, currency: cur, id },
    });
  }

  return out;
}

/**
 * normalizeExchangeRates: كما هو (ممتاز)
 */
export function normalizeExchangeRates(source) {
  if (!source) return { usd_to_syp: null, syp_to_usd: null };
  const r = source.exchange_rates || source || {};

  const num = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "object" && v.value != null) {
      return typeof v.value === "number" ? v.value : Number(v.value);
    }
    if (v.USD_to_SYP != null) return Number(v.USD_to_SYP);
    if (v.SYP_to_USD != null) return Number(v.SYP_to_USD);
    if (v.usdToSyp != null) return Number(v.usdToSyp);
    if (v.sypToUsd != null) return Number(v.sypToUsd);
    return Number(v) || null;
  };

  return {
    usd_to_syp: num(r.usd_to_syp ?? r.USD_to_SYP ?? r.usdToSyp),
    syp_to_usd: num(r.syp_to_usd ?? r.SYP_to_USD ?? r.sypToUsd),
  };
}
