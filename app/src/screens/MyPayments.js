// src/screens/MyPayments.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";

import {
  getPaymentsStatusSummary,
  listPaymentsHistory,
} from "../api/payment";

import {
  getCache,
  setCache,
  cacheKey,
} from "../utils/cache";

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

function buildLocalSummary(
  items,
  totalOverride
) {
  const counts = {
    total: 0,
    success: 0,
    pending: 0,
    failed: 0,
  };

  for (const item of items || []) {
    counts.total += 1;

    const status =
      normalizeStatus(item);

    if (
      status === "approved" ||
      status === "refunded"
    ) {
      counts.success += 1;
    } else if (
      status === "failed" ||
      status === "cancelled"
    ) {
      counts.failed += 1;
    } else {
      counts.pending += 1;
    }
  }

  if (
    Number.isFinite(
      Number(totalOverride)
    )
  ) {
    counts.total =
      Number(totalOverride);
  }

  return counts;
}

/* =========================================================
   Dates
========================================================= */

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

function endOfDay(date) {
  if (!date) return null;

  const result =
    new Date(date);

  result.setHours(
    23,
    59,
    59,
    999
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
    const number =
      Number(value);

    if (
      Number.isFinite(number)
    ) {
      return Math.abs(number);
    }
  }

  return null;
}

function fmtNum(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return "0.00";
  }

  return number.toFixed(2);
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

