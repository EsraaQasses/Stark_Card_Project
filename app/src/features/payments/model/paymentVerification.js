import { unwrapQueryPayload, extractQueryStatus } from "./paymentQuery";
export function inquiryIsPayable(result, inputKey, currentInputKey, now = Date.now()) {
 const data=unwrapQueryPayload(result), query=data?.query || data;
 if (inputKey !== currentInputKey || !query || data?.timeout) return false;
 if (!["success","successful","completed","done","paid","ready"].includes(String(extractQueryStatus(result)).toLowerCase())) return false;
 const expiry=query.expires_at ?? data.expires_at;
 return Boolean(expiry && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry)>now);
}
export function calculatorTotal(data, currency) {
 if (!data || !["USD","SYP"].includes(currency)) return null;
 const walletCurrency=String(data.wallet_currency || "").toUpperCase();
 const baseCurrency=String(data.currency || data.base_currency || "").toUpperCase();
 const value=walletCurrency===currency ? data.wallet_user_final_price : baseCurrency===currency ? data.user_final_price : null;
 if (value == null || value === "" || !Number.isFinite(Number(value)) || Number(value)<=0) return null;
 return Number(value);
}

export function parseCheckoutObject(value) {
 if (value && typeof value === "object" && !Array.isArray(value)) return value;
 if (typeof value !== "string") return null;
 try {
  const parsed=JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
 } catch { return null; }
}
