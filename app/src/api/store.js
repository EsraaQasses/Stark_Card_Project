// src/api/store.js
import api, { STORE_PREFIX, absolutizeUrl, buildUrl } from "./client";

// (اختياري) i18n لاختيار اللغة المناسبة
let i18n;
try {
  i18n = require("../i18n").default;
} catch { }
const isAr = () => (i18n?.language || "en").toLowerCase().startsWith("ar");

/* ===================== أدوات مساعدة ===================== */

/** ✅ تطبيع inquiry_enabled من الباك */
function normalizeInquiryFlag(value) {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** يلتقط الحقل الأنسب للصورة من كائن API */
function pickImageField(obj = {}) {
  if (!obj || typeof obj !== "object") return null;

  const direct =
    obj.image ||
    obj.image_url ||
    obj.thumbnail ||
    obj.thumb ||
    obj.logo ||
    obj.cover ||
    obj.banner ||
    null;

  if (typeof direct === "string") return direct;

  if (direct && typeof direct === "object") {
    return direct.url || direct.path || null;
  }

  if (typeof obj?.image_url === "string") return obj.image_url;
  if (obj?.image_url && typeof obj.image_url === "object") {
    return obj.image_url.url || obj.image_url.path || null;
  }

  return null;
}

/** ✅ تطبيع رابط الصورة (يتعامل مع data:/blob:/file: ويربط النسبي بالدومين تلقائيًا) */
export function normalizeImageUrl(input) {
  if (!input) return null;
  const url = String(input).trim();

  // ترك: data:/blob:/file: كما هي
  if (/^(data:|blob:|file:)/i.test(url)) return url;

  // كامل؟ خلص
  if (/^https?:\/\//i.test(url)) return url;

  // 🔥 جديد: لو ما في "/" بالبداية وهو شكل مسار ملف، أضف "/media/"
  const fixed = !url.startsWith("/")
    ? /^(sections|products|images|uploads)\/.+/i.test(url)
      ? `/media/${url}`
      : `/${url}`
    : url;

  // حوّل لأي رابط مطلق على الدومين
  return absolutizeUrl(fixed);
}

// يختار الاسم والوصف حسب اللغة
const pickName = (o) =>
  isAr() ? o?.name_ar || o?.name_en || "" : o?.name_en || o?.name_ar || "";
const pickDesc = (o) =>
  isAr()
    ? o?.description_ar || o?.description_en || ""
    : o?.description_en || o?.description_ar || "";

/** ✅ قسم */
function mapSection(s) {
  const image = normalizeImageUrl(pickImageField(s));
  const rawSubs = Array.isArray(s?.subsections) ? s.subsections : [];

  return {
    id: s?.id,
    name: pickName(s),
    description: pickDesc(s),
    image,
    father_section: s?.father_section ?? null,
    is_active: !!s?.is_active,
    subsections: rawSubs.map(mapSection), // عرض الأقسام الفرعية
    products_count: s?.products_count ?? s?.active_products_count ?? null,
    _raw: s,
  };
}

/** ✅ منتج (موسّع عشان Payment يشتغل صح) */
function mapProduct(p) {
  const image = normalizeImageUrl(pickImageField(p));
  const prices = p?.prices || null; // { base_currency, base_price, converted{USD,SYP}, exchange_rates }

  // المتطلبات (ID / أرقام / نصوص)
  const requirements = Array.isArray(p?.requirements) ? p.requirements : [];

  return {
    id: p?.id,
    name: pickName(p),
    description: pickDesc(p),

    // العملة + السعر الأساسي
    currency: p?.currency || p?.base_currency || p?.price_currency || null,
    base_currency: p?.base_currency || p?.currency || null,
    base_price: p?.base_price ?? p?.price ?? null,
    calculated_price: p?.calculated_price ?? null,

    // نوع المنتج
    product_type: p?.product_type || null,

    // إعدادات المدى الكمي من الباك
    min_amount: p?.min_amount ?? null,
    max_amount: p?.max_amount ?? null,
    min_amount_price: p?.min_amount_price ?? null,
    calculated_price_per_unit: p?.calculated_price_per_unit ?? null,

    // خيارات التخصيص من الأدمن (CSV)
    customization_options: p?.customization_options ?? null,
    customization_prices: p?.customization_prices ?? null,

    // معلومات السعر من الباك
    price_info: p?.price_info ?? null,
    user_final_prices: p?.price_info?.user_final_prices ?? null,
    user_final_price: p?.price_info?.user_final_price ?? null,

    // لو عندك customization_data structured
    customization_data: p?.customization_data ?? null,

    // المتطلبات الإضافية (ID / نص / رقم..)
    requirements,

    section: p?.section || p?.section_id || null,
    image,
    is_active: !!p?.is_active,

    // معلومات إضافية مفيدة
    is_favorite: !!p?.is_favorite,
    prices,
    external_product_info: p?.external_product_info ?? null,
    available_external_products: Array.isArray(p?.available_external_products)
      ? p.available_external_products
      : [],
    query_enabled: normalizeInquiryFlag(p?.query_enabled),

    _raw: p,
  };
}

/** ✅ StoreProduct (للأدمن غالبًا) */
function mapStoreProduct(sp) {
  return {
    id: sp?.id,
    name: sp?.name || "",
    description: sp?.description || "",
    price: sp?.price ?? null,
    is_active: !!sp?.is_active,
    section: sp?.section ?? null,
    section_name: sp?.section_name ?? null,
    external_product: sp?.external_product ?? null,
    external_product_info: sp?.external_product_info ?? null,
    _raw: sp,
  };
}

/* ===================== API للمستخدم ===================== */

/** الأقسام */
export async function getSections(params = {}) {
  const url = buildUrl(STORE_PREFIX, "user/sections/");
  const { data } = await api.get(url, { params });
  const list = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  return list.map(mapSection);
}

/** المنتجات بالقسم (جلب عبر /user/products/?section_id=) */
export async function getProductsBySection(sectionId, params = {}) {
  const url = buildUrl(STORE_PREFIX, "user/products/");
  const { data } = await api.get(url, {
    params: { ...params, section_id: sectionId },
  });
  const list = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  return list.map(mapProduct);
}

/** المنتجات بالقسم مع معلومات القسم (استخدم هذه لجلب منتجات قسم كامل مع البيانات) */
export async function getProductsBySectionDetail(sectionId) {
  const url = buildUrl(STORE_PREFIX, "user/products/by_section/");
  try {
    const { data } = await api.get(url, {
      params: { section_id: sectionId },
    });
    return {
      ok: true,
      section: data?.section,
      count: data?.count ?? 0,
      products: Array.isArray(data?.products) ? data.products.map(mapProduct) : [],
    };
  } catch (error) {
    return {
      ok: false,
      error: extractErrorMessage(error),
      section: null,
      count: 0,
      products: [],
    };
  }
}

/** منتج واحد بالتفصيل */
export async function getUserProductById(productId) {
  const url = buildUrl(STORE_PREFIX, "user/products", `${productId}/`);
  const { data } = await api.get(url);
  return mapProduct(data);
}

/** متطلبات منتج محدد (الحقول المطلوبة للشراء) */
export async function getUserProductRequirements(productId) {
  const url = buildUrl(STORE_PREFIX, "user/products", `${productId}`, "requirements/");
  const { data } = await api.get(url);
  return Array.isArray(data) ? data : [];
}

/** تنفيذ استعلام (Query) للمنتج إن كان يدعم ذلك */
export async function createProductQuery(productId, user_inputs = {}) {
  try {
    const safeInputs = user_inputs && typeof user_inputs === "object" ? user_inputs : {};
    const url = buildUrl(STORE_PREFIX, "user/products", `${productId}`, "query/");
    const { data } = await api.post(url, { user_inputs: safeInputs });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, data: null, error: extractErrorMessage(error) };
  }
}

/** تنفيذ استعلام (Query) مع انتظار النتيجة النهائية */
export async function createProductQueryWaitV2(productId, user_inputs = {}) {
  try {
    const safeInputs = user_inputs && typeof user_inputs === "object" ? user_inputs : {};
    const url = buildUrl(STORE_PREFIX, "user/products", `${productId}`, "query-wait/");
    const { data } = await api.post(url, { user_inputs: safeInputs }, { timeout: 100000 });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, data: null, error: extractErrorMessage(error) };
  }
}

