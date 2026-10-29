import i18n from "../../../i18n";

export type ApiError = {
  message: string; status?: number; code?: string;
  fields?: Record<string, unknown>; details?: unknown; outcomeUnknown?: boolean;
};
type Obj = Record<string, any>;
const obj = (value: unknown): Obj => value && typeof value === "object" ? value as Obj : {};
const copy = {
 ar: {
  generic: "تعذر إكمال الطلب. يرجى المحاولة لاحقاً.", network: "تعذر الاتصال. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.",
  timeout: "انتهت مهلة الاتصال. يرجى المحاولة لاحقاً.",
  unknown: "تعذر التأكد من نتيجة العملية. يرجى مراجعة سجل عملياتك قبل إعادة المحاولة.",
  400: "تحقق من البيانات المدخلة.", 401: "انتهت جلستك. يرجى تسجيل الدخول مجدداً.",
  403: "لا تملك صلاحية تنفيذ هذا الطلب.", 404: "العنصر المطلوب غير موجود.",
  409: "يوجد تعارض مع طلب سابق. راجع سجل عملياتك قبل إعادة المحاولة.", 422: "تحقق من الحقول المدخلة.",
  429: "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.", 500: "تعذر إكمال الطلب حالياً. يرجى المحاولة لاحقاً.",
  503: "الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.",
 },
 en: {
  generic: "Unable to complete the request. Please try again later.", network: "Unable to connect. Check your internet connection and try again.",
  timeout: "The connection timed out. Please try again later.",
  unknown: "The outcome could not be confirmed. Check your transaction history before trying again.",
  400: "Check the information you entered.", 401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this request.", 404: "The requested item was not found.",
  409: "This conflicts with an earlier request. Check your history before trying again.", 422: "Check the information you entered.",
  429: "Too many attempts. Wait a moment and try again.", 500: "Unable to complete the request right now. Please try again later.",
  503: "The service is temporarily unavailable. Please try again later.",
 }
};
export function safeMessage(value: unknown, locale: "ar" | "en"): string | undefined {
 if (Array.isArray(value)) return value.map(v => safeMessage(v, locale)).filter(Boolean).join("\n") || undefined;
 if (value && typeof value === "object") return safeMessage(obj(value)[locale] ?? obj(value)[locale === "ar" ? "en" : "ar"], locale);
 if (typeof value !== "string") return undefined;
 const text = value.trim();
 if (!text || text.length > 1000 || /traceback|stack trace|axioserror|typeerror|referenceerror|syntaxerror|cannot read propert|is not a function|<\/?(?:html|script|body)|bearer\s+|eyJ[a-zA-Z0-9_-]+\.|(?:password|token|secret|api[_-]?key)\s*[:=]|[A-Z]:\\|\/(?:home|usr|var)\/|\.(?:py|tsx?|jsx?):\d+|\[object Object\]|^\s*[\[{]|network error|request failed with status code|timeout.*exceeded|ECONN|ENOTFOUND|no refresh token|no access returned|sql|django\.|exception/i.test(text)) return undefined;
 return text;
}
export function isFinancialRequest(config: Obj = {}): boolean {
 if (!/^(post|put|patch|delete)$/i.test(config.method || "")) return false;
 const url = String(config.url || "");
 if (/query|inquiry|lookup|price_calculator|all_requests|login|logout|token|register/i.test(url)) return false;
 return /purchases|transfer|cashout|take-money|shipping|withdraw|payment|transactions\/approve/i.test(url);
}
function localizeErrorMessage(message: string, locale: "ar" | "en", fallback: string): string {
 if (locale === "en") return /[\u0600-\u06ff]/.test(message) ? fallback : message;
 if (/[\u0600-\u06ff]/.test(message)) return message;
 if (/insufficient (?:funds|balance)/i.test(message)) return "الرصيد المتاح لا يكفي لتنفيذ العملية.";
 if (/invalid credentials|incorrect.*password|wrong.*password/i.test(message)) return "اسم المستخدم أو كلمة المرور غير صحيحة.";
 if (/required/i.test(message)) return "هذا الحقل مطلوب.";
 if (/invalid amount/i.test(message)) return "أدخل مبلغاً صحيحاً أكبر من صفر.";
 if (/unsupported currency/i.test(message)) return "العملة غير مدعومة.";
 if (/not verified/i.test(message)) return "يرجى تفعيل الحساب قبل تسجيل الدخول.";
 if (/invalid.*(?:phone|account)/i.test(message)) return "تحقق من رقم الحساب أو الهاتف.";
 if (/not found/i.test(message)) return "العنصر المطلوب غير موجود.";
 if (/already|duplicate/i.test(message)) return "يوجد طلب سابق مطابق. راجع سجل الطلبات قبل إعادة المحاولة.";
 return fallback;
}
export function normalizeApiError(error: unknown, locale?: "ar" | "en"): ApiError {
 const lang = locale || (String(i18n.language || "ar").startsWith("ar") ? "ar" : "en");
 const text = copy[lang];
 const input = obj(error), response = obj(input.response), data = obj(response.data ?? input.data ?? error), nested = obj(data.error);
 const status = response.status ?? input.status, code = nested.code ?? data.code ?? data.error_code ?? input.code;
 const outcomeUnknown = Boolean(input.outcomeUnknown || (isFinancialRequest(input.config) && (!status || status >= 500 || status === 408)));
 const rawFields = nested.fields ?? data.fields ?? data.errors;
 const fields: Record<string, string> = {};
 Object.entries(obj(rawFields)).forEach(([key, value]) => {
  const message = safeMessage(value, lang); if (message && !/token|secret/i.test(key)) fields[key] = message;
 });
 if (!Object.keys(fields).length && (status === 400 || status === 422)) Object.entries(data).forEach(([key, value]) => {
  const message = Array.isArray(value) ? safeMessage(value, lang) : undefined;
  if (message && !/token|secret/i.test(key)) fields[key] = message;
 });
 const backend = safeMessage(nested.message, lang) || safeMessage(data.message, lang) || safeMessage(data.detail, lang)
  || safeMessage(data.error, lang) || safeMessage(obj(nested.details).legacy_error, lang) || safeMessage(data.non_field_errors, lang);
 const domain: Record<string, {ar:string;en:string}> = {
  CHECKOUT_ID_MISSING:{ar:"معرّف المنتج غير متوفر. افتح المنتج مجدداً من المتجر.",en:"The product ID is missing. Open the product again from the store."},
  CHECKOUT_ID_MISMATCH:{ar:"تعذر التحقق من المنتج المطلوب. أعد المحاولة.",en:"The returned product does not match your selection. Try again."},
  CHECKOUT_UNAVAILABLE:{ar:"هذا المنتج غير متاح حالياً.",en:"This product is currently unavailable."},
 };
 let message: string;
 if (domain[code]) message = domain[code][lang];
 else if (outcomeUnknown) message = text.unknown;
 else if (status >= 500) message = status === 503 ? text[503] : text[500];
 else if (status === 401) message = text[401];
 else if (code === "ECONNABORTED" || code === "ETIMEDOUT") message = text.timeout;
 else if (!status && (input.isAxiosError || input.request || code === "ERR_NETWORK" || input.message === "Network Error")) message = text.network;
 else message = backend || Object.values(fields).join("\n") || safeMessage(typeof error === "string" ? error : input.message, lang)
  || text[status as keyof typeof text] || text.generic;
 message = localizeErrorMessage(message, lang, text[status as keyof typeof text] || text.generic);
 Object.keys(fields).forEach(key => { fields[key] = localizeErrorMessage(fields[key], lang, text[422]); });
 return { message, status, code, fields: Object.keys(fields).length ? fields : undefined, outcomeUnknown };
}
export function getApiErrorMessage(error: unknown, locale?: "ar" | "en"): string {
 return normalizeApiError(error, locale).message;
}
