// src/screens/MyPayments.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  useWindowDimensions,
  ScrollView,
  Platform,
  I18nManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import PageLayout from "../ui/PageLayout"; // ✅ غلاف موحّد (BottomNav + SideMenu)
import CornerSpinner from "../ui/CornerSpinner";
import Theme from "../ui/Theme";
import { getPaymentsStatusSummary, listPaymentsHistory } from "../api/payment";
import { getCache, setCache, cacheKey } from "../utils/cache";

const { colors: tcolors = {} } = Theme;
const COLORS = {
  bg: tcolors.bg || "#F7FAFC",
  card: "#FFFFFF",
  text: tcolors.text || "#0E1B3B",
  textMuted: tcolors.muted || "#64748b",
  line: tcolors.line || "#E4ECF2",
  primary: tcolors.primary || "#1274F5",
  info: "#2563eb",
  // statuses
  success: "#16a34a",
  pending: "#ca8a04",
  processing: "#2563eb",
  failed: "#dc2626",
  cancelled: "#6b7280",
  slate: "#334155",
};

const BASE_W = 390,
  BASE_H = 844;
const PAGE_SIZE = 12;
const RADIUS = 16;

const STATUS_OPTIONS = (L) => [
  { key: "approved", tint: COLORS.success, label: L("payments.filter.approved", "مكتملة") },
  { key: "pending", tint: COLORS.pending, label: L("payments.filter.pending", "قيد الانتظار") },
  { key: "failed", tint: COLORS.failed, label: L("payments.filter.failed", "فاشلة") },
];

const DATE_OPTIONS = (L) => [
  { key: "all", label: L("payments.date.all", "كل الأوقات") },
  { key: "today", label: L("payments.date.today", "اليوم") },
  { key: "7days", label: L("payments.date.7days", "آخر 7 أيام") },
  { key: "30days", label: L("payments.date.30days", "آخر 30 يوم") },
];

/* ========= helpers: انتقاء اسم بحسب لغة التطبيق مع فولباك ========= */
function pickLang(obj, base, lang) {
  if (!obj) return "";
  const isAr = (lang || "").toLowerCase().startsWith("ar");
  const k = `${base}_${isAr ? "ar" : "en"}`;
  const fallbacks = [`${base}_${isAr ? "en" : "ar"}`, base];
  if (obj[k] != null && obj[k] !== "") return obj[k];
  for (const f of fallbacks) if (obj[f] != null && obj[f] !== "") return obj[f];
  return "";
}
function extractProductNameFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";

  const purchaseMatch = raw.match(
    /Purchase:\s*(.+?)(?=\s+\((?:Amount|Units):|\s+-\s+(?:External ID|Order ID):|$)/i
  );
  if (purchaseMatch?.[1]) return purchaseMatch[1].trim();

  return raw;
}
function displayProductName(it, lang) {
  // من PaymentSerializer في الباك: store_product_name (أو store_product_name_en/ar لو كان عندك)
  const fromMulti = pickLang(it, "store_product_name", lang);
  if (fromMulti) return fromMulti;
  const fromObj = pickLang(it?.store_product || it?.product, "name", lang);
  if (fromObj) return fromObj;
  const rawName =
    it?.store_product_name ||
    it?.product_name ||
    it?.store_product?.name ||
    it?.product?.name ||
    "";
  if (rawName) return rawName;
  // For transactions, extract from note if purchase
  if (it?.transaction_type === 'purchase' && it?.note) {
    const extracted = extractProductNameFromNote(it.note);
    if (extracted) return extracted;
  }
  return extractProductNameFromNote(it?.store_product_name || it?.note || "");
}

function normalizeLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_\-\s]/g, "");
}

function looksLikeUserEntryField(key, label = "") {
  const haystack = `${normalizeLookupKey(key)} ${normalizeLookupKey(label)}`;
  return [
    "gamerid",
    "playerid",
    "userid",
    "accountid",
    "subscriberid",
    "customerid",
    "identifier",
    "phone",
    "phonenumber",
    "mobile",
    "msisdn",
    "tel",
    "uid",
    "id",
    "رقمالهاتف",
    "هاتف",
    "جوال",
    "معرف",
    "المعرف",
    "ايدي",
    "رقمالمشترك",
    "رقمالعميل",
    "رقمالحساب",
  ].some((token) => haystack.includes(token));
}

