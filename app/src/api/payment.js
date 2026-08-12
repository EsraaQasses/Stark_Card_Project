// ================================================
// src/api/payment.js  (نسخة منقّحة + Summary Normalization)
// ================================================

import api, { buildUrl, STORE_PREFIX } from "./client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setDefaultWalletId, getDefaultWalletId } from "../utils/walletHelpers";

/* =============================
 * واجهة توافقية (Compatibility Layer)
 * ============================= */

export { setDefaultWalletId, getDefaultWalletId };

/**
 * يحاول استخراج wallet_id من route.params
 * وإن لم يجد يرجع الافتراضي من التخزين المحلي
 */
export async function resolveWalletId(routeParams) {
  const fromRoute = routeParams?.wallet_id;
  if (fromRoute != null) return Number(fromRoute);
  const fromLocal = await getDefaultWalletId();
  return fromLocal != null ? Number(fromLocal) : null;
}

/**
 * يحاول حلّ رقم هاتف إلى wallet_id عبر عدة مسارات
 * أو يرجع null إذا لم يُوجد مطابق
 */
export async function resolveRecipient({ phone, wallet_id }) {
  try {
    if (Number.isFinite(Number(wallet_id))) {
      return { ok: true, wallet_id: Number(wallet_id) };
    }

    if (phone) {
      const cleanedPhone = String(phone).trim();
      if (cleanedPhone.length < 9) {
        return { ok: false, error: "رقم الهاتف قصير جداً" };
      }

      const { data } = await api.get("transactions/transfer/lookup/", {
        params: { phone: cleanedPhone },
      });
      const recipientWallet = Array.isArray(data?.wallets) ? data.wallets[0] : null;
      const wid = Number(recipientWallet?.id);
      if (wid > 0) {
        return {
          ok: true,
          wallet_id: wid,
          recipient: data,
        };
      }
    }

    return { ok: false, error: "لم يتم العثور على المحفظة", wallet_id: null };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), wallet_id: null };
  }
}

/* =============================
 * Endpoints الشبكة
 * ============================= */

/**
 * GET /payment/config/
 * يجلب إعدادات الدفع العامة (profit_percentage, updated_at)
 */
export async function getPaymentConfig() {
  try {
    const { data } = await api.get("payment/config/");
    return { ok: true, data };
  } catch (e) {
    const payload = e?.response?.data;
    const msg =
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" ? payload : "Failed to load payment config");
    return { ok: false, error: msg, raw: payload };
  }
}

/**
 * POST /store/user/purchases/
 * Body: { store_product_id or product_id, user_inputs }
 */
export async function createPurchaseTransaction({ store_product_id, product_id, user_inputs = {} }) {
  try {
    const safeInputs = user_inputs && typeof user_inputs === "object" ? user_inputs : {};

    const payload = { user_inputs: safeInputs };

    if (store_product_id != null) {
      payload.store_product_id = Number(store_product_id);
    } else if (product_id != null) {
      payload.product_id = Number(product_id);
    } else {
      return { ok: false, error: "Either store_product_id or product_id is required" };
    }

    const url = buildUrl(STORE_PREFIX, "user/purchases/");
    const { data } = await api.post(url, payload);
    return { ok: true, data };
  } catch (e) {
    const status = e?.response?.status;
    const payload = e?.response?.data;

    if (status === 401) return { ok: false, unauth: true, error: "Unauthorized" };

    const msg =
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" ? payload : "Payment request failed");

    return { ok: false, error: msg, raw: payload };
  }
}

/**
 * ✅ دالة شاملة لمعالجة الدفع الكامل
 * تطبق نفس منطق الباك إند: التحقق من الرصيد + الحجز + API + التحديث
 */
