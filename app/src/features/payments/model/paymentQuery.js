// Pure query helpers extracted from Payment.js.
// Preserves existing nested backend response unwrapping and pending/final status rules.
export function unwrapQueryPayload(payload) {
  let data = payload?.data ?? payload;
  let guard = 0;
  while (data && typeof data === "object" && guard < 4) {
    if (data.query || data.local_id || data.status || data.message || data.new_quantity) {
      break;
    }
    if (data.data && typeof data.data === "object") {
      data = data.data;
      guard += 1;
      continue;
    }
    break;
  }
  return data;
}

export function extractQueryStatus(payload) {
  if (!payload || typeof payload !== "object") return null;
  const data = unwrapQueryPayload(payload);
  if (!data || typeof data !== "object") return null;
  return (
    data.status ||
    data.state ||
    data.query?.status ||
    data.data?.status ||
    data.data?.query?.status ||
    null
  );
}

export function isFinalQueryStatus(status) {
  if (!status) return false;
  const normalizedStatus = String(status).trim().toLowerCase();
  if (normalizedStatus.includes("قيد") || normalizedStatus.includes("انتظار") || normalizedStatus.includes("معالجة")) return false;
  if (["pending", "processing", "in_progress", "wait"].includes(normalizedStatus)) return false;
  return true;
}

export function normalizeQueryDisplay(payload) {
  if (!payload || typeof payload !== "object") return null;
  const data = unwrapQueryPayload(payload);
  const query = data?.query || data;
  if (!query || typeof query !== "object") return null;

  return {
    status:
      query.status ||
      query.state ||
      data.status ||
      data.state ||
      null,
    message:
      query.message ||
      data.message ||
      null,
    new_quantity: query.new_quantity ?? data.new_quantity ?? null,
  };
}
