// src/config/api.config.js

/**
 * تكوين موحد لـ API و endpoints
 * يسهل إدارة النقاط النهائية و تبديل البيئات
 */

// تحديد البيئة
const API_TIMEOUT = 20000; // 20 ثانية
const configuredBaseURL = process.env.EXPO_PUBLIC_API_BASE?.trim();
const developmentBaseURL = "http://127.0.0.1:8000/api";
if (!configuredBaseURL && typeof __DEV__ !== "undefined" && !__DEV__) {
  throw new Error("EXPO_PUBLIC_API_BASE is required outside development builds.");
}
const normalizedBaseURL = (configuredBaseURL || developmentBaseURL)
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "") + "/api";

// Endpoints الأساسية
export const API_CONFIG = {
  // Development
  development: {
    baseURL: normalizedBaseURL,
    timeout: API_TIMEOUT,
  },
  // Production
  production: {
    baseURL: normalizedBaseURL,
    timeout: API_TIMEOUT,
  },
  // Staging
  staging: {
    baseURL: normalizedBaseURL,
    timeout: API_TIMEOUT,
  },
};

// الحصول على config البيئة الحالية
export const getCurrentConfig = () => {
  // يمكن التحكم عبره EXPO_PUBLIC_ENV
  const env = process.env.EXPO_PUBLIC_ENV || "development";
  return API_CONFIG[env] || API_CONFIG.development;
};

// Paths الثابتة
export const API_PATHS = {
  // Auth
  REGISTER: "/users/register/",
  LOGIN: "/users/login/",
  ME: "/users/me/",
  LOGOUT: "/users/logout/",
  VERIFY_OTP: "/users/verify-otp/",
  RESEND_OTP: "/users/resend-otp/",
  REFRESH_TOKEN: "/users/token/refresh/",
  CHANGE_PASSWORD: "/users/password-change/",
  FORGOT_PASSWORD: "/users/password-reset/request/",
  VERIFY_PASSWORD_RESET: "/users/password-reset/verify/",
  RESEND_PASSWORD_RESET: "/users/password-reset/resend/",
  RESET_PASSWORD: "/users/password-reset/confirm/",

  // Wallet
  WALLET: "/wallets/wallet/",
  WALLET_TRANSACTIONS: "/wallets/wallet/transactions/",
  WALLET_DEPOSIT: "/wallets/wallet/deposit/",
  WALLET_WITHDRAW: "/wallets/wallet/withdraw/",
  EXCHANGE_RATE: "/wallets/exchange-rate/",
  CHANGE_CURRENCY: "/wallets/change-currency/",

  // Store
  SECTIONS: "/store/user/sections/",
  PRODUCTS: "/store/user/products/",
  FEATURED_PRODUCTS: "/store/user/featured-products/",
  PRODUCT_SEARCH: "/store/user/products/search/",
  FAVORITES: "/store/user/favorites/",
  FAVORITES_ADD: "/store/user/favorites/add/",
  FAVORITES_REMOVE: "/store/user/favorites/remove/",
  CONVERT_PRICE: "/store/user/convert-price/",
  PURCHASES: "/store/user/purchases/",

  // Payment & Requests
  PAYMENT_CONFIG: "/payment/config/",
  PAYMENT_HISTORY: "/payment/payment/",
  PAYMENT_METHODS: "/payment-methods/user/payment-methods/",
  REQUESTS: "/all_requests/user/requests/",
  SHIPPING: "/shipping/",

  // Transactions
  TRANSACTIONS: "/transactions/transactions/",
  TRANSACTION_DETAIL: "/transactions/transactions/",

  // System
  NOTIFICATIONS: "/system/notifications/",
  ADS: "/system/all/",

  // Agents
  AGENTS: "/agents/agents/",
  AGENT_USERS: "/agents/{agentId}/users/",
  AGENT_COMMISSION: "/agents/agent/{agentId}/commission/",
  AGENT_PURCHASE: "/agents/agent/purchase/",

  // QR Code
  QR_GENERATE: "/qr_code/generate/",
  QR_MY: "/qr_code/my-qr/",
};

// Status codes معالجة
export const HTTP_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

// رسائل الأخطاء الشاملة
export const ERROR_MESSAGES = {
  NETWORK: "خطأ في الاتصال. تحقق من اتصالك بالإنترنت.",
  TIMEOUT: "انتهت مهلة الاتصال. حاول مجدداً.",
  UNAUTHORIZED: "انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.",
  FORBIDDEN: "ليس لديك صلاحيات للوصول لهذا المورد.",
  NOT_FOUND: "المورد المطلوب غير موجود.",
  CONFLICT: "حدث تضارب. قد تكون المحاولة الأخيرة نجحت.",
  RATE_LIMITED: "عدد المحاولات كثير. انتظر قليلاً ثم حاول مجدداً.",
  SERVER_ERROR: "خطأ في الخادم. حاول لاحقاً.",
  GENERIC: "فشل الطلب. حاول مجدداً.",
};

// Polling intervals (بالميلي ثانية)
export const POLLING_INTERVALS = {
  WALLET: 15000, // 15 ثانية
  NOTIFICATIONS: 10000, // 10 ثواني
  TRANSACTIONS: 20000, // 20 ثانية
  DEPOSITS: 30000, // 30 ثانية
};

// الحد الأقصى لـ retries
export const MAX_RETRIES = 3;

// محاولات تسجيل الدخول المحظورة
export const LOGIN_RATE_LIMIT = {
  attempts: 5,
  windowMs: 15 * 60 * 1000, // 15 دقيقة
};

export default {
  API_CONFIG,
  getCurrentConfig,
  API_PATHS,
  HTTP_CODES,
  ERROR_MESSAGES,
  POLLING_INTERVALS,
  MAX_RETRIES,
  LOGIN_RATE_LIMIT,
};
