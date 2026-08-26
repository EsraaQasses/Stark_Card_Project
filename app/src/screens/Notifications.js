// src/screens/Notifications.js

import { Ionicons } from "@expo/vector-icons";

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
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";

import {
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
} from "../api/system";

import {
  getCache,
  setCache,
  cacheKey,
} from "../utils/cache";

/* =========================================================
   Constants
========================================================= */

const BASE_W = 390;
const BASE_H = 844;
const MAX_W = 480;

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

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/* =========================================================
   الوقت بالعربي
========================================================= */

function timeAgo(value) {
  if (!value) {
    return "";
  }

  const timestamp =
    new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const seconds =
    Math.max(
      0,
      Date.now() - timestamp
    ) / 1000;

  if (seconds < 60) {
    return "الآن";
  }

  const minutes =
    Math.floor(seconds / 60);

  if (seconds < 3600) {
    return `منذ ${minutes} دقيقة`;
  }

  const hours =
    Math.floor(seconds / 3600);

  if (seconds < 86400) {
    if (hours === 1) {
      return "منذ ساعة";
    }

    if (hours === 2) {
      return "منذ ساعتين";
    }

    return `منذ ${hours} ساعات`;
  }

  const days =
    Math.floor(seconds / 86400);

  if (days === 1) {
    return "منذ يوم";
  }

  if (days === 2) {
    return "منذ يومين";
  }

  if (days < 7) {
    return `منذ ${days} أيام`;
  }

  try {
    return new Date(value)
      .toLocaleDateString(
        "ar-SY",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );
  } catch {
    return "";
  }
}

/* =========================================================
   نوع الإشعار
========================================================= */

function getNotificationMeta(type) {
  const value =
    normalizeText(type);

  if (
    value.includes("transfer")
  ) {
    return {
      label: "تحويل",
      icon: "swap-horizontal-outline",
      color: COLORS.primary,
      bg: COLORS.primarySoft,
    };
  }

  if (
    value.includes("deposit") ||
    value.includes("shipping")
  ) {
    return {
      label: "شحن رصيد",
      icon: "wallet-outline",
      color: COLORS.success,
      bg: COLORS.successSoft,
    };
  }

  if (
    value.includes("cashout") ||
    value.includes("withdraw")
  ) {
    return {
      label: "سحب أموال",
      icon: "cash-outline",
      color: COLORS.warning,
      bg: COLORS.warningSoft,
    };
  }

  if (
    value.includes("payment") ||
    value.includes("purchase")
  ) {
    return {
      label: "عملية دفع",
      icon: "card-outline",
      color: "#7C3AED",
      bg: "#F5F3FF",
    };
  }

  if (
    value.includes("agent")
  ) {
    return {
      label: "الوكيل",
      icon: "people-outline",
      color: "#0891B2",
      bg: "#ECFEFF",
    };
  }

  if (
    value.includes("security")
  ) {
    return {
      label: "الأمان",
      icon: "shield-checkmark-outline",
      color: COLORS.danger,
      bg: COLORS.dangerSoft,
    };
  }

  if (
    value.includes("wallet")
  ) {
    return {
      label: "المحفظة",
      icon: "wallet-outline",
      color: COLORS.primary,
      bg: COLORS.primarySoft,
    };
  }

  return {
    label: containsArabic(type)
      ? String(type)
      : "",

    icon: "notifications-outline",

    color: COLORS.primary,

    bg: COLORS.primarySoft,
  };
}

/* =========================================================
   ترجمة عناوين الـ backend المعروفة
========================================================= */