/* ========= helpers: تطبيع summary من الباك ========= */
function buildLocalSummary(items, totalOverride) {
  const counts = { total: 0, success: 0, pending: 0, failed: 0 };
  for (const it of items || []) {
    counts.total += 1;
    const st = normalizeStatus(it);
    if (st === "approved" || st === "refunded") counts.success += 1;
    else if (st === "failed" || st === "cancelled") counts.failed += 1;
    else counts.pending += 1;
  }
  if (Number.isFinite(Number(totalOverride))) counts.total = Number(totalOverride);
  return counts;
}

/* ========= helpers: extract user input (ID / phone) from user_inputs ========= */
/**
 * Extract the user-entered identifier (phone, ID, account number, etc.)
 * from the user_inputs dict. Skips internal/system fields.
 */
function extractUserInput(inputs, item) {
  if (!inputs && !item) return "";

  // If there's recipient info, prefer recipient_phone or recipient_id
  if (item?.recipient_phone) return item.recipient_phone;
  if (item?.recipient_id) return `ID: ${item.recipient_id}`;

  if (!inputs || typeof inputs !== "object") return "";

  // Keys that are internal/system — not user-entered identifiers
  const SKIP_KEYS = new Set([
    "wallet_id", "wallet_currency", "currency", "currency_submitted",
    "final_amount_submitted", "wallet_balance_before_payment",
    "amount", "quantity", "count", "price", "final_price",
    "selected_option", "product_id", "store_product_id",
  ]);

  // Priority keys that are likely the user-entered value
  const PRIORITY_KEYS = [
    "gamer_id", "player_id", "phone", "phone_number", "mobile", "msisdn",
    "id", "account_id", "subscriber_id", "customer_id",
    "account", "number", "identifier", "recipient",
    "email", "username", "user_id", "target_user_id",
  ];

  // Try priority keys first
  for (const key of PRIORITY_KEYS) {
    const val = inputs[key];
    if (val != null && String(val).trim() !== "") return String(val);
  }

  // Fallback: pick the first non-skipped, non-empty string/number value
  for (const [key, val] of Object.entries(inputs)) {
    if (SKIP_KEYS.has(key)) continue;
    if (val == null) continue;
    if (typeof val === "object") continue;
    const str = String(val).trim();
    if (str !== "" && str !== "null" && str !== "undefined") return str;
  }

  return "";
}

function extractQuantity(item) {
  const candidates = [
    item?.user_inputs?.quantity,
    item?.user_inputs?.count,
    item?.user_inputs?.selected_units,
    item?.selected_option,
    item?.user_inputs?.selected_option,
    item?.user_inputs?.amount,
  ];

  for (const value of candidates) {
    if (value == null) continue;
    const str = String(value).trim();
    if (str && str !== "null" && str !== "undefined") return str;
  }

  return "";
}

function extractPaymentUserInput(item) {
  const inputs = item?.user_inputs;
  if (!inputs || typeof inputs !== "object") {
    if (item?.recipient_phone) return item.recipient_phone;
    if (item?.recipient_id) return `ID: ${item.recipient_id}`;
    return "";
  }

  const labels = inputs?._labels && typeof inputs._labels === "object" ? inputs._labels : {};
  const skipKeys = new Set([
    "wallet_id", "wallet_currency", "currency", "currency_submitted",
    "final_amount_submitted", "wallet_balance_before_payment", "wallet_balance_before",
    "amount", "quantity", "count", "price", "final_price",
    "selected_option", "selected_option_id", "selected_units",
    "product_id", "store_product_id", "client_ref", "mode", "product_name",
    "display_currency", "original_amount", "fx_used", "base_currency",
    "unit_price_display", "payment_processed_at", "sender_role", "_labels",
  ]);

  for (const [key, val] of Object.entries(inputs)) {
    if (skipKeys.has(key) || val == null || typeof val === "object") continue;
    const str = String(val).trim();
    if (!str || str === "null" || str === "undefined") continue;
    if (looksLikeUserEntryField(key, labels[key])) return str;
  }

  for (const [key, val] of Object.entries(inputs)) {
    if (skipKeys.has(key) || val == null || typeof val === "object") continue;
    const str = String(val).trim();
    if (!str || str === "null" || str === "undefined") continue;
    if (labels[key]) return str;
  }

  for (const [key, val] of Object.entries(inputs)) {
    if (skipKeys.has(key) || val == null || typeof val === "object") continue;
    const str = String(val).trim();
    if (str && str !== "null" && str !== "undefined") return str;
  }

  if (item?.recipient_phone) return item.recipient_phone;
  if (item?.recipient_id) return `ID: ${item.recipient_id}`;
  return "";
}