export async function processCompletePayment({
  store_product_id,
  product_id,
  user_inputs = {},
  walletBalance = 0,
  finalAmount = 0,
  currency = "SYP",
  amount = null,
  selected_option = null,
  wallet_currency = null,
}) {
  try {
    if (store_product_id == null && product_id == null) {
      return { ok: false, error: "معرّف المنتج مطلوب", step: "validation" };
    }

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return { ok: false, error: "المبلغ غير صحيح", step: "validation" };
    }

    if (!Number.isFinite(walletBalance)) {
      return { ok: false, error: "لا يمكن قراءة رصيد المحفظة", step: "validation" };
    }

    if (walletBalance <= 0) {
      return {
        ok: false,
        error: "لا يوجد رصيد في محفظتك",
        step: "balance_check",
        required: finalAmount,
        available: walletBalance,
      };
    }

    if (walletBalance < finalAmount) {
      return {
        ok: false,
        error: `رصيد غير كافٍ. المطلوب: ${finalAmount} ${currency}, المتاح: ${walletBalance} ${currency}`,
        step: "balance_check",
        required: finalAmount,
        available: walletBalance,
      };
    }

    const safeInputs = user_inputs && typeof user_inputs === "object" ? user_inputs : {};

    let wallet_currency_final = wallet_currency;
    if (!wallet_currency_final) {
      try {
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          wallet_currency_final = user?.currency_preference || "USD";
        }
      } catch (_e) {
        console.warn("Failed to get user currency preference, using USD");
      }
    }
    wallet_currency_final = wallet_currency_final || "USD";

    const payload = {
      user_inputs: {
        ...safeInputs,
        payment_processed_at: new Date().toISOString(),
        final_amount_submitted: finalAmount,
        currency_submitted: currency,
        wallet_balance_before_payment: walletBalance,
      },
      wallet_currency: wallet_currency_final,
    };

    if (amount != null) {
      payload.amount = typeof amount === "string" ? amount : String(amount);
    }

    if (selected_option != null) {
      payload.selected_option = String(selected_option);
    }

    if (store_product_id != null) payload.store_product_id = Number(store_product_id);
    else payload.product_id = Number(product_id);

    const url = buildUrl(STORE_PREFIX, "user/purchases/");
    const { data } = await api.post(url, payload);

    if (data?.success || data?.transaction_id) {
      return {
        ok: true,
        step: "payment_success",
        data: {
          transaction_id: data.transaction_id,
          payment_id: data.payment_id,
          order_id: data.order_id,
          external_transaction_id: data.external_transaction_id,
          new_balance: data.new_balance,
          message: data.message || "تمت عملية الدفع بنجاح",
        },
      };
    }

    if (data?.message) {
      return { ok: true, step: "payment_success", data };
    }

    return { ok: false, error: data?.error || "فشلت عملية الدفع", step: "payment_processing", raw: data };
  } catch (e) {
    const status = e?.response?.status;
    const payload = e?.response?.data;

    if (status === 401) {
      return { ok: false, unauth: true, error: "جلستك انتهت، يرجى تسجيل الدخول من جديد", step: "auth" };
    }

    if (status === 400) {
      const details =
        payload?.errors ||
        payload?.detail ||
        payload?.error ||
        payload?.message ||
        "بيانات غير صحيحة";
      if (__DEV__) {
        console.log("Purchase 400 payload:", payload);
      }
      return { ok: false, error: details, step: "validation", raw: payload };
    }

    if (status === 404) {
      return { ok: false, error: "المنتج غير موجود", step: "product_not_found", raw: payload };
    }

    const msg =
      payload?.detail ||
      payload?.error ||
      payload?.message ||
      (typeof payload === "string" ? payload : "حدث خطأ في الدفع");

    return { ok: false, error: msg, step: "api_error", status: status, raw: payload };
  }
}

/**
 * GET /payment/payment/
 * يجلب تاريخ المدفوعات مع دعم الصفحات والفلاتر
 */
export async function listPaymentsHistory(params = {}) {
  try {
    const { data } = await api.get("payment/payment/", { params });
    const items = Array.isArray(data) ? data : data?.results || [];
    const pagination = normalizePagination(data, params);
    return { ok: true, data: items, pagination };
  } catch (e) {
    const payload = e?.response?.data;
    const msg =
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" ? payload : "Failed to load payments history");
    return { ok: false, error: msg, raw: payload };
  }
}

/**
 * ✅ GET /payment/payment/stats/
 * يرجّع Summary موحّد للواجهة:
 * { total, success, failed, pending, raw }
 */
export async function getPaymentsStatusSummary() {
  try {
    const { data } = await api.get("payment/payment/stats/");

    const raw = data || {};

    // الباك الموثوق (حسب views.py)
    const total = num(raw.total_payments ?? raw.total ?? raw.totalPayments ?? 0);
    const success = num(raw.successful_payments ?? raw.success ?? raw.successful ?? 0);
    const failed = num(raw.failed_payments ?? raw.failed ?? 0);

    // pending غالباً يشمل pending + processing
    const pending = num(raw.pending_payments ?? raw.pending ?? raw.processing_payments ?? 0);

    return {
      ok: true,
      data: { total, success, failed, pending, raw },
    };
  } catch (e) {
    const status = e?.response?.status;
    if (status === 404) {
      return {
        ok: true,
        data: { total: 0, success: 0, failed: 0, pending: 0, raw: null },
        missing: true,
      };
    }

    const payload = e?.response?.data;
    const msg =
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" ? payload : "Failed to load payments summary");
    return { ok: false, error: msg, raw: payload };
  }
}

/**
 * GET /payment/payment/{id}/
 * تفاصيل دفعة واحدة
 */
export async function getPaymentById(id) {
  try {
    const { data } = await api.get(`payment/payment/${id}/`);
    return { ok: true, data };
  } catch (e) {
    const payload = e?.response?.data;
    const msg =
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" ? payload : "Failed to load payment");
    return { ok: false, error: msg, raw: payload };
  }
}

/* =============================
 * Helpers داخلية
 * ============================= */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizePagination(data, params) {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, page: 1, page_size: data.length };
  }

  const count = Number.isFinite(data?.count) ? data.count : data?.results?.length ?? 0;
  const next = data?.next ?? null;
  const previous = data?.previous ?? null;

  const page =
    Number(params?.page) ||
    extractQueryNumber(next, "page") ||
    extractQueryNumber(previous, "page") ||
    1;

  const page_size =
    Number(params?.page_size) ||
    extractQueryNumber(next, "page_size") ||
    extractQueryNumber(previous, "page_size") ||
    (Array.isArray(data?.results) ? data.results.length : 0);

  return { count, next, previous, page, page_size };
}

function extractQueryNumber(url, key) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const v = u.searchParams.get(key);
    return v != null ? Number(v) : null;
  } catch {
    const m = url.match(new RegExp(`[?&]${key}=([^&]+)`));
    return m ? Number(m[1]) : null;
  }
}

function extractErrorMessage(error, defaultMsg = "فشل الطلب") {
  if (typeof error === "string") return error;
  if (error?.detail) return error.detail;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return defaultMsg;
}
