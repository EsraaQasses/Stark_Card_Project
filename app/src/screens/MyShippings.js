// src/screens/MyShippings.js

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
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";

import { AppHeader } from "../shared/ui/layout";

import { listDepositRequests } from "../api/deposits";
import { useAuth } from "../context/AuthProvider";

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

  success: "#16A34A",
  pending: "#CA8A04",
  rejected: "#DC2626",

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
   Helpers
========================================================= */

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

/* =========================================================
   Shipping title
========================================================= */

function getShippingTitle(item) {
  const arabicTitle =
    item?.title_ar ||
    item?.name_ar ||
    item?.request_type_ar;

  if (arabicTitle) {
    return String(arabicTitle);
  }

  const rawTitle =
    item?.title ||
    "";

  if (
    rawTitle &&
    containsArabic(rawTitle)
  ) {
    return rawTitle;
  }

  const type = String(
    item?._shipping_type ||
      item?.shipping_type ||
      item?.request_type ||
      item?.type ||
      ""
  ).toLowerCase();

  if (
    type.includes("via_agent") ||
    type.includes("agent")
  ) {
    return "طلب شحن عبر الوكيل";
  }

  if (
    type.includes("deposit") ||
    type.includes("topup") ||
    type.includes("top_up") ||
    type.includes("balance") ||
    type.includes("shipping") ||
    type.includes("recharge")
  ) {
    return "طلب شحن رصيد";
  }

  return "طلب شحن";
}

/* =========================================================
   Shipping description
========================================================= */

function getShippingDescription(item) {
  const arabic =
    item?.description_ar ||
    item?.note_ar ||
    item?.notes_ar;

  if (arabic) {
    return String(arabic);
  }

  const raw =
    item?.description ||
    item?.note ||
    item?.notes ||
    "";

  if (
    raw &&
    containsArabic(raw)
  ) {
    return String(raw);
  }

  // ما منعرض وصف تقني إنكليزي للمستخدم
  return "";
}

/* =========================================================
   Failure / rejection reason
========================================================= */

function localizeFailureReason(raw) {
  const text =
    String(raw || "").trim();

  if (!text) {
    return "";
  }

  if (containsArabic(text)) {
    return text;
  }

  const value =
    text.toLowerCase();

  if (
    value.includes("insufficient") ||
    value.includes("not enough balance")
  ) {
    return "الرصيد غير كافٍ.";
  }

  if (
    value.includes("invalid") ||
    value.includes("not valid")
  ) {
    return "بعض البيانات المدخلة غير صحيحة.";
  }

  if (
    value.includes("not found")
  ) {
    return "تعذر العثور على البيانات المطلوبة.";
  }

  if (
    value.includes("timeout") ||
    value.includes("timed out")
  ) {
    return "انتهت مهلة تنفيذ الطلب.";
  }

  if (
    value.includes("rejected") ||
    value.includes("declined")
  ) {
    return "تم رفض طلب الشحن.";
  }

  return "تعذر تنفيذ طلب الشحن.";
}

/* =========================================================
   Error Message
========================================================= */

function getErrorMessage(error) {
  const raw =
    error?.response?.data?.detail ||
    error?.response?.data?.error ||
    error?.message ||
    "";

  if (
    raw &&
    containsArabic(raw)
  ) {
    return String(raw);
  }

  return "تعذر تحميل طلبات الشحن. يرجى المحاولة مرة أخرى.";
}

/* =========================================================
   Status
========================================================= */

function normalizeStatus(item) {
  const raw =
    String(
      item?.status ||
        item?.state ||
        ""
    ).toLowerCase();

  if (
    [
      "approved",
      "success",
      "successful",
      "completed",
      "done",
    ].includes(raw)
  ) {
    return "approved";
  }

  if (
    [
      "pending",
      "processing",
      "in_progress",
      "created",
    ].includes(raw)
  ) {
    return "pending";
  }

  if (
    [
      "rejected",
      "failed",
      "declined",
      "error",
    ].includes(raw)
  ) {
    return "rejected";
  }

  return raw || "pending";
}

