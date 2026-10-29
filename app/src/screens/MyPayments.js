// src/screens/MyPayments.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";
import { useAuth } from "../context/AuthProvider";
import { listPaymentObjections, submitPaymentObjection } from "../api/objections";
import { paymentIdentifiers, paymentSnapshots, moneySnapshot, canObject, isOpenObjection, objectionStatus, refundPresentation } from "../features/payments/model/paymentHistory";
import * as Clipboard from "expo-clipboard";
import { getApiErrorMessage } from "../shared/api/errors/apiError";
import { calendarKey, historyToday } from "../features/payments/model/historyFilters";

import {
  getPaymentsStatusSummary,
  listPaymentsHistory,
} from "../api/payment";



/* =========================================================
   Light Theme
========================================================= */

const COLORS = {
  bg: "#F7F9FC",
  card: "#FFFFFF",

  text: "#0E1B3B",
  textMuted: "#6B7B90",

  line: "#E4ECF2",

  primary: "#1274F5",
  primarySoft: "#EEF5FF",

  info: "#2563EB",

  success: "#16A34A",
  pending: "#CA8A04",
  processing: "#2563EB",
  failed: "#DC2626",
  cancelled: "#6B7280",

  slate: "#334155",
};

/* =========================================================
   Responsive
========================================================= */

const BASE_W = 390;
const BASE_H = 844;

const PAGE_SIZE = 12;
const MAX_W = 480;

/* =========================================================
   Product Name
========================================================= */

function pickLang(obj, base, lang) {
  if (!obj) return "";

  const isAr = String(lang || "")
    .toLowerCase()
    .startsWith("ar");

  const key = `${base}_${isAr ? "ar" : "en"}`;

  const fallbacks = [
    `${base}_${isAr ? "en" : "ar"}`,
    base,
  ];

  if (
    obj[key] != null &&
    obj[key] !== ""
  ) {
    return obj[key];
  }

  for (const fallback of fallbacks) {
    if (
      obj[fallback] != null &&
      obj[fallback] !== ""
    ) {
      return obj[fallback];
    }
  }

  return "";
}

function extractProductNameFromNote(note) {
  const raw = String(note || "").trim();

  if (!raw) return "";

  const purchaseMatch = raw.match(
    /Purchase:\s*(.+?)(?=\s+\((?:Amount|Units):|\s+-\s+(?:External ID|Order ID):|$)/i
  );

  if (purchaseMatch?.[1]) {
    return purchaseMatch[1].trim();
  }

  return raw;
}

function displayProductName(item, lang) {
  const fromMulti = pickLang(
    item,
    "store_product_name",
    lang
  );

  if (fromMulti) {
    return fromMulti;
  }

  const fromObject = pickLang(
    item?.store_product || item?.product,
    "name",
    lang
  );

  if (fromObject) {
    return fromObject;
  }

  const rawName =
    item?.store_product_name ||
    item?.product_name ||
    item?.store_product?.name ||
    item?.product?.name ||
    "";

  if (rawName) {
    return rawName;
  }

  if (
    item?.transaction_type === "purchase" &&
    item?.note
  ) {
    const extracted =
      extractProductNameFromNote(item.note);

    if (extracted) {
      return extracted;
    }
  }

  return extractProductNameFromNote(
    item?.store_product_name ||
      item?.note ||
      ""
  );
}

/* =========================================================
   User Input Helpers
========================================================= */

function normalizeLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_\-\s]/g, "");
}

function looksLikeUserEntryField(
  key,
  label = ""
) {
  const haystack =
    `${normalizeLookupKey(key)} ${normalizeLookupKey(label)}`;

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
  ].some((token) =>
    haystack.includes(token)
  );
}

function extractPaymentUserInput(item) {
  const inputs = item?.user_inputs;

  if (
    !inputs ||
    typeof inputs !== "object"
  ) {
    if (item?.recipient_phone) {
      return item.recipient_phone;
    }

    if (item?.recipient_id) {
      return `ID: ${item.recipient_id}`;
    }

    return "";
  }

  const labels =
    inputs?._labels &&
    typeof inputs._labels === "object"
      ? inputs._labels
      : {};

  const skipKeys = new Set([
    "wallet_id",
    "wallet_currency",

    "currency",
    "currency_submitted",

    "final_amount_submitted",

    "wallet_balance_before_payment",
    "wallet_balance_before",

    "amount",
    "quantity",
    "count",

    "price",
    "final_price",

    "selected_option",
    "selected_option_id",
    "selected_units",

    "product_id",
    "store_product_id",

    "client_ref",
    "mode",

    "product_name",
    "display_currency",

    "original_amount",

    "fx_used",
    "base_currency",

    "unit_price_display",

    "payment_processed_at",

    "sender_role",

    "_labels",
  ]);

  /* نبحث أولاً عن رقم حساب / هاتف / ID */

  for (
    const [key, value] of Object.entries(inputs)
  ) {
    if (
      skipKeys.has(key) ||
      value == null ||
      typeof value === "object"
    ) {
      continue;
    }

    const stringValue =
      String(value).trim();

    if (
      !stringValue ||
      stringValue === "null" ||
      stringValue === "undefined"
    ) {
      continue;
    }

    if (
      looksLikeUserEntryField(
        key,
        labels[key]
      )
    ) {
      return stringValue;
    }
  }

  /* حقول معرفة من الأدمن */

  for (
    const [key, value] of Object.entries(inputs)
  ) {
    if (
      skipKeys.has(key) ||
      value == null ||
      typeof value === "object"
    ) {
      continue;
    }

    const stringValue =
      String(value).trim();

    if (
      !stringValue ||
      stringValue === "null" ||
      stringValue === "undefined"
    ) {
      continue;
    }

    if (labels[key]) {
      return stringValue;
    }
  }

  /* fallback */

  for (
    const [key, value] of Object.entries(inputs)
  ) {
    if (
      skipKeys.has(key) ||
      value == null ||
      typeof value === "object"
    ) {
      continue;
    }

    const stringValue =
      String(value).trim();

    if (
      stringValue &&
      stringValue !== "null" &&
      stringValue !== "undefined"
    ) {
      return stringValue;
    }
  }

  if (item?.recipient_phone) {
    return item.recipient_phone;
  }

  if (item?.recipient_id) {
    return `ID: ${item.recipient_id}`;
  }

  return "";
}

/* =========================================================
   Quantity
========================================================= */

function extractPaymentQuantity(item) {
  const mode = String(
    item?.user_inputs?.mode || ""
  ).toLowerCase();

  const selectedOption =
    item?.selected_option ??
    item?.user_inputs?.selected_option ??
    item?.user_inputs?.selected_units;

  const candidates =
    mode === "packages" ||
    (
      selectedOption != null &&
      String(selectedOption).trim() !== ""
    )
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

    const stringValue =
      String(value).trim();

    if (
      stringValue &&
      stringValue !== "null" &&
      stringValue !== "undefined"
    ) {
      return stringValue;
    }
  }

  return "";
}

/* =========================================================
   Status
========================================================= */

function normalizeStatus(item) {
  const raw = String(
    item?.status ||
      item?.payment_status ||
      item?.state ||
      item?.transaction_status ||
      ""
  ).toLowerCase();

  if (
    [
      "approved",
      "success",
      "successful",
      "completed",
      "paid",
      "done",
    ].includes(raw)
  ) {
    return "approved";
  }

  if (
    [
      "pending",
      "awaiting",
      "created",
    ].includes(raw)
  ) {
    return "pending";
  }

  if (
    [
      "processing",
      "in_progress",
      "inprogress",
    ].includes(raw)
  ) {
    return "processing";
  }

  if (
    [
      "failed",
      "error",
      "declined",
      "rejected",
    ].includes(raw)
  ) {
    return "failed";
  }

  if (
    [
      "cancelled",
      "canceled",
      "cancel",
    ].includes(raw)
  ) {
    return "cancelled";
  }

  if (
    [
      "refunded",
      "refund",
    ].includes(raw)
  ) {
    return "refunded";
  }

  return raw || "pending";
}