function getArabicTitle(value) {
  const raw =
    String(value || "").trim();

  if (!raw) {
    return "إشعار جديد";
  }

  if (containsArabic(raw)) {
    return raw;
  }

  const text =
    raw.toLowerCase();

  if (
    text.includes(
      "transfer received"
    )
  ) {
    return "تحويل وارد";
  }

  if (
    text.includes(
      "transfer sent"
    )
  ) {
    return "تم إرسال التحويل";
  }

  if (
    text.includes(
      "transfer approved"
    )
  ) {
    return "تمت الموافقة على التحويل";
  }

  if (
    text.includes(
      "transfer rejected"
    )
  ) {
    return "تم رفض التحويل";
  }

  if (
    text.includes(
      "payment successful"
    ) ||
    text.includes(
      "payment completed"
    )
  ) {
    return "تمت عملية الدفع بنجاح";
  }

  if (
    text.includes(
      "payment failed"
    )
  ) {
    return "تعذر إتمام عملية الدفع";
  }

  if (
    text.includes(
      "deposit approved"
    ) ||
    text.includes(
      "shipping approved"
    )
  ) {
    return "تمت الموافقة على طلب الشحن";
  }

  if (
    text.includes(
      "deposit rejected"
    ) ||
    text.includes(
      "shipping rejected"
    )
  ) {
    return "تم رفض طلب الشحن";
  }

  if (
    text.includes(
      "cashout approved"
    ) ||
    text.includes(
      "withdrawal approved"
    )
  ) {
    return "تمت الموافقة على طلب السحب";
  }

  if (
    text.includes(
      "cashout rejected"
    ) ||
    text.includes(
      "withdrawal rejected"
    )
  ) {
    return "تم رفض طلب السحب";
  }

  if (
    text.includes("notification")
  ) {
    return "إشعار جديد";
  }

  /*
   * ما منعرض عنوان تقني إنكليزي
   */
  return "إشعار جديد";
}

/* =========================================================
   ترجمة الرسائل
========================================================= */

function getArabicMessage(value) {
  const raw =
    String(value || "").trim();

  if (!raw) {
    return "";
  }

  if (containsArabic(raw)) {
    return raw;
  }

  const text =
    raw.toLowerCase();

  if (
    text.includes(
      "transfer received"
    )
  ) {
    return "لقد استلمت تحويلاً جديداً إلى محفظتك.";
  }

  if (
    text.includes(
      "transfer sent"
    )
  ) {
    return "تم إرسال التحويل بنجاح.";
  }

  if (
    text.includes(
      "payment successful"
    ) ||
    text.includes(
      "payment completed"
    )
  ) {
    return "تمت عملية الدفع بنجاح.";
  }

  if (
    text.includes(
      "payment failed"
    )
  ) {
    return "تعذر إتمام عملية الدفع.";
  }

  if (
    text.includes("approved") &&
    (
      text.includes("deposit") ||
      text.includes("shipping")
    )
  ) {
    return "تمت الموافقة على طلب شحن الرصيد.";
  }

  if (
    text.includes("rejected") &&
    (
      text.includes("deposit") ||
      text.includes("shipping")
    )
  ) {
    return "تم رفض طلب شحن الرصيد.";
  }

  if (
    text.includes("approved") &&
    (
      text.includes("cashout") ||
      text.includes("withdraw")
    )
  ) {
    return "تمت الموافقة على طلب السحب.";
  }

  if (
    text.includes("rejected") &&
    (
      text.includes("cashout") ||
      text.includes("withdraw")
    )
  ) {
    return "تم رفض طلب السحب.";
  }

  /*
   * ما منظهر نص backend إنكليزي تقني.
   */
  return "لديك تحديث جديد على حسابك.";
}

/* =========================================================
   Screen
========================================================= */

