// src/screens/transactions/TransactionsList.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PageLayout from "../../ui/PageLayout";
import CornerSpinner from "../../ui/CornerSpinner";
import { AppHeader } from "../../shared/ui/layout";

import { getTransactions } from "../../api/transactions";
import { cancelCashout } from "../../api/agent";

import {
  getCache,
  setCache,
  cacheKey,
} from "../../utils/cache";

/* =========================================================
   Colors
========================================================= */

const COLORS = {
  bg: "#F7F9FC",
  card: "#FFFFFF",

  text: "#0F172A",
  muted: "#6B7B90",

  line: "#E4ECF2",

  primary: "#0B63D8",
  primarySoft: "#EEF5FF",

  success: "#16A34A",
  successSoft: "#F0FDF4",

  warning: "#CA8A04",
  warningSoft: "#FFFBEB",

  danger: "#DC2626",
  dangerSoft: "#FEF2F2",

  info: "#2563EB",
  infoSoft: "#EFF6FF",

  slate: "#334155",
};

const BASE_W = 390;
const BASE_H = 844;
const MAX_W = 480;

const PAGE_SIZE = 20;

/* =========================================================
   Helpers
========================================================= */

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

function getArabicError(error, fallback) {
  const data =
    error?.response?.data ??
    error?.data ??
    error;

  if (
    data &&
    typeof data === "object"
  ) {
    const arabic =
      data?.message?.ar ||
      data?.error?.ar ||
      data?.detail?.ar ||
      data?.message_ar ||
      data?.error_ar;

    if (arabic) {
      return String(arabic);
    }

    const normal =
      data?.detail ||
      data?.error ||
      data?.message;

    if (
      typeof normal === "string" &&
      containsArabic(normal)
    ) {
      return normal;
    }
  }

  if (
    typeof data === "string" &&
    containsArabic(data)
  ) {
    return data;
  }

  return fallback;
}

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

function formatAmount(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return Math.abs(
    number
  ).toFixed(2);
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
   Transaction Type
========================================================= */

function getTypeMeta(type) {
  const raw =
    String(
      type || ""
    ).toLowerCase();

  switch (raw) {
    case "deposit":
      return {
        label: "إيداع",
        icon: "arrow-down-outline",
        color: COLORS.success,
        bg: COLORS.successSoft,
      };

    case "transfer":
      return {
        label: "تحويل",
        icon: "swap-horizontal-outline",
        color: COLORS.info,
        bg: COLORS.infoSoft,
      };

    case "purchase":
      return {
        label: "شراء",
        icon: "cart-outline",
        color: COLORS.primary,
        bg: COLORS.primarySoft,
      };

    case "cashout":
      return {
        label: "سحب",
        icon: "cash-outline",
        color: COLORS.warning,
        bg: COLORS.warningSoft,
      };

    default:
      return {
        label: "معاملة",
        icon: "receipt-outline",
        color: COLORS.muted,
        bg: "#F1F5F9",
      };
  }
}

/* =========================================================
   Status
========================================================= */

function normalizeStatus(status) {
  const raw =
    String(
      status || ""
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
      "rejected",
      "declined",
    ].includes(raw)
  ) {
    return "rejected";
  }

  if (
    [
      "failed",
      "error",
    ].includes(raw)
  ) {
    return "failed";
  }

  if (
    [
      "cancelled",
      "canceled",
    ].includes(raw)
  ) {
    return "cancelled";
  }

  return "pending";
}

function getStatusMeta(status) {
  const normalized =
    normalizeStatus(
      status
    );

  switch (normalized) {
    case "approved":
      return {
        label: "مكتملة",
        tint: COLORS.success,
        icon: "checkmark-circle-outline",
      };

    case "rejected":
      return {
        label: "مرفوضة",
        tint: COLORS.danger,
        icon: "close-circle-outline",
      };

    case "failed":
      return {
        label: "فشلت",
        tint: COLORS.danger,
        icon: "alert-circle-outline",
      };

    case "cancelled":
      return {
        label: "ملغاة",
        tint: COLORS.muted,
        icon: "ban-outline",
      };

    default:
      return {
        label: "قيد الانتظار",
        tint: COLORS.warning,
        icon: "time-outline",
      };
  }
}

