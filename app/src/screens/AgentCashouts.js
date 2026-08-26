// src/screens/AgentCashouts.js

import { Ionicons } from "@expo/vector-icons";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  approveCashout,
  cancelCashout,
  listCashouts,
} from "../api/agent";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";

/* =========================================================
   Constants
========================================================= */

const BASE_W = 390;
const BASE_H = 844;

const MAX_W = 480;
const PAGE_SIZE = 20;

const COLORS = {
  bg: "#F7F9FC",

  card: "#FFFFFF",

  text: "#0E1B3B",

  muted: "#718198",

  line: "#E4ECF2",

  primary: "#0B63D8",
  primarySoft: "#EEF5FF",

  success: "#16A34A",
  successSoft: "#F0FDF4",

  warning: "#D97706",
  warningSoft: "#FFF7E8",

  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
};

/* =========================================================
   Helpers
========================================================= */

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getStatusMeta(value) {
  const status =
    normalizeStatus(value);

  if (
    status === "approved" ||
    status === "completed" ||
    status === "paid"
  ) {
    return {
      label: "تم الدفع",
      color: COLORS.success,
      background: COLORS.successSoft,
      icon: "checkmark-circle",
    };
  }

  if (
    status === "rejected" ||
    status === "cancelled" ||
    status === "canceled"
  ) {
    return {
      label: "مرفوض",
      color: COLORS.danger,
      background: COLORS.dangerSoft,
      icon: "close-circle",
    };
  }

  return {
    label: "قيد الانتظار",
    color: COLORS.warning,
    background: COLORS.warningSoft,
    icon: "time-outline",
  };
}