export default function Notifications({
  navigation,
}) {
  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } = useWindowDimensions();

  const sx =
    useCallback(
      (n) =>
        (W / BASE_W) * n,
      [W]
    );

  const sy =
    useCallback(
      (n) =>
        (H / BASE_H) * n,
      [H]
    );

  const sp =
    useCallback(
      (n) =>
        n *
        Math.min(
          W / BASE_W,
          H / BASE_H
        ),
      [W, H]
    );

  const styles =
    useMemo(
      () =>
        createStyles({
          sx,
          sy,
          sp,
        }),
      [sx, sy, sp]
    );

  const bottomPadding =
    insets.bottom +
    sy(90);

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
    filter,
    setFilter,
  ] = useState("all");

  const autoMarkRef =
    useRef(false);

  const UNREAD_OVERRIDE_KEY =
    "@notif_unread_override";

  /* =======================================================
     Load
  ======================================================= */

  const load =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        try {
          if (showLoading) {
            setLoading(true);
          }

          const key =
            cacheKey(
              "notifications",
              "list"
            );

          const cached =
            await getCache(
              key,
              1000 *
                60 *
                10
            );

          if (
            Array.isArray(cached)
          ) {
            setItems(cached);
          }

          const response =
            await getNotifications();

          if (!response?.ok) {
            throw new Error();
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
                ? response
                    .raw
                    .results

                : Array.isArray(
                      response
                        ?.raw
                        ?.data
                    )
                  ? response
                      .raw
                      .data

                  : [];

          setItems(list);

          await setCache(
            key,
            list
          );
        } catch {
          const cached =
            await getCache(
              cacheKey(
                "notifications",
                "list"
              )
            );

          setItems(
            Array.isArray(cached)
              ? cached
              : []
          );
        } finally {
          if (showLoading) {
            setLoading(false);
          }
        }
      },
      []
    );

  /* =======================================================
     Initial load
  ======================================================= */

  useEffect(() => {
    load({
      showLoading: true,
    });
  }, [load]);

  /* =======================================================
     Refresh
  ======================================================= */

  const onRefresh =
    useCallback(
      async () => {
        setRefreshing(true);

        await load();

        setRefreshing(false);
      },
      [load]
    );

  /* =======================================================
     Unread
  ======================================================= */

  const unreadCount =
    useMemo(
      () =>
        items.filter(
          (item) =>
            item?.is_read ===
              false ||
            (
              item?.read_at ===
                null &&
              item?.is_read !==
                true
            )
        ).length,
      [items]
    );

  /* =======================================================
     Filter
  ======================================================= */

  const filteredItems =
    useMemo(() => {
      if (
        filter === "unread"
      ) {
        return items.filter(
          (item) =>
            item?.is_read ===
              false ||
            (
              item?.read_at ===
                null &&
              item?.is_read !==
                true
            )
        );
      }

      return items;
    }, [
      filter,
      items,
    ]);

  /* =======================================================
     Read one
  ======================================================= */

  const markOneRead =
    useCallback(
      async (id) => {
        const current =
          items.find(
            (item) =>
              item.id === id
          );

        if (
          current?.is_read === true
        ) {
          return;
        }

        try {
          const response =
            await markNotificationAsRead(
              id
            );

          if (!response?.ok) {
            throw new Error();
          }

          const next =
            items.map(
              (item) =>
                item.id === id
                  ? {
                      ...item,

                      is_read:
                        true,

                      read_at:
                        item.read_at ||
                        new Date()
                          .toISOString(),
                    }
                  : item
            );

          setItems(next);

          await setCache(
            cacheKey(
              "notifications",
              "list"
            ),
            next
          );
        } catch {
          Alert.alert(
            "تعذر تحديث الإشعار",
            "لم نتمكن من تحديث حالة الإشعار."
          );
        }
      },
      [items]
    );

  /* =======================================================
     Delete
  ======================================================= */

  const onDelete =
    useCallback(
      (id) => {
        Alert.alert(
          "حذف الإشعار",
          "هل تريد حذف هذا الإشعار؟",
          [
            {
              text: "إلغاء",
              style: "cancel",
            },

            {
              text: "حذف",
              style: "destructive",

              onPress:
                async () => {
                  try {
                    const response =
                      await deleteNotification(
                        id
                      );

                    if (
                      !response?.ok
                    ) {
                      throw new Error();
                    }

                    setItems(
                      (previous) => {
                        const next =
                          previous.filter(
                            (item) =>
                              item.id !== id
                          );

                        setCache(
                          cacheKey(
                            "notifications",
                            "list"
                          ),
                          next
                        );

                        return next;
                      }
                    );
                  } catch {
                    Alert.alert(
                      "تعذر حذف الإشعار",
                      "حدث خطأ أثناء حذف الإشعار."
                    );
                  }
                },
            },
          ]
        );
      },
      []
    );

  /* =======================================================
     Mark all read
  ======================================================= */

  const markAllRead =
    useCallback(
      async () => {
        const unread =
          items.filter(
            (item) =>
              item?.is_read ===
                false ||
              item?.read_at ===
                null
          );

        if (!unread.length) {
          return;
        }

        try {
          const results =
            await Promise
              .allSettled(
                unread.map(
                  (item) =>
                    markNotificationAsRead(
                      item.id
                    )
                )
              );

          const succeeded =
            new Set(
              unread
                .filter(
                  (
                    _,
                    index
                  ) =>
                    results[
                      index
                    ].status ===
                      "fulfilled" &&
                    results[
                      index
                    ].value
                      ?.ok
                )
                .map(
                  (item) =>
                    item.id
                )
            );

          const next =
            items.map(
              (item) =>
                succeeded.has(
                  item.id
                )
                  ? {
                      ...item,

                      is_read:
                        true,

                      read_at:
                        item.read_at ||
                        new Date()
                          .toISOString(),
                    }
                  : item
            );

          setItems(next);

          await setCache(
            cacheKey(
              "notifications",
              "list"
            ),
            next
          );
        } catch {}
      },
      [items]
    );

  /* =======================================================
     Auto read
  ======================================================= */

  useEffect(() => {
    if (
      loading ||
      autoMarkRef.current ||
      items.length === 0
    ) {
      return;
    }

    autoMarkRef.current =
      true;

    (async () => {
      await markAllRead();

      try {
        await AsyncStorage.setItem(
          UNREAD_OVERRIDE_KEY,
          "0"
        );
      } catch {}
    })();
  }, [
    loading,
    items,
    markAllRead,
  ]);

  /* =======================================================
     Render card
  ======================================================= */

  const renderItem =
    useCallback(
      ({ item }) => {
        const isUnread =
          item?.is_read ===
            false ||
          (
            !item?.read_at &&
            item?.is_read !==
              true
          );

        const meta =
          getNotificationMeta(
            item?.type
          );

        const title =
          getArabicTitle(
            item?.title
          );

        const message =
          getArabicMessage(
            item?.message
          );

        return (
          <Pressable
            onPress={() =>
              markOneRead(
                item.id
              )
            }
            onLongPress={() =>
              onDelete(
                item.id
              )
            }
            delayLongPress={450}
            style={({ pressed }) => [
              styles.notificationCard,

              isUnread &&
                styles.unreadCard,

              pressed &&
                styles.pressedCard,
            ]}
          >
            {/* Icon - RIGHT */}

            <View
              style={
                styles.iconOuter
              }
            >
              <View
                style={[
                  styles.iconBox,

                  {
                    backgroundColor:
                      meta.bg,
                  },
                ]}
              >
                {item?.icon ? (
                  <Image
                    source={{
                      uri:
                        item.icon,
                    }}
                    resizeMode="cover"
                    style={
                      styles.remoteIcon
                    }
                  />
                ) : (
                  <Ionicons
                    name={
                      meta.icon
                    }
                    size={sp(22)}
                    color={
                      meta.color
                    }
                  />
                )}
              </View>

              {isUnread && (
                <View
                  style={
                    styles.unreadDot
                  }
                />
              )}
            </View>

            {/* Content */}

            <View
              style={
                styles.notificationContent
              }
            >
              <Text
                style={
                  styles.notificationTitle
                }
                numberOfLines={2}
              >
                {title}
              </Text>

              {!!message && (
                <Text
                  style={
                    styles.notificationMessage
                  }
                  numberOfLines={3}
                >
                  {message}
                </Text>
              )}

              <View
                style={
                  styles.bottomRow
                }
              >
                {!!meta.label && (
                  <View
                    style={[
                      styles.typePill,

                      {
                        backgroundColor:
                          meta.bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeText,

                        {
                          color:
                            meta.color,
                        },
                      ]}
                    >
                      {
                        meta.label
                      }
                    </Text>
                  </View>
                )}

                <View
                  style={
                    styles.timeRow
                  }
                >
                  <Ionicons
                    name="time-outline"
                    size={sp(13)}
                    color={
                      COLORS.muted
                    }
                  />

                  <Text
                    style={
                      styles.timeText
                    }
                  >
                    {timeAgo(
                      item
                        ?.created_at
                    )}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      },
      [
        markOneRead,
        onDelete,
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
        <View
          style={
            styles.listHeader
          }
        >
          
          {/* Filters */}

          <View
            style={
              styles.filters
            }
          >
            <Pressable
              onPress={() =>
                setFilter("all")
              }
              style={[
                styles.filterBtn,

                filter === "all" &&
                  styles.filterBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,

                  filter === "all" &&
                    styles.filterTextActive,
                ]}
              >
                الكل
              </Text>

              <View
                style={[
                  styles.countBox,

                  filter === "all" &&
                    styles.countBoxActive,
                ]}
              >
                <Text
                  style={[
                    styles.countText,

                    filter === "all" &&
                      styles.countTextActive,
                  ]}
                >
                  {items.length}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() =>
                setFilter(
                  "unread"
                )
              }
              style={[
                styles.filterBtn,

                filter ===
                  "unread" &&
                  styles.filterBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,

                  filter ===
                    "unread" &&
                    styles.filterTextActive,
                ]}
              >
                غير المقروءة
              </Text>

              <View
                style={[
                  styles.countBox,

                  filter ===
                    "unread" &&
                    styles.countBoxActive,
                ]}
              >
                <Text
                  style={[
                    styles.countText,

                    filter ===
                      "unread" &&
                      styles.countTextActive,
                  ]}
                >
                  {unreadCount}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      ),
      [
        filter,
        items.length,
        styles,
        unreadCount,
      ]
    );

  /* =======================================================
     Empty
  ======================================================= */

  const Empty =
    useMemo(
      () => (
        <View
          style={
            styles.emptyCard
          }
        >
          <View
            style={
              styles.emptyIcon
            }
          >
            <Ionicons
              name={
                filter ===
                "unread"
                  ? "checkmark-done-outline"
                  : "notifications-outline"
              }
              size={sp(30)}
              color={
                COLORS.primary
              }
            />
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            {filter ===
            "unread"
              ? "لا توجد إشعارات غير مقروءة"
              : "لا توجد إشعارات"}
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            {filter ===
            "unread"
              ? "تمت قراءة جميع الإشعارات."
              : "ستظهر إشعاراتك الجديدة هنا."}
          </Text>
        </View>
      ),
      [
        filter,
        sp,
        styles,
      ]
    );

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={navigation}
      active="home"
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
            size={sx(800)}
            image={require("../assets/home-corner.png")}
            speedMs={16000}
            opacity={0.4}
          />
        </View>

        {/* Header */}

        <AppHeader
          title="الإشعارات"
        />

        {/* Content */}

        {loading ? (
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
              جاري تحميل الإشعارات...
            </Text>
          </View>
        ) : (
          <FlatList
            data={
              filteredItems
            }
            keyExtractor={(
              item
            ) =>
              String(item.id)
            }
            renderItem={
              renderItem
            }
            ListHeaderComponent={
              ListHeader
            }
            ListEmptyComponent={
              Empty
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height:
                    sy(10),
                }}
              />
            )}
            showsVerticalScrollIndicator={
              false
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
                bottomPadding,
            }}
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  onRefresh
                }
                colors={[
                  COLORS.primary,
                ]}
                tintColor={
                  COLORS.primary
                }
              />
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