/** جلب حالة الاستعلام بواسطة local_id */
export async function getProductQueryStatus(productId, local_id) {
  try {
    const url = buildUrl(STORE_PREFIX, "user/products", `${productId}`, "query-status/");
    const { data } = await api.get(url, { params: { local_id } });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, data: null, error: extractErrorMessage(error) };
  }
}

/** منتجات مميّزة (featured) */
export async function getFeaturedProducts() {
  const url = buildUrl(STORE_PREFIX, "user/featured-products/");
  const { data } = await api.get(url);
  const list = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  return list.map(mapProduct);
}

/** بحث محسّن مع فلاتر */
export async function searchUserProducts({
  q = "",
  section_id,
  product_type,
  currency,
} = {}) {
  const url = buildUrl(STORE_PREFIX, "user/products/search/");
  const params = {};
  if (q) params.q = q;
  if (section_id) params.section_id = section_id;
  if (product_type) params.product_type = product_type; // "amount_based" | "customization_based"
  if (currency) params.currency = currency; // "USD" | "SYP"

  const { data } = await api.get(url, { params });
  const list = Array.isArray(data?.results) ? data.results : [];
  return {
    count: data?.count ?? list.length,
    results: list.map(mapProduct),
  };
}

/* ===================== المفضلة ===================== */

