// src/api/deposits.js
import api from "./client";

// حارس بسيط للأرقام
const toPosNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const trimNote = (s, max = 1000) => {
  if (!s) return "";
  const t = String(s).trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
};

// مفيد لمنع تكرار الإنشاء عند الضغط المزدوج
const makeIdempotencyKey = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * ينشئ "طلب شحن رصيد" (سيناريو 1) مباشرةً في shipping/standard
 * → الأدمن يوافق → يتم شحن المحفظة.
 */
export async function createDepositRequest({
  // wallet_id ما عاد نستعمله، بس تركناه للتوافق لو في استدعاءات قديمة
  wallet_id,
  currency,        // "USD" / "SYP" أو أي case
  amount,
  method,          // "manual" | "agent" | "bank" ...
  note,
  receipt,         // { uri, name, type } optional
  evidence_url,    // مستقبلاً: صورة إيصال
  payment_method,  // ID من جدول payment_methods (اختياري)
  extra = {},
  idempotencyKey,
}) {
  const amt = toPosNumber(amount);
  if (!amt) return { ok: false, error: "Invalid amount" };

  // ✅ نخليها Uppercase لتتوافق مع Wallet/Backend ("USD" / "SYP")
  const curRaw = (currency || "").toString().trim();
  const cur = curRaw ? curRaw.toUpperCase() : null;

  if (cur !== "USD" && cur !== "SYP") {
    return { ok: false, error: "Unsupported currency" };}

  const normalizedNote = trimNote(note);

  const headers = {
    "X-Idempotency-Key": idempotencyKey || makeIdempotencyKey(),
  };

  const pmIdRaw = payment_method;
  const pmIdNum = Number(pmIdRaw);
  const pmId = Number.isFinite(pmIdNum) ? pmIdNum : null;

  const payload = {
    amount: amt,
    currency: cur,
    wallet_currency: cur,
    ...(pmId ? { payment_method: pmId } : {}),
    user_input_data: {
      method: method || "manual",
      note: normalizedNote,
      ...extra,
    },
  };

  try {
    if (receipt?.uri) {
      const form = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (k === "user_input_data") {
          form.append(k, JSON.stringify(v || {}));
        } else if (v != null) {
          form.append(k, v);
        }
      });
      form.append("receipt_image", {
        uri: receipt.uri,
        name: receipt.name || "receipt.jpg",
        type: receipt.type || "image/jpeg",
      });

      const { data } = await api.post(
        "shipping/standard/",
        form,
        { headers: { ...headers, "Content-Type": "multipart/form-data" } }
      );
      return shapeOk(data, "request");
    }

    const { data } = await api.post(
      "shipping/standard/",
      payload,
      { headers }
    );
    return shapeOk(data, "request");
  } catch (_e) {
    const err = _e?.response?.data || _e;
    return {
      ok: false,
      error: extractMsg(err),
      raw: err,
    };
  }
}

/**
 * Create agent shipping request (سيناريو 2).
 */
export async function createAgentShippingRequest({
  amount,
  currency,
  note,
  payment_method,
  wallet_currency,
  extra = {},
  receipt,
}) {
  const amt = toPosNumber(amount);
  if (!amt) return { ok: false, error: "Invalid amount" };

  const curRaw = (currency || "").toString().trim();
  const cur = curRaw ? curRaw.toUpperCase() : null;
  if (cur !== "USD" && cur !== "SYP") {
    return { ok: false, error: "Unsupported currency" };
  }

  const walletCurRaw = (wallet_currency || "").toString().trim();
  const walletCur = walletCurRaw ? walletCurRaw.toUpperCase() : null;
  if (walletCur !== "USD" && walletCur !== "SYP") {
    return { ok: false, error: "wallet_currency is required" };
  }

  try {
    const headers = {
      "X-Idempotency-Key": makeIdempotencyKey(),
    };
    const payload = {
      amount: amt,
      currency: cur,
      wallet_currency: walletCur,
      note: trimNote(note),
      user_input_data: {
        ...extra,
        wallet_currency: walletCur,
        note: trimNote(note),
        shipping_channel: "agent",
      },
    };

    if (receipt?.uri) {
      const form = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (k === "user_input_data") {
          form.append(k, JSON.stringify(v || {}));
        } else if (v != null) {
          form.append(k, v);
        }
      });
      form.append("receipt_image", {
        uri: receipt.uri,
        name: receipt.name || "receipt.jpg",
        type: receipt.type || "image/jpeg",
      });
      const { data } = await api.post("shipping/via-agent/", form, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      return shapeOk(data, "request");
    }

    const { data } = await api.post("shipping/via-agent/", payload, { headers });
    return shapeOk(data, "request");
  } catch (_e) {
    const err = _e?.response?.data || _e;
    return {
      ok: false,
      error: extractMsg(err),
      raw: err,
    };
  }
}

