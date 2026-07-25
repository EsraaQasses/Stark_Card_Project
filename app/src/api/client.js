// src/api/client.js
import axios from "axios";
import {
  clearAuthTokens,
  getAuthorizationToken,
  getRefreshToken,
  setAccessToken,
} from "../shared/storage/authStorage";

/* ===== Base & Helpers ===== */
export const API_ROOT = (process.env.EXPO_PUBLIC_API_BASE || "http://192.168.1.111:8000/api")
  .replace(/\/+$/, ""); // إزالة الشرطات الأخيرة

if (!process.env.EXPO_PUBLIC_API_BASE) {
  console.warn("EXPO_PUBLIC_API_BASE not set; using fallback IP. Set in .env for production.");
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

/* ===== Attach Authorization & Refresh (لنفس المنطق على كلا الإنستانسين) ===== */
function attachAuthAndRefresh(instance) {
  instance.interceptors.request.use(async (config) => {
    try {
      const token = await getAuthorizationToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
    return config;
  });

  let isRefreshing = false;
  let queue = [];

  const REFRESH_PATH = buildUrl(API_ROOT, USERS_PREFIX, "token/refresh/"); // ثابت على /api/users/token/refresh/

  function resolveQueue(error, newToken = null) {
    queue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(newToken)));
    queue = [];
  }

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

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: async (newToken) => {
              try {
                if (newToken) {
                  original.headers = original.headers || {};
                  original.headers.Authorization = `Bearer ${newToken}`;
                }
                const resp = await instance.request(original);
                resolve(resp);
              } catch (e) {
                reject(e);
              }
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const refresh = await getRefreshToken();
        if (!refresh) throw new Error("No refresh token");

        // استخدم axios الخام عالـ /api/users/token/refresh/ حصراً
        const { data } = await axios.post(
          REFRESH_PATH,
          { refresh },
          { headers: { "Content-Type": "application/json" }, timeout: 15000 }
        );

        const newAccess = data?.access;
        if (!newAccess) throw new Error("No access returned");

        await setAccessToken(newAccess);

        resolveQueue(null, newAccess);

        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return instance.request(original);
      } catch (e) {
        await clearAuthTokens();
        resolveQueue(e, null);
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
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