function getStatusMeta(status, L) {
  switch (status) {
    case "approved":
      return {
        label: L(
          "payments.status.approved",
          "مكتملة"
        ),
        tint: COLORS.success,
        icon: "checkmark-circle-outline",
      };

    case "pending":
      return {
        label: L(
          "payments.status.pending",
          "قيد الانتظار"
        ),
        tint: COLORS.pending,
        icon: "time-outline",
      };

    case "failed":
      return {
        label: L(
          "payments.status.failed",
          "فاشلة"
        ),
        tint: COLORS.failed,
        icon: "close-circle-outline",
      };

    case "cancelled":
      return {
        label: L(
          "payments.status.cancelled",
          "ملغاة"
        ),
        tint: COLORS.cancelled,
        icon: "ban-outline",
      };

    case "processing":
      return {
        label: L(
          "payments.status.processing",
          "قيد المعالجة"
        ),
        tint: COLORS.processing,
        icon: "sync-outline",
      };

    case "refunded":
      return {
        label: L(
          "payments.status.refunded",
          "مستردة"
        ),
        tint: COLORS.info,
        icon: "return-down-back-outline",
      };

    default:
      return {
        label: status || "—",
        tint: COLORS.textMuted,
        icon: "ellipse-outline",
      };
  }
}

/* =========================================================
   Summary
========================================================= */

/* =========================================================
   Dates
========================================================= */

function extractItemDate(item) {
  const candidates = [
    item?.created_at,
    item?.processed_at,
    item?.created,
    item?.paid_at,
    item?.updated_at,
    item?.date,
    item?.timestamp,
  ];

  for (const value of candidates) {
    if (value == null) continue;

    try {
      const date =
        new Date(value);

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        return date;
      }
    } catch {}
  }

  return null;
}

function startOfDay(date) {
  if (!date) return null;

  const result =
    new Date(date);

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

function formatApiDate(date) {
  if (!date) return "";

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatSelectedDate(date) {
  if (!date) {
    return "اختر التاريخ";
  }

  try {
    return date.toLocaleDateString(
      "ar-SY",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  } catch {
    return formatApiDate(date);
  }
}

function formatDate(iso, locale) {
  try {
    const date =
      new Date(iso);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date.toLocaleString(
      locale || "ar-SY",
      {
        year: "numeric",
        month: "short",
        day: "2-digit",

        hour: "2-digit",
        minute: "2-digit",

        timeZone:
          "Asia/Damascus",
      }
    );
  } catch {
    return "—";
  }
}

/* =========================================================
   Money
========================================================= */

function pickCurrency(...values) {
  for (const value of values) {
    if (
      value != null &&
      String(value).trim() !== ""
    ) {
      return String(value).toUpperCase();
    }
  }

  return "";
}

function pickAmount(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (/^-?\d+(?:\.\d+)?$/.test(text)) return text.replace(/^-/, "");
  }
  return null;
}

/* =========================================================
   Misc
========================================================= */

function hexWithAlpha(hex, alpha) {
  try {
    const value =
      Math.round(
        alpha * 255
      );

    return `${hex}${value
      .toString(16)
      .padStart(2, "0")}`;
  } catch {
    return hex;
  }
}

function sortByCreatedDesc(items) {
  return items
    .slice()
    .sort((a, b) => {
      const aDate =
        extractItemDate(a);

      const bDate =
        extractItemDate(b);

      return (
        (bDate?.getTime?.() || 0) -
        (aDate?.getTime?.() || 0)
      );
    });
}

/* =========================================================
   Screen
========================================================= */

export default function MyPayments({
  navigation,
}) {
  const insets =
    useSafeAreaInsets();

  const {
    t,
    i18n,
  } = useTranslation();

  const {
    width: W,
    height: H,
  } = useWindowDimensions();

  const sx = useCallback(
    (n) =>
      (W / BASE_W) * n,
    [W]
  );

  const sy = useCallback(
    (n) =>
      (H / BASE_H) * n,
    [H]
  );

  const sp = useCallback(
    (n) =>
      n *
      Math.min(
        W / BASE_W,
        H / BASE_H
      ),
    [W, H]
  );

  const L = useCallback(
    (key, fallback) =>
      t(key, fallback),
    [t]
  );

  /* ================= State ================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  /* Pagination */

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    hasNext,
    setHasNext,
  ] = useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  /* Status filter */

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  /* ================= Custom Dates ================= */

  const [
    dateFrom,
    setDateFrom,
  ] = useState(null);

  const [
    dateTo,
    setDateTo,
  ] = useState(null);

  const [dateInputFrom,setDateInputFrom] = useState(null);
  const [dateInputTo,setDateInputTo] = useState(null);
  const [pickerField, setPickerField] = useState(null);
  const [draftDate, setDraftDate] = useState(new Date());
  const requestSequence = useRef(0);
  const historyAbort = useRef(null);
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const filteredItems = items;

  /* =======================================================
     Fetch
  ======================================================= */

  const fetchPage = useCallback(async ({ reset = false, pageOverride } = {}) => {
    const sequence = ++requestSequence.current;
    historyAbort.current?.abort();
    const controller = new AbortController();
    historyAbort.current = controller;
    const currentPage = reset ? 1 : pageOverride || 1;
    try {
      setError("");
      if (reset) { setItems([]); setSummary(null); setHasNext(false); setPage(1); }
      const params = { page:currentPage, page_size:PAGE_SIZE,
        ...(statusFilter !== "all" ? {status:statusFilter} : {}),
        ...(dateFrom ? {date_from:calendarKey(dateFrom)} : {}),
        ...(dateTo ? {date_to:calendarKey(dateTo)} : {}) };
      const response = await listPaymentsHistory(params, {signal:controller.signal});
      if (sequence !== requestSequence.current) return;
      if (!response?.ok) throw new Error(response?.error || "تعذر تحميل المدفوعات.");
      let totals = response.summary || null;
      if (!totals && !hasDateFilter && statusFilter === "all") {
        const result = await getPaymentsStatusSummary();
        if (sequence !== requestSequence.current) return;
        totals = result?.ok && !result.missing ? result.data : null;
      }
      const nextItems = sortByCreatedDesc(response.data || []);
      setItems(previous => reset ? nextItems : [...previous, ...nextItems.filter(x => !previous.some(y => y.id === x.id))]);
      setSummary(totals);
      setHasNext(Boolean(response.pagination?.next));
      setPage(currentPage);
    } catch (error) {
      if (sequence === requestSequence.current) setError(getApiErrorMessage(error));
    } finally {
      if (sequence === requestSequence.current) { setLoading(false); setRefreshing(false); setLoadingMore(false); }
    }
  }, [statusFilter, dateFrom, dateTo, hasDateFilter]);

  useEffect(() => {
    setLoading(true);
    fetchPage({reset:true});
    return () => { requestSequence.current += 1; historyAbort.current?.abort(); };
  }, [fetchPage]);

  /* =======================================================
     Refresh
  ======================================================= */

  const onRefresh =
    useCallback(() => {
      setRefreshing(
        true
      );

      setPage(1);

      fetchPage({
        reset: true,
      });
    }, [
      fetchPage,
    ]);

  /* =======================================================
     Load more
  ======================================================= */

  const loadMore =
    useCallback(() => {
      if (
        loadingMore ||
        !hasNext
      ) {
        return;
      }

      setLoadingMore(
        true
      );

      const next =
        page + 1;



      fetchPage({
        reset: false,
        pageOverride:
          next,
      });
    }, [
      fetchPage,
      hasNext,
      loadingMore,
      page,
    ]);

  /* =======================================================
     Summary filter
  ======================================================= */

  const onTapSummary =
    useCallback(
      (target) => {
        if (!target) {
          setStatusFilter(
            "all"
          );

          return;
        }

        if (
          [
            "approved",
            "pending",
            "failed",
          ].includes(
            target
          )
        ) {
          setStatusFilter(
            target
          );
        }
      },
      []
    );

  /* =======================================================
     Date actions
  ======================================================= */

  const clearDates = useCallback(() => {
    setDateFrom(null);setDateTo(null);setDateInputFrom(null);setDateInputTo(null);setPickerField(null);
  }, []);
  const applyDates = () => {
    if (dateInputFrom && dateInputTo && dateInputFrom > dateInputTo) return;
    if (dateInputFrom > historyToday() || dateInputTo > historyToday()) return;
    setDateFrom(dateInputFrom);setDateTo(dateInputTo);
  };
  const commitDate = (field,value) => {
    const date = startOfDay(value);
    if (!date || Number.isNaN(+date) || date > historyToday()) return;
    if (field === "from" && dateInputTo && date > dateInputTo || field === "to" && dateInputFrom && date < dateInputFrom) return;
    if (field === "from") setDateInputFrom(date);else setDateInputTo(date);
  };
  const openDatePicker = field => {
    const maximumDate = field === "from" && dateInputTo ? dateInputTo : historyToday();
    const minimumDate = field === "to" ? dateInputFrom || undefined : undefined;
    let value = (field === "from" ? dateInputFrom : dateInputTo) || maximumDate;
    if (value > maximumDate) value = maximumDate;
    if (minimumDate && value < minimumDate) value = minimumDate;
    if (Platform.OS === "android") DateTimePickerAndroid.open({value,mode:"date",minimumDate,maximumDate,
      onChange:(event,date)=>{if(event.type==="set" && date) commitDate(field,date);}});
    else if (Platform.OS === "ios") {setDraftDate(value);setPickerField(field);}
  };

  /* =======================================================
     Navigation
  ======================================================= */

  const onExplore =
    useCallback(() => {
      navigation.navigate(
        "Home"
      );
    }, [
      navigation,
    ]);

  /* =======================================================
     List
  ======================================================= */

  const keyExtractor =
    useCallback(
      (item) =>
        String(
          item.id
        ),
      []
    );

  const renderSeparator =
    useCallback(
      () => (
        <View
          style={{
            height:
              sy(10),
          }}
        />
      ),
      [sy]
    );

  const renderPaymentItem =
    useCallback(
      ({ item }) => (
        <PaymentCard
          item={item}
          sx={sx}
          sy={sy}
          sp={sp}
          lang={
            i18n.language
          }
          L={L}
        />
      ),
      [
        L,
        i18n.language,
        sp,
        sx,
        sy,
      ]
    );

  const S =
    useMemo(
      () =>
        stylesFactory({
          sx,
          sy,
          sp,
        }),
      [
        sx,
        sy,
        sp,
      ]
    );

  const listContentStyle =
    useMemo(
      () => ({
        paddingHorizontal:
          sx(14),

        paddingTop:
          sy(6),

        paddingBottom:
          sy(80) +
          insets.bottom +
          sy(12),
      }),
      [
        insets.bottom,
        sx,
        sy,
      ]
    );

  const listFooter =
    useMemo(
      () => (
        <View
          style={{
            paddingVertical:
              sy(14),
          }}
        >
          {hasNext ? (
            <Pressable
              onPress={
                loadMore
              }
              disabled={
                loadingMore
              }
              style={[
                S.loadMoreButton,

                loadingMore && {
                  opacity:
                    0.6,
                },
              ]}
            >
              {loadingMore ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name="chevron-down-outline"
                    size={18}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      S.loadMoreText
                    }
                  >
                    {L(
                      "payments.loadMore",
                      "تحميل المزيد"
                    )}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <Text
              style={
                S.listEndText
              }
            >
              {L(
                "payments.noMore",
                "لا توجد نتائج أخرى"
              )}
            </Text>
          )}
        </View>
      ),
      [
        L,
        S.loadMoreButton,
        S.loadMoreText,
        S.listEndText,
        hasNext,
        loadMore,
        loadingMore,
        sy,
      ]
    );

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="payments"
      withSideMenu={
        true
      }
    >
      <View
        style={
          styles.page
        }
      >
        {/* Background */}

        <View
          pointerEvents="none"
          style={
            styles.spinnerBg
          }
        >
          <CornerSpinner
            size={
              sx(800)
            }
            image={require("../assets/home-corner.png")}
            speedMs={
              16000
            }
            opacity={
              0.45
            }
          />
        </View>

        {/* =================================================
            نفس هيدر باقي الصفحات
        ================================================= */}

        <AppHeader
          title={L(
            "payments.title",
            "مدفوعاتي"
          )}
        />

        <View
          style={
            S.content
          }
        >
          {/* =================================================
              Error
          ================================================= */}

          {!!error && (
            <View
              style={
                S.errorBanner
              }
            >
              <View
                style={
                  S.errorTop
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={
                    COLORS.failed
                  }
                />

                <Text
                  style={
                    S.errorBannerText
                  }
                >
                  {error}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setLoading(
                    true
                  );

                  fetchPage({
                    reset: true,
                  });
                }}
                disabled={
                  loading
                }
                style={
                  S.retryButton
                }
              >
                <Text
                  style={
                    S.retryButtonText
                  }
                >
                  {L(
                    "common.retry",
                    "إعادة المحاولة"
                  )}
                </Text>
              </Pressable>
            </View>
          )}

          {/* =================================================
              Summary
          ================================================= */}

          {!!summary && (
            <View
              style={
                S.summaryGrid
              }
            >
              <SummaryCard
                label={L(
                  "payments.total",
                  "الكل"
                )}
                value={
                  summary.total
                }
                tint={
                  COLORS.slate
                }
                icon="receipt-outline"
                active={
                  statusFilter ===
                  "all"
                }
                onPress={() =>
                  onTapSummary(
                    null
                  )
                }
              />

              <SummaryCard
                label={L(
                  "payments.approved",
                  "مكتملة"
                )}
                value={
                  summary.success
                }
                tint={
                  COLORS.success
                }
                icon="checkmark-circle-outline"
                active={
                  statusFilter ===
                  "approved"
                }
                onPress={() =>
                  onTapSummary(
                    "approved"
                  )
                }
              />

              <SummaryCard
                label={L(
                  "payments.pending",
                  "قيد الانتظار"
                )}
                value={
                  summary.pending
                }
                tint={
                  COLORS.pending
                }
                icon="time-outline"
                active={
                  statusFilter ===
                  "pending"
                }
                onPress={() =>
                  onTapSummary(
                    "pending"
                  )
                }
              />

              <SummaryCard
                label={L(
                  "payments.failed",
                  "فاشلة"
                )}
                value={
                  summary.failed
                }
                tint={
                  COLORS.failed
                }
                icon="close-circle-outline"
                active={
                  statusFilter ===
                  "failed"
                }
                onPress={() =>
                  onTapSummary(
                    "failed"
                  )
                }
              />
            </View>
          )}

          {!loading && !summary && <Text style={{textAlign:"right",paddingHorizontal:14,color:COLORS.textMuted}}>إحصائيات الفترة غير متوفرة حالياً.</Text>}
          {/* =================================================
              Custom Date Range
          ================================================= */}

          <View style={S.dateCard}>
            <Text style={S.dateTitle}>الفترة الزمنية</Text>
            <View style={[S.dateFieldsRow,{marginVertical:6}]}>
              <DateButton title="من تاريخ" value={dateInputFrom} onPress={()=>openDatePicker("from")}/>
              <DateButton title="إلى تاريخ" value={dateInputTo} onPress={()=>openDatePicker("to")}/>
            </View>
            <View style={styles.monthRow}>
              <Pressable accessibilityRole="button" style={[styles.datePreset,styles.datePresetActive]} onPress={applyDates}><Text style={styles.datePresetTextActive}>{t("checkout.apply","تطبيق الفلتر")}</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.datePreset} onPress={clearDates}><Text style={styles.datePresetText}>{t("checkout.clear","مسح الفلتر")}</Text></Pressable>
            </View>
          </View>

          {/* =================================================
              Loading / Empty / List
          ================================================= */}

          {loading ? (
            <View
              style={
                S.center
              }
            >
              <ActivityIndicator
                size="large"
                color={
                  COLORS.primary
                }
              />

              <Text
                style={
                  S.loadingText
                }
              >
                جاري تحميل المدفوعات...
              </Text>
            </View>
          ) : error &&
            items.length ===
              0 ? (
            <View
              style={
                S.center
              }
            >
              <Ionicons
                name="cloud-offline-outline"
                size={
                  sx(42)
                }
                color={
                  COLORS.textMuted
                }
              />

              <Text
                style={
                  S.errorText
                }
              >
                {L(
                  "payments.loadFailed",
                  "تعذر تحميل سجل المدفوعات."
                )}
              </Text>
            </View>
          ) : filteredItems.length ===
            0 ? (
            <EmptyState
              sx={sx}
              sy={sy}
              title={
                hasDateFilter
                  ? "لا توجد عمليات ضمن هذه الفترة"
                  : L(
                      "payments.emptyTitle",
                      "لا توجد مدفوعات بعد"
                    )
              }
              hint={
                hasDateFilter
                  ? "جرّب اختيار فترة زمنية مختلفة."
                  : L(
                      "payments.emptyHint",
                      "عمليات الشراء التي تقوم بها ستظهر هنا."
                    )
              }
              onExplore={
                onExplore
              }
            />
          ) : (
            <FlatList
              data={
                filteredItems
              }
              keyExtractor={
                keyExtractor
              }
              renderItem={
                renderPaymentItem
              }
              ItemSeparatorComponent={
                renderSeparator
              }
              ListFooterComponent={
                listFooter
              }
              contentContainerStyle={
                listContentStyle
              }
              showsVerticalScrollIndicator={
                false
              }
              refreshControl={
                <RefreshControl
                  refreshing={
                    refreshing
                  }
                  onRefresh={
                    onRefresh
                  }
                  tintColor={
                    COLORS.primary
                  }
                />
              }
              bounces={
                false
              }
              overScrollMode="never"
              initialNumToRender={
                8
              }
              windowSize={
                7
              }
              maxToRenderPerBatch={
                8
              }
              updateCellsBatchingPeriod={
                50
              }
              removeClippedSubviews={
                true
              }
            />
          )}
        </View>
      </View>
      {Platform.OS === "ios" && pickerField !== null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPickerField(null)}>
          <View style={styles.datePickerBackdrop}><View style={styles.datePickerSheet} accessibilityViewIsModal>
            <Text style={styles.datePickerTitle}>{pickerField === "from" ? "من تاريخ" : "إلى تاريخ"}</Text>
            <DateTimePicker value={draftDate} mode="date" display="spinner" themeVariant="light" style={{width:"100%",height:216}}
              minimumDate={pickerField === "to" ? dateInputFrom || undefined : undefined}
              maximumDate={pickerField === "from" && dateInputTo ? dateInputTo : historyToday()}
              onChange={(event,date) => { if (event.type === "set" && date) setDraftDate(date); }}/>
            <View style={styles.monthRow}>
              <Pressable style={styles.datePreset} onPress={() => setPickerField(null)}><Text>إلغاء</Text></Pressable>
              <Pressable style={[styles.datePreset,styles.datePresetActive]} onPress={() => {commitDate(pickerField,draftDate);setPickerField(null);}}><Text style={styles.datePresetTextActive}>تطبيق</Text></Pressable>
            </View>
          </View></View>
        </Modal>
      )}
    </PageLayout>
  );
}