function extractPaymentQuantity(item) {
  const mode = String(item?.user_inputs?.mode || "").toLowerCase();
  const selectedOption =
    item?.selected_option ??
    item?.user_inputs?.selected_option ??
    item?.user_inputs?.selected_units;

  const candidates =
    mode === "packages" || (selectedOption != null && String(selectedOption).trim() !== "")
      ? [
          selectedOption,
          item?.user_inputs?.quantity,
          item?.user_inputs?.count,
          item?.user_inputs?.amount,
        ]
      : [
          item?.user_inputs?.quantity,
          item?.user_inputs?.count,
          item?.user_inputs?.amount,
          selectedOption,
        ];

  for (const value of candidates) {
    if (value == null) continue;
    const str = String(value).trim();
    if (str && str !== "null" && str !== "undefined") return str;
  }

  return "";
}

/**
 * Build displayable label/value pairs from user_inputs for the expanded card.
 * Skips internal system fields and shows everything else with readable Arabic labels.
 */
function buildDisplayInputs(inputs, item) {
  if (!inputs && !item) return [];

  // Merge recipient info into inputs for display
  const displayInputs = { ...inputs };
  if (item?.recipient_phone) displayInputs.recipient_phone = item.recipient_phone;
  if (item?.recipient_id) displayInputs.recipient_id = item.recipient_id;
  if (item?.recipient_name) displayInputs.recipient_name = item.recipient_name;

  if (!displayInputs || typeof displayInputs !== "object") return [];

  // System-internal keys to skip in details view (per task spec + _labels)
  const SKIP_KEYS = new Set([
    "wallet_id",
    "wallet_currency", 
    "currency_submitted",
    "wallet_balance_before_payment",
    "product_id", 
    "store_product_id",
    "final_amount_submitted",
    "client_ref",
    "mode",
    "product_name",
    "display_currency",
    "original_amount",
    "fx_used",
    "base_currency",
    "unit_price_display",
    "sender_role",
    "selected_option_id",
    "_labels"
  ]);

  // Arabic-friendly labels for known keys
  const LABELS = {
    phone: "رقم الهاتف",
    phone_number: "رقم الهاتف",
    mobile: "رقم الجوال",
    msisdn: "رقم المشترك",
    id: "المعرّف",
    account_id: "رقم الحساب",
    subscriber_id: "رقم المشترك",
    customer_id: "رقم العميل",
    gamer_id: "معرّف اللاعب",
    player_id: "معرّف اللاعب",
    account: "الحساب",
    number: "الرقم",
    identifier: "المعرّف",
    recipient: "المستلم",
    email: "البريد الإلكتروني",
    username: "اسم المستخدم",
    user_id: "معرّف المستخدم",
    target_user_id: "معرّف المستلم",
    target_user_name: "اسم المستلم",
    recipient_id: "معرّف المستلم",
    recipient_name: "اسم المستلم",
    recipient_phone: "رقم هاتف المستلم",
    amount: "المبلغ",
    quantity: "الكمية",
    count: "العدد",
    price: "السعر",
    final_price: "السعر النهائي",
    currency: "العملة",
    selected_option: "الخيار المحدد",
    note: "ملاحظة",
  };

  const result = [];
  for (const [key, val] of Object.entries(displayInputs)) {
    if (SKIP_KEYS.has(key)) continue;
    if (val == null) continue;
    if (typeof val === "object") continue;
    const str = String(val).trim();
    if (str === "" || str === "null" || str === "undefined") continue;
    // _labels: priority from saved field display names (generic for admin-added reqs)
    const label = inputs._labels?.[key] || LABELS[key] || key.replace(/_/g, " ");
    result.push({ label, value: str });
  }
  return result;
}

/* ========= helpers: safe date extraction from an item ========= */
/**
 * Extract a valid Date from an item, trying multiple possible field names.
 * Returns null if no valid date is found.
 */
function extractItemDate(item) {
  const candidates = [
    item?.processed_at,
    item?.created_at,
    item?.created,
    item?.paid_at,
    item?.updated_at,
    item?.date,
    item?.timestamp,
  ];
  for (const val of candidates) {
    if (val == null) continue;
    try {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) return d;
    } catch {
      // skip invalid
    }
  }
  return null;
}

/**
 * Compute the date range [from, to] for the given dateFilter key.
 * Returns { from: Date|null, to: Date|null }.
 */
