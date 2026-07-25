// Preserves the language fallback behavior that Products.js used for display text.
export function pickLang(obj, base, lang) {
  if (!obj) return "";
  const isAr = (lang || "").toLowerCase().startsWith("ar");
  const k = `${base}_${isAr ? "ar" : "en"}`;
  const fallbacks = [`${base}_${isAr ? "en" : "ar"}`, base];
  if (obj[k] != null && obj[k] !== "") return obj[k];
  for (const f of fallbacks) if (obj[f] != null && obj[f] !== "") return obj[f];
  return "";
}

export const getProductName = (product, lang) => pickLang(product, "name", lang);

export const getProductDescription = (product, lang) =>
  pickLang(product, "description", lang);
