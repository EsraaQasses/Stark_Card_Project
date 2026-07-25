// src/api/transactions.js
import api from "./client";

/**
 * جلب قائمة العمليات
 * يدعم pagination و filtering
 */
export async function getTransactions(params = {}) {
  try {
    const { data } = await api.get("transactions/transactions/", { params });
    const list = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
    return {
      ok: true,
      data: list,
      pagination: normalizePagination(data, params),
      raw: data,
    };
  } catch (error) {
    return {
      ok: false,
      error: extractErrorMessage(error),
      data: [],
      raw: error?.response?.data,
    };
  }
}

/**
 * جلب تفاصيل عملية واحدة
 */
export async function getTransactionById(id) {
  try {
    const { data } = await api.get(`transactions/transactions/${id}/`);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * جلب ملخص مالي (للأدمن فقط)
 */
export async function getFinancialSummary(params = {}) {
  try {
    const { data } = await api.get("transactions/financial/summary/", { params });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * ملخص مالي للوكيل
 */
export async function getAgentFinancialSummary(params = {}) {
  try {
    const { data } = await api.get("transactions/financial/summary/agent/", { params });
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: extractErrorMessage(error),
      data: null,
      status: error?.response?.status,
      raw: error?.response?.data,
    };
  }
}

/**
 * موافقة على عملية (للأدمن فقط)
 */
export async function approveTransaction(id, action = "approve") {
  try {
    const { data } = await api.post(`transactions/approve/${id}/`, { action });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * إنشاء عملية تحويل
 */
export async function lookupRecipientByPhone(phone) {
  try {
    const { data } = await api.get("transactions/transfer/lookup/", { params: { phone } });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}


export async function lookupRecipientByWallet(wallet_id) {
  try {
    const { data } = await api.get("transactions/transfer/lookup/", { params: { wallet_id } });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}


export async function createTransfer(payload) {
  try {
    const { data } = await api.post("transactions/transfer/", payload);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * Helpers
 */
function normalizePagination(data, params) {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, page: 1 };
  }
  return {
    count: data?.count ?? 0,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    page: Number(params?.page) || 1,
  };
}

function extractErrorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "فشل الطلب"
  );
}

export default {
  getTransactions,
  getTransactionById,
  getFinancialSummary,
  getAgentFinancialSummary,
  approveTransaction,
  lookupRecipientByPhone,
  lookupRecipientByWallet,
  createTransfer,
};
