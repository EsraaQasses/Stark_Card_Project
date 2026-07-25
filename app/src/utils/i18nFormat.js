// /src/utils/i18nFormat.js
import i18n from "i18next";

/** يحوّل الأرقام العربية-الهندية إلى لاتينية (لإرسالها للباكند) */
export function toLatinDigits(str) {
  if (str == null) return str;
  const map = {
    "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  };
  return String(str).replace(/[٠-٩]/g, (d) => map[d] ?? d);
}

/** تنسيق رقم حسب اللغة الحالية (ar→ أرقام عربية-هندية تلقائيًا) */
export function n(value, options = {}) {
  try {
    const lang = i18n.language || "en";
    if (value == null || value === "") return "";
    const num = typeof value === "number" ? value : Number(toLatinDigits(String(value)).replace(/[^0-9.\-]/g, ""));
    if (!isFinite(num)) return String(value);
    return new Intl.NumberFormat(lang, options).format(num);
  } catch {
    return String(value);
  }
}

/** تنسيق عملة بسيط: قيمة منسّقة + رمز/اختصار */
export function money(value, currency = "") {
  const out = n(value, { maximumFractionDigits: 2 });
  return currency ? `${out} ${currency}` : out;
}

/** يتحقق أن النص رقم صحيح موجب */
export function isPositiveIntText(text) {
  const t = toLatinDigits(String(text)).trim();
  return /^\d+$/.test(t) && Number(t) > 0;
}

/** يرجّع Number من نص قد يحتوي أرقام عربية-هندية */
export function parseIntLocalized(text, fallback = null) {
  const t = toLatinDigits(String(text)).trim();
  const v = parseInt(t, 10);
  return Number.isFinite(v) ? v : fallback;
}