function normalizeCurrency(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getCurrencyLabel(value) {
  const currency =
    normalizeCurrency(value);

  if (currency === "USD") {
    return "دولار";
  }

  if (
    currency === "SYP" ||
    currency === "LOCAL"
  ) {
    return "سوري";
  }

  return "—";
}

function formatAmount(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return number.toFixed(2);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

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
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return "—";
  }
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

function getArabicError(
  error,
  fallback
) {
  const data =
    error?.response?.data ??
    error?.data ??
    error;

  const candidates = [
    data?.message?.ar,
    data?.error?.ar,
    data?.detail?.ar,
    data?.message_ar,
    data?.error_ar,
    data?.detail,
    data?.error,
    data?.message,
    error?.message,
  ];

  for (
    const value of candidates
  ) {
    if (
      typeof value === "string" &&
      containsArabic(value)
    ) {
      return value;
    }
  }

  return fallback;
}

/* =========================================================
   Screen
========================================================= */

export default function AgentCashouts({
  navigation,
}) {
  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } =
    useWindowDimensions();

  const sx =
    useCallback(
      (number) =>
        (W / BASE_W) *
        number,
      [W]
    );

  const sy =
    useCallback(
      (number) =>
        (H / BASE_H) *
        number,
      [H]
    );

  const sp =
    useCallback(
      (number) =>
        number *
        Math.min(
          W / BASE_W,
          H / BASE_H
        ),
      [W, H]
    );

  const styles =
    useMemo(
      () =>
        makeStyles({
          sx,
          sy,
          sp,
        }),
      [sx, sy, sp]
    );

  /* =======================================================
     State
  ======================================================= */

  const [
    items,
    setItems,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] =
    useState(false);

  const [
    page,
    setPage,
  ] =
    useState(1);

  const [
    hasNext,
    setHasNext,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    actingId,
    setActingId,
  ] =
    useState(null);

  /* =======================================================
     Load
  ======================================================= */

  const load =
    useCallback(
      async ({
        targetPage = 1,
        reset = false,
      } = {}) => {
        if (reset) {
          setError("");
          setLoading(true);
        }

        try {
          const data =
            await listCashouts({
              as_agent: true,
              page: targetPage,
              page_size:
                PAGE_SIZE,
            });

          const rows =
            Array.isArray(data)
              ? data
              : Array.isArray(
                    data?.results
                  )
                ? data.results
                : [];

          const count =
            Number(data?.count) ||
            rows.length;

          setHasNext(
            Boolean(data?.next) ||
              targetPage *
                PAGE_SIZE <
                count
          );

          if (reset) {
            setItems(rows);
          } else {
            setItems(
              (previous) => {
                const ids =
                  new Set(
                    previous.map(
                      (item) =>
                        item.id
                    )
                  );

                const newRows =
                  rows.filter(
                    (item) =>
                      !ids.has(
                        item.id
                      )
                  );

                return [
                  ...previous,
                  ...newRows,
                ];
              }
            );
          }

          setPage(
            targetPage
          );
        } catch (loadError) {
          setError(
            getArabicError(
              loadError,
              "تعذر تحميل طلبات السحب."
            )
          );

          if (reset) {
            setItems([]);
          }
        } finally {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      },
      []
    );

  /* =======================================================
     Initial load
  ======================================================= */

  useEffect(() => {
    load({
      reset: true,
      targetPage: 1,
    });
  }, [load]);

  /* =======================================================
     Refresh
  ======================================================= */

  const refresh =
    useCallback(() => {
      setRefreshing(true);

      load({
        targetPage: 1,
        reset: true,
      });
    }, [load]);

  /* =======================================================
     Load more
  ======================================================= */

  const loadMore =
    useCallback(() => {
      if (
        !hasNext ||
        loadingMore ||
        loading
      ) {
        return;
      }

      setLoadingMore(true);

      load({
        targetPage:
          page + 1,
      });
    }, [
      hasNext,
      load,
      loading,
      loadingMore,
      page,
    ]);

  /* =======================================================
     Stats
  ======================================================= */

  const stats =
    useMemo(() => {
      let pending = 0;
      let completed = 0;

      for (const item of items) {
        const status =
          normalizeStatus(
            item?.status
          );

        if (
          status === "approved" ||
          status === "completed" ||
          status === "paid"
        ) {
          completed += 1;
        } else if (
          ![
            "rejected",
            "cancelled",
            "canceled",
          ].includes(status)
        ) {
          pending += 1;
        }
      }

      return {
        total:
          items.length,

        pending,

        completed,
      };
    }, [items]);

  /* =======================================================
     Approve / Reject
  ======================================================= */

  const decide =
    useCallback(
      (item, action) => {
        if (
          actingId ||
          !item
        ) {
          return;
        }

        const approving =
          action ===
          "approve";

        const amount =
          formatAmount(
            item.amount
          );

        const currency =
          getCurrencyLabel(
            item.currency ||
              item.wallet_currency
          );

        const customer =
          item.user_name ||
          "العميل";

        Alert.alert(
          approving
            ? "تأكيد دفع السحب"
            : "رفض طلب السحب",

          approving
            ? `هل تؤكد دفع ${amount} ${currency} للعميل ${customer}؟`
            : `هل تريد رفض طلب السحب بقيمة ${amount} ${currency} للعميل ${customer}؟`,

          [
            {
              text:
                "إلغاء",

              style:
                "cancel",
            },

            {
              text:
                approving
                  ? "تأكيد الدفع"
                  : "رفض",

              style:
                approving
                  ? "default"
                  : "destructive",

              onPress:
                async () => {
                  setActingId(
                    item.id
                  );

                  try {
                    if (
                      approving
                    ) {
                      await approveCashout(
                        item.id
                      );
                    } else {
                      await cancelCashout(
                        item.id
                      );
                    }

                    await load({
                      targetPage:
                        1,

                      reset:
                        true,
                    });

                    Alert.alert(
                      "تم بنجاح",

                      approving
                        ? "تم اعتماد طلب السحب."
                        : "تم رفض طلب السحب."
                    );
                  } catch (
                    actionError
                  ) {
                    Alert.alert(
                      "تعذر تنفيذ الإجراء",

                      getArabicError(
                        actionError,

                        approving
                          ? "تعذر اعتماد طلب السحب."
                          : "تعذر رفض طلب السحب."
                      )
                    );
                  } finally {
                    setActingId(
                      null
                    );
                  }
                },
            },
          ]
        );
      },
      [
        actingId,
        load,
      ]
    );

  /* =======================================================
     Padding
  ======================================================= */

  const bottomPadding =
    insets.bottom +
    sy(100);

  /* =======================================================
     Render item
  ======================================================= */

  const renderItem =
    useCallback(
      ({
        item,
      }) => {
        const status =
          getStatusMeta(
            item.status
          );

        const pending =
          normalizeStatus(
            item.status
          ) === "pending";

        const busy =
          Boolean(
            actingId ===
              item.id
          );

        const currency =
          getCurrencyLabel(
            item.currency ||
              item.wallet_currency
          );

        const userName =
          item.user_name ||
          (
            item.user_id
              ? `مستخدم #${item.user_id}`
              : "مستخدم"
          );

        const contact =
          item.user_phone ||
          item.user_email ||
          "";

        return (
          <View
            style={
              styles.cashoutCard
            }
          >
            {/* ===========================================
                Customer
            =========================================== */}

            <View
              style={
                styles.cardTop
              }
            >
              <View
                style={
                  styles.customerIcon
                }
              >
                <Ionicons
                  name="person-outline"
                  size={
                    sp(21)
                  }
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.customerInfo
                }
              >
                <Text
                  style={
                    styles.customerLabel
                  }
                >
                  العميل
                </Text>

                <Text
                  numberOfLines={
                    1
                  }
                  style={
                    styles.customerName
                  }
                >
                  {userName}
                </Text>

                {!!contact && (
                  <Text
                    numberOfLines={
                      1
                    }
                    style={
                      styles.contactText
                    }
                  >
                    {contact}
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.statusBadge,

                  {
                    backgroundColor:
                      status.background,
                  },
                ]}
              >
                <Ionicons
                  name={
                    status.icon
                  }
                  size={
                    sp(13)
                  }
                  color={
                    status.color
                  }
                />

                <Text
                  style={[
                    styles.statusText,

                    {
                      color:
                        status.color,
                    },
                  ]}
                >
                  {
                    status.label
                  }
                </Text>
              </View>
            </View>

            {/* ===========================================
                Divider
            =========================================== */}

            <View
              style={
                styles.divider
              }
            />

            {/* ===========================================
                Amount
            =========================================== */}

            <View
              style={
                styles.detailRow
              }
            >
              <Text
                style={
                  styles.detailLabel
                }
              >
                مبلغ السحب
              </Text>

              <View
                style={
                  styles.amountRow
                }
              >
                <Text
                  style={
                    styles.amountValue
                  }
                >
                  {formatAmount(
                    item.amount
                  )}
                </Text>

                <Text
                  style={
                    styles.currencyText
                  }
                >
                  {currency}
                </Text>
              </View>
            </View>

            {/* ===========================================
                Date
            =========================================== */}

            <View
              style={
                styles.detailRow
              }
            >
              <Text
                style={
                  styles.detailLabel
                }
              >
                تاريخ الطلب
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={
                  styles.dateText
                }
              >
                {formatDate(
                  item.created_at
                )}
              </Text>
            </View>

            {/* ===========================================
                Note
            =========================================== */}

            {!!item.note && (
              <View
                style={
                  styles.noteBox
                }
              >
                <View
                  style={
                    styles.noteHeader
                  }
                >
                  <Ionicons
                    name="document-text-outline"
                    size={
                      sp(14)
                    }
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.noteLabel
                    }
                  >
                    ملاحظة العميل
                  </Text>
                </View>

                <Text
                  style={
                    styles.noteText
                  }
                >
                  {item.note}
                </Text>
              </View>
            )}

            {/* ===========================================
                Actions
            =========================================== */}

            {pending && (
              <View
                style={
                  styles.actions
                }
              >
                {/* Approve */}

                <Pressable
                  disabled={
                    Boolean(
                      actingId
                    )
                  }
                  onPress={() =>
                    decide(
                      item,
                      "approve"
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.button,
                    styles.approve,

                    actingId &&
                      styles.disabled,

                    pressed &&
                      !actingId && {
                        opacity:
                          0.86,
                      },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-outline"
                        size={
                          sp(17)
                        }
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.approveText
                        }
                      >
                        تأكيد الدفع
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Reject */}

                <Pressable
                  disabled={
                    Boolean(
                      actingId
                    )
                  }
                  onPress={() =>
                    decide(
                      item,
                      "cancel"
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.button,
                    styles.reject,

                    actingId &&
                      styles.disabled,

                    pressed &&
                      !actingId && {
                        opacity:
                          0.8,
                      },
                  ]}
                >
                  <Ionicons
                    name="close-outline"
                    size={
                      sp(18)
                    }
                    color={
                      COLORS.danger
                    }
                  />

                  <Text
                    style={
                      styles.rejectText
                    }
                  >
                    رفض
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      },
      [
        actingId,
        decide,
        sp,
        styles,
      ]
    );

  /* =======================================================
     Header
  ======================================================= */

  const ListHeader =
    useMemo(
      () => (
        <View>
          {/* Section */}

          <View
            style={
              styles.sectionHeading
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              طلبات سحب العملاء
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              راجع طلبات السحب وتأكد من الدفع قبل اعتماد الطلب
            </Text>
          </View>

          {/* Summary */}

          <View
            style={
              styles.summaryRow
            }
          >
            <View
              style={
                styles.summaryCard
              }
            >
              <View
                style={[
                  styles.summaryIcon,

                  {
                    backgroundColor:
                      COLORS.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name="documents-outline"
                  size={
                    sp(20)
                  }
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.summaryInfo
                }
              >
                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  إجمالي الطلبات
                </Text>

                <Text
                  style={[
                    styles.summaryValue,

                    {
                      color:
                        COLORS.primary,
                    },
                  ]}
                >
                  {
                    stats.total
                  }
                </Text>
              </View>
            </View>

            <View
              style={
                styles.summaryCard
              }
            >
              <View
                style={[
                  styles.summaryIcon,

                  {
                    backgroundColor:
                      COLORS.warningSoft,
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={
                    sp(20)
                  }
                  color={
                    COLORS.warning
                  }
                />
              </View>

              <View
                style={
                  styles.summaryInfo
                }
              >
                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  بانتظار الدفع
                </Text>

                <Text
                  style={[
                    styles.summaryValue,

                    {
                      color:
                        COLORS.warning,
                    },
                  ]}
                >
                  {
                    stats.pending
                  }
                </Text>
              </View>
            </View>
          </View>
        </View>
      ),
      [
        sp,
        stats.pending,
        stats.total,
        styles,
      ]
    );

  /* =======================================================
     Empty
  ======================================================= */

  const EmptyState =
    useMemo(
      () => (
        <View
          style={
            styles.stateCard
          }
        >
          <View
            style={
              styles.stateIcon
            }
          >
            <Ionicons
              name="cash-outline"
              size={
                sp(29)
              }
              color={
                COLORS.primary
              }
            />
          </View>

          <Text
            style={
              styles.stateTitle
            }
          >
            لا توجد طلبات سحب
          </Text>

          <Text
            style={
              styles.stateText
            }
          >
            طلبات سحب العملاء المرتبطين بك ستظهر هنا.
          </Text>
        </View>
      ),
      [
        sp,
        styles,
      ]
    );

  /* =======================================================
     Footer
  ======================================================= */

  const ListFooter =
    useMemo(
      () => {
        if (
          loadingMore
        ) {
          return (
            <View
              style={
                styles.footerLoader
              }
            >
              <ActivityIndicator
                color={
                  COLORS.primary
                }
              />
            </View>
          );
        }

        if (
          error &&
          items.length >
            0
        ) {
          return (
            <Text
              style={
                styles.footerError
              }
            >
              تعذر تحميل المزيد من الطلبات.
            </Text>
          );
        }

        return (
          <View
            style={{
              height:
                sy(6),
            }}
          />
        );
      },
      [
        error,
        items.length,
        loadingMore,
        styles,
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
      active="menu"
      withSideMenu
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
              0.4
            }
          />
        </View>

        {/* App Header */}

        <AppHeader
          title="طلبات سحب العملاء"
        />

        {/* Initial loading */}

        {loading &&
        items.length === 0 ? (
          <View
            style={
              styles.loading
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
                styles.loadingText
              }
            >
              جاري تحميل طلبات السحب...
            </Text>
          </View>
        ) : error &&
          items.length ===
            0 ? (
          /* Error */

          <View
            style={
              styles.stateContainer
            }
          >
            <View
              style={
                styles.stateCard
              }
            >
              <View
                style={[
                  styles.stateIcon,

                  {
                    backgroundColor:
                      COLORS.dangerSoft,
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={
                    sp(29)
                  }
                  color={
                    COLORS.danger
                  }
                />
              </View>

              <Text
                style={
                  styles.stateTitle
                }
              >
                تعذر تحميل الطلبات
              </Text>

              <Text
                style={
                  styles.stateText
                }
              >
                {error}
              </Text>

              <Pressable
                onPress={() =>
                  load({
                    targetPage:
                      1,

                    reset:
                      true,
                  })
                }
                style={
                  styles.retry
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={
                    sp(16)
                  }
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.retryText
                  }
                >
                  إعادة المحاولة
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* List */

          <FlatList
            data={
              items
            }
            renderItem={
              renderItem
            }
            keyExtractor={(
              item
            ) =>
              String(
                item.id
              )
            }
            ListHeaderComponent={
              ListHeader
            }
            ListEmptyComponent={
              EmptyState
            }
            ListFooterComponent={
              ListFooter
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height:
                    sy(11),
                }}
              />
            )}
            contentContainerStyle={{
              width:
                "100%",

              maxWidth:
                MAX_W,

              alignSelf:
                "center",

              paddingHorizontal:
                sx(14),

              paddingTop:
                sy(12),

              paddingBottom:
                bottomPadding,

              flexGrow:
                items.length ===
                0
                  ? 1
                  : undefined,
            }}
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  refresh
                }
                tintColor={
                  COLORS.primary
                }
                colors={[
                  COLORS.primary,
                ]}
              />
            }
            onEndReached={
              loadMore
            }
            onEndReachedThreshold={
              0.4
            }
            showsVerticalScrollIndicator={
              false
            }
            initialNumToRender={
              8
            }
            maxToRenderPerBatch={
              8
            }
            windowSize={
              7
            }
          />
        )}
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Styles
========================================================= */

function makeStyles({
  sx,
  sy,
  sp,
}) {
  return StyleSheet.create({
    /* =====================================================
       Page
    ===================================================== */

    page: {
      flex: 1,

      backgroundColor:
        COLORS.bg,

      direction:
        "ltr",
    },

    spinnerBg: {
      position:
        "absolute",

      top: 0,

      right: 0,

      left: 0,

      height: 0,
    },

    /* =====================================================
       Section
    ===================================================== */

    sectionHeading: {
      width:
        "100%",

      alignItems:
        "flex-end",

      marginBottom:
        sy(12),
    },

    sectionTitle: {
      width:
        "100%",

      color:
        COLORS.text,

      fontSize:
        sp(22),

      lineHeight:
        sp(30),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    sectionSubtitle: {
      width:
        "100%",

      marginTop:
        sy(3),

      color:
        COLORS.muted,

      fontSize:
        sp(12),

      lineHeight:
        sp(19),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Summary
    ===================================================== */

    summaryRow: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "stretch",

      gap:
        sx(9),

      marginBottom:
        sy(15),
    },

    summaryCard: {
      flex: 1,

      minHeight:
        sy(80),

      padding:
        sx(11),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(9),

      backgroundColor:
        COLORS.card,

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(17),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.025,

      shadowRadius:
        6,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation:
        1,
    },

    summaryIcon: {
      width:
        sx(39),

      height:
        sx(39),

      borderRadius:
        sx(12),

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    summaryInfo: {
      flex:
        1,

      minWidth: 0,

      alignItems:
        "flex-end",
    },

    summaryLabel: {
      width:
        "100%",

      color:
        COLORS.muted,

      fontSize:
        sp(10.5),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    summaryValue: {
      width:
        "100%",

      marginTop:
        sy(2),

      fontSize:
        sp(20),

      fontWeight:
        "900",

      textAlign:
        "right",
    },

    /* =====================================================
       Card
    ===================================================== */

    cashoutCard: {
      width:
        "100%",

      padding:
        sx(14),

      backgroundColor:
        COLORS.card,

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(18),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.03,

      shadowRadius:
        7,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation:
        1,
    },

    /* =====================================================
       Customer
    ===================================================== */

    cardTop: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(10),
    },

    customerIcon: {
      width:
        sx(44),

      height:
        sx(44),

      borderRadius:
        sx(13),

      flexShrink:
        0,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    customerInfo: {
      flex: 1,

      minWidth: 0,

      alignItems:
        "flex-end",
    },

    customerLabel: {
      width:
        "100%",

      color:
        COLORS.muted,

      fontSize:
        sp(10),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    customerName: {
      width:
        "100%",

      marginTop:
        sy(2),

      color:
        COLORS.text,

      fontSize:
        sp(15),

      lineHeight:
        sp(21),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    contactText: {
      width:
        "100%",

      marginTop:
        sy(3),

      color:
        COLORS.muted,

      fontSize:
        sp(11),

      fontWeight:
        "600",

      textAlign:
        "right",
    },

    /* =====================================================
       Status
    ===================================================== */

    statusBadge: {
      flexShrink:
        0,

      minHeight:
        sy(29),

      paddingHorizontal:
        sx(8),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(4),

      borderRadius:
        sx(10),
    },

    statusText: {
      fontSize:
        sp(10),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Divider
    ===================================================== */

    divider: {
      width:
        "100%",

      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLORS.line,

      marginVertical:
        sy(12),
    },

    /* =====================================================
       Details
    ===================================================== */

    detailRow: {
      width:
        "100%",

      minHeight:
        sy(34),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        sx(10),
    },

    detailLabel: {
      color:
        COLORS.muted,

      fontSize:
        sp(11),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    amountRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(5),
    },

    amountValue: {
      color:
        COLORS.text,

      fontSize:
        sp(16),

      fontWeight:
        "900",
    },

    currencyText: {
      color:
        COLORS.primary,

      fontSize:
        sp(11),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    dateText: {
      flex:
        1,

      color:
        COLORS.text,

      fontSize:
        sp(11),

      fontWeight:
        "700",

      textAlign:
        "left",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Note
    ===================================================== */

    noteBox: {
      width:
        "100%",

      marginTop:
        sy(9),

      padding:
        sx(10),

      backgroundColor:
        "#F8FAFD",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(12),
    },

    noteHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "flex-start",

      gap:
        sx(5),
    },

    noteLabel: {
      color:
        COLORS.primary,

      fontSize:
        sp(10.5),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    noteText: {
      width:
        "100%",

      marginTop:
        sy(5),

      color:
        COLORS.text,

      fontSize:
        sp(11.5),

      lineHeight:
        sp(18),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Actions
    ===================================================== */

    actions: {
      width:
        "100%",

      marginTop:
        sy(14),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(8),
    },

    button: {
      flex: 1,

      minHeight:
        sy(44),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(5),

      borderRadius:
        sx(12),
    },

    approve: {
      backgroundColor:
        COLORS.success,
    },

    reject: {
      backgroundColor:
        COLORS.dangerSoft,

      borderColor:
        "#FECACA",

      borderWidth:
        1,
    },

    approveText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(12),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    rejectText: {
      color:
        COLORS.danger,

      fontSize:
        sp(12),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    disabled: {
      opacity:
        0.55,
    },

    /* =====================================================
       State
    ===================================================== */

    stateContainer: {
      flex:
        1,

      width:
        "100%",

      maxWidth:
        MAX_W,

      alignSelf:
        "center",

      paddingHorizontal:
        sx(14),

      justifyContent:
        "center",

      paddingBottom:
        sy(70),
    },

    stateCard: {
      width:
        "100%",

      paddingVertical:
        sy(35),

      paddingHorizontal:
        sx(18),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.card,

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(18),
    },

    stateIcon: {
      width:
        sx(58),

      height:
        sx(58),

      borderRadius:
        sx(18),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    stateTitle: {
      marginTop:
        sy(11),

      color:
        COLORS.text,

      fontSize:
        sp(15),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    stateText: {
      marginTop:
        sy(5),

      color:
        COLORS.muted,

      fontSize:
        sp(12),

      lineHeight:
        sp(19),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Retry
    ===================================================== */

    retry: {
      minHeight:
        sy(40),

      marginTop:
        sy(14),

      paddingHorizontal:
        sx(15),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(5),

      backgroundColor:
        COLORS.primary,

      borderRadius:
        sx(12),
    },

    retryText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(12),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Loading
    ===================================================== */

    loading: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingBottom:
        sy(70),
    },

    loadingText: {
      marginTop:
        sy(9),

      color:
        COLORS.muted,

      fontSize:
        sp(12),

      fontWeight:
        "700",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Footer
    ===================================================== */

    footerLoader: {
      paddingVertical:
        sy(18),

      alignItems:
        "center",
    },

    footerError: {
      paddingVertical:
        sy(15),

      color:
        COLORS.danger,

      fontSize:
        sp(11),

      fontWeight:
        "700",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },
  });
}