/* =========================================================
   Screen
========================================================= */

export default function TransactionsList({
  navigation,
}) {
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

  const [
    cancelingId,
    setCancelingId,
  ] = useState(null);

  /* =======================================================
     Load
  ======================================================= */

  const load =
    useCallback(
      async ({
        reset = false,
        pageOverride,
      } = {}) => {
        const currentPage =
          reset
            ? 1
            : pageOverride ?? 1;

        if (reset) {
          setError("");
          setLoading(true);
        }

        const cacheK =
          cacheKey(
            "transactions-v4",
            String(currentPage)
          );

        try {
          if (reset) {
            const cached =
              await getCache(
                cacheK,
                1000 * 60 * 5
              );

            if (
              Array.isArray(
                cached
              )
            ) {
              setItems(
                cached
              );
            }
          }

          const response =
            await getTransactions({
              page:
                currentPage,

              page_size:
                PAGE_SIZE,
            });

          if (
            !response?.ok
          ) {
            throw response;
          }

          const list =
            Array.isArray(
              response?.data
            )
              ? response.data
              : Array.isArray(
                    response
                      ?.raw
                      ?.results
                  )
                ? response.raw
                    .results
                : Array.isArray(
                      response
                        ?.raw
                        ?.data
                    )
                  ? response.raw
                      .data
                  : [];

          const pagination =
            response?.pagination ||
            {};

          const total =
            Number(
              pagination.count
            ) ||
            list.length;

          const nextExists =
            !!pagination.next ||
            currentPage *
              PAGE_SIZE <
              total;

          setHasNext(
            nextExists
          );

          if (reset) {
            setItems(list);
            setPage(1);
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
                  const item of list
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

                return merged;
              }
            );
          }

          await setCache(
            cacheK,
            list
          );
        } catch (loadError) {
          setError(
            getArabicError(
              loadError,
              "تعذر تحميل المعاملات. يرجى المحاولة مرة أخرى."
            )
          );

          const cached =
            await getCache(
              cacheK
            );

          if (
            reset &&
            Array.isArray(
              cached
            )
          ) {
            setItems(
              cached
            );
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
     First Load
  ======================================================= */

  useEffect(() => {
    load({
      reset: true,
    });
  }, [load]);

  /* =======================================================
     Android Back
  ======================================================= */

  useFocusEffect(
    useCallback(() => {
      const onBackPress =
        () => {
          navigation.navigate(
            "Home"
          );

          return true;
        };

      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );

      return () =>
        subscription.remove();
    }, [navigation])
  );

  /* =======================================================
     Refresh
  ======================================================= */

  const onRefresh =
    useCallback(() => {
      setRefreshing(true);
      setPage(1);

      load({
        reset: true,
      });
    }, [load]);

  /* =======================================================
     Load More
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

      setLoadingMore(true);
      setPage(next);

      load({
        pageOverride:
          next,
      });
    }, [
      hasNext,
      load,
      loadingMore,
      page,
    ]);

  /* =======================================================
     Cancel Cashout
  ======================================================= */

  const onCancelCashout =
    useCallback(
      (id) => {
        if (
          cancelingId
        ) {
          return;
        }

        Alert.alert(
          "إلغاء طلب السحب",
          "هل تريد بالتأكيد إلغاء طلب السحب المعلق؟",
          [
            {
              text: "تراجع",
              style: "cancel",
            },

            {
              text:
                "إلغاء الطلب",

              style:
                "destructive",

              onPress:
                async () => {
                  setCancelingId(
                    id
                  );

                  try {
                    await cancelCashout(
                      id
                    );

                    await load({
                      reset: true,
                    });

                    Alert.alert(
                      "تم الإلغاء",
                      "تم إلغاء طلب السحب بنجاح."
                    );
                  } catch (
                    cancelError
                  ) {
                    Alert.alert(
                      "تعذر الإلغاء",

                      getArabicError(
                        cancelError,
                        "تعذر إلغاء طلب السحب. يرجى المحاولة مرة أخرى."
                      )
                    );
                  } finally {
                    setCancelingId(
                      null
                    );
                  }
                },
            },
          ]
        );
      },
      [
        cancelingId,
        load,
      ]
    );

  /* =======================================================
     Summary
  ======================================================= */

  const summary =
    useMemo(() => {
      const result = {
        total: 0,
        approved: 0,
        pending: 0,
        unsuccessful: 0,
      };

      for (
        const item of items ||
        []
      ) {
        result.total += 1;

        const current =
          normalizeStatus(
            item?.status
          );

        if (
          current ===
          "approved"
        ) {
          result.approved +=
            1;
        } else if (
          current ===
          "pending"
        ) {
          result.pending +=
            1;
        } else {
          result.unsuccessful +=
            1;
        }
      }

      return result;
    }, [items]);

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
     List Header
  ======================================================= */

  const ListHeader =
    useMemo(
      () => (
        <View>
          {/* ===============================================
              Quick Actions
          =============================================== */}

          <View
            style={
              S.quickActionsCard
            }
          >
            <View
              style={
                S.quickActionsHeader
              }
            >
              <View
                style={
                  S.quickHeaderIcon
                }
              >
                <Ionicons
                  name="flash-outline"
                  size={19}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  S.quickHeaderText
                }
              >
                <Text
                  style={
                    S.quickTitle
                  }
                >
                  عمليات سريعة
                </Text>

                <Text
                  style={
                    S.quickSubtitle
                  }
                >
                  اختر العملية التي تريد تنفيذها
                </Text>
              </View>
            </View>

            <View
              style={
                S.quickActionsRow
              }
            >
              <QuickAction
                icon="swap-horizontal-outline"
                label="تحويل رصيد"
                onPress={() =>
                  navigation.navigate(
                    "NewTransfer"
                  )
                }
              />

              <QuickAction
                icon="cash-outline"
                label="طلب سحب"
                onPress={() =>
                  navigation.navigate(
                    "TakeMoney"
                  )
                }
              />
            </View>
          </View>

          {/* ===============================================
              Summary
          =============================================== */}

          <View
            style={
              S.sectionHeader
            }
          >
            <Text
              style={
                S.sectionTitle
              }
            >
              ملخص المعاملات
            </Text>
          </View>

          <View
            style={
              S.summaryGrid
            }
          >
            <SummaryCard
              icon="receipt-outline"
              label="الإجمالي"
              value={
                summary.total
              }
              tint={
                COLORS.slate
              }
            />

            <SummaryCard
              icon="checkmark-circle-outline"
              label="مكتملة"
              value={
                summary.approved
              }
              tint={
                COLORS.success
              }
            />

            <SummaryCard
              icon="time-outline"
              label="قيد الانتظار"
              value={
                summary.pending
              }
              tint={
                COLORS.warning
              }
            />

            <SummaryCard
              icon="close-circle-outline"
              label="غير ناجحة"
              value={
                summary.unsuccessful
              }
              tint={
                COLORS.danger
              }
            />
          </View>

          {/* ===============================================
              Error
          =============================================== */}

          {!!error && (
            <View
              style={
                S.errorBanner
              }
            >
              <View
                style={
                  S.errorContent
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={
                    COLORS.danger
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
                onPress={() =>
                  load({
                    reset: true,
                  })
                }
                style={
                  S.errorRetry
                }
              >
                <Text
                  style={
                    S.errorRetryText
                  }
                >
                  إعادة المحاولة
                </Text>
              </Pressable>
            </View>
          )}

          {/* ===============================================
              List Heading
          =============================================== */}

          <View
            style={
              S.transactionsHeader
            }
          >
            <View
              style={
                S.transactionsTitleWrap
              }
            >
              <Text
                style={
                  S.sectionTitle
                }
              >
                سجل المعاملات
              </Text>

              <Text
                style={
                  S.transactionsSubtitle
                }
              >
                أحدث العمليات على حسابك
              </Text>
            </View>

            <View
              style={
                S.countBadge
              }
            >
              <Text
                style={
                  S.countBadgeText
                }
              >
                {items.length}
              </Text>
            </View>
          </View>
        </View>
      ),
      [
        S,
        error,
        items.length,
        load,
        navigation,
        summary,
      ]
    );

  /* =======================================================
     Empty Component
  ======================================================= */

  const EmptyComponent =
    useMemo(() => {
      if (loading) {
        return (
          <View
            style={
              S.loadingBox
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
              جاري تحميل المعاملات...
            </Text>
          </View>
        );
      }

      return (
        <View
          style={
            S.emptyBox
          }
        >
          <View
            style={
              S.emptyIcon
            }
          >
            <Ionicons
              name="receipt-outline"
              size={31}
              color={
                COLORS.primary
              }
            />
          </View>

          <Text
            style={
              S.emptyTitle
            }
          >
            لا توجد معاملات بعد
          </Text>

          <Text
            style={
              S.emptySubtitle
            }
          >
            ستظهر عمليات التحويل والسحب والشراء والإيداع هنا.
          </Text>
        </View>
      );
    }, [
      S,
      loading,
    ]);

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="wallet"
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
            image={require("../../assets/home-corner.png")}
            speedMs={
              16000
            }
            opacity={
              0.45
            }
          />
        </View>

        {/* Header */}

        <AppHeader
          title="المعاملات"
        />

        {/* List */}

        <FlatList
          data={
            items
          }
          keyExtractor={(
            item
          ) =>
            String(
              item.id
            )
          }
          renderItem={({
            item,
          }) => (
            <TransactionCard
              item={item}
              sx={sx}
              sy={sy}
              sp={sp}
              onPress={() =>
                navigation.navigate(
                  "TransactionDetail",
                  {
                    id: item.id,
                  }
                )
              }
              onCancelCashout={
                onCancelCashout
              }
              cancelingId={
                cancelingId
              }
            />
          )}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height:
                  sy(10),
              }}
            />
          )}
          ListHeaderComponent={
            ListHeader
          }
          ListEmptyComponent={
            EmptyComponent
          }
          contentContainerStyle={{
            width: "100%",
            maxWidth:
              MAX_W,

            alignSelf:
              "center",

            paddingHorizontal:
              sx(14),

            paddingTop:
              sy(12),

            paddingBottom:
              sy(80) +
              insets.bottom +
              sy(20),
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
            items.length >
            0 ? (
              <View
                style={{
                  paddingVertical:
                    sy(15),
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
                      S.loadMore,

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
                          تحميل المزيد
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <Text
                    style={
                      S.endText
                    }
                  >
                    وصلت إلى نهاية المعاملات
                  </Text>
                )}
              </View>
            ) : null
          }
        />
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Quick Action
========================================================= */

function QuickAction({
  icon,
  label,
  onPress,
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={
        styles.quickAction
      }
    >
      <View
        style={
          styles.quickIcon
        }
      >
        <Ionicons
          name={icon}
          size={21}
          color={
            COLORS.primary
          }
        />
      </View>

      <Text
        style={
          styles.quickLabel
        }
      >
        {label}
      </Text>

      <Ionicons
        name="chevron-back-outline"
        size={17}
        color={
          COLORS.muted
        }
      />
    </Pressable>
  );
}

/* =========================================================
   Summary
========================================================= */

function SummaryCard({
  icon,
  label,
  value,
  tint,
}) {
  return (
    <View
      style={
        styles.summaryCard
      }
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
            size={18}
            color={tint}
          />
        </View>

        <Text
          style={[
            styles.summaryValue,
            {
              color: tint,
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
    </View>
  );
}

/* =========================================================
   Transaction Card
========================================================= */

function TransactionCard({
  item,
  sx,
  sy,
  sp,
  onPress,
  onCancelCashout,
  cancelingId,
}) {
  const typeMeta =
    getTypeMeta(
      item?.transaction_type
    );

  const statusMeta =
    getStatusMeta(
      item?.status
    );

  const amount =
    formatAmount(
      item?.amount
    );

  const direction =
    item?.direction;

  const sign =
    direction === "in"
      ? "+"
      : direction === "out"
        ? "-"
        : "";

  const currency =
    String(
      item?.currency ||
        item?.wallet_currency ||
        ""
    ).toUpperCase();

  const created =
    formatDate(
      item?.created_at
    );

  const isPendingCashout =
    item?.transaction_type ===
      "cashout" &&
    normalizeStatus(
      item?.status
    ) === "pending";

  const isCanceling =
    cancelingId ===
    item?.id;

  return (
    <Pressable
      onPress={
        onPress
      }
      android_ripple={{
        color: "#EEF4FF",
      }}
      style={[
        styles.transactionCard,
        {
          padding:
            sx(14),

          borderRadius:
            sx(18),
        },
      ]}
    >
      {/* =================================================
          Top
      ================================================= */}

      <View
        style={
          styles.transactionTop
        }
      >
        <View
          style={
            styles.transactionIdentity
          }
        >
          <View
            style={[
              styles.transactionIcon,
              {
                width:
                  sx(44),

                height:
                  sx(44),

                borderRadius:
                  sx(13),

                backgroundColor:
                  typeMeta.bg,
              },
            ]}
          >
            <Ionicons
              name={
                typeMeta.icon
              }
              size={
                sx(21)
              }
              color={
                typeMeta.color
              }
            />
          </View>

          {/* فقط اسم نوع العملية */}

          <View
            style={
              styles.transactionText
            }
          >
            <Text
              style={[
                styles.transactionType,
                {
                  fontSize:
                    sp(15.5),
                },
              ]}
            >
              {typeMeta.label}
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

      {/* =================================================
          Amount
      ================================================= */}

      <View
        style={[
          styles.amountBox,
          {
            marginTop:
              sy(12),

            paddingVertical:
              sy(10),

            paddingHorizontal:
              sx(11),
          },
        ]}
      >
        <Text
          style={[
            styles.amountLabel,
            {
              fontSize:
                sp(12.5),
            },
          ]}
        >
          قيمة المعاملة
        </Text>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.amountValue,
            {
              fontSize:
                sp(17),
            },

            direction ===
              "in" && {
              color:
                COLORS.success,
            },
          ]}
        >
          {sign}
          {amount}{" "}
          {currency}
        </Text>
      </View>

      {/* =================================================
          Date Only
      ================================================= */}

      <View
        style={[
          styles.transactionDateRow,
          {
            marginTop:
              sy(10),
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={14}
          color={
            COLORS.muted
          }
        />

        <Text
          style={[
            styles.transactionDateText,
            {
              fontSize:
                sp(11.5),
            },
          ]}
        >
          {created}
        </Text>
      </View>

      {/* =================================================
          Cancel Cashout
      ================================================= */}

      {isPendingCashout && (
        <Pressable
          onPress={(event) => {
            event?.stopPropagation?.();

            onCancelCashout(
              item.id
            );
          }}
          disabled={
            Boolean(
              cancelingId
            )
          }
          style={[
            styles.cancelButton,
            {
              marginTop:
                sy(10),
            },

            isCanceling && {
              opacity:
                0.6,
            },
          ]}
        >
          {isCanceling ? (
            <ActivityIndicator
              size="small"
              color={
                COLORS.danger
              }
            />
          ) : (
            <Ionicons
              name="close-circle-outline"
              size={18}
              color={
                COLORS.danger
              }
            />
          )}

          <Text
            style={
              styles.cancelText
            }
          >
            {isCanceling
              ? "جاري الإلغاء..."
              : "إلغاء طلب السحب"}
          </Text>
        </Pressable>
      )}

      {/* =================================================
          Details
      ================================================= */}

      <View
        style={[
          styles.detailsRow,
          {
            marginTop:
              sy(10),
          },
        ]}
      >
        <Text
          style={[
            styles.detailsText,
            {
              fontSize:
                sp(11.5),
            },
          ]}
        >
          عرض تفاصيل المعاملة
        </Text>

        <Ionicons
          name="chevron-back-outline"
          size={16}
          color={
            COLORS.primary
          }
        />
      </View>
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
              0.26
            ),
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={12}
        color={tint}
      />

      <Text
        style={[
          styles.statusText,
          {
            color: tint,
          },
        ]}
      >
        {label}
      </Text>
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
    quickActionsCard: {
      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,
      borderColor:
        COLORS.line,

      borderRadius:
        sx(18),

      padding:
        sx(13),

      marginBottom:
        sy(16),

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

      elevation: 1,
    },

    quickActionsHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(9),

      marginBottom:
        sy(11),
    },

    quickHeaderIcon: {
      width:
        sx(38),

      height:
        sx(38),

      borderRadius:
        sx(12),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    quickHeaderText: {
      flex: 1,

      alignItems:
        "flex-end",
    },

    quickTitle: {
      width: "100%",

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

    quickSubtitle: {
      width: "100%",

      marginTop:
        sy(2),

      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    quickActionsRow: {
      flexDirection:
        "row-reverse",

      gap:
        sx(8),
    },

    sectionHeader: {
      marginBottom:
        sy(8),

      alignItems:
        "flex-end",
    },

    sectionTitle: {
      color:
        COLORS.text,

      fontSize:
        sp(22),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    summaryGrid: {
      flexDirection:
        "row-reverse",

      flexWrap:
        "wrap",

      justifyContent:
        "space-between",

      gap:
        sx(9),

      marginBottom:
        sy(17),
    },

    errorBanner: {
      backgroundColor:
        COLORS.dangerSoft,

      borderWidth:
        1,

      borderColor:
        "#FECACA",

      borderRadius:
        sx(14),

      padding:
        sx(11),

      marginBottom:
        sy(14),
    },

    errorContent: {
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

      fontSize:
        sp(12),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    errorRetry: {
      alignSelf:
        "flex-end",

      marginTop:
        sy(7),

      paddingHorizontal:
        sx(8),

      paddingVertical:
        sy(5),
    },

    errorRetryText: {
      color:
        COLORS.danger,

      fontSize:
        sp(11),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    transactionsHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        sx(10),

      marginBottom:
        sy(10),
    },

    transactionsTitleWrap: {
      flex: 1,

      alignItems:
        "flex-end",
    },

    transactionsSubtitle: {
      width: "100%",

      marginTop:
        sy(2),

      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    countBadge: {
      minWidth:
        sx(34),

      height:
        sx(34),

      paddingHorizontal:
        sx(9),

      borderRadius:
        sx(11),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    countBadgeText: {
      color:
        COLORS.primary,

      fontSize:
        sp(11.5),

      fontWeight:
        "900",

      writingDirection:
        "ltr",
    },

    loadingBox: {
      alignItems:
        "center",

      justifyContent:
        "center",

      paddingVertical:
        sy(55),
    },

    loadingText: {
      marginTop:
        sy(10),

      color:
        COLORS.muted,

      fontSize:
        sp(13),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    emptyBox: {
      alignItems:
        "center",

      justifyContent:
        "center",

      paddingVertical:
        sy(45),

      paddingHorizontal:
        sx(20),
    },

    emptyIcon: {
      width:
        sx(68),

      height:
        sx(68),

      borderRadius:
        sx(34),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    emptyTitle: {
      marginTop:
        sy(13),

      color:
        COLORS.text,

      fontSize:
        sp(17),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    emptySubtitle: {
      maxWidth:
        sx(285),

      marginTop:
        sy(5),

      color:
        COLORS.muted,

      fontSize:
        sp(12.5),

      lineHeight:
        sp(19),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    loadMore: {
      minWidth:
        sx(145),

      minHeight:
        sy(43),

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

      backgroundColor:
        COLORS.primary,

      borderRadius:
        sx(12),

      paddingHorizontal:
        sx(16),
    },

    loadMoreText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(13),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    endText: {
      color:
        "#94A3B8",

      fontSize:
        sp(11.5),

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

    /* Quick Action */

    quickAction: {
      flex: 1,

      minWidth: 0,

      minHeight: 52,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap: 7,

      paddingHorizontal:
        9,

      borderRadius: 13,

      borderWidth: 1,

      borderColor:
        COLORS.line,

      backgroundColor:
        "#F8FAFC",
    },

    quickIcon: {
      width: 34,
      height: 34,

      borderRadius: 10,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    quickLabel: {
      flex: 1,

      color:
        COLORS.text,

      fontSize: 12.5,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* Summary */

    summaryCard: {
      width: "48.5%",

      minHeight: 86,

      padding: 12,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius: 16,

      shadowColor:
        "#000",

      shadowOpacity:
        0.03,

      shadowRadius: 6,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 1,
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
      width: 34,
      height: 34,

      borderRadius: 11,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    summaryValue: {
      fontSize: 21,

      fontWeight:
        "900",

      writingDirection:
        "ltr",
    },

    summaryLabel: {
      marginTop: 9,

      color:
        COLORS.text,

      fontSize: 12.5,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* Transaction */

    transactionCard: {
      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      shadowColor:
        "#000",

      shadowOpacity:
        0.04,

      shadowRadius: 7,

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

    transactionTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      justifyContent:
        "space-between",

      gap: 9,
    },

    transactionIdentity: {
      flex: 1,

      minWidth: 0,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap: 9,
    },

    transactionIcon: {
      alignItems:
        "center",

      justifyContent:
        "center",
    },

    transactionText: {
      flex: 1,

      minWidth: 0,

      alignItems:
        "flex-end",
    },

    transactionType: {
      width: "100%",

      color:
        COLORS.text,

      fontWeight:
        "900",

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

      gap: 4,

      paddingHorizontal:
        8,

      paddingVertical:
        5,

      borderRadius:
        999,

      borderWidth: 1,
    },

    statusText: {
      fontSize: 10.5,

      fontWeight:
        "800",

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

      gap: 10,

      backgroundColor:
        "#F7F9FC",

      borderWidth: 1,

      borderColor:
        "#EDF1F5",

      borderRadius: 13,
    },

    amountLabel: {
      color:
        COLORS.muted,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    amountValue: {
      flexShrink: 1,

      color:
        COLORS.text,

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "ltr",
    },

    /* Date */

    transactionDateRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap: 5,

      alignSelf:
        "flex-end",
    },

    transactionDateText: {
      color:
        COLORS.muted,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* Cancel */

    cancelButton: {
      minHeight: 42,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap: 6,

      backgroundColor:
        COLORS.dangerSoft,

      borderWidth: 1,

      borderColor:
        "#FECACA",

      borderRadius: 11,
    },

    cancelText: {
      color:
        COLORS.danger,

      fontSize: 12.5,

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* Details */

    detailsRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap: 4,
    },

    detailsText: {
      color:
        COLORS.primary,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* Background */

    spinnerBg: {
      position:
        "absolute",

      top: 0,
      left: 0,
      right: 0,

      height: 0,
    },
  });