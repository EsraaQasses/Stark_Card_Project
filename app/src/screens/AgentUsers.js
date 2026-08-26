// src/screens/AgentUsers.js

import { Ionicons } from "@expo/vector-icons";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";

import { AppHeader } from "../shared/ui/layout";

import { useAuth } from "../context/AuthProvider";
import { getAgentUsers } from "../api/agent";

/* =========================================================
   Constants
========================================================= */

const BASE_W = 390;
const BASE_H = 844;

const MAX_W = 480;

const COLOR = {
  bg: "#F7F9FC",

  card: "#FFFFFF",

  text: "#0E1B3B",

  muted: "#718198",

  line: "#E4ECF2",

  primary: "#0B63D8",

  primarySoft: "#EEF5FF",

  success: "#16A34A",

  successSoft: "#F0FDF4",

  danger: "#DC2626",

  dangerSoft: "#FEF2F2",
};

/* =========================================================
   Helpers
========================================================= */

function fmtPhone(value) {
  if (!value) {
    return "";
  }

  return String(value).trim();
}

function makeInitials(name) {
  const value =
    String(name || "")
      .trim();

  if (!value) {
    return "ع";
  }

  const parts =
    value
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    `${parts[0]?.[0] || ""}${
      parts[1]?.[0] || ""
    }`
  ).toUpperCase();
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

/* =========================================================
   Category
========================================================= */

function getCategoryLabel(value) {
  const raw =
    String(value || "")
      .trim();

  if (!raw) {
    return "";
  }

  if (containsArabic(raw)) {
    return raw;
  }

  const normalized =
    raw.toLowerCase();

  const map = {
    regular: "عادي",
    normal: "عادي",
    standard: "عادي",

    vip: "مميز",
    premium: "مميز",

    new: "جديد",

    active: "نشط",
  };

  return (
    map[normalized] ||
    ""
  );
}

/* =========================================================
   Country
========================================================= */

function getCountryLabel(value) {
  const raw =
    String(value || "")
      .trim();

  if (!raw) {
    return "";
  }

  if (containsArabic(raw)) {
    return raw;
  }

  const normalized =
    raw.toLowerCase();

  const map = {
    syria: "سوريا",

    "syrian arab republic":
      "سوريا",

    turkey: "تركيا",
    türkiye: "تركيا",

    lebanon: "لبنان",

    jordan: "الأردن",

    iraq: "العراق",

    egypt: "مصر",

    uae:
      "الإمارات",

    "united arab emirates":
      "الإمارات",

    saudi:
      "السعودية",

    "saudi arabia":
      "السعودية",

    qatar: "قطر",

    kuwait: "الكويت",

    bahrain: "البحرين",

    oman: "عُمان",
  };

  return (
    map[normalized] ||
    raw
  );
}

/* =========================================================
   Balance
========================================================= */