/**
 * Agent cashout via admin (Agent -> Admin).
 */
export async function createAgentCashoutRequest({
  amount,
  currency,
  note,
  wallet_currency,
  extra = {},
}) {
  const amt = toPosNumber(amount);
  if (!amt) return { ok: false, error: "Invalid amount" };

  const curRaw = (currency || "").toString().trim();
  const cur = curRaw ? curRaw.toUpperCase() : null;
  if (cur !== "USD" && cur !== "SYP") {
    return { ok: false, error: "Unsupported currency" };
  }

  const walletCurRaw = (wallet_currency || "").toString().trim();
  const walletCur = walletCurRaw ? walletCurRaw.toUpperCase() : null;
  if (walletCur !== "USD" && walletCur !== "SYP") {
    return { ok: false, error: "wallet_currency is required" };
  }

  try {
    const headers = {
      "X-Idempotency-Key": makeIdempotencyKey(),
    };
    const payload = {
      amount: amt,
      currency: cur,
      wallet_currency: walletCur,
      note: trimNote(note),
      user_input_data: {
        ...extra,
        wallet_currency: walletCur,
        note: trimNote(note),
        shipping_channel: "admin",
        cashout_type: "agent",
      },
    };

    const { data } = await api.post("shipping/agent-cashout-request/", payload, { headers });
    return shapeOk(data, "request");
  } catch (_e) {
    const err = _e?.response?.data || _e;
    return {
      ok: false,
      error: extractMsg(err),
      raw: err,
    };
  }
}

/**
 * Agent shipping via admin (Scenario 3).
 */
export async function createAgentAdminShippingRequest({
  amount,
  currency,
  note,
  wallet_currency,
  extra = {},
}) {
  const amt = toPosNumber(amount);
  if (!amt) return { ok: false, error: "Invalid amount" };

  const curRaw = (currency || "").toString().trim();
  const cur = curRaw ? curRaw.toUpperCase() : null;
  if (cur !== "USD" && cur !== "SYP") {
    return { ok: false, error: "Unsupported currency" };
  }

  const walletCurRaw = (wallet_currency || "").toString().trim();
  const walletCur = walletCurRaw ? walletCurRaw.toUpperCase() : null;
  if (walletCur !== "USD" && walletCur !== "SYP") {
    return { ok: false, error: "wallet_currency is required" };
  }

  try {
    console.log("[AgentAdminShipping] payload", {
      amount: amt,
      currency: cur,
      wallet_currency: walletCur,
      note: trimNote(note),
      user_input_data: {
        ...extra,
        wallet_currency: walletCur,
        note: trimNote(note),
        shipping_channel: "admin",
      },
    });
    const headers = {
      "X-Idempotency-Key": makeIdempotencyKey(),
    };
    const payload = {
      amount: amt,
      currency: cur,
      wallet_currency: walletCur,
      note: trimNote(note),
      user_input_data: {
        ...extra,
        wallet_currency: walletCur,
        note: trimNote(note),
        shipping_channel: "admin",
      },
    };

    const { data } = await api.post("shipping/agent-admin/", payload, { headers });
    console.log("[AgentAdminShipping] response", data);
    return shapeOk(data, "request");
  } catch (_e) {
    const err = _e?.response?.data || _e;
    console.log("[AgentAdminShipping] error", err);
    return {
      ok: false,
      error: extractMsg(err),
      raw: err,
    };
  }
}



/**
 * جلب طلبات الشحن للمستخدم (سيناريو 1 + سيناريو 2)
 */