export async function listFavorites() {
  const url = buildUrl(STORE_PREFIX, "user/favorites/");
  const { data } = await api.get(url);
  const list = Array.isArray(data) ? data : [];
  // كل عنصر: { id, product: {...} }
  return list.map((f) => ({
    id: f?.id,
    product: f?.product ? mapProduct(f.product) : null,
    _raw: f,
  }));
}

export async function addFavorite(product_id) {
  const url = buildUrl(STORE_PREFIX, "user/favorites/add/");
  const { data } = await api.post(url, { product_id });
  return data;
}

export async function removeFavorite(product_id) {
  const url = buildUrl(STORE_PREFIX, "user/favorites/remove/");
  const { data } = await api.post(url, { product_id });
  return data;
}

export async function toggleFavorite(product_id) {
  const favorites = await listFavorites();
  const isFavorite = favorites.some(
    (favorite) => Number(favorite?.product?.id) === Number(product_id)
  );

  if (isFavorite) {
    const data = await removeFavorite(product_id);
    return { ...data, product_id: Number(product_id), is_favorite: false };
  }

  const data = await addFavorite(product_id);
  return { ...data, product_id: Number(product_id), is_favorite: true };
}

/* ===================== الأسعار & التحويل ===================== */

/** حساب السعر النهائي للمنتج (بناءً على الكمية أو الخيار المختار) */
export async function calculateProductPrice(productId, params = {}) {
  const url = buildUrl(STORE_PREFIX, "user/products", `${productId}`, "price_calculator/");
  try {
    const { data } = await api.get(url, { params });
    return { ok: true, data, error: null };
  } catch (error) {
    return { ok: false, data: null, error: extractErrorMessage(error) };
  }
}

/** تحويل عملة عبر الباك (ad-hoc) */
export async function convertPrice(amount, fromCurrency, toCurrency) {
  const url = buildUrl(STORE_PREFIX, "user/convert-price/");
  const { data } = await api.get(url, {
    params: { amount, from_currency: fromCurrency, to_currency: toCurrency },
  });
  return data; // { original_amount, converted_amount, ... }
}

/**
 * ✅ عرض السعر للمنتج (sync function)
 * يستخدم user_final_prices أو prices.converted إذا موجود، وإلا base_price.
 *
 * المخرَج:
 * { amount: number|null, currency: string }
 */
export function displayPrice(product, uiCurrency = "USD") {
  const curr = String(uiCurrency || "USD").toUpperCase();
  // Debug: log pricing fields once per product to Expo CLI
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    try {
      if (!global.__priceDebugOnce) global.__priceDebugOnce = new Set();
      const pid = product?.id ?? product?._raw?.id ?? null;
      if (pid != null && !global.__priceDebugOnce.has(pid)) {
        global.__priceDebugOnce.add(pid);
        console.log("[price_debug]", {
          id: pid,
          base_price: product?.base_price,
          currency: product?.currency,
          price_info: product?.price_info,
          user_final_prices: product?.user_final_prices,
          user_final_price: product?.user_final_price,
          prices: product?.prices,
        });
      }
    } catch {}
  }

  // 1) أولاً: حاول استخدام user_final_prices (الموجود في mapProduct)
  const userPrices = product?.user_final_prices;
  if (userPrices && typeof userPrices === "object") {
    const price = userPrices[curr] ?? userPrices.USD ?? userPrices.SYP ?? null;
    if (price != null) return { amount: Number(price), currency: curr };
  }

  // 2) ثانياً: حاول استخدام prices.converted الجاهز من الباك
  const converted = product?.prices?.converted?.[curr];
  if (converted != null) {
    return { amount: Number(converted), currency: curr };
  }

  // 3) fallback: السعر الأساسي بدون تحويل
  const base =
    product?.prices?.base_price ??
    product?.base_price ??
    product?.price ??
    null;

  const baseCur =
    product?.prices?.base_currency ??
    product?.base_currency ??
    product?.currency ??
    null;

  if (base == null) return { amount: null, currency: curr };

  return {
    amount: Number(base),
    currency: (baseCur || curr).toUpperCase(),
  };
}