function getStatusMeta(status) {
  switch (status) {
    case "approved":
      return {
        label: "تمت الموافقة",
        tint: COLORS.success,
        icon:
          "checkmark-circle-outline",
      };

    case "pending":
      return {
        label: "قيد الانتظار",
        tint: COLORS.pending,
        icon: "time-outline",
      };

    case "rejected":
      return {
        label: "مرفوض",
        tint: COLORS.rejected,
        icon:
          "close-circle-outline",
      };

    default:
      return {
        label: "قيد الانتظار",
        tint: COLORS.textMuted,
        icon:
          "ellipse-outline",
      };
  }
}

/* =========================================================
   Summary
========================================================= */

function buildCounts(list) {
  const result = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  for (
    const item of list || []
  ) {
    result.total += 1;

    const status =
      normalizeStatus(item);

    if (
      status === "approved"
    ) {
      result.approved += 1;
    } else if (
      status === "rejected"
    ) {
      result.rejected += 1;
    } else {
      result.pending += 1;
    }
  }

  return result;
}

/* =========================================================
   Dates
========================================================= */

function extractItemDate(item) {
  const candidates = [
    item?.created_at,
    item?.processed_at,
    item?.updated_at,
    item?.created,
    item?.date,
    item?.timestamp,
  ];

  for (const value of candidates) {
    if (value == null) {
      continue;
    }

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
  if (!date) {
    return null;
  }

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
  if (!date) {
    return null;
  }

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
  if (!date) {
    return "";
  }

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

function formatDate(value) {
  try {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date.toLocaleString(
      "ar-SY",
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

function formatAmount(value) {
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
   Colors
========================================================= */

function hexWithAlpha(
  hex,
  alpha
) {
  try {
    const a =
      Math.round(
        alpha * 255
      );

    return `${hex}${a
      .toString(16)
      .padStart(2, "0")}`;
  } catch {
    return hex;
  }
}

/* =========================================================
   Sort
========================================================= */

function sortNewest(list) {
  return [...(list || [])].sort(
    (a, b) => {
      const aDate =
        extractItemDate(a);

      const bDate =
        extractItemDate(b);

      return (
        (bDate?.getTime?.() || 0) -
        (aDate?.getTime?.() || 0)
      );
    }
  );
}

/* =========================================================
   Main
========================================================= */

export default function MyShippings({
  navigation,
}) {
  const { user } =
    useAuth();

  const role =
    String(
      user?.role ||
        user?.raw?.role ||
        ""
    ).toLowerCase();

  const isAgent =
    role === "agent" ||
    user?.is_agent === true ||
    user?.raw?.is_agent ===
      true;

  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } =
    useWindowDimensions();

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

  /* =======================================================
     State
  ======================================================= */

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

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

  /* Status */

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  /* Dates */

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
     Key
  ======================================================= */

  const getItemKey =
    useCallback((item) => {
      const type =
        String(
          item?._shipping_type ||
            item?.shipping_type ||
            item?.type ||
            "standard"
        );

      const id =
        item?.id ??
        item?.pk ??
        "noid";

      return `${type}:${id}`;
    }, []);

  /* =======================================================
     Local Filter
  ======================================================= */

  const filteredItems =
    useMemo(() => {
      let result =
        items;

      const from =
        startOfDay(
          dateFrom
        );

      const to =
        endOfDay(
          dateTo
        );

      if (
        from ||
        to
      ) {
        result =
          result.filter(
            (item) => {
              const date =
                extractItemDate(
                  item
                );

              if (!date) {
                return false;
              }

              if (
                from &&
                date < from
              ) {
                return false;
              }

              if (
                to &&
                date > to
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
              : pageOverride ??
                1;

          const cacheK =
            cacheKey(
              "shippings-v2",
              formatApiDate(
                dateFrom
              ) ||
                "all",
              formatApiDate(
                dateTo
              ) ||
                "all",
              String(
                currentPage
              )
            );

          /* Cache */

          if (reset) {
            const cached =
              await getCache(
                cacheK,
                1000 *
                  60 *
                  5
              );

            if (
              Array.isArray(
                cached
              )
            ) {
              const cachedItems =
                sortNewest(
                  cached
                );

              setItems(
                cachedItems
              );

              setSummary(
                buildCounts(
                  cachedItems
                )
              );
            }
          }

          /* API params */

          const params = {
            page:
              currentPage,

            page_size:
              PAGE_SIZE,

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

          const response =
            await listDepositRequests(
              params
            );

          if (
            !response?.ok
          ) {
            throw new Error(
              "تعذر تحميل طلبات الشحن."
            );
          }

          let list =
            Array.isArray(
              response.data
            )
              ? response.data
              : [];

          /*
           * نفس منطقك السابق:
           * الوكيل ما يشوف طلبات العملاء عبر الوكيل
           * ضمن شحناته الشخصية.
           */

          if (isAgent) {
            list =
              list.filter(
                (item) =>
                  String(
                    item?._shipping_type ||
                      ""
                  ) !==
                  "via_agent"
              );
          }

          list =
            sortNewest(list);

          const pagination =
            response.pagination ||
            {};

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
                list.length
              )
            );

          setHasNext(
            nextExists
          );

          if (reset) {
            setItems(list);

            setSummary(
              buildCounts(list)
            );

            setPage(1);

            await setCache(
              cacheK,
              list
            );
          } else {
            setItems(
              (previous) => {
                const seen =
                  new Set(
                    previous.map(
                      getItemKey
                    )
                  );

                const merged = [
                  ...previous,
                ];

                for (
                  const item of list
                ) {
                  const key =
                    getItemKey(
                      item
                    );

                  if (
                    !seen.has(
                      key
                    )
                  ) {
                    merged.push(
                      item
                    );
                  }
                }

                const sorted =
                  sortNewest(
                    merged
                  );

                setSummary(
                  buildCounts(
                    sorted
                  )
                );

                return sorted;
              }
            );
          }
        } catch (e) {
          setError(
            getErrorMessage(
              e
            )
          );

          const fallbackCache =
            cacheKey(
              "shippings-v2",
              formatApiDate(
                dateFrom
              ) ||
                "all",
              formatApiDate(
                dateTo
              ) ||
                "all",
              String(
                pageOverride ??
                  1
              )
            );

          const cached =
            await getCache(
              fallbackCache
            );

          if (
            Array.isArray(
              cached
            )
          ) {
            setItems(
              sortNewest(
                cached
              )
            );
          }
        } finally {
          setLoading(false);

          setRefreshing(
            false
          );

          setLoadingMore(
            false
          );
        }
      },
      [
        dateFrom,
        dateTo,
        getItemKey,
        isAgent,
      ]
    );

  /* =======================================================
     Date change triggers reload
  ======================================================= */

  useEffect(() => {
    setLoading(true);
    setPage(1);

    fetchPage({
      reset: true,
    });
  }, [
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
     More
  ======================================================= */

  const loadMore =
    useCallback(() => {
      if (
        loadingMore ||
        !hasNext
      ) {
        return;
      }

      const next =
        page + 1;

      setLoadingMore(
        true
      );

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
     Date
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
          Platform.OS !==
          "ios"
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

        const selected =
          startOfDay(
            selectedDate
          );

        setDateFrom(
          selected
        );

        if (
          dateTo &&
          selected >
            endOfDay(
              dateTo
            )
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
          Platform.OS !==
          "ios"
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
     Styles
  ======================================================= */

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

  /* =======================================================
     List
  ======================================================= */

  const keyExtractor =
    useCallback(
      (item) =>
        getItemKey(
          item
        ),
      [getItemKey]
    );

  const renderItem =
    useCallback(
      ({ item }) => (
        <ShippingCard
          item={item}
          sx={sx}
          sy={sy}
          sp={sp}
        />
      ),
      [
        sx,
        sy,
        sp,
      ]
    );

  const separator =
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

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="menu"
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

        {/* نفس هيدر باقي الصفحات */}

        <AppHeader
          title="شحناتي"
        />

        <View
          style={
            S.content
          }
        >
          {/* ===============================================
              Error
          =============================================== */}

          {!!error && (
            <View
              style={
                S.errorCard
              }
            >
              <View
                style={
                  S.errorRow
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={
                    COLORS.rejected
                  }
                />

                <Text
                  style={
                    S.errorText
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
                style={
                  S.retryButton
                }
              >
                <Text
                  style={
                    S.retryText
                  }
                >
                  إعادة المحاولة
                </Text>
              </Pressable>
            </View>
          )}

          {/* ===============================================
              Summary
          =============================================== */}

          {!!summary && (
            <View
              style={
                S.summaryGrid
              }
            >
              <SummaryCard
                label="الكل"
                value={
                  summary.total
                }
                tint={
                  COLORS.slate
                }
                icon="cube-outline"
                active={
                  statusFilter ===
                  "all"
                }
                onPress={() =>
                  setStatusFilter(
                    "all"
                  )
                }
              />

              <SummaryCard
                label="تمت الموافقة"
                value={
                  summary.approved
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
                  setStatusFilter(
                    "approved"
                  )
                }
              />

              <SummaryCard
                label="قيد الانتظار"
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
                  setStatusFilter(
                    "pending"
                  )
                }
              />

              <SummaryCard
                label="مرفوض"
                value={
                  summary.rejected
                }
                tint={
                  COLORS.rejected
                }
                icon="close-circle-outline"
                active={
                  statusFilter ===
                  "rejected"
                }
                onPress={() =>
                  setStatusFilter(
                    "rejected"
                  )
                }
              />
            </View>
          )}

          {/* ===============================================
              Date Range
          =============================================== */}

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
                    S.dateSub
                  }
                >
                  اختر الفترة التي تريد عرض طلباتها
                </Text>
              </View>

              {hasDateFilter && (
                <Pressable
                  onPress={
                    clearDates
                  }
                  style={
                    S.clearButton
                  }
                >
                  <Ionicons
                    name="refresh-outline"
                    size={16}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      S.clearText
                    }
                  >
                    الكل
                  </Text>
                </Pressable>
              )}
            </View>

            <View
              style={
                S.dateButtons
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

              <Ionicons
                name="arrow-back-outline"
                size={18}
                color={
                  COLORS.textMuted
                }
              />

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

          {/* ===============================================
              Content
          =============================================== */}

          {loading &&
          items.length === 0 ? (
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
                جاري تحميل الشحنات...
              </Text>
            </View>
          ) : filteredItems.length ===
            0 ? (
            <EmptyState
              sx={sx}
              sy={sy}
              hasFilter={
                statusFilter !==
                  "all" ||
                hasDateFilter
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
                renderItem
              }
              ItemSeparatorComponent={
                separator
              }
              contentContainerStyle={{
                paddingHorizontal:
                  sx(14),

                paddingTop:
                  sy(4),

                paddingBottom:
                  sy(80) +
                  insets.bottom +
                  sy(12),
              }}
              showsVerticalScrollIndicator={
                false
              }
              bounces={
                false
              }
              overScrollMode="never"
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
              ListFooterComponent={
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
                            size={17}
                            color="#FFFFFF"
                          />

                          <Text
                            style={
                              S.loadMoreText
                            }
                          >
                            تحميل المزيد
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <Text
                      style={
                        S.listEnd
                      }
                    >
                      لا توجد نتائج إضافية
                    </Text>
                  )}
                </View>
              }
            />
          )}
        </View>
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Shipping Card
========================================================= */

const ShippingCard =
  React.memo(
    function ShippingCard({
      item,
      sx,
      sy,
      sp,
    }) {
      const [
        expanded,
        setExpanded,
      ] = useState(false);

      const status =
        normalizeStatus(
          item
        );

      const meta =
        getStatusMeta(
          status
        );

      const title =
        getShippingTitle(
          item
        );

      const description =
        getShippingDescription(
          item
        );

      const amount =
        Number(
          item?.amount ??
            0
        );

      const currency =
        String(
          item?.currency ||
            ""
        ).toUpperCase();

      const created =
        formatDate(
          item?.created_at ||
            item?.created ||
            item?.updated_at
        );

      const requestId =
        item?.id ??
        item?.pk ??
        null;

      const type =
        String(
          item?._shipping_type ||
            item?.shipping_type ||
            ""
        );

      const failureReason =
        localizeFailureReason(
          item?.rejection_reason_ar ||
            item?.reject_reason_ar ||
            item?.error_message_ar ||
            item?.failure_reason_ar ||
            item?.rejection_reason ||
            item?.reject_reason ||
            item?.error_message ||
            item?.failure_reason
        );

      return (
        <Pressable
          onPress={() =>
            setExpanded(
              (value) =>
                !value
            )
          }
          android_ripple={{
            color:
              "#EEF4FF",
          }}
          style={[
            styles.shippingCard,

            {
              padding:
                sx(15),

              borderRadius:
                sx(18),
            },

            expanded &&
              styles.shippingCardExpanded,
          ]}
        >
          {/* ================= Header ================= */}

          <View
            style={
              styles.shippingHeader
            }
          >
            <View
              style={
                styles.shippingTitleWrap
              }
            >
              <Text
                numberOfLines={
                  2
                }
                style={[
                  styles.shippingTitle,
                  {
                    fontSize:
                      sp(16),
                  },
                ]}
              >
                {title}
              </Text>

              <View
                style={[
                  styles.shippingDateRow,
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
                    styles.shippingDate,
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
                meta.label
              }
              tint={
                meta.tint
              }
              icon={
                meta.icon
              }
            />
          </View>

          {/* ================= Amount ================= */}

          <View
            style={[
              styles.amountBox,
              {
                marginTop:
                  sy(13),

                paddingHorizontal:
                  sx(12),

                paddingVertical:
                  sy(10),
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
              مبلغ الشحن
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
              {formatAmount(
                amount
              )}{" "}
              {currency}
            </Text>
          </View>

          {/* ================= Description ================= */}

          {!!description &&
            !expanded && (
              <Text
                numberOfLines={
                  2
                }
                style={[
                  styles.shortDescription,
                  {
                    marginTop:
                      sy(9),
                  },
                ]}
              >
                {description}
              </Text>
            )}

          {/* ================= Details ================= */}

          {expanded && (
            <View
              style={[
                styles.detailsPanel,
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
                    name="cube-outline"
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
                  تفاصيل طلب الشحن
                </Text>
              </View>

              <View
                style={
                  styles.divider
                }
              />

              {!!requestId && (
                <DetailItem
                  icon="receipt-outline"
                  label="رقم الطلب"
                  value={String(
                    requestId
                  )}
                  sp={sp}
                  sy={sy}
                  ltr
                />
              )}

              <DetailItem
                icon="cash-outline"
                label="مبلغ الشحن"
                value={`${formatAmount(
                  amount
                )} ${currency}`}
                sp={sp}
                sy={sy}
                ltr
                highlight
              />

              <DetailItem
                icon={
                  meta.icon
                }
                label="حالة الطلب"
                value={
                  meta.label
                }
                sp={sp}
                sy={sy}
                valueColor={
                  meta.tint
                }
              />

              <DetailItem
                icon="calendar-outline"
                label="تاريخ الطلب"
                value={
                  created
                }
                sp={sp}
                sy={sy}
              />

              {!!type && (
                <DetailItem
                  icon="options-outline"
                  label="طريقة الشحن"
                  value={
                    type ===
                    "via_agent"
                      ? "عبر الوكيل"
                      : "شحن مباشر"
                  }
                  sp={sp}
                  sy={sy}
                />
              )}

              {!!description && (
                <DetailItem
                  icon="document-text-outline"
                  label="ملاحظات"
                  value={
                    description
                  }
                  sp={sp}
                  sy={sy}
                />
              )}

              {status ===
                "rejected" &&
                !!failureReason && (
                  <View
                    style={[
                      styles.failureBox,
                      {
                        marginTop:
                          sy(9),
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
                          COLORS.rejected
                        }
                      />

                      <Text
                        style={
                          styles.failureTitle
                        }
                      >
                        سبب الرفض
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.failureText
                      }
                    >
                      {
                        failureReason
                      }
                    </Text>
                  </View>
                )}
            </View>
          )}

          {/* ================= Expand ================= */}

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
   Detail
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
          styles.detailLabelWrap
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

            color:
              valueColor ||
              (
                highlight
                  ? COLORS.primary
                  : COLORS.text
              ),

            writingDirection:
              ltr
                ? "ltr"
                : "rtl",
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   Summary
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
            name={icon}
            size={19}
            color={tint}
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
   Status
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
        name={icon}
        size={13}
        color={tint}
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
   Empty
========================================================= */

function EmptyState({
  sx,
  sy,
  hasFilter,
}) {
  return (
    <View
      style={[
        styles.emptyState,
        {
          paddingTop:
            sy(55),

          paddingHorizontal:
            sx(24),
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
          name="cube-outline"
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
              sy(15),
          },
        ]}
      >
        {hasFilter
          ? "لا توجد شحنات مطابقة"
          : "لا توجد شحنات بعد"}
      </Text>

      <Text
        style={[
          styles.emptyText,
          {
            marginTop:
              sy(6),
          },
        ]}
      >
        {hasFilter
          ? "جرّب تغيير الحالة أو الفترة الزمنية."
          : "طلبات الشحن الخاصة بك ستظهر هنا."}
      </Text>
    </View>
  );
}

/* =========================================================
   Responsive styles
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

    /* Error */

    errorCard: {
      marginHorizontal:
        sx(14),

      marginTop:
        sy(10),

      marginBottom:
        sy(4),

      padding:
        sx(12),

      backgroundColor:
        "#FEF2F2",

      borderWidth:
        1,

      borderColor:
        "#FECACA",

      borderRadius:
        sx(14),
    },

    errorRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(8),
    },

    errorText: {
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

      marginTop:
        sy(9),

      backgroundColor:
        "#991B1B",

      paddingHorizontal:
        sx(13),

      paddingVertical:
        sy(7),

      borderRadius:
        sx(9),
    },

    retryText: {
      color:
        "#FFFFFF",

      fontWeight:
        "800",

      writingDirection:
        "rtl",
    },

    /* Summary */

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

    /* Date */

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

      gap:
        sx(9),

      marginBottom:
        sy(12),
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

    dateSub: {
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

    clearButton: {
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

    clearText: {
      color:
        COLORS.primary,

      fontWeight:
        "800",

      fontSize:
        sp(11),

      writingDirection:
        "rtl",
    },

    dateButtons: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(6),
    },

    /* Center */

    center: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        sx(20),

      paddingTop:
        sy(30),
    },

    loadingText: {
      marginTop:
        sy(10),

      color:
        COLORS.textMuted,

      fontSize:
        sp(14),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    loadMoreButton: {
      alignSelf:
        "center",

      minWidth:
        sx(145),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(6),

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

    listEnd: {
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

    /* Summary */

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
        "#00000000",

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

    /* Date */

    dateButton: {
      flex: 1,

      minHeight:
        58,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        7,

      paddingHorizontal:
        9,

      backgroundColor:
        "#F8FAFC",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        13,
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
      flex: 1,

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

    /* Shipping */

    shippingCard: {
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

    shippingCardExpanded: {
      borderColor:
        "#BFD7FF",
    },

    shippingHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      justifyContent:
        "space-between",

      gap:
        10,
    },

    shippingTitleWrap: {
      flex: 1,

      alignItems:
        "flex-end",
    },

    shippingTitle: {
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

    shippingDateRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        5,

      alignSelf:
        "flex-end",
    },

    shippingDate: {
      color:
        COLORS.textMuted,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* Status */

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

    /* Amount */

    amountBox: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      backgroundColor:
        "#F6F9FD",

      borderWidth:
        1,

      borderColor:
        "#EDF2F7",

      borderRadius:
        13,
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

    shortDescription: {
      color:
        COLORS.textMuted,

      lineHeight:
        20,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* Details */

    detailsPanel: {
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
      flex: 1,

      color:
        COLORS.text,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    divider: {
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

    detailLabelWrap: {
      flex: 1,

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
        COLORS.primarySoft,
    },

    detailLabel: {
      flex: 1,

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
      flex: 1,

      color:
        COLORS.text,

      fontWeight:
        "800",

      textAlign:
        "left",
    },

    /* Failure */

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
      flex: 1,

      color:
        COLORS.rejected,

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

    /* Expand */

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

    /* Empty */

    emptyState: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    emptyIcon: {
      backgroundColor:
        COLORS.primarySoft,

      alignItems:
        "center",

      justifyContent:
        "center",
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

    emptyText: {
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

    spinnerBg: {
      position:
        "absolute",

      top: 0,
      left: 0,
      right: 0,

      height: 0,
    },
  });