function createStyles({
  sx,
  sy,
  sp,
}) {
  return StyleSheet.create({
    page: {
      flex: 1,

      backgroundColor:
        COLORS.bg,

      direction: "ltr",
    },

    spinnerBg: {
      position: "absolute",

      top: 0,
      right: 0,
      left: 0,

      height: 0,
    },

    /* =====================================================
       Header content
    ===================================================== */

    listHeader: {
      width: "100%",

      alignItems:
        "flex-end",

      marginBottom:
        sy(14),
    },

    sectionTitle: {
      width: "100%",

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
      width: "100%",

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
       Filters
    ===================================================== */

    filters: {
      width: "100%",

      marginTop:
        sy(13),

      flexDirection:
        "row-reverse",

      justifyContent:
        "flex-start",

      alignItems:
        "center",

      gap:
        sx(9),
    },

    filterBtn: {
      minHeight:
        sy(40),

      paddingHorizontal:
        sx(11),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(6),

      borderWidth: 1,

      borderColor:
        COLORS.line,

      backgroundColor:
        COLORS.card,

      borderRadius:
        sx(12),
    },

    filterBtnActive: {
      backgroundColor:
        COLORS.primarySoft,

      borderColor:
        "#CFE1FF",
    },

    filterText: {
      color:
        COLORS.muted,

      fontSize:
        sp(12),

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    filterTextActive: {
      color:
        COLORS.primary,

      fontWeight:
        "900",
    },

    countBox: {
      minWidth:
        sx(22),

      height:
        sx(22),

      paddingHorizontal:
        sx(5),

      borderRadius:
        sx(11),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#EEF1F5",
    },

    countBoxActive: {
      backgroundColor:
        COLORS.primary,
    },

    countText: {
      color:
        COLORS.muted,

      fontSize:
        sp(10),

      fontWeight:
        "900",

      textAlign:
        "center",
    },

    countTextActive: {
      color:
        "#FFFFFF",
    },

    /* =====================================================
       Card RTL
    ===================================================== */

    notificationCard: {
      width: "100%",

      minHeight:
        sy(100),

      /*
       * أهم سطر:
       * الأيقونة عاليمين
       * والمحتوى بعدها عاليسار.
       */
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      gap:
        sx(11),

      padding:
        sx(13),

      backgroundColor:
        COLORS.card,

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(18),

      shadowColor:
        "#000",

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.035,

      shadowRadius: 7,

      elevation: 1,
    },

    unreadCard: {
      backgroundColor:
        "#F8FBFF",

      borderColor:
        "#CFE1FF",
    },

    pressedCard: {
      opacity: 0.92,

      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    /* =====================================================
       Icon
    ===================================================== */

    iconOuter: {
      position:
        "relative",

      flexShrink: 0,
    },

    iconBox: {
      width:
        sx(48),

      height:
        sx(48),

      borderRadius:
        sx(14),

      alignItems:
        "center",

      justifyContent:
        "center",

      overflow:
        "hidden",
    },

    remoteIcon: {
      width: "100%",
      height: "100%",
    },

    unreadDot: {
      position:
        "absolute",

      top: -2,
      right: -2,

      width:
        sx(10),

      height:
        sx(10),

      borderRadius:
        sx(5),

      backgroundColor:
        COLORS.primary,

      borderWidth: 2,

      borderColor:
        "#FFFFFF",
    },

    /* =====================================================
       Content RTL
    ===================================================== */

    notificationContent: {
      flex: 1,

      minWidth: 0,

      alignItems:
        "flex-end",
    },

    notificationTitle: {
      width: "100%",

      color:
        COLORS.text,

      fontSize:
        sp(15),

      lineHeight:
        sp(22),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    notificationMessage: {
      width: "100%",

      marginTop:
        sy(5),

      color:
        COLORS.muted,

      fontSize:
        sp(12.5),

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
       Bottom row
    ===================================================== */

    bottomRow: {
      width: "100%",

      marginTop:
        sy(9),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        sx(8),
    },

    typePill: {
      paddingHorizontal:
        sx(9),

      paddingVertical:
        sy(4),

      borderRadius: 999,
    },

    typeText: {
      fontSize:
        sp(10.5),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    timeRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(4),
    },

    timeText: {
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

    /* =====================================================
       Empty
    ===================================================== */

    emptyCard: {
      width: "100%",

      marginTop:
        sy(10),

      paddingVertical:
        sy(38),

      paddingHorizontal:
        sx(20),

      alignItems:
        "center",

      backgroundColor:
        COLORS.card,

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(18),
    },

    emptyIcon: {
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

    emptyTitle: {
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

    emptyText: {
      marginTop:
        sy(5),

      color:
        COLORS.muted,

      fontSize:
        sp(12),

      lineHeight:
        sp(18),

      textAlign:
        "center",

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
    },

    loadingText: {
      marginTop:
        sy(9),

      color:
        COLORS.muted,

      fontSize:
        sp(12.5),

      fontWeight:
        "700",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },
  });
}