function getDateRange(filterKey) {
  if (!filterKey || filterKey === "all") return { from: null, to: null };

  const now = new Date();
  // "to" = end of today (or just use now)
  const to = new Date(now);

  let from;
  switch (filterKey) {
    case "today": {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    }
    case "7days": {
      from = new Date(now);
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case "30days": {
      from = new Date(now);
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      break;
    }
    default:
      return { from: null, to: null };
  }
  return { from, to };
}

/* =========================== Component =========================== */

export default function MyPayments({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width: W, height: H } = useWindowDimensions();

  const sx = useCallback((n) => (W / BASE_W) * n, [W]);
  const sy = useCallback((n) => (H / BASE_H) * n, [H]);
  const sp = useCallback((n) => n * Math.min(W / BASE_W, H / BASE_H), [W, H]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedOptionFilter, setSelectedOptionFilter] = useState("");

  const isRTL = useMemo(() => i18n.dir() === "rtl", [i18n]);
  const L = useCallback((k, fb) => t(k, fb), [t]); // مختصر ترجمة

  // === Derived: local date-filtered items ===
  const filteredItems = useMemo(() => {
    const { from, to } = getDateRange(dateFilter);

    // If no date filter, start with all items
    let result = items;

    if (from || to) {
      result = result.filter((item) => {
        const itemDate = extractItemDate(item);
        if (!itemDate) return false;
        if (from && itemDate < from) return false;
        if (to && itemDate > to) return false;
        return true;
      });
    }

    // Status filter (local fallback)
    if (statusFilter && statusFilter !== "all") {
      result = result.filter((item) => normalizeStatus(item) === statusFilter);
    }

    // Selected option quick filter
    if (selectedOptionFilter && String(selectedOptionFilter).trim() !== "") {
      const needle = String(selectedOptionFilter).toLowerCase().trim();
      result = result.filter((item) => {
        const selected =
          String(item?.selected_option || item?.user_inputs?.selected_option || "").toLowerCase();
        return selected.includes(needle);
      });
    }

    return result;
  }, [items, dateFilter, statusFilter, selectedOptionFilter]);

  // === helper: التقاط رسالة مفهومة من استجابة السيرفر ===
  const extractServerMessage = (raw) => {
    try {
      if (!raw) return "";
      const data = raw?.response?.data ?? raw?.data ?? raw;
      if (typeof data === "string") return data;
      if (Array.isArray(data)) return data.map(String).join("\n");
      if (typeof data === "object") {
        if (data.detail) return String(data.detail);
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const v = data[firstKey];
          if (Array.isArray(v)) return v.map(String).join("\n");
          return `${firstKey}: ${String(v)}`;
        }
      }
      return "";
    } catch {
      return "";
    }
  };

  const sortByCreatedDesc = (arr) =>
    arr.slice().sort((a, b) => {
      const da = extractItemDate(a);
      const db = extractItemDate(b);
      return (db?.getTime?.() || 0) - (da?.getTime?.() || 0);
    });

  const fetchPage = useCallback(
    async ({ reset = false, pageOverride } = {}) => {
      try {
        if (reset) setError("");
        const currentPage = reset ? 1 : pageOverride ?? 1;
        const cacheK = cacheKey("payment-history-v2", statusFilter, dateFilter, String(currentPage));
        if (reset) {
          const cached = await getCache(cacheK, 1000 * 60 * 5);
          if (cached && Array.isArray(cached)) {
            const nextItems = sortByCreatedDesc(cached);
            setItems(nextItems);
            setSummary(buildLocalSummary(nextItems));
          }
        }

        // Build params — always send date_from/date_to so the backend
        // can use them if/when it supports them; they are harmless if ignored.
        const { from, to } = getDateRange(dateFilter);
        const params = {
          page: currentPage,
          page_size: PAGE_SIZE,
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(from ? { date_from: from.toISOString().split("T")[0] } : {}),
          ...(to ? { date_to: to.toISOString().split("T")[0] } : {}),
        };


        const h = await listPaymentsHistory(params);

        if (!h.ok) {
          const msg = extractServerMessage(h.error || h);
          throw new Error(msg || "Failed to load payments");
        }

        let pageItems = Array.isArray(h.data) ? h.data : [];
        if (statusFilter !== "all") {
          pageItems = pageItems.filter((it) => normalizeStatus(it) === statusFilter);
        }
        const p = h.pagination || {};
        const summaryResponse = await getPaymentsStatusSummary();
        const serverSummary = summaryResponse?.ok ? summaryResponse.data : null;

        const _hasNext =
          !!p.next ||
          ((p.page || currentPage) * (p.page_size || PAGE_SIZE) < (p.count || pageItems.length));

        setHasNext(_hasNext);

        if (reset) {
          const nextItems = sortByCreatedDesc(pageItems);
          setItems(nextItems);
          setSummary(serverSummary || buildLocalSummary(nextItems, p?.count));
          setPage(1);
          await setCache(cacheK, nextItems);
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((x) => x.id));
            const merged = [...prev];
            for (const it of pageItems) if (!seen.has(it.id)) merged.push(it);
            const nextItems = sortByCreatedDesc(merged);
            setSummary(serverSummary || buildLocalSummary(nextItems, p?.count));
            return nextItems;
          });
        }
      } catch (e) {
        const msg = extractServerMessage(e) || e?.message || String(e);
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, dateFilter]
  );

  // Refetch when status or date filter changes
  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchPage({ reset: true });
  }, [statusFilter, dateFilter, fetchPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchPage({ reset: true });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasNext) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    fetchPage({ reset: false, pageOverride: next });
  }, [fetchPage, hasNext, loadingMore, page]);

  const onTapSummary = useCallback((target) => {
    if (!target) setStatusFilter("all");
    else if (["approved", "pending", "failed"].includes(target)) setStatusFilter(target);
  }, []);

  const onExplore = useCallback(() => {
    navigation.navigate("Home");
  }, [navigation]);

  const keyExtractor = useCallback((it) => String(it.id), []);

  const renderSeparator = useCallback(() => <View style={{ height: sy(10) }} />, [sy]);

  const renderPaymentItem = useCallback(
    ({ item }) => (
      <PaymentCard
        item={item}
        sx={sx}
        sy={sy}
        sp={sp}
        isRTL={isRTL}
        lang={i18n.language}
        L={L}
      />
    ),
    [L, i18n.language, isRTL, sp, sx, sy]
  );

  const S = useMemo(() => stylesFactory({ sx, sy, sp, isRTL }), [sx, sy, sp, isRTL]);

  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: sx(14),
      paddingBottom: sy(80) + insets.bottom + sy(12),
      paddingTop: sy(6),
    }),
    [insets.bottom, sx, sy]
  );

  const listFooter = useMemo(
    () => (
      <View style={{ paddingVertical: sy(12) }}>
        {hasNext ? (
          <Pressable
            onPress={loadMore}
            android_ripple={{ color: "#e5e7eb" }}
            style={[S.button, loadingMore && { opacity: 0.7 }]}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={S.buttonText}>{L("payments.loadMore", "تحميل المزيد")}</Text>
            )}
          </Pressable>
        ) : (
          <Text style={S.listEndText}>{L("payments.noMore", "لا توجد نتائج أخرى")}</Text>
        )}
      </View>
    ),
    [L, S.button, S.buttonText, S.listEndText, hasNext, loadMore, loadingMore, sy]
  );

  return (
    <PageLayout navigation={navigation} active="payments" withSideMenu={true}>
      {/* خلفية سبينر شكلية */}
      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>

      {/* ===== Header ===== */}
      <View style={{ backgroundColor: "transparent", direction: "rtl" }}>
        <View style={{ alignSelf: "center", width: "100%", maxWidth: 480 }}>
          <View style={{ marginTop: insets.top + sy(8), paddingHorizontal: sx(14) }}>
            <View
              style={[
                S.headerBar,
                { flexDirection: "row-reverse", borderRadius: sx(20) },
              ]}
            >
              <Text style={[S.title, { flex: 1, textAlign: "right" }]}>
                {L("payments.title", "مدفوعاتي")}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.line }} />
      </View>

      {/* ===== Content ===== */}
      <View style={{ alignSelf: "center", width: "100%", maxWidth: 480, flex: 1, direction: "rtl" }}>
        {/* Error banner (اختياري) */}
        {!!error && (
          <View
            style={{
              backgroundColor: "#FEF2F2",
              borderColor: "#FECACA",
              borderWidth: 1.5,
              borderRadius: 12,
              padding: 8,
              margin: 14,
            }}
          >
            <Text style={{ color: "#991B1B", fontWeight: "800" }}>{error}</Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                fetchPage({ reset: true });
              }}
              disabled={loading}
              style={{ alignSelf: "flex-start", marginTop: 8, borderRadius: 8, backgroundColor: "#991B1B", paddingHorizontal: 12, paddingVertical: 7 }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>{L("common.retry", "إعادة المحاولة")}</Text>
            </Pressable>
          </View>
        )}

        {/* Summary Pills + Filters */}
        <View style={{ paddingHorizontal: sx(14), paddingTop: sy(10) }}>
          {!!summary && (
            <ScrollView
              horizontal
              contentContainerStyle={[S.row, { flexDirection: "row-reverse", paddingLeft: sx(6) }]}
              showsHorizontalScrollIndicator={false}
            >
              <Pressable onPress={() => onTapSummary(null)} style={S.pillWrap}>
                <SummaryPill label={L("payments.total", "الإجمالي")} value={summary.total} tint={COLORS.slate} />
              </Pressable>
              <Pressable onPress={() => onTapSummary("approved")} style={S.pillWrap}>
                <SummaryPill
                  label={L("payments.approved", "مكتملة")}
                  value={summary.success}
                  tint={COLORS.success}
                />
              </Pressable>
              <Pressable onPress={() => onTapSummary("pending")} style={S.pillWrap}>
                <SummaryPill
                  label={L("payments.pending", "قيد الانتظار")}
                  value={summary.pending}
                  tint={COLORS.pending}
                />
              </Pressable>
              <Pressable onPress={() => onTapSummary("failed")} style={S.pillWrap}>
                <SummaryPill label={L("payments.failed", "فاشلة")} value={summary.failed} tint={COLORS.failed} />
              </Pressable>
            </ScrollView>
          )}


          {/* Date filter row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[S.row, { flexDirection: "row-reverse", marginTop: sy(8) }]}
          >
            {DATE_OPTIONS(L).map((opt) => (
              <FilterChip
                key={opt.key}
                active={dateFilter === opt.key}
                label={opt.label}
                tint={COLORS.info}
                onPress={() => setDateFilter(opt.key)}
                sx={sx}
              />
            ))}
          </ScrollView>

          
        </View>

        {/* List / Empty / Loading */}
        {loading ? (
          <View style={S.center}>
            <ActivityIndicator size="large" />
            {!!error && <Text style={S.errorText}>{error}</Text>}
          </View>
        ) : error && items.length === 0 ? (
          <View style={S.center}>
            <Text style={S.errorText}>{L("payments.loadFailed", "تعذر تحميل سجل المدفوعات.")}</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            sx={sx}
            sy={sy}
            title={L("payments.emptyTitle", "لا توجد مدفوعات بعد")}
            hint={
              statusFilter === "all" && dateFilter === "all"
                ? L("payments.emptyHint", "ستظهر مدفوعاتك المستقبلية هنا.")
                : L("payments.emptyFiltered", "لا توجد مدفوعات لهذا الفلتر.")
            }
            onExplore={onExplore}
          />
        ) : (
          <FlatList
            data={filteredItems}
            inverted={false}
            keyExtractor={keyExtractor}
            contentContainerStyle={listContentStyle}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ItemSeparatorComponent={renderSeparator}
            renderItem={renderPaymentItem}
            ListFooterComponent={listFooter}
            initialNumToRender={8}
            windowSize={7}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={true}
          />
        )}
      </View>
    </PageLayout>
  );
}