/* =========================================================
   Date Button
========================================================= */

function DateButton({
  title,
  value,
  onPress,
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={
        styles.dateButton
      }
    >
      <View
        style={
          styles.dateButtonIcon
        }
      >
        <Ionicons
          name="calendar-clear-outline"
          size={18}
          color={
            COLORS.primary
          }
        />
      </View>

      <View
        style={
          styles.dateButtonTextWrap
        }
      >
        <Text
          style={
            styles.dateButtonLabel
          }
        >
          {title}
        </Text>

        <Text
          style={[
            styles.dateButtonValue,

            !value && {
              color:
                COLORS.textMuted,
              fontWeight:
                "600",
            },
          ]}
        >
          {formatSelectedDate(
            value
          )}
        </Text>
      </View>
    </Pressable>
  );
}

/* =========================================================
   Summary Card
========================================================= */

function SummaryCard({
  label,
  value,
  tint,
  icon,
  active,
  onPress,
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={[
        styles.summaryCard,

        active && {
          borderColor:
            tint,

          backgroundColor:
            hexWithAlpha(
              tint,
              0.055
            ),
        },
      ]}
    >
      <View
        style={
          styles.summaryTop
        }
      >
        <View
          style={[
            styles.summaryIcon,
            {
              backgroundColor:
                hexWithAlpha(
                  tint,
                  0.1
                ),
            },
          ]}
        >
          <Ionicons
            name={
              icon
            }
            size={16}
            color={
              tint
            }
          />
        </View>

        <Text
          style={[
            styles.summaryValue,
            {
              color:
                tint,
            },
          ]}
        >
          {value ?? 0}
        </Text>
      </View>

      <Text
        style={
          styles.summaryLabel
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* =========================================================
   Payment Card
========================================================= */

const PaymentCard =
  React.memo(
    function PaymentCard({
      item,
      sx,
      sy,
      sp,
      lang,
      L,
    }) {
      const { user } = useAuth();
      const [objections, setObjections] = useState([]);
      const [objectionLoadError, setObjectionLoadError] = useState("");
      const objectionLock = useRef(false);
      const loadObjections = useCallback(async () => {
        if (!user?.id || !item?.id) return;
        try { setObjectionLoadError(""); setObjections(await listPaymentObjections(item.id, user.id)); }
        catch (error) { setObjectionLoadError(getApiErrorMessage(error)); }
      }, [item?.id, user?.id]);
      const [
        expanded,
        setExpanded,
      ] =
        useState(
          false
        );

      const [
        objectionOpen,
        setObjectionOpen,
      ] = useState(false);

      const [
        objectionReason,
        setObjectionReason,
      ] = useState("");

      const [
        objectionSubmitting,
        setObjectionSubmitting,
      ] = useState(false);

      const normalizedStatus =
        normalizeStatus(
          item
        );

      const statusMeta =
        getStatusMeta(
          normalizedStatus,
          L
        );

      const created =
        formatDate(
          item?.created_at ||
            item?.processed_at,

          lang
        );

      const productName =
        displayProductName(
          item,
          lang
        ) ||
        "—";

      const userInput =
        extractPaymentUserInput(
          item
        );

      const quantity =
        extractPaymentQuantity(
          item
        );

      const paidAmount =
        pickAmount(
          item?.paid_amount,

          item?.wallet_user_final_price,

          item?.wallet_final_price,

          item?.final_price,

          item?.amount
        );

      const paidCurrency =
        pickCurrency(
          item?.paid_currency,

          item?.wallet_currency,

          item?.currency
        );

      const amountText = moneySnapshot(paidAmount, paidCurrency, lang);

      const identifiers = paymentIdentifiers(item);
      const snapshot = paymentSnapshots(item);
      const refund = refundPresentation(item, lang);
      const activeObjection = objections.find(isOpenObjection);
      const latestObjection = activeObjection || objections[0];
      const canSubmitObjection = canObject(item) && Boolean(user?.id) && (item.user == null || String(item.user) === String(user.id));
      useEffect(() => { if (expanded && canSubmitObjection) loadObjections(); }, [expanded, canSubmitObjection, loadObjections]);

      const openObjection =
        (event) => {
          event?.stopPropagation?.();

          if (
            !canSubmitObjection ||
            activeObjection
          ) {
            return;
          }

          setObjectionReason("");
          setObjectionOpen(true);
        };

      const closeObjection =
        () => {
          if (objectionSubmitting) {
            return;
          }

          setObjectionOpen(false);
        };

      const submitObjection =
        async (event) => {
          event?.stopPropagation?.();

          const cleanReason =
            String(
              objectionReason || ""
            ).trim();

          if (!cleanReason) {
            Alert.alert(
              "سبب الاعتراض",
              "يرجى كتابة سبب الاعتراض."
            );

            return;
          }

          if (objectionLock.current || activeObjection) return;
          objectionLock.current = true;
          setObjectionSubmitting(true);
          const result = await submitPaymentObjection(item, cleanReason, user?.id);
          objectionLock.current = false;
          setObjectionSubmitting(false);

          if (!result?.ok) {
            Alert.alert(
              "تعذر إرسال الاعتراض",
              result?.error ||
                "حاول مرة أخرى."
            );

            return;
          }

          setObjections(previous => [result.data, ...previous.filter(x => x.id !== result.data?.id)]);
          setObjectionOpen(false);

          Alert.alert(
            "تم إرسال الاعتراض",
            "تم إرسال طلب الاعتراض للإدارة بنجاح."
          );
        };

      return (
        <Pressable
          onPress={() =>
            setExpanded(
              (previous) =>
                !previous
            )
          }
          android_ripple={{
            color:
              "#EEF4FF",
          }}
          style={[
            styles.paymentCard,

            {
              padding:
                sx(15),

              borderRadius:
                sx(18),
            },

            expanded &&
              styles.paymentCardExpanded,
          ]}
        >
          {/* =================================================
              Main Card
          ================================================= */}

          <View
            style={
              styles.paymentTop
            }
          >
            <View
              style={
                styles.productInfo
              }
            >
              <Text
                numberOfLines={
                  2
                }
                style={[
                  styles.productName,
                  {
                    fontSize:
                      sp(16),
                  },
                ]}
              >
                {productName}
              </Text>

              <View
                style={[
                  styles.dateRow,
                  {
                    marginTop:
                      sy(5),
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={
                    sp(13)
                  }
                  color={
                    COLORS.textMuted
                  }
                />

                <Text
                  style={[
                    styles.dateText,
                    {
                      fontSize:
                        sp(12),
                    },
                  ]}
                >
                  {created}
                </Text>
              </View>
            </View>

            <StatusPill
              label={
                statusMeta.label
              }
              tint={
                statusMeta.tint
              }
              icon={
                statusMeta.icon
              }
            />
          </View>

          {/* Amount */}

          <View
            style={[
              styles.amountBox,
              {
                marginTop:
                  sy(13),

                paddingVertical:
                  sy(10),

                paddingHorizontal:
                  sx(12),
              },
            ]}
          >
            <Text
              style={[
                styles.amountLabel,
                {
                  fontSize:
                    sp(13),
                },
              ]}
            >
              المبلغ المدفوع
            </Text>

            <Text
              style={[
                styles.amountValue,
                {
                  fontSize:
                    sp(18),
                },
              ]}
            >
              {amountText}
            </Text>
          </View>

          {/* =================================================
              Beautiful Expanded Details
          ================================================= */}

          {expanded && (
            <View
              style={[
                styles.expandedPanel,
                {
                  marginTop:
                    sy(13),

                  padding:
                    sx(12),

                  borderRadius:
                    sx(15),
                },
              ]}
            >
              {/* Details title */}

              <View
                style={
                  styles.detailsHeader
                }
              >
                <View
                  style={
                    styles.detailsHeaderIcon
                  }
                >
                  <Ionicons
                    name="receipt-outline"
                    size={18}
                    color={
                      COLORS.primary
                    }
                  />
                </View>

                <Text
                  style={[
                    styles.detailsTitle,
                    {
                      fontSize:
                        sp(15),
                    },
                  ]}
                >
                  تفاصيل العملية
                </Text>
              </View>

              <View
                style={
                  styles.detailsDivider
                }
              />

              {!!userInput && (
                <DetailItem
                  icon="person-circle-outline"
                  label="بيانات الحساب"
                  value={
                    userInput
                  }
                  sp={sp}
                  sy={sy}
                  ltr
                />
              )}

              {!!quantity && (
                <DetailItem
                  icon="layers-outline"
                  label="الكمية"
                  value={
                    quantity
                  }
                  sp={sp}
                  sy={sy}
                  ltr
                />
              )}

              <DetailItem
                icon="cash-outline"
                label="المبلغ المدفوع"
                value={
                  amountText
                }
                sp={sp}
                sy={sy}
                ltr
                highlight
              />

              <DetailItem
                icon={
                  statusMeta.icon
                }
                label="حالة العملية"
                value={
                  statusMeta.label ||
                  "—"
                }
                sp={sp}
                sy={sy}
                valueColor={
                  statusMeta.tint
                }
              />

              <DetailItem
                icon="calendar-outline"
                label="تاريخ العملية"
                value={
                  created
                }
                sp={sp}
                sy={sy}
              />

              {[["رقم عملية Stark Card",identifiers.transaction],["رقم الدفعة",identifiers.payment],
                ["رقم عملية المزود",identifiers.provider],["رقم طلب المزود",identifiers.order]].map(([label,value]) => (
                <View key={label}>
                  <DetailItem icon="receipt-outline" label={label} value={value == null ? "غير متوفر" : String(value)} sp={sp} sy={sy} ltr/>
                  {value != null && <Pressable accessibilityRole="button" accessibilityLabel={`نسخ ${label}`}
                    style={styles.copyNumber} onPress={async event => {
                      event.stopPropagation();
                      try {await Clipboard.setStringAsync(String(value)); Alert.alert("تم النسخ");}
                      catch(error) {Alert.alert("تعذر النسخ",getApiErrorMessage(error));}
                    }}><Text style={styles.datePresetTextActive}>نسخ</Text></Pressable>}
                </View>
              ))}
              <DetailItem icon="wallet-outline" label="الرصيد المتاح قبل العملية" value={moneySnapshot(snapshot.before,snapshot.currency,lang)} sp={sp} sy={sy} ltr/>
              <DetailItem icon="wallet-outline" label="الرصيد المتاح بعد العملية" value={moneySnapshot(snapshot.after,snapshot.currency,lang)} sp={sp} sy={sy} ltr/>
              <DetailItem icon="cash-outline" label="المبلغ المخصوم فعلياً" value={moneySnapshot(snapshot.debit,snapshot.currency,lang)} sp={sp} sy={sy} ltr/>
              <DetailItem icon="return-down-back-outline" label="حالة الاسترداد" value={refund.status} sp={sp} sy={sy}/>
              {item.refund && <>
                <DetailItem icon="cash-outline" label="المبلغ الأصلي" value={moneySnapshot(refund.original,refund.currency,lang)} sp={sp} sy={sy}/>
                <DetailItem icon="cash-outline" label="المبلغ المسترد فعلياً" value={moneySnapshot(refund.refunded,refund.currency,lang)} sp={sp} sy={sy}/>
                <DetailItem icon="cash-outline" label="المتبقي القابل للاسترداد" value={moneySnapshot(refund.remaining,refund.currency,lang)} sp={sp} sy={sy}/>
                {refund.date && <DetailItem icon="calendar-outline" label="تاريخ الاسترداد" value={formatDate(refund.date,lang)} sp={sp} sy={sy}/>}
                {refund.reference != null && <DetailItem icon="receipt-outline" label="مرجع معاملة الاسترداد" value={String(refund.reference)} sp={sp} sy={sy}/>}
              </>}
              {latestObjection && <>
                <DetailItem icon="chatbubble-outline" label="حالة الاعتراض" value={objectionStatus(latestObjection,lang)} sp={sp} sy={sy}/>
                {latestObjection.rejection_reason && <DetailItem icon="alert-circle-outline" label="سبب رفض الاعتراض" value={getApiErrorMessage(latestObjection.rejection_reason)} sp={sp} sy={sy}/>}
                {latestObjection.admin_notes && <DetailItem icon="chatbubble-outline" label="رد الإدارة" value={getApiErrorMessage(latestObjection.admin_notes)} sp={sp} sy={sy}/>}
                {latestObjection.decision_at && <DetailItem icon="calendar-outline" label="تاريخ القرار" value={formatDate(latestObjection.decision_at,lang)} sp={sp} sy={sy}/>}
                <Text style={styles.datePresetText}>قبول الاعتراض لا يعني استرداد الأموال؛ تظهر التسوية بعد تأكيدها.</Text>
              </>}
              {!!objectionLoadError && <Pressable style={styles.datePreset} onPress={loadObjections}><Text>{objectionLoadError} — إعادة المحاولة</Text></Pressable>}

              {!!item?.gamer_id && (
                <DetailItem
                  icon="game-controller-outline"
                  label="معرّف اللاعب"
                  value={String(
                    item.gamer_id
                  )}
                  sp={sp}
                  sy={sy}
                  ltr
                />
              )}

              {!!item?.selected_option && (
                <DetailItem
                  icon="options-outline"
                  label="الخيار المحدد"
                  value={String(
                    item.selected_option
                  )}
                  sp={sp}
                  sy={sy}
                />
              )}

              {!!(
                item?.notes ||
                item?.note
              ) && (
                <DetailItem
                  icon="document-text-outline"
                  label="ملاحظات"
                  value={String(
                    item?.notes ||
                      item?.note
                  )}
                  sp={sp}
                  sy={sy}
                />
              )}

              {!!item?.error_message && (
                <View
                  style={[
                    styles.failureBox,
                    {
                      marginTop:
                        sy(8),
                    },
                  ]}
                >
                  <View
                    style={
                      styles.failureHeader
                    }
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={18}
                      color={
                        COLORS.failed
                      }
                    />

                    <Text
                      style={
                        styles.failureTitle
                      }
                    >
                      سبب الفشل
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.failureText
                    }
                  >
                    {getApiErrorMessage(item.error_message)}
                  </Text>
                </View>
              )}

              {canSubmitObjection && (
                <View
                  style={[
                    styles.objectionBox,
                    {
                      marginTop:
                        sy(10),
                    },
                  ]}
                >
                  <View
                    style={
                      styles.objectionTextWrap
                    }
                  >
                    <Text
                      style={
                        styles.objectionTitle
                      }
                    >
                      في مشكلة بهذه العملية؟
                    </Text>

                    <Text
                      style={
                        styles.objectionHint
                      }
                    >
                      أرسل اعتراضاً للإدارة مع توضيح المشكلة.
                    </Text>
                  </View>

                  <Pressable
                    onPress={
                      openObjection
                    }
                    disabled={
                      (Boolean(activeObjection))
                    }
                    style={[
                      styles.objectionButton,

                      activeObjection &&
                        styles.objectionButtonDone,
                    ]}
                  >
                    <Ionicons
                      name={
                        (Boolean(activeObjection))
                          ? "checkmark-circle-outline"
                          : "alert-circle-outline"
                      }
                      size={17}
                      color={
                        (Boolean(activeObjection))
                          ? COLORS.success
                          : "#FFFFFF"
                      }
                    />

                    <Text
                      style={[
                        styles.objectionButtonText,

                        activeObjection &&
                          styles.objectionButtonTextDone,
                      ]}
                    >
                      {(Boolean(activeObjection))
                        ? "تم إرسال الاعتراض"
                        : "تقديم اعتراض"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* =================================================
              Expand Button
          ================================================= */}

          <View
            style={[
              styles.expandRow,
              {
                marginTop:
                  sy(11),
              },
            ]}
          >
            <Text
              style={[
                styles.expandText,
                {
                  fontSize:
                    sp(12),
                },
              ]}
            >
              {expanded
                ? "إخفاء التفاصيل"
                : "عرض التفاصيل"}
            </Text>

            <Ionicons
              name={
                expanded
                  ? "chevron-up-outline"
                  : "chevron-down-outline"
              }
              size={
                sp(16)
              }
              color={
                COLORS.primary
              }
            />
          </View>

          <Modal
            visible={
              objectionOpen
            }
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={
              closeObjection
            }
          >
            <Pressable
              style={
                styles.objectionBackdrop
              }
              onPress={
                closeObjection
              }
            >
              <Pressable
                onPress={(event) =>
                  event?.stopPropagation?.()
                }
                style={
                  styles.objectionModal
                }
              >
                <View
                  style={
                    styles.objectionModalHeader
                  }
                >
                  <View
                    style={
                      styles.objectionModalIcon
                    }
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={22}
                      color={
                        COLORS.failed
                      }
                    />
                  </View>

                  <View
                    style={{
                      flex: 1,
                      alignItems: "flex-end",
                    }}
                  >
                    <Text
                      style={
                        styles.objectionModalTitle
                      }
                    >
                      تقديم اعتراض
                    </Text>

                    <Text
                      style={
                        styles.objectionModalSubtitle
                      }
                    >
                      الدفعة #{String(identifiers.payment)}
                    </Text>
                  </View>
                </View>

                <Text
                  style={
                    styles.objectionReasonLabel
                  }
                >
                  اشرح سبب الاعتراض
                </Text>

                <TextInput
                  value={
                    objectionReason
                  }
                  onChangeText={
                    setObjectionReason
                  }
                  editable={
                    !objectionSubmitting
                  }
                  multiline
                  maxLength={1000}
                  textAlign="right"
                  textAlignVertical="top"
                  placeholder="مثال: تم خصم المبلغ ولم يصل المنتج..."
                  placeholderTextColor="#94A3B8"
                  style={
                    styles.objectionInput
                  }
                />

                <Text
                  style={
                    styles.objectionCounter
                  }
                >
                  {objectionReason.length}/1000
                </Text>

                <View
                  style={
                    styles.objectionActions
                  }
                >
                  <Pressable
                    onPress={
                      closeObjection
                    }
                    disabled={
                      objectionSubmitting
                    }
                    style={
                      styles.objectionCancelButton
                    }
                  >
                    <Text
                      style={
                        styles.objectionCancelText
                      }
                    >
                      إلغاء
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={
                      submitObjection
                    }
                    disabled={
                      objectionSubmitting
                    }
                    style={[
                      styles.objectionSubmitButton,

                      objectionSubmitting && {
                        opacity: 0.65,
                      },
                    ]}
                  >
                    {objectionSubmitting ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <Ionicons
                        name="send-outline"
                        size={17}
                        color="#FFFFFF"
                      />
                    )}

                    <Text
                      style={
                        styles.objectionSubmitText
                      }
                    >
                      {objectionSubmitting
                        ? "جاري الإرسال..."
                        : "إرسال الاعتراض"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </Pressable>
      );
    }
  );

/* =========================================================
   Beautiful Detail Item
========================================================= */

function DetailItem({
  icon,
  label,
  value,
  sp,
  sy,
  ltr = false,
  highlight = false,
  valueColor,
}) {
  return (
    <View
      style={[
        styles.detailItem,
        {
          paddingVertical:
            sy(8),
        },
      ]}
    >
      <View
        style={
          styles.detailRight
        }
      >
        <View
          style={
            styles.detailIcon
          }
        >
          <Ionicons
            name={icon}
            size={17}
            color={
              COLORS.primary
            }
          />
        </View>

        <Text
          style={[
            styles.detailLabel,
            {
              fontSize:
                sp(12.5),
            },
          ]}
        >
          {label}
        </Text>
      </View>

      <Text
        numberOfLines={
          3
        }
        style={[
          styles.detailValue,

          {
            fontSize:
              sp(
                highlight
                  ? 14
                  : 13
              ),

            writingDirection:
              ltr
                ? "ltr"
                : "rtl",

            color:
              valueColor ||
              (
                highlight
                  ? COLORS.primary
                  : COLORS.text
              ),
          },

          highlight && {
            fontWeight:
              "900",
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   Status Pill
========================================================= */

function StatusPill({
  label,
  tint,
  icon,
}) {
  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor:
            hexWithAlpha(
              tint,
              0.1
            ),

          borderColor:
            hexWithAlpha(
              tint,
              0.28
            ),
        },
      ]}
    >
      <Ionicons
        name={
          icon ||
          "ellipse-outline"
        }
        size={13}
        color={
          tint
        }
      />

      <Text
        style={[
          styles.statusText,
          {
            color:
              tint,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/* =========================================================
   Empty State
========================================================= */

function EmptyState({
  sx,
  sy,
  title,
  hint,
  onExplore,
}) {
  return (
    <View
      style={[
        styles.emptyState,
        {
          paddingHorizontal:
            sx(24),

          paddingTop:
            sy(60),
        },
      ]}
    >
      <View
        style={[
          styles.emptyIcon,
          {
            width:
              sx(76),

            height:
              sx(76),

            borderRadius:
              sx(38),
          },
        ]}
      >
        <Ionicons
          name="receipt-outline"
          size={
            sx(34)
          }
          color={
            COLORS.primary
          }
        />
      </View>

      <Text
        style={[
          styles.emptyTitle,
          {
            fontSize:
              sx(19),

            marginTop:
              sy(16),
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.emptyHint,
          {
            marginTop:
              sy(6),
          },
        ]}
      >
        {hint}
      </Text>

      <Pressable
        onPress={
          onExplore
        }
        style={[
          styles.exploreButton,
          {
            marginTop:
              sy(18),
          },
        ]}
      >
        <Ionicons
          name="storefront-outline"
          size={19}
          color="#FFFFFF"
        />

        <Text
          style={
            styles.exploreButtonText
          }
        >
          استكشف المنتجات
        </Text>
      </Pressable>
    </View>
  );
}

/* =========================================================
   Responsive Styles
========================================================= */

function stylesFactory({
  sx,
  sy,
  sp,
}) {
  return StyleSheet.create({
    content: {
      flex: 1,

      alignSelf:
        "center",

      width:
        "100%",

      maxWidth:
        MAX_W,
    },

    /* ================= Error ================= */

    errorBanner: {
      marginHorizontal:
        sx(14),

      marginTop:
        sy(10),

      marginBottom:
        sy(6),

      padding:
        sx(12),

      borderRadius:
        sx(14),

      borderWidth:
        1,

      borderColor:
        "#FECACA",

      backgroundColor:
        "#FEF2F2",
    },

    errorTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(8),
    },

    errorBannerText: {
      flex: 1,

      color:
        "#991B1B",

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    retryButton: {
      alignSelf:
        "flex-end",

      backgroundColor:
        "#991B1B",

      marginTop:
        sy(9),

      paddingVertical:
        sy(7),

      paddingHorizontal:
        sx(13),

      borderRadius:
        sx(9),
    },

    retryButtonText: {
      color:
        "#FFFFFF",

      fontWeight:
        "800",

      writingDirection:
        "rtl",
    },

    /* ================= Summary ================= */

    summaryGrid: {
      flexDirection:
        "row-reverse",

      flexWrap:
        "wrap",

      justifyContent:
        "space-between",

      gap:
        sx(9),

      paddingHorizontal:
        sx(14),

      paddingTop:
        sy(12),

      marginBottom:
        sy(12),
    },

    /* ================= Date ================= */

    dateCard: {
      marginHorizontal:
        sx(14),

      marginBottom:
        sy(8),

      padding:
        sx(10),

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(17),

      backgroundColor:
        "#FFFFFF",

      shadowColor:
        "#000",

      shadowOpacity:
        0.035,

      shadowRadius:
        7,

      shadowOffset: {
        width: 0,
        height: 3,
      },

      elevation:
        1,
    },

    dateHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      marginBottom:
        sy(12),

      gap:
        sx(9),
    },

    dateHeaderIcon: {
      width:
        sx(38),

      height:
        sx(38),

      borderRadius:
        sx(12),

      backgroundColor:
        COLORS.primarySoft,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    dateTitle: {
      color:
        COLORS.text,

      fontSize:
        sp(15),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    dateSubtitle: {
      color:
        COLORS.textMuted,

      fontSize:
        sp(11.5),

      marginTop:
        sy(2),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    clearDateButton: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(4),

      backgroundColor:
        COLORS.primarySoft,

      paddingHorizontal:
        sx(9),

      paddingVertical:
        sy(6),

      borderRadius:
        sx(10),
    },

    clearDateText: {
      color:
        COLORS.primary,

      fontWeight:
        "800",

      fontSize:
        sp(11),

      writingDirection:
        "rtl",
    },

    dateFieldsRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(6),
    },

    dateArrow: {
      width:
        sx(25),

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    dateHint: {
      marginTop:
        sy(9),

      color:
        COLORS.pending,

      fontSize:
        sp(11.5),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* ================= Loading ================= */

    center: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        sx(24),

      paddingTop:
        sy(40),
    },

    loadingText: {
      color:
        COLORS.textMuted,

      marginTop:
        sy(10),

      fontSize:
        sp(14),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    errorText: {
      color:
        COLORS.failed,

      marginTop:
        sy(10),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    loadMoreButton: {
      alignSelf:
        "center",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(6),

      minWidth:
        sx(145),

      backgroundColor:
        COLORS.primary,

      paddingHorizontal:
        sx(18),

      paddingVertical:
        sy(10),

      borderRadius:
        sx(12),
    },

    loadMoreText: {
      color:
        "#FFFFFF",

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    listEndText: {
      color:
        "#94A3B8",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },
  });
}

/* =========================================================
   Static Styles
========================================================= */

const styles =
  StyleSheet.create({
    page: {
      flex: 1,

      backgroundColor:
        COLORS.bg,
    },

    /* =====================================================
       Summary
    ===================================================== */

    summaryCard: {
      width:
        "48.5%",

      minHeight:
        64,

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        16,

      padding:
        8,

      shadowColor:
        "#7d14140c",

      shadowOpacity:
        0.025,

      shadowRadius:
        7,

      shadowOffset: {
        width: 0,
        height: 3,
      },

      elevation:
        1,
    },

    summaryTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",
    },

    summaryIcon: {
      width:
        24,

      height:
        24,

      borderRadius:
        11,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    summaryValue: {
      fontSize:
        19,

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "ltr",
    },

    summaryLabel: {
      color:
        COLORS.text,

      fontSize:
        13,

      fontWeight:
        "800",

      marginTop:
        4,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Date button
    ===================================================== */

    copyNumber: {minHeight:44,alignSelf:"flex-start",justifyContent:"center",paddingHorizontal:12},
    datePresets: { flexDirection:"row-reverse",flexWrap:"wrap",gap:6,marginVertical:6 },
    datePreset: { minHeight:44,paddingHorizontal:9,paddingVertical:7,borderRadius:10,borderWidth:1,borderColor:COLORS.line,backgroundColor:"#F8FAFC",alignItems:"center",justifyContent:"center" },
    datePresetActive: {borderColor:COLORS.primary,backgroundColor:COLORS.primarySoft},
    datePresetText: {fontSize:12,color:COLORS.text,textAlign:"center",writingDirection:"rtl"},
    datePresetTextActive: {fontSize:12,color:COLORS.primary,fontWeight:"800",textAlign:"center"},
    monthRow: {flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:4},
    monthLabel: {flexShrink:1,color:COLORS.text,fontSize:13,textAlign:"center"},
    datePickerBackdrop: {flex:1,backgroundColor:"rgba(15,23,42,0.45)",justifyContent:"center",alignItems:"center",padding:16},
    datePickerSheet: {width:"100%",maxWidth:390,padding:12,borderRadius:17,backgroundColor:COLORS.card},
    datePickerTitle: {fontSize:16,fontWeight:"800",color:COLORS.text,textAlign:"right"},
    dateButton: {
      minWidth:0,
      paddingVertical:5,
      flex:
        1,

      minHeight:
        48,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      backgroundColor:
        "#F8FAFC",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        13,

      paddingHorizontal:
        9,

      gap:
        7,
    },

    dateButtonIcon: {
      width:
        24,

      height:
        24,

      borderRadius:
        9,

      backgroundColor:
        COLORS.primarySoft,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    dateButtonTextWrap: {
      minWidth:0,
      flex:
        1,

      alignItems:
        "flex-end",
    },

    dateButtonLabel: {
      color:
        COLORS.textMuted,

      fontSize:
        10.5,

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    dateButtonValue: {
      width:
        "100%",

      marginTop:
        2,

      color:
        COLORS.text,

      fontSize:
        12,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Payment Card
    ===================================================== */

    paymentCard: {
      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      shadowColor:
        "#000",

      shadowOpacity:
        0.045,

      shadowRadius:
        8,

      shadowOffset: {
        width: 0,
        height: 3,
      },

      elevation:
        Platform.OS ===
        "android"
          ? 1
          : 0,
    },

    paymentCardExpanded: {
      borderColor:
        "#BFD7FF",

      backgroundColor:
        "#FFFFFF",
    },

    paymentTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      justifyContent:
        "space-between",

      gap:
        10,
    },

    productInfo: {
      flex:
        1,

      alignItems:
        "flex-end",
    },

    productName: {
      width:
        "100%",

      color:
        COLORS.text,

      fontWeight:
        "900",

      lineHeight:
        23,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    dateRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        5,

      alignSelf:
        "flex-end",
    },

    dateText: {
      color:
        COLORS.textMuted,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Status
    ===================================================== */

    statusPill: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        4,

      borderWidth:
        1,

      borderRadius:
        999,

      paddingHorizontal:
        8,

      paddingVertical:
        5,
    },

    statusText: {
      fontSize:
        11,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Amount
    ===================================================== */

    amountBox: {
      flexDirection:
        "row-reverse",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      backgroundColor:
        "#F6F9FD",

      borderRadius:
        13,

      borderWidth:
        1,

      borderColor:
        "#EDF2F7",
    },

    amountLabel: {
      color:
        COLORS.textMuted,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    amountValue: {
      color:
        COLORS.primary,

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "ltr",
    },

    /* =====================================================
       Expanded Details
    ===================================================== */

    expandedPanel: {
      backgroundColor:
        "#F8FAFD",

      borderWidth:
        1,

      borderColor:
        "#E5EDF7",
    },

    detailsHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        8,
    },

    detailsHeaderIcon: {
      width:
        32,

      height:
        32,

      borderRadius:
        10,

      backgroundColor:
        COLORS.primarySoft,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    detailsTitle: {
      flex:
        1,

      color:
        COLORS.text,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    detailsDivider: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        "#DEE7F1",

      marginVertical:
        10,
    },

    detailItem: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        10,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        "#E8EEF5",
    },

    detailRight: {
      flex:
        1,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        8,
    },

    detailIcon: {
      width:
        29,

      height:
        29,

      borderRadius:
        9,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#EEF5FF",
    },

    detailLabel: {
      flex:
        1,

      color:
        COLORS.textMuted,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    detailValue: {
      flex:
        1,

      color:
        COLORS.text,

      fontWeight:
        "800",

      textAlign:
        "left",
    },

    /* =====================================================
       Failure
    ===================================================== */

    failureBox: {
      backgroundColor:
        "#FFF3F3",

      borderWidth:
        1,

      borderColor:
        "#FFD6D6",

      padding:
        10,

      borderRadius:
        11,
    },

    failureHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        6,
    },

    failureTitle: {
      flex:
        1,

      color:
        COLORS.failed,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    failureText: {
      color:
        "#991B1B",

      fontSize:
        12,

      marginTop:
        6,

      lineHeight:
        19,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Objection
    ===================================================== */

    objectionBox: {
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        "#E3EAF2",
      paddingTop:
        12,
      gap:
        10,
    },

    objectionTextWrap: {
      alignItems:
        "flex-end",
    },

    objectionTitle: {
      color:
        COLORS.text,
      fontSize:
        13,
      fontWeight:
        "900",
      textAlign:
        "right",
      writingDirection:
        "rtl",
    },

    objectionHint: {
      color:
        COLORS.textMuted,
      fontSize:
        11.5,
      marginTop:
        3,
      textAlign:
        "right",
      writingDirection:
        "rtl",
    },

    objectionButton: {
      minHeight:
        42,
      flexDirection:
        "row-reverse",
      alignItems:
        "center",
      justifyContent:
        "center",
      gap:
        7,
      borderRadius:
        12,
      backgroundColor:
        COLORS.failed,
      paddingHorizontal:
        14,
      paddingVertical:
        10,
    },

    objectionButtonDone: {
      backgroundColor:
        "#ECFDF3",
      borderWidth:
        1,
      borderColor:
        "#BBF7D0",
    },

    objectionButtonText: {
      color:
        "#FFFFFF",
      fontSize:
        12.5,
      fontWeight:
        "900",
      writingDirection:
        "rtl",
    },

    objectionButtonTextDone: {
      color:
        COLORS.success,
    },

    objectionBackdrop: {
      flex:
        1,
      justifyContent:
        "center",
      alignItems:
        "center",
      backgroundColor:
        "rgba(15, 23, 42, 0.55)",
      paddingHorizontal:
        18,
    },

    objectionModal: {
      width:
        "100%",
      maxWidth:
        390,
      borderRadius:
        20,
      backgroundColor:
        "#FFFFFF",
      padding:
        18,
      shadowColor:
        "#000000",
      shadowOpacity:
        0.18,
      shadowRadius:
        18,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation:
        10,
    },

    objectionModalHeader: {
      flexDirection:
        "row-reverse",
      alignItems:
        "center",
      gap:
        10,
      marginBottom:
        16,
    },

    objectionModalIcon: {
      width:
        42,
      height:
        42,
      borderRadius:
        13,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#FEF2F2",
    },

    objectionModalTitle: {
      color:
        COLORS.text,
      fontSize:
        18,
      fontWeight:
        "900",
      textAlign:
        "right",
      writingDirection:
        "rtl",
    },

    objectionModalSubtitle: {
      color:
        COLORS.textMuted,
      fontSize:
        11.5,
      marginTop:
        3,
      textAlign:
        "right",
      writingDirection:
        "rtl",
    },

    objectionReasonLabel: {
      color:
        COLORS.text,
      fontSize:
        13,
      fontWeight:
        "800",
      marginBottom:
        8,
      textAlign:
        "right",
      writingDirection:
        "rtl",
    },

    objectionInput: {
      minHeight:
        120,
      maxHeight:
        190,
      borderWidth:
        1,
      borderColor:
        "#DCE5EF",
      borderRadius:
        14,
      backgroundColor:
        "#F8FAFC",
      color:
        COLORS.text,
      paddingHorizontal:
        12,
      paddingVertical:
        12,
      fontSize:
        14,
      lineHeight:
        21,
      writingDirection:
        "rtl",
    },

    objectionCounter: {
      color:
        COLORS.textMuted,
      fontSize:
        10.5,
      marginTop:
        5,
      textAlign:
        "left",
      writingDirection:
        "ltr",
    },

    objectionActions: {
      flexDirection:
        "row-reverse",
      gap:
        9,
      marginTop:
        16,
    },

    objectionCancelButton: {
      minHeight:
        44,
      flex:
        1,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderWidth:
        1,
      borderColor:
        "#DCE5EF",
      borderRadius:
        12,
      backgroundColor:
        "#FFFFFF",
    },

    objectionCancelText: {
      color:
        COLORS.text,
      fontWeight:
        "800",
      writingDirection:
        "rtl",
    },

    objectionSubmitButton: {
      minHeight:
        44,
      flex:
        1.4,
      flexDirection:
        "row-reverse",
      alignItems:
        "center",
      justifyContent:
        "center",
      gap:
        7,
      borderRadius:
        12,
      backgroundColor:
        COLORS.failed,
    },

    objectionSubmitText: {
      color:
        "#FFFFFF",
      fontWeight:
        "900",
      writingDirection:
        "rtl",
    },

    /* =====================================================
       Expand
    ===================================================== */

    expandRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        5,
    },

    expandText: {
      color:
        COLORS.primary,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Empty
    ===================================================== */

    emptyState: {
      flex:
        1,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    emptyIcon: {
      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    emptyTitle: {
      color:
        COLORS.text,

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    emptyHint: {
      maxWidth:
        280,

      color:
        COLORS.textMuted,

      lineHeight:
        21,

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    exploreButton: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        7,

      backgroundColor:
        COLORS.primary,

      paddingHorizontal:
        18,

      paddingVertical:
        11,

      borderRadius:
        13,
    },

    exploreButtonText: {
      color:
        "#FFFFFF",

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Spinner
    ===================================================== */

    spinnerBg: {
      position:
        "absolute",

      top: 0,
      left: 0,
      right: 0,

      height: 0,
    },
  });