function extractServerMessage(raw) {
  try {
    if (!raw) return "";

    const data =
      raw?.response?.data ??
      raw?.data ??
      raw;

    if (
      typeof data === "string"
    ) {
      return data;
    }

    if (
      Array.isArray(data)
    ) {
      return data
        .map(String)
        .join("\n");
    }

    if (
      typeof data === "object"
    ) {
      if (data.detail) {
        return String(data.detail);
      }

      if (data.error) {
        return String(data.error);
      }

      const firstKey =
        Object.keys(data)[0];

      if (firstKey) {
        const value =
          data[firstKey];

        if (
          Array.isArray(value)
        ) {
          return value
            .map(String)
            .join("\n");
        }

        return String(value);
      }
    }

    return "";
  } catch {
    return "";
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

  const [
    showFromPicker,
    setShowFromPicker,
  ] = useState(false);

  const [
    showToPicker,
    setShowToPicker,
  ] = useState(false);

  const hasDateFilter =
    Boolean(
      dateFrom ||
      dateTo
    );

  /* =======================================================
     Local filter
  ======================================================= */

  const filteredItems =
    useMemo(() => {
      let result =
        items;

      const from =
        startOfDay(dateFrom);

      const to =
        endOfDay(dateTo);

      if (
        from ||
        to
      ) {
        result =
          result.filter(
            (item) => {
              const itemDate =
                extractItemDate(
                  item
                );

              if (!itemDate) {
                return false;
              }

              if (
                from &&
                itemDate < from
              ) {
                return false;
              }

              if (
                to &&
                itemDate > to
              ) {
                return false;
              }

              return true;
            }
          );
      }

      if (
        statusFilter !==
        "all"
      ) {
        result =
          result.filter(
            (item) =>
              normalizeStatus(
                item
              ) ===
              statusFilter
          );
      }

      return result;
    }, [
      items,
      dateFrom,
      dateTo,
      statusFilter,
    ]);

  /* =======================================================
     Fetch
  ======================================================= */

  const fetchPage =
    useCallback(
      async ({
        reset = false,
        pageOverride,
      } = {}) => {
        try {
          if (reset) {
            setError("");
          }

          const currentPage =
            reset
              ? 1
              : pageOverride ?? 1;

          const fromKey =
            formatApiDate(dateFrom) ||
            "all";

          const toKey =
            formatApiDate(dateTo) ||
            "all";

          const cacheK =
            cacheKey(
              "payment-history-v3",
              statusFilter,
              fromKey,
              toKey,
              String(currentPage)
            );

          /* ================= Cache ================= */

          if (reset) {
            const cached =
              await getCache(
                cacheK,
                1000 *
                  60 *
                  5
              );

            if (
              cached &&
              Array.isArray(cached)
            ) {
              const nextItems =
                sortByCreatedDesc(
                  cached
                );

              setItems(
                nextItems
              );

              setSummary(
                buildLocalSummary(
                  nextItems
                )
              );
            }
          }

          /* ================= API Params ================= */

          const params = {
            page:
              currentPage,

            page_size:
              PAGE_SIZE,

            ...(statusFilter !==
            "all"
              ? {
                  status:
                    statusFilter,
                }
              : {}),

            ...(dateFrom
              ? {
                  date_from:
                    formatApiDate(
                      dateFrom
                    ),
                }
              : {}),

            ...(dateTo
              ? {
                  date_to:
                    formatApiDate(
                      dateTo
                    ),
                }
              : {}),
          };

          /* ================= History ================= */

          const historyResponse =
            await listPaymentsHistory(
              params
            );

          if (
            !historyResponse?.ok
          ) {
            const message =
              extractServerMessage(
                historyResponse?.error ||
                  historyResponse
              );

            throw new Error(
              message ||
                "تعذر تحميل المدفوعات."
            );
          }

          let pageItems =
            Array.isArray(
              historyResponse.data
            )
              ? historyResponse.data
              : [];

          if (
            statusFilter !==
            "all"
          ) {
            pageItems =
              pageItems.filter(
                (item) =>
                  normalizeStatus(
                    item
                  ) ===
                  statusFilter
              );
          }

          const pagination =
            historyResponse.pagination ||
            {};

          /* ================= Summary ================= */

          let serverSummary = null;

          /*
           * إذا ما في فلتر تاريخ نستعمل summary من السيرفر.
           * إذا في فترة مخصصة نحسب الملخص من النتائج المعروضة
           * حتى ما نظهر أرقام عامة وهي مو من نفس الفترة.
           */

          if (!hasDateFilter) {
            try {
              const summaryResponse =
                await getPaymentsStatusSummary();

              serverSummary =
                summaryResponse?.ok
                  ? summaryResponse.data
                  : null;
            } catch {
              serverSummary = null;
            }
          }

          /* ================= Pagination ================= */

          const nextExists =
            !!pagination.next ||
            (
              (
                pagination.page ||
                currentPage
              ) *
                (
                  pagination.page_size ||
                  PAGE_SIZE
                ) <
              (
                pagination.count ||
                pageItems.length
              )
            );

          setHasNext(
            nextExists
          );

          if (reset) {
            const nextItems =
              sortByCreatedDesc(
                pageItems
              );

            setItems(
              nextItems
            );

            setSummary(
              serverSummary ||
                buildLocalSummary(
                  nextItems,
                  pagination?.count
                )
            );

            setPage(1);

            await setCache(
              cacheK,
              nextItems
            );
          } else {
            setItems(
              (previous) => {
                const seen =
                  new Set(
                    previous.map(
                      (item) =>
                        item.id
                    )
                  );

                const merged = [
                  ...previous,
                ];

                for (
                  const item of pageItems
                ) {
                  if (
                    !seen.has(
                      item.id
                    )
                  ) {
                    merged.push(
                      item
                    );
                  }
                }

                const nextItems =
                  sortByCreatedDesc(
                    merged
                  );

                setSummary(
                  serverSummary ||
                    buildLocalSummary(
                      nextItems,
                      pagination?.count
                    )
                );

                return nextItems;
              }
            );
          }
        } catch (e) {
          const message =
            extractServerMessage(
              e
            ) ||
            e?.message ||
            String(e);

          setError(
            message
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );

          setLoadingMore(
            false
          );
        }
      },
      [
        statusFilter,
        dateFrom,
        dateTo,
        hasDateFilter,
      ]
    );

  /* =======================================================
     Refetch
  ======================================================= */

  useEffect(() => {
    setLoading(true);
    setPage(1);

    fetchPage({
      reset: true,
    });
  }, [
    statusFilter,
    dateFrom,
    dateTo,
    fetchPage,
  ]);

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

      setPage(next);

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

  const clearDates =
    useCallback(() => {
      setDateFrom(null);
      setDateTo(null);

      setShowFromPicker(
        false
      );

      setShowToPicker(
        false
      );
    }, []);

  const onFromChange =
    useCallback(
      (
        event,
        selectedDate
      ) => {
        if (
          Platform.OS !== "ios"
        ) {
          setShowFromPicker(
            false
          );
        }

        if (
          event?.type ===
          "dismissed"
        ) {
          return;
        }

        if (!selectedDate) {
          return;
        }

        const cleanDate =
          startOfDay(
            selectedDate
          );

        setDateFrom(
          cleanDate
        );

        /*
         * إذا "إلى" صار أقدم من "من"
         * منمسحه ليختار المستخدم تاريخ صحيح.
         */

        if (
          dateTo &&
          cleanDate >
            endOfDay(dateTo)
        ) {
          setDateTo(null);
        }
      },
      [dateTo]
    );

  const onToChange =
    useCallback(
      (
        event,
        selectedDate
      ) => {
        if (
          Platform.OS !== "ios"
        ) {
          setShowToPicker(
            false
          );
        }

        if (
          event?.type ===
          "dismissed"
        ) {
          return;
        }

        if (!selectedDate) {
          return;
        }

        setDateTo(
          startOfDay(
            selectedDate
          )
        );
      },
      []
    );

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

          {/* =================================================
              Custom Date Range
          ================================================= */}

          <View
            style={
              S.dateCard
            }
          >
            <View
              style={
                S.dateHeader
              }
            >
              <View
                style={
                  S.dateHeaderIcon
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={{
                  flex: 1,
                  alignItems:
                    "flex-end",
                }}
              >
                <Text
                  style={
                    S.dateTitle
                  }
                >
                  الفترة الزمنية
                </Text>

                <Text
                  style={
                    S.dateSubtitle
                  }
                >
                  اختر المدة التي تريد عرض عملياتها
                </Text>
              </View>

              {hasDateFilter && (
                <Pressable
                  onPress={
                    clearDates
                  }
                  style={
                    S.clearDateButton
                  }
                >
                  <Ionicons
                    name="refresh-outline"
                    size={17}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      S.clearDateText
                    }
                  >
                    الكل
                  </Text>
                </Pressable>
              )}
            </View>

            <View
              style={
                S.dateFieldsRow
              }
            >
              <DateButton
                title="من تاريخ"
                value={
                  dateFrom
                }
                onPress={() => {
                  setShowToPicker(
                    false
                  );

                  setShowFromPicker(
                    true
                  );
                }}
              />

              <View
                style={
                  S.dateArrow
                }
              >
                <Ionicons
                  name="arrow-back-outline"
                  size={19}
                  color={
                    COLORS.textMuted
                  }
                />
              </View>

              <DateButton
                title="إلى تاريخ"
                value={
                  dateTo
                }
                onPress={() => {
                  setShowFromPicker(
                    false
                  );

                  setShowToPicker(
                    true
                  );
                }}
              />
            </View>

            {!!dateFrom &&
              !dateTo && (
                <Text
                  style={
                    S.dateHint
                  }
                >
                  اختر تاريخ النهاية لإكمال الفترة
                </Text>
              )}

            {showFromPicker && (
              <DateTimePicker
                value={
                  dateFrom ||
                  new Date()
                }
                mode="date"
                display={
                  Platform.OS ===
                  "ios"
                    ? "compact"
                    : "default"
                }
                maximumDate={
                  dateTo ||
                  new Date()
                }
                onChange={
                  onFromChange
                }
              />
            )}

            {showToPicker && (
              <DateTimePicker
                value={
                  dateTo ||
                  dateFrom ||
                  new Date()
                }
                mode="date"
                display={
                  Platform.OS ===
                  "ios"
                    ? "compact"
                    : "default"
                }
                minimumDate={
                  dateFrom ||
                  undefined
                }
                maximumDate={
                  new Date()
                }
                onChange={
                  onToChange
                }
              />
            )}
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
          numberOfLines={1}
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
            size={19}
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
      const [
        expanded,
        setExpanded,
      ] =
        useState(
          false
        );

      const statusMeta =
        getStatusMeta(
          normalizeStatus(
            item
          ),
          L
        );

      const created =
        formatDate(
          item?.processed_at ||
            item?.created_at,

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

          item?.amount,

          item?.user_inputs
            ?.final_amount_submitted
        );

      const paidCurrency =
        pickCurrency(
          item?.paid_currency,

          item?.wallet_currency,

          item?.currency,

          item?.user_inputs
            ?.wallet_currency,

          item?.user_inputs
            ?.currency_submitted
        );

      const amountText =
        paidAmount != null
          ? `${fmtNum(
              paidAmount
            )} ${paidCurrency}`.trim()
          : "—";

      const transactionId =
        item?.external_transaction_id ||
        item?.transaction_id ||
        item?.reference ||
        item?.id ||
        "";

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

              {!!transactionId && (
                <DetailItem
                  icon="receipt-outline"
                  label="رقم العملية"
                  value={String(
                    transactionId
                  )}
                  sp={sp}
                  sy={sy}
                  ltr
                />
              )}

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
                    {String(
                      item.error_message
                    )}
                  </Text>
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
        sy(12),

      padding:
        sx(13),

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
        88,

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        16,

      padding:
        12,

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
        34,

      height:
        34,

      borderRadius:
        11,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    summaryValue: {
      fontSize:
        22,

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
        9,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Date button
    ===================================================== */

    dateButton: {
      flex:
        1,

      minHeight:
        58,

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
        31,

      height:
        31,

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