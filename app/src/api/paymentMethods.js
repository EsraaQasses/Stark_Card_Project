// src/api/paymentMethods.js (مع retry/backoff بسيط)
import api from "./client";

// Compatibility API: existing screens still import this throwing function.
// New payment-method integrations should prefer src/features/payments/api/paymentMethodsApi.ts.

/** small helper: sleep ms */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

let cachedPaymentMethods = null;
let cachedAt = 0;
let inFlight = null;

/** Read retry-after header (seconds) or parse server detail like "Expected available in 16086 seconds." */
function parseRetryAfter(response) {
  try {
    const ra = response?.headers?.["retry-after"];
    if (ra) {
      const num = Number(ra);
      if (!Number.isNaN(num)) return num * 1000; // seconds -> ms
      // maybe HTTP-date — ignore for simplicity
    }
    const detail = response?.data?.detail;
    if (typeof detail === "string") {
      const m = detail.match(/(\d{2,})\s*seconds/);
      if (m) return Number(m[1]) * 1000;
      const m2 = detail.match(/(\d+)\s*minutes/);
      if (m2) return Number(m2[1]) * 60 * 1000;
    }
  } catch {}
  return null;
}

/** رجّع وسائل الدفع الفعّالة للمستخدم مع retry ذكي */
export async function listUserPaymentMethods({
  maxRetries = 3,
  baseDelayMs = 1000,
  ttlMs = 30000,
  force = false,
} = {}) {
  const now = Date.now();
  if (!force && cachedPaymentMethods && now - cachedAt < ttlMs) {
    return cachedPaymentMethods;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    let attempt = 0;
    while (true) {
      try {
        const res = await api.get("payment-methods/user/payment-methods/");
        if (res?.status >= 200 && res?.status < 300) {
          cachedPaymentMethods = res.data || [];
          cachedAt = Date.now();
          return cachedPaymentMethods;
        }
        throw new Error(`Unexpected status: ${res?.status}`);
      } catch (e) {
        attempt++;
        const status = e?.response?.status;
        // ?? 429: ???? ???? ??? Retry-After ?? ?????? ?? ??? body
        if (status === 429 && attempt <= maxRetries) {
          const raMs = parseRetryAfter(e.response);
          if (raMs && raMs > 0) {
            // ?? ?????? ????? ??? ???? (??? > 2 ?????) ?? ????? ???? ? ???? ??? ????
            if (raMs > 2 * 60 * 1000) {
              console.log("Throttled long:", raMs, "ms, aborting retries.");
              throw new Error(
                `Server rate limited. Try again after ${Math.round(raMs / 1000)}s.`
              );
            }
            console.log(`429 received ? respecting Retry-After ${raMs}ms`);
            await sleep(raMs);
            continue; // ?? ???? ??? ?????
          }
          // ?? ?? ?? Retry-After? ?????? exponential backoff ?? jitter
          const delay = Math.min(
            baseDelayMs * 2 ** (attempt - 1),
            30 * 1000
          ); // ?? ???? 30s
          const jitter = Math.floor(Math.random() * 400) - 200; // ?200ms
          console.log(`429 received ? backoff attempt ${attempt}, sleeping ${delay + jitter}ms`);
          await sleep(delay + jitter);
          continue;
        }

        // ?? ????? ??? ????????? ?? ??? ???
        console.log(
          "? listUserPaymentMethods failed:",
          status,
          e?.message,
          e?.response?.data
        );

        // ?? Retry attempts ?????
        if (status === 429) {
          throw new Error(
            `Payment methods request was rate-limited. (${status || "no status"})`
          );
        }

        throw new Error(
          `Payment methods request failed. (${status || "no status"})`
        );
      }
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