/* ===================== الشراء (StoreProduct) ===================== */

/** التحقق من الحقول المطلوبة قبل الشراء */
export function validateRequiredFields(storeProduct, userInputs) {
  const reqs = storeProduct?.external_product_info?.required_fields;
  if (!Array.isArray(reqs) || !reqs.length) return { ok: true, missing: [] };

  const missing = [];
  for (const f of reqs) {
    const fname = typeof f === "string" ? f : f?.field_name;
    if (fname && !(fname in (userInputs || {}))) missing.push(fname);
  }
  return { ok: missing.length === 0, missing };
}

/** تنفيذ عملية شراء - استخدم store_product_id أو product_id */
export async function purchaseStoreProduct({
  product,
  product_id,
  store_product_id,
  user_inputs,
}) {
  try {
    if (!user_inputs || typeof user_inputs !== "object") {
      throw new Error("بيانات المستخدم غير صحيحة");
    }

    const spid = store_product_id ?? product?.store_product_id ?? null;
    const pid = product_id ?? product?.id ?? null;

    if (!spid && !pid) {
      throw new Error("معرّف المنتج غير واضح");
    }

    const url = buildUrl(STORE_PREFIX, "user/purchases/");
    const payload = { user_inputs };

    if (spid) payload.store_product_id = spid;
    else payload.product_id = pid;

    const { data } = await api.post(url, payload);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/** قائمة مشتريات المستخدم */
export async function listUserPurchases(params = {}) {
  const url = buildUrl(STORE_PREFIX, "user/purchases/");
  try {
    const { data } = await api.get(url, { params });
    const list = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];
    return {
      ok: true,
      data: list,
      pagination: normalizePagination(data, params),
      raw: data,
    };
  } catch (error) {
    return {
      ok: false,
      error: extractErrorMessage(error),
      data: [],
      raw: error?.response?.data,
    };
  }
}

/**
 * استخراج رسالة الخطأ
 */
function extractErrorMessage(error, defaultMsg = "فشل الطلب") {
  if (typeof error === "string") return error;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return defaultMsg;
}

function normalizePagination(data, params) {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, page: 1, page_size: data.length };
  }
  const count = Number.isFinite(data?.count) ? data.count : data?.results?.length ?? 0;
  const next = data?.next ?? null;
  const previous = data?.previous ?? null;
  const page =
    Number(params?.page) ||
    extractQueryNumber(next, "page") ||
    extractQueryNumber(previous, "page") ||
    1;
  const page_size =
    Number(params?.page_size) ||
    extractQueryNumber(next, "page_size") ||
    extractQueryNumber(previous, "page_size") ||
    (Array.isArray(data?.results) ? data.results.length : 0);
  return { count, next, previous, page, page_size };
}

function extractQueryNumber(url, key) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const v = u.searchParams.get(key);
    return v != null ? Number(v) : null;
  } catch {
    const m = url.match(new RegExp(`[?&]${key}=([^&]+)`));
    return m ? Number(m[1]) : null;
  }
}

/* ===================== (اختياري) API للأدمن ===================== */
/** منتجات المتجر بحسب القسم (بحسب الباك عندك: endpoint أدمن) */
export async function getStoreProductsBySectionAdmin(sectionId) {
  const url = buildUrl(STORE_PREFIX, "admin/store-products/by_section/");
  const { data } = await api.get(url, { params: { section_id: sectionId } });
  const list = Array.isArray(data?.products)
    ? data.products
    : Array.isArray(data)
      ? data
      : [];
  return list.map(mapStoreProduct);
}

/**
 * GET /api/store/user/products/{product_id}/price_calculator/
 * Query: amount (للـ amount_based), selected_option (للـ customization_based), wallet_currency (اختياري USD/SYP)
 * يرجع: { user_final_price, wallet_user_final_price, currency, wallet_currency, ... }
 */
export async function getPriceCalculator(productId, params = {}) {
  try {
    const url = buildUrl(STORE_PREFIX, `user/products/${productId}/price_calculator/`);
    const { data } = await api.get(url, { params });
    return { ok: true, data };
  } catch (e) {
    const payload = e?.response?.data;
    const msg =
      payload?.detail ||
      payload?.message ||
      (typeof payload === "string" ? payload : "Failed to calculate price");
    return { ok: false, error: msg, raw: payload };
  }
}
