// src/api/agent.js
import api, { agentsApi } from "./client";

/* Helper: رجّع Array سواء كانت الاستجابة مباشرة أو داخل results */
function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

/* ========== قائمة الوكلاء ========== */
/** يحاول أولاً /agents/ ثم يسقط لـ / في حال 404 (اختلاف روتينغ السيرفر) */
export async function getAgents(params = {}) {
  try {
    const { data } = await agentsApi.get("/agents/", { params });
    return asList(data);
  } catch (e) {
    const s = e?.response?.status || 0;
    if (s === 404) {
      const { data } = await agentsApi.get("/", { params });
      return asList(data);
    }
    throw e;
  }
}

/* ========== عملاء وكيل ========== */
export async function getAgentUsers(agentId) {
  if (agentId == null) throw new Error("agentId ?????");
  try {
    console.log("[AgentUsers] GET /{agent_id}/users", { agentId });
    const { data } = await agentsApi.get(`/${agentId}/users/`);
    return asList(data);
  } catch (e) {
    const s = e?.response?.status || 0;
    console.log("[AgentUsers] primary failed", {
      agentId,
      status: s,
      data: e?.response?.data,
      message: e?.message,
    });
    if (s === 404) {
      console.log("[AgentUsers] GET /agent/{agent_id}/users fallback", { agentId });
      const { data } = await agentsApi.get(`/agent/${agentId}/users/`);
      return asList(data);
    }
    throw e;
  }
}

/* ========== جلب بعنوان كامل (يدعم روابط مطلقة/نسبية) ========== */
export async function getByFullUrl(fullUrl) {
  if (!fullUrl) throw new Error("fullUrl مطلوب");
  // لو الرابط مطلق (http/https) نستخدم instance عادي؛ Axios سيتجاهل baseURL
  if (/^https?:\/\//i.test(fullUrl)) {
    const { data } = await api.get(fullUrl);
    return data;
  }
  // لو نسبي يبدأ بـ "/": مرره كما هو للـ agentsApi
  const { data } = await agentsApi.get(fullUrl);
  return data;
}

/* ========== عمولة وكيل ========== */
export async function getAgentCommission(agentId) {
  if (agentId == null) throw new Error("agentId مطلوب");
  const { data } = await agentsApi.get(`/agent/${agentId}/commission/`);
  return data;
}

/* ========== مناطق الوكلاء (مع تجاهل 401/403/404) ========== */
export async function getAgentRegions() {
  try {
    const { data } = await agentsApi.get("/regions/");
    return asList(data);
  } catch (e) {
    const s = e?.response?.status || 0;
    if (s === 401 || s === 403 || s === 404) return [];
    throw e;
  }
}

/* ========== شراء عبر الوكيل ========== */
export async function makeAgentPurchase(payload) {
  const { data } = await agentsApi.post(`/agent/purchase/`, payload);
  return data;
}

/* ========== موافقة/رفض عملية ========== */
export async function approveTransaction(transactionId, approve = true) {
  if (!transactionId) throw new Error("transactionId مطلوب");
  const { data } = await agentsApi.post(`/agent/transactions/${transactionId}/approve/`, { approve });
  return data;
}

/* ========== Cashout (Take Money) ========== */
export async function listCashouts(params = {}) {
  const { data } = await agentsApi.get(`/agent/cashout/`, { params });
  return data;
}

export async function createCashout(payload) {
  const { data } = await agentsApi.post(`/agent/cashout/`, payload);
  return data;
}

export async function approveCashout(transactionId) {
  if (!transactionId) throw new Error("transactionId مطلوب");
  const { data } = await agentsApi.post(`/agent/cashout/${transactionId}/approve/`);
  return data;
}

export async function cancelCashout(transactionId) {
  if (!transactionId) throw new Error("transactionId مطلوب");
  const { data } = await agentsApi.post(`/agent/cashout/${transactionId}/cancel/`);
  return data;
}

/* ========== ربط مستخدم بوكيل ========== */
export async function connectToAgent({ agent_id, agent_code, allow_switch } = {}) {
  const payload = {};
  if (agent_id != null) payload.agent_id = agent_id;
  if (agent_code != null && String(agent_code).trim() !== "") payload.agent_code = String(agent_code).trim();
  if (allow_switch != null) payload.allow_switch = !!allow_switch;
  const { data } = await agentsApi.post(`/agent/connect/`, payload);
  return data;
}
export async function disconnectFromAgent() {
  const { data } = await agentsApi.post(`/agent/disconnect/`);
  return data;
}



export default api;