/* ================== Subcomponents ================== */

function SummaryPill({ label, value, tint }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: COLORS.line,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: "row-reverse",
        alignItems: "center",
        gap: 6,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
      <Text style={{ color: COLORS.text, fontWeight: "800", textAlign: "right" }}>
        {label}: <Text style={{ color: tint }}>{value}</Text>
      </Text>
    </View>
  );
}

function FilterChip({ active, label, tint, onPress, sx }) {
  const bg = active ? hexWithAlpha(tint, 0.12) : "#fff";
  const bd = active ? hexWithAlpha(tint, 0.35) : COLORS.line;
  const tx = active ? tint : COLORS.text;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#e5e7eb" }}
      style={{
        backgroundColor: bg,
        borderColor: bd,
        borderWidth: 1.5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        marginLeft: sx(6),
      }}
    >
      <Text style={{ color: tx, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const PaymentCard = React.memo(function PaymentCard({ item, sx, sy, sp, isRTL, lang, L }) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = getStatusMeta(normalizeStatus(item), L);
  const created = formatDate(item?.processed_at || item?.created_at, lang);
  const productName = displayProductName(item, lang) || "—";
  const userInput = extractPaymentUserInput(item);
  const paidAmount = pickAmount(
    item?.paid_amount,
    item?.wallet_user_final_price,
    item?.wallet_final_price,
    item?.final_price,
    item?.amount,
    item?.user_inputs?.final_amount_submitted
  );
  const paidCurrency = pickCurrency(
    item?.paid_currency,
    item?.wallet_currency,
    item?.currency,
    item?.user_inputs?.wallet_currency,
    item?.user_inputs?.currency_submitted
  );
  const quantity = extractPaymentQuantity(item);

  return (
    <Pressable
      onPress={() => setExpanded((prev) => !prev)}
      android_ripple={{ color: "#e5e7eb" }}
      style={[
        styles.card,
        {
          padding: sx(12),
          borderRadius: RADIUS,
          borderColor: expanded ? COLORS.primary : COLORS.line,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: Platform.OS === "android" ? 1 : 0,
          backgroundColor: COLORS.card,
          direction: "rtl",
        },
      ]}
    >
      {/* اسم المنتج + الحالة */}
      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          numberOfLines={1}
          style={{
            color: COLORS.text,
            fontSize: sp(15),
            fontWeight: "800",
            flex: 1,
            textAlign: "right",
          }}
        >
          {productName}
        </Text>
        <StatusPill label={statusMeta.label} tint={statusMeta.tint} />
      </View>

      {/* تاريخ الدفع */}
      <Text
        style={{
          color: COLORS.textMuted,
          fontSize: sp(12),
          marginTop: sy(4),
          textAlign: "right",
        }}
      >
        {created}
      </Text>
      <Text style={{ color: COLORS.primary, fontSize: sp(16), fontWeight: "900", marginTop: sy(4), textAlign: "right" }}>
        {paidAmount != null ? `${fmtNum(paidAmount)} ${paidCurrency}`.trim() : "—"}
      </Text>

      {/* ===== التفاصيل عند الضغط ===== */}
      {expanded && (
        <View style={{ marginTop: sy(10) }}>
          {/* خط فاصل */}
          <View style={{ height: 1, backgroundColor: "#EEF2F6", marginBottom: sy(8) }} />

          <DetailRow label="مدخل المستخدم" value={userInput || "—"} sp={sp} sy={sy} />
          <DetailRow label="الكمية" value={quantity || "—"} sp={sp} sy={sy} />
          <DetailRow
            label="المبلغ المدفوع"
            value={paidAmount != null ? `${fmtNum(paidAmount)} ${paidCurrency}`.trim() : "—"}
            sp={sp}
            sy={sy}
          />
          <DetailRow label="حالة الدفعة" value={statusMeta.label || "—"} sp={sp} sy={sy} />
          <DetailRow label="تاريخ الدفع" value={created} sp={sp} sy={sy} />
          {!!item?.gamer_id && <DetailRow label="معرّف اللاعب" value={String(item.gamer_id)} sp={sp} sy={sy} />}
          {!!item?.selected_option && <DetailRow label="الخيار" value={String(item.selected_option)} sp={sp} sy={sy} />}
          {!!item?.external_transaction_id && <DetailRow label="رقم العملية الخارجي" value={String(item.external_transaction_id)} sp={sp} sy={sy} />}
          {!!item?.notes && <DetailRow label="ملاحظات" value={String(item.notes)} sp={sp} sy={sy} />}
          {!!item?.error_message && <DetailRow label="سبب الفشل" value={String(item.error_message)} sp={sp} sy={sy} />}
        </View>
      )}

      {/* مؤشر الضغط */}
      <Text style={{ textAlign: "center", color: COLORS.textMuted, fontSize: sp(10), marginTop: sy(6) }}>
        {expanded ? "▲ إخفاء التفاصيل" : "▼ عرض التفاصيل"}
      </Text>
    </Pressable>
  );
});


/* ========= DetailRow: سطر تفاصيل بسيط RTL ========= */
function DetailRow({ label, value, sp, sy }) {
  return (
    <View
      style={{
        flexDirection: "row-reverse",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: sy(4),
      }}
    >
      <Text style={{ color: COLORS.textMuted, fontSize: sp(13), fontWeight: "700", textAlign: "right" }}>
        {label}
      </Text>
      <Text style={{ color: COLORS.text, fontSize: sp(13), fontWeight: "800", textAlign: "left", flexShrink: 1, marginLeft: 8 }}>
        {value}
      </Text>
    </View>
  );
}

function StatusPill({ label, tint }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: hexWithAlpha(tint, 0.12),
        borderWidth: 1,
        borderColor: hexWithAlpha(tint, 0.35),
      }}
    >
      <Text style={{ color: tint, fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function KeyVal({ k, v }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: COLORS.textMuted }}>{k}</Text>
      <Text style={{ color: COLORS.text, fontWeight: "800" }}>{v}</Text>
    </View>
  );
}

