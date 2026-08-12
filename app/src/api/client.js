// src/api/client.js
import axios from "axios";
import {
  clearAuthTokens,
  getAuthorizationToken,
  getRefreshToken,
  setAuthTokens,
} from "../shared/storage/authStorage";

/* ===== Base & Helpers ===== */
const configuredApiBase = process.env.EXPO_PUBLIC_API_BASE?.trim();
const developmentApiBase = "http://127.0.0.1:8000/api";

if (!configuredApiBase && typeof __DEV__ !== "undefined" && !__DEV__) {
  throw new Error("EXPO_PUBLIC_API_BASE is required outside development builds.");
}

export const API_ROOT = (configuredApiBase || developmentApiBase)
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "") + "/api";

if (!configuredApiBase) {
  console.warn("EXPO_PUBLIC_API_BASE not set; using the local development API.");
}

export const STORE_PREFIX = "/store";
export const USERS_PREFIX = "/users";
export const AGENTS_PREFIX = "/agents";

/* ✅ NEW: دالة ترجّع الجذر بدون /api لو بدنا نبني روابط مطلقة (للصور مثلاً) */
export const API_BASE = API_ROOT.replace(/\/api$/, "");

/**
 * يبني URL نظيف
 */
export function buildUrl(...parts) {
  const arr = parts.filter(Boolean).map(String);
  const lastHadSlash = arr.length > 0 && arr[arr.length - 1].endsWith("/");

  const cleaned = arr.map((p, idx) => {
    if (idx === 0) return p.replace(/\/+$/, "");             // أول جزء: اشطب السلاشات الأخيرة
    return p.replace(/^\/+/, "").replace(/\/+$/g, "");        // بقية الأجزاء: اشطب الأولى والأخيرة
  });

  let url = cleaned.join("/");
  if (lastHadSlash && !url.endsWith("/")) url += "/";
  return url;
}
export function absolutizeUrl(url) {
  if (!url) return null;
  const u = String(url).trim();

  // إذا كان كامل (http/https) أو data/blob/file فخليه متل ما هو
  if (/^(https?:|data:|blob:|file:)/i.test(u)) return u;

  // إذا كان مطلق من الجذر (يبدأ بسلاش) → أركبه على الدومين
  if (u.startsWith("/")) return `${API_BASE}${u}`;

  // 🔥 الحالة المسببة للمشكلة: "sections/..." أو "products/..." إلخ
  // كثير من سرفرات Django بترجع "folder/filename" بدون "/media/"
  // فهون نضيف "/media/" إذا ما كانت موجودة.
  const looksLikeDjangoMedia = /^(sections|products|images|uploads|media)\/.+/i.test(u);
  const withMedia = looksLikeDjangoMedia && !u.startsWith("media/")
    ? `media/${u}`
    : u;

  return `${API_BASE}/${withMedia}`;
}

/* ===== Factory ===== */
function createAxios(baseURL) {
  return axios.create({
    baseURL,
    timeout: 100000,
    headers: { "Content-Type": "application/json" },
  });
}

/* ===== Instances ===== */
// عام لكل الـ API: /api
const api = createAxios(API_ROOT);

// خاص للوكلاء: اربطه صريحًا على /api/agents (مش مسار نسبي)
const agentsApi = createAxios(buildUrl(API_ROOT, AGENTS_PREFIX));
const REFRESH_PATH = buildUrl(API_ROOT, USERS_PREFIX, "token/refresh/");
let sharedRefreshPromise = null;
const authFailureListeners = new Set();

export function subscribeAuthFailure(listener) {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

function notifyAuthFailure() {
  authFailureListeners.forEach((listener) => {
    try { listener(); } catch {}
  });
}

async function refreshAuthentication() {
  const refresh = await getRefreshToken();
  if (!refresh) throw new Error("No refresh token");

  const { data } = await axios.post(
    REFRESH_PATH,
    { refresh },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );
  const access = data?.access;
  if (!access) throw new Error("No access returned");

  await setAuthTokens({ access, refresh: data?.refresh || refresh });
  return access;
}

/* ===== Attach Authorization & Refresh (لنفس المنطق على كلا الإنستانسين) ===== */
function attachAuthAndRefresh(instance) {
  instance.interceptors.request.use(async (config) => {
    try {
      const token = await getAuthorizationToken();
      const requestUrl = `${config.baseURL || ""}${config.url || ""}`;
      const isPublicAuthRequest = /\/users\/(?:register|login(?:\/|$)|verify-otp|resend-otp|token\/refresh|password-reset|forgot-password|reset-password)/i.test(requestUrl);
      if (token && !isPublicAuthRequest) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      } else if (isPublicAuthRequest && config.headers) {
        delete config.headers.Authorization;
      }
    } catch {}
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error?.config;
      const status = error?.response?.status ?? 0;
      if (!original) return Promise.reject(error);

      const url = (original?.baseURL || "") + (original?.url || "");
      const isRefreshReq = url.startsWith(REFRESH_PATH);
      const isLogoutReq = /\/users\/logout\/?$/i.test(url);

      if (status !== 401 || original?._retry || isRefreshReq || isLogoutReq) {
        return Promise.reject(error);
      }

      original._retry = true;

      try {
        if (!sharedRefreshPromise) {
          sharedRefreshPromise = refreshAuthentication()
            .catch(async (refreshError) => {
              await clearAuthTokens();
              notifyAuthFailure();
              throw refreshError;
            })
            .finally(() => {
              sharedRefreshPromise = null;
            });
        }
        const newAccess = await sharedRefreshPromise;

        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return instance.request(original);
      } catch (e) {
        return Promise.reject(error);
      }
    }
  );
}

// ثبّت الإنترسبتورز على الإنستانسين
attachAuthAndRefresh(api);
attachAuthAndRefresh(agentsApi);

/* ===== Exports ===== */
export default api;       // باقي الموديولات تستعمل /api
export { agentsApi };    // استعمل هذا للوكلاء (/api/agents)

/* ✅ BONUS: اختياري — دالة مبسطة لاسترجاع الدومين (تفيد بالفرونت مثلاً للصور مباشرة) */
export function getApiDomain() {
  try {
    const url = new URL(API_BASE);
    return url.origin;
  } catch {
    return API_BASE;
  }
}