export async function listDepositRequests(params = {}) {
  try {
    const [std, viaAgent, agentAdmin] = await Promise.all([
      api.get("shipping/standard/", { params }).catch(() => ({ data: [] })),
      api.get("shipping/via-agent/", { params }).catch(() => ({ data: [] })),
      api.get("shipping/agent-admin/", { params }).catch(() => ({ data: [] })),
    ]);

    const stdArr = Array.isArray(std?.data) ? std.data : std?.data?.results || [];
    const agentArr = Array.isArray(viaAgent?.data) ? viaAgent.data : viaAgent?.data?.results || [];
    const agentAdminArr = Array.isArray(agentAdmin?.data) ? agentAdmin.data : agentAdmin?.data?.results || [];

    const withMeta = (x, type) => ({
      ...x,
      _shipping_type: type,
      title:
        x?.title ||
        (type === "via_agent"
          ? "شحن عبر الوكيل"
          : type === "agent_admin"
            ? "شحن عبر الإدارة (وكيل)"
            : "شحن رصيد"),
      description:
        x?.description ||
        x?.user_input_data?.note ||
        "",
    });

    const merged = [
      ...stdArr.map((x) => withMeta(x, "standard")),
      ...agentArr.map((x) => withMeta(x, "via_agent")),
      ...agentAdminArr.map((x) => withMeta(x, "agent_admin")),
    ];
    merged.sort((a, b) => {
      const da = new Date(a?.created_at || 0).getTime();
      const db = new Date(b?.created_at || 0).getTime();
      return db - da;
    });

    return { ok: true, data: merged, raw: { standard: std.data, via_agent: viaAgent.data, agent_admin: agentAdmin.data }, pagination: normalizePagination(merged, params) };
  } catch (_e) {
    return { ok: false, error: "Failed to load shippings" };
  }
}

/**
 * جلب طلبات الشحن للوكيل (Shipping) — من جدول Shipping مباشرة
 */
export async function listAgentShippings(params = {}) {
  try {
    const { data } = await api.get("shipping/via-agent/", { params });
    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
        ? data.results
        : [];
    return { ok: true, data: arr, raw: data };
  } catch (_e) {
    const err = _e?.response?.data || _e;
    return { ok: false, error: extractMsg(err), raw: err };
  }
}

/**
 * جلب عدادات الإيداعات (total/pending/approved/rejected)
 * يحاول أولاً من /shipping/count/ ولو فشل يحسبها من القائمة
 */
export async function getDepositCounts({ data } = {}) {
  try {
    const arr = Array.isArray(data) ? data : null;
    if (arr) {
      const counts = {
        total: arr.length,
        pending: arr.filter(item => item?.status === "pending").length,
        approved: arr.filter(item => item?.status === "approved").length,
        rejected: arr.filter(item => item?.status === "rejected").length,
      };
      return { ok: true, data: counts, computed: true };
    }

    const res = await listDepositRequests({ page: 1, page_size: 1000 });
    if (!res.ok) throw new Error("failed");
    const list = Array.isArray(res.data) ? res.data : [];
    const counts = {
      total: list.length,
      pending: list.filter(item => item?.status === "pending").length,
      approved: list.filter(item => item?.status === "approved").length,
      rejected: list.filter(item => item?.status === "rejected").length,
    };
    return { ok: true, data: counts, computed: true };
  } catch (_e) {
    return { ok: false, error: extractMsg(_e), data: { total: 0, pending: 0, approved: 0, rejected: 0 } };
  }
}


/* -------------------- Helpers -------------------- */
function shapeOk(data, via) {
  const id = data?.id ?? data?.pk ?? null;
  return { ok: true, data, via, id };
}

function extractMsg(payload) {
  if (!payload) return "Request failed";
  if (typeof payload === "string") return payload;
  if (payload?.detail) return payload.detail;
  if (payload?.message) return payload.message;
  if (typeof payload === "object") {
    const fieldErrors = Object.entries(payload)
      .filter(([k]) => Array.isArray(payload[k]))
      .map(([k, v]) => `${k}: ${v.join(", ")}`);
    if (fieldErrors.length) return fieldErrors.join(" | ");
  }
  return "Request failed";
}

function normalizePagination(data, params) {
  if (Array.isArray(data)) {
    return {
      count: data.length,
      next: null,
      previous: null,
      page: 1,
      page_size: data.length,
    };
  }
  const count = Number.isFinite(data?.count)
    ? data.count
    : data?.results?.length ?? 0;
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