function EmptyState({ sx, sy, title, hint, onExplore }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: sx(16), direction: "rtl" }}>
      <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.text, textAlign: "right" }}>{title}</Text>
      <Text style={{ marginTop: sy(6), color: COLORS.textMuted, textAlign: "center" }}>{hint}</Text>
      <Pressable
        onPress={onExplore}
        android_ripple={{ color: "#e5e7eb" }}
        style={[styles.button, { marginTop: sy(14) }]}
      >
        <Text style={styles.buttonText}>استكشف المنتجات</Text>
      </Pressable>
    </View>
  );
}

/* ================== helpers & i18n-ish ================== */

function tShort(status, L) {
  switch (status) {
    case "approved":
      return L("payments.status.approved", "مكتملة");
    case "pending":
      return L("payments.status.pending", "قيد الانتظار");
    case "failed":
      return L("payments.status.failed", "فاشلة");
    case "cancelled":
      return L("payments.status.cancelled", "ملغاة");
    case "processing":
      return L("payments.status.processing", "قيد المعالجة");
    default:
      return String(status || "");
  }
}
function getStatusMeta(status, L) {
  switch (status) {
    case "approved":
      return { label: L("payments.status.approved", "مكتملة"), tint: COLORS.success };
    case "pending":
      return { label: L("payments.status.pending", "قيد الانتظار"), tint: COLORS.pending };
    case "failed":
      return { label: L("payments.status.failed", "فاشلة"), tint: COLORS.failed };
    case "cancelled":
      return { label: L("payments.status.cancelled", "ملغاة"), tint: COLORS.cancelled };
    case "processing":
      return { label: L("payments.status.processing", "قيد المعالجة"), tint: COLORS.processing };
    case "refunded":
      return { label: L("payments.status.refunded", "مستردة"), tint: COLORS.info };
    default:
      return { label: status || "—", tint: COLORS.textMuted };
  }
}
function normalizeStatus(item) {
  const raw = String(
    item?.status ||
    item?.payment_status ||
    item?.state ||
    item?.transaction_status ||
    ""
  ).toLowerCase();
  if (["approved", "success", "successful", "completed", "paid", "done"].includes(raw)) return "approved";
  if (["pending", "awaiting", "created"].includes(raw)) return "pending";
  if (["processing", "in_progress", "inprogress"].includes(raw)) return "processing";
  if (["failed", "error", "declined", "rejected"].includes(raw)) return "failed";
  if (["cancelled", "canceled", "cancel"].includes(raw)) return "cancelled";
  if (["refunded", "refund"].includes(raw)) return "refunded";
  return raw || "pending";
}
function pickCurrency(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== "") return String(v).toUpperCase();
  }
  return "";
}
function pickAmount(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.abs(n);
  }
  return null;
}
function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}
function hexWithAlpha(hex, alpha) {
  try {
    const a = Math.round(alpha * 255);
    const pad = (n) => n.toString(16).padStart(2, "0");
    return `${hex}${pad(a)}`;
  } catch {
    return hex;
  }
}
function formatDate(iso, locale) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(locale || undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Damascus",
    });
  } catch {
    return "—";
  }
}
function renderVal(v) {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/* ================== Styles ================== */

function stylesFactory({ sx, sy, sp }) {
  return StyleSheet.create({
    headerBar: {
      backgroundColor: "rgba(255,255,255,0.92)",
      paddingHorizontal: sx(14),
      paddingVertical: sy(12),
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.line,
    },
    row: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: sx(8),
    },
    title: {
      fontSize: sp(22),
      fontWeight: "900",
      color: COLORS.text,
    },
    center: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: sx(16),
      paddingTop: sy(40),
    },
    errorText: { marginTop: sy(10), color: COLORS.failed },
    button: {
      alignSelf: "center",
      backgroundColor: COLORS.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
    },
    buttonText: { color: "#fff", fontWeight: "900" },
    listEndText: { color: "#94a3b8", textAlign: "center" },
    pillWrap: { marginRight: sx(6) },
  });
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: { color: "#fff", fontWeight: "900" },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },
  /* Decorative spinner bg */
  spinnerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
  },
});