function getUsdBalance(user) {
  const wallet =
    user?.wallet_balance ||
    user?.wallet ||
    {};

  const value =
    wallet?.available_usd ??
    wallet?.usd ??
    wallet?.USD ??
    user?.available_usd ??
    0;

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

/* =========================================================
   Screen
========================================================= */

export default function AgentUsers({
  navigation,
}) {
  const { user } =
    useAuth();

  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } = useWindowDimensions();

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
      [
        sx,
        sy,
        sp,
      ]
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

  /* =======================================================
     Agent
  ======================================================= */

  const agentId =
    useMemo(
      () =>
        user?.id ||
        user?.raw?.id ||
        null,
      [user]
    );

  /* =======================================================
     Local fallback
  ======================================================= */

  const localAgentUsers =
    useMemo(() => {
      const raw =
        user?.raw ||
        user ||
        {};

      const list =
        raw?.agent_users ||
        raw?.agentUsers ||
        [];

      return Array.isArray(
        list
      )
        ? list
        : [];
    }, [user]);

  /* =======================================================
     Load
  ======================================================= */

  const load =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (showLoading) {
          setLoading(true);
        }

        setError("");

        if (!agentId) {
          setItems([]);

          setLoading(false);

          setRefreshing(false);

          setError(
            "تعذر تحديد حساب الوكيل الحالي."
          );

          return;
        }

        try {
          const list =
            await getAgentUsers(
              agentId
            );

          setItems(
            Array.isArray(list)
              ? list
              : []
          );
        } catch {
          if (
            localAgentUsers.length >
            0
          ) {
            setItems(
              localAgentUsers
            );

            setError("");
          } else {
            setItems([]);

            setError(
              "تعذر تحميل العملاء. حاول مرة أخرى."
            );
          }
        } finally {
          setLoading(false);

          setRefreshing(false);
        }
      },
      [
        agentId,
        localAgentUsers,
      ]
    );

  /* =======================================================
     Initial Load
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
    useCallback(() => {
      setRefreshing(true);

      load();
    }, [load]);

  /* =======================================================
     Padding
  ======================================================= */

  const contentPadBottom =
    useMemo(
      () =>
        insets.bottom +
        sy(100),
      [
        insets.bottom,
        sy,
      ]
    );

  /* =======================================================
     Render customer
  ======================================================= */

  const renderItem =
    useCallback(
      ({ item }) => {
        const name =
          item?.full_name ||
          item?.name ||
          item?.username ||
          "مستخدم";

        const phone =
          fmtPhone(
            item?.phone ||
            item?.optional_phone
          );

        const country =
          getCountryLabel(
            item?.country
          );

        const category =
          getCategoryLabel(
            item?.customer_category
          );

        const usd =
          getUsdBalance(item);

        return (
          <View
            style={
              styles.customerCard
            }
          >
            {/* ===========================================
                Customer top
            =========================================== */}

            <View
              style={
                styles.customerTop
              }
            >
              {/* Avatar - RIGHT */}

              <View
                style={
                  styles.avatar
                }
              >
                <Text
                  style={
                    styles.avatarText
                  }
                >
                  {makeInitials(
                    name
                  )}
                </Text>
              </View>

              {/* Information */}

              <View
                style={
                  styles.customerInfo
                }
              >
                <View
                  style={
                    styles.nameRow
                  }
                >
                  <Text
                    numberOfLines={
                      1
                    }
                    style={
                      styles.customerName
                    }
                  >
                    {name}
                  </Text>

                  {!!category && (
                    <View
                      style={
                        styles.categoryBadge
                      }
                    >
                      <Text
                        style={
                          styles.categoryText
                        }
                      >
                        {
                          category
                        }
                      </Text>
                    </View>
                  )}
                </View>

                {/* Phone */}

                {!!phone && (
                  <View
                    style={
                      styles.infoRow
                    }
                  >
                    <Ionicons
                      name="call-outline"
                      size={
                        sp(14)
                      }
                      color={
                        COLOR.muted
                      }
                    />

                    <Text
                      numberOfLines={
                        1
                      }
                      style={
                        styles.phoneText
                      }
                    >
                      {phone}
                    </Text>
                  </View>
                )}

                {/* Country */}

                {!!country && (
                  <View
                    style={
                      styles.infoRow
                    }
                  >
                    <Ionicons
                      name="location-outline"
                      size={
                        sp(14)
                      }
                      color={
                        COLOR.muted
                      }
                    />

                    <Text
                      numberOfLines={
                        1
                      }
                      style={
                        styles.infoText
                      }
                    >
                      {
                        country
                      }
                    </Text>
                  </View>
                )}
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
                Bottom
            =========================================== */}

            <View
              style={
                styles.cardBottom
              }
            >
              {/* Balance */}

              <View
                style={
                  styles.balanceBox
                }
              >
                <View
                  style={
                    styles.balanceIcon
                  }
                >
                  <Ionicons
                    name="wallet-outline"
                    size={
                      sp(16)
                    }
                    color={
                      COLOR.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.balanceInfo
                  }
                >
                  <Text
                    style={
                      styles.balanceLabel
                    }
                  >
                    الرصيد بالدولار
                  </Text>

                  <Text
                    style={
                      styles.balanceValue
                    }
                  >
                    {usd.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Connected */}

              <View
                style={
                  styles.connectedBadge
                }
              >
                <Ionicons
                  name="checkmark-circle"
                  size={
                    sp(15)
                  }
                  color={
                    COLOR.success
                  }
                />

                <Text
                  style={
                    styles.connectedText
                  }
                >
                  مرتبط
                </Text>
              </View>
            </View>
          </View>
        );
      },
      [
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
          {/* ===============================================
              Section title
          =============================================== */}

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
              العملاء المرتبطون
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              المستخدمون المرتبطون بحسابك كوكيل
            </Text>
          </View>

          {/* ===============================================
              Summary
          =============================================== */}

          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={
                styles.summaryIcon
              }
            >
              <Ionicons
                name="people-outline"
                size={
                  sp(24)
                }
                color={
                  COLOR.primary
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
                إجمالي العملاء
              </Text>

              <Text
                style={
                  styles.summaryValue
                }
              >
                {
                  items.length
                }
              </Text>
            </View>
          </View>
        </View>
      ),
      [
        items.length,
        sp,
        styles,
      ]
    );

  /* =======================================================
     Empty
  ======================================================= */

  const EmptyState =
    useMemo(
      () => {
        if (error) {
          return (
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
                      COLOR.dangerSoft,
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={
                    sp(27)
                  }
                  color={
                    COLOR.danger
                  }
                />
              </View>

              <Text
                style={
                  styles.stateTitle
                }
              >
                تعذر تحميل العملاء
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
                    showLoading:
                      true,
                  })
                }
                style={
                  styles.retryButton
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
          );
        }

        return (
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
                name="people-outline"
                size={
                  sp(28)
                }
                color={
                  COLOR.primary
                }
              />
            </View>

            <Text
              style={
                styles.stateTitle
              }
            >
              لا يوجد عملاء بعد
            </Text>

            <Text
              style={
                styles.stateText
              }
            >
              أي مستخدم يرتبط بك كوكيل سيظهر هنا.
            </Text>
          </View>
        );
      },
      [
        error,
        load,
        sp,
        styles,
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
              0.42
            }
          />
        </View>

        {/* Same header as rest of app */}

        <AppHeader
          title="عملائي"
        />

        {/* Loading */}

        {loading ? (
          <View
            style={
              styles.loading
            }
          >
            <ActivityIndicator
              size="large"
              color={
                COLOR.primary
              }
            />

            <Text
              style={
                styles.loadingText
              }
            >
              جاري تحميل العملاء...
            </Text>
          </View>
        ) : (
          <FlatList
            data={
              items
            }
            keyExtractor={(
              item,
              index
            ) =>
              String(
                item?.id ??
                item?.user_id ??
                index
              )
            }
            renderItem={
              renderItem
            }
            ListHeaderComponent={
              ListHeader
            }
            ListEmptyComponent={
              EmptyState
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height:
                    sy(11),
                }}
              />
            )}
            showsVerticalScrollIndicator={
              false
            }
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
                contentPadBottom,

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
                  onRefresh
                }
                tintColor={
                  COLOR.primary
                }
                colors={[
                  COLOR.primary,
                ]}
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
        COLOR.bg,

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
        COLOR.text,

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
        COLOR.muted,

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

    summaryCard: {
      width:
        "100%",

      minHeight:
        sy(78),

      marginBottom:
        sy(16),

      paddingHorizontal:
        sx(14),

      paddingVertical:
        sy(12),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(11),

      backgroundColor:
        COLOR.card,

      borderWidth: 1,

      borderColor:
        "#CFE1FF",

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

      elevation: 1,
    },

    summaryIcon: {
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

      backgroundColor:
        COLOR.primarySoft,
    },

    summaryInfo: {
      flex: 1,

      alignItems:
        "flex-end",
    },

    summaryLabel: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontSize:
        sp(12),

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

      color:
        COLOR.primary,

      fontSize:
        sp(22),

      fontWeight:
        "900",

      textAlign:
        "right",
    },

    /* =====================================================
       Customer Card
    ===================================================== */

    customerCard: {
      width:
        "100%",

      padding:
        sx(14),

      backgroundColor:
        COLOR.card,

      borderWidth:
        1,

      borderColor:
        COLOR.line,

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

    customerTop: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      gap:
        sx(11),
    },

    /* =====================================================
       Avatar
    ===================================================== */

    avatar: {
      width:
        sx(48),

      height:
        sx(48),

      borderRadius:
        sx(14),

      flexShrink:
        0,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,

      borderWidth:
        1,

      borderColor:
        "#D7E6FF",
    },

    avatarText: {
      color:
        COLOR.primary,

      fontSize:
        sp(15),

      fontWeight:
        "900",

      textAlign:
        "center",
    },

    /* =====================================================
       Customer Info
    ===================================================== */

    customerInfo: {
      flex:
        1,

      minWidth:
        0,

      alignItems:
        "flex-end",
    },

    nameRow: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        sx(8),
    },

    customerName: {
      flex:
        1,

      color:
        COLOR.text,

      fontSize:
        sp(16),

      lineHeight:
        sp(23),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Category
    ===================================================== */

    categoryBadge: {
      flexShrink:
        0,

      paddingHorizontal:
        sx(9),

      paddingVertical:
        sy(4),

      borderRadius:
        999,

      backgroundColor:
        COLOR.successSoft,

      borderWidth:
        1,

      borderColor:
        "#BBF7D0",
    },

    categoryText: {
      color:
        COLOR.success,

      fontSize:
        sp(10),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Meta
    ===================================================== */

    infoRow: {
      width:
        "100%",

      marginTop:
        sy(5),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "flex-start",

      gap:
        sx(5),
    },

    infoText: {
      flexShrink:
        1,

      color:
        COLOR.muted,

      fontSize:
        sp(11.5),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    phoneText: {
      flexShrink:
        1,

      color:
        COLOR.muted,

      fontSize:
        sp(11.5),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "ltr",
    },

    /* =====================================================
       Divider
    ===================================================== */

    divider: {
      width:
        "100%",

      height:
        StyleSheet.hairlineWidth,

      marginVertical:
        sy(12),

      backgroundColor:
        COLOR.line,
    },

    /* =====================================================
       Bottom
    ===================================================== */

    cardBottom: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        sx(10),
    },

    /* =====================================================
       Balance
    ===================================================== */

    balanceBox: {
      flex:
        1,

      minWidth:
        0,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(8),
    },

    balanceIcon: {
      width:
        sx(34),

      height:
        sx(34),

      borderRadius:
        sx(10),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    balanceInfo: {
      flex:
        1,

      minWidth:
        0,

      alignItems:
        "flex-end",
    },

    balanceLabel: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontSize:
        sp(10),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    balanceValue: {
      width:
        "100%",

      marginTop:
        sy(1),

      color:
        COLOR.text,

      fontSize:
        sp(14),

      fontWeight:
        "900",

      textAlign:
        "right",
    },

    /* =====================================================
       Connected
    ===================================================== */

    connectedBadge: {
      flexShrink:
        0,

      minHeight:
        sy(32),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(5),

      paddingHorizontal:
        sx(10),

      backgroundColor:
        COLOR.successSoft,

      borderWidth:
        1,

      borderColor:
        "#BBF7D0",

      borderRadius:
        sx(11),
    },

    connectedText: {
      color:
        COLOR.success,

      fontSize:
        sp(10.5),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       State
    ===================================================== */

    stateCard: {
      width:
        "100%",

      marginTop:
        sy(5),

      paddingVertical:
        sy(35),

      paddingHorizontal:
        sx(20),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.card,

      borderWidth:
        1,

      borderColor:
        COLOR.line,

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
        COLOR.primarySoft,
    },

    stateTitle: {
      marginTop:
        sy(12),

      color:
        COLOR.text,

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
        COLOR.muted,

      fontSize:
        sp(12),

      lineHeight:
        sp(19),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    retryButton: {
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
        sx(6),

      backgroundColor:
        COLOR.primary,

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
      flex:
        1,

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
        COLOR.muted,

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