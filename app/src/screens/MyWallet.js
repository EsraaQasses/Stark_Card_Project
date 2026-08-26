// src/screens/MyWallet.js

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import React, {
  useCallback,
  useMemo,
} from "react";

import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";

import {
  normalizeWalletsResponse,
} from "../api/wallets";

import {
  changeUserCurrencyNormalized,
} from "../features/wallet/api/walletApi";

import {
  getPreferredWalletCurrency,
  selectCurrencyWallets,
} from "../features/wallet/model/walletSummary";

import {
  useWalletData,
} from "../features/wallet/hooks/useWalletData";

import {
  formatWalletDecimal,
  formatWalletInteger,
  pickWalletAmount,
} from "../features/wallet/utils/walletFormatting";

/* =========================================================
   Constants
========================================================= */

const BASE_W = 390;
const BASE_H = 844;

const MAX_W = 480;

const COLOR = {
  primary: "#0B63D8",
  primarySoft: "#EEF5FF",

  text: "#0E1B3B",
  muted: "#718198",

  bg: "#F7F9FC",
  card: "#FFFFFF",

  line: "#E4ECF2",

  success: "#16A34A",

  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
};

/* =========================================================
   Android Layout Animation
========================================================= */

const isNewArch =
  !!globalThis.__turboModuleProxy;

if (
  Platform.OS === "android" &&
  !isNewArch &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(
    true
  );
}

/* =========================================================
   Main Screen
========================================================= */

export default function MyWallet({
  navigation,
}) {
  const { t } =
    useTranslation();

  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } = useWindowDimensions();

  /* =======================================================
     Responsive
  ======================================================= */

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
     Wallet Data
  ======================================================= */

  const {
    error,
    loading,

    refreshWalletData,
    refreshing,

    reloadWalletData,

    setWallet,
    wallet,
  } = useWalletData({
    loadErrorMessage: t(
      "wallet.errors.load",
      "تعذر تحميل بيانات المحفظة."
    ),
  });

  /* =======================================================
     Preferred Currency
  ======================================================= */

  const preferredCurrency =
    useMemo(() => {
      return getPreferredWalletCurrency(
        wallet
      );
    }, [wallet]);

  /* =======================================================
     Reload When Screen Gets Focus
  ======================================================= */

  useFocusEffect(
    useCallback(() => {
      reloadWalletData();

      const intervalId =
        setInterval(
          reloadWalletData,
          15000
        );

      return () =>
        clearInterval(
          intervalId
        );
    }, [reloadWalletData])
  );

  /* =======================================================
     Change Currency
  ======================================================= */

  const onChangeCurrency =
    useCallback(
      async (currency) => {
        if (
          preferredCurrency ===
          currency
        ) {
          return;
        }

        try {
          const previous =
            wallet || {};

          const optimistic = {
            ...previous,

            currency_preference:
              currency,
          };

          LayoutAnimation.configureNext(
            LayoutAnimation.Presets
              .easeInEaseOut
          );

          setWallet(
            optimistic
          );

          const result =
            await changeUserCurrencyNormalized(
              currency
            );

          if (!result.ok) {
            throw result.error;
          }

          const response =
            result.data;

          if (
            response?.currency_preference
          ) {
            setWallet(
              (prev) => ({
                ...(prev || {}),

                currency_preference:
                  response.currency_preference,
              })
            );
          }

          await reloadWalletData();

          Alert.alert(
            t(
              "wallet.alerts.currencyChanged.title",
              "تم تحديث العملة"
            ),

            t(
              "wallet.alerts.currencyChanged.body",
              {
                currency,

                defaultValue:
                  `تم اعتماد ${currency} كعملة افتراضية.`,
              }
            )
          );
        } catch {
          await reloadWalletData();

          Alert.alert(
            t(
              "common.networkError",
              "خطأ"
            ),

            t(
              "wallet.errors.changeCurrency",
              "تعذر تغيير العملة حالياً."
            )
          );
        }
      },
      [
        preferredCurrency,
        reloadWalletData,
        setWallet,
        t,
        wallet,
      ]
    );

  /* =======================================================
     Normalize Wallets
  ======================================================= */

  const {
    walletUSDObj,
    walletSYPObj,
  } = useMemo(() => {
    const list =
      normalizeWalletsResponse(
        wallet
      );

    return selectCurrencyWallets(
      wallet,
      list
    );
  }, [wallet]);

  /* =======================================================
     Balances
  ======================================================= */

  const usdBalance =
    useMemo(
      () =>
        formatWalletDecimal(
          pickWalletAmount(
            walletUSDObj
          )
        ),
      [walletUSDObj]
    );

  const sypBalance =
    useMemo(
      () =>
        formatWalletInteger(
          pickWalletAmount(
            walletSYPObj
          )
        ),
      [walletSYPObj]
    );

  /* =======================================================
     Totals
  ======================================================= */

  const totalUsd =
    useMemo(
      () =>
        formatWalletDecimal(
          wallet?.totals?.usd ??
            pickWalletAmount(
              walletUSDObj
            )
        ),
      [
        wallet,
        walletUSDObj,
      ]
    );

  const totalSyp =
    useMemo(
      () =>
        formatWalletInteger(
          wallet?.totals?.syp ??
            pickWalletAmount(
              walletSYPObj
            )
        ),
      [
        wallet,
        walletSYPObj,
      ]
    );

  /* =======================================================
     Currency Options
  ======================================================= */

  const currencyOptions =
    useMemo(
      () => [
        {
          key: "USD",

          label: t(
            "currency.usd",
            "USD"
          ),
        },

        {
          key: "SYP",

          label: t(
            "currency.SYP",
            "SYP"
          ),
        },
      ],
      [t]
    );

  /* =======================================================
     Sizes
  ======================================================= */

  const NAV_HEIGHT =
    useMemo(
      () => sy(64),
      [sy]
    );

  const contentBottom =
    useMemo(
      () =>
        NAV_HEIGHT +
        insets.bottom +
        sy(24),
      [
        NAV_HEIGHT,
        insets.bottom,
        sy,
      ]
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
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={navigation}
      active="wallet"
      withSideMenu={true}
    >
      <View style={styles.page}>
        {/* =================================================
            Decorative Background
        ================================================= */}

        <View
          pointerEvents="none"
          style={styles.spinnerBg}
        >
          <CornerSpinner
            size={sx(800)}
            image={require("../assets/home-corner.png")}
            speedMs={16000}
            opacity={0.45}
          />
        </View>

        {/* =================================================
            Same Header As Other Pages
        ================================================= */}

        <AppHeader
          title={t(
            "wallet.title",
            "محفظتي"
          )}
        />

        {/* =================================================
            Loading
        ================================================= */}

        {loading && !wallet ? (
          <View style={S.center}>
            <View style={S.loadingIcon}>
              <Ionicons
                name="wallet-outline"
                size={sx(32)}
                color={COLOR.primary}
              />
            </View>

            <ActivityIndicator
              size="large"
              color={COLOR.primary}
              style={{
                marginTop: sy(16),
              }}
            />

            <Text style={S.loadingText}>
              {t(
                "common.loading",
                "جاري تحميل المحفظة..."
              )}
            </Text>
          </View>
        ) : error && !wallet ? (
          /* =================================================
              Error
          ================================================= */

          <View style={S.center}>
            <View style={S.errorIcon}>
              <Ionicons
                name="alert-circle-outline"
                size={sx(30)}
                color={COLOR.danger}
              />
            </View>

            <Text style={S.errorTitle}>
              تعذر تحميل المحفظة
            </Text>

            <Text style={S.errorDescription}>
              {containsArabic(error)
                ? error
                : "حدث خطأ أثناء تحميل بيانات المحفظة. يرجى المحاولة مرة أخرى."}
            </Text>

            <Pressable
              onPress={
                refreshWalletData
              }
              style={
                S.retryButton
              }
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text style={S.retryText}>
                {t(
                  "common.tryAgain",
                  "إعادة المحاولة"
                )}
              </Text>
            </Pressable>
          </View>
        ) : (
          /* =================================================
              Wallet Content
          ================================================= */

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal:
                sx(14),

              paddingTop:
                sy(12),

              paddingBottom:
                contentBottom,
            }}
            showsVerticalScrollIndicator={
              false
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  refreshWalletData
                }
                tintColor={
                  COLOR.primary
                }
              />
            }
          >
            <View style={S.content}>
              {/* =============================================
                  Currency Preference
              ============================================= */}

              <View style={S.currencyCard}>
                <View style={S.currencyHeader}>
                  <View style={S.sectionIcon}>
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={20}
                      color={COLOR.primary}
                    />
                  </View>

                  <View
                    style={
                      S.currencyHeaderText
                    }
                  >
                    <Text
                      style={
                        S.sectionTitle
                      }
                    >
                      عملة الدفع
                    </Text>

                    <Text
                      style={
                        S.sectionSub
                      }
                    >
                      اختر العملة الافتراضية للشراء
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    S.currencySelector
                  }
                >
                  {currencyOptions.map(
                    (option) => {
                      const active =
                        preferredCurrency ===
                        option.key;

                      return (
                        <Pressable
                          key={
                            option.key
                          }
                          onPress={() =>
                            onChangeCurrency(
                              option.key
                            )
                          }
                          style={[
                            S.currencyButton,

                            active &&
                              S.currencyButtonActive,
                          ]}
                        >
                          {active && (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={
                                COLOR.primary
                              }
                            />
                          )}

                          <Text
                            style={[
                              S.currencyButtonText,

                              active &&
                                S.currencyButtonTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>
              </View>

              {/* =============================================
                  Wallet Balance Title
              ============================================= */}

              <View
                style={
                  S.sectionHeading
                }
              >
                <Text
                  style={
                    S.sectionHeadingText
                  }
                >
                  رصيد المحفظة
                </Text>
              </View>

              {/* =============================================
                  Wallet Cards
              ============================================= */}

              <View
                style={
                  S.walletCardsRow
                }
              >
                <WalletCard
                  title="محفظة الدولار"
                  currency="USD"
                  value={
                    usdBalance
                  }
                  icon="logo-usd"
                  tint="#16A34A"
                  sx={sx}
                  sp={sp}
                  active={
                    preferredCurrency ===
                    "USD"
                  }
                />

                <WalletCard
                  title="محفظة الليرة"
                  currency="SYP"
                  value={
                    sypBalance
                  }
                  icon="wallet-outline"
                  tint="#2563EB"
                  sx={sx}
                  sp={sp}
                  active={
                    preferredCurrency ===
                    "SYP"
                  }
                />
              </View>

              {/* =============================================
                  Total Balance
              ============================================= */}

              <View style={S.totalCard}>
                <View
                  style={
                    S.totalCardHeader
                  }
                >
                  <View
                    style={
                      S.sectionIcon
                    }
                  >
                    <Ionicons
                      name="pie-chart-outline"
                      size={20}
                      color={
                        COLOR.primary
                      }
                    />
                  </View>

                  <Text
                    style={
                      S.sectionTitle
                    }
                  >
                    إجمالي الأرصدة
                  </Text>
                </View>

                <BalanceRow
                  label="الدولار الأمريكي"
                  currency="USD"
                  value={
                    totalUsd
                  }
                  tint={
                    COLOR.success
                  }
                  sx={sx}
                  sp={sp}
                />

                <View style={S.divider} />

                <BalanceRow
                  label="الليرة السورية"
                  currency="SYP"
                  value={
                    totalSyp
                  }
                  tint={
                    COLOR.primary
                  }
                  sx={sx}
                  sp={sp}
                />
              </View>

              {/* =============================================
                  Update Information
              ============================================= */}

              <View style={S.infoCard}>
                <View
                  style={
                    S.infoIcon
                  }
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={
                      COLOR.primary
                    }
                  />
                </View>

                <Text style={S.infoText}>
                  يتم تحديث رصيد المحفظة تلقائيًا.
                  يمكنك أيضًا سحب الصفحة للأسفل للحصول على أحدث رصيد.
                </Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Wallet Card
========================================================= */

function WalletCard({
  title,
  currency,
  value,
  icon,
  tint,
  active,
  sx,
  sp,
}) {
  return (
    <View
      style={[
        styles.walletCard,

        {
          borderRadius:
            sx(17),
        },

        active && {
          borderColor:
            tint,

          backgroundColor:
            hexWithAlpha(
              tint,
              0.035
            ),
        },
      ]}
    >
      {/* Header */}

      <View style={styles.walletCardTop}>
        <View
          style={[
            styles.walletIcon,

            {
              backgroundColor:
                hexWithAlpha(
                  tint,
                  0.1
                ),

              width:
                sx(40),

              height:
                sx(40),

              borderRadius:
                sx(12),
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={sx(21)}
            color={tint}
          />
        </View>

        {active && (
          <View
            style={[
              styles.activeBadge,

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
              name="checkmark"
              size={11}
              color={tint}
            />

            <Text
              style={[
                styles.activeBadgeText,
                {
                  color:
                    tint,
                },
              ]}
            >
              الافتراضية
            </Text>
          </View>
        )}
      </View>

      {/* Name */}

      <Text
        numberOfLines={1}
        style={[
          styles.walletTitle,

          {
            fontSize:
              sp(13),
          },
        ]}
      >
        {title}
      </Text>

      {/* Balance */}

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[
          styles.walletAmount,

          {
            fontSize:
              sp(20),

            color:
              tint,
          },
        ]}
      >
        {value}
      </Text>

      {/* Currency */}

      <Text
        style={[
          styles.walletCurrency,

          {
            fontSize:
              sp(11),
          },
        ]}
      >
        {currency}
      </Text>
    </View>
  );
}

/* =========================================================
   Balance Row
========================================================= */

function BalanceRow({
  label,
  value,
  currency,
  tint,
  sx,
  sp,
}) {
  return (
    <View style={styles.balanceRow}>
      {/* Label right */}

      <View
        style={
          styles.balanceLabelWrap
        }
      >
        <View
          style={[
            styles.balanceDot,

            {
              backgroundColor:
                tint,

              width:
                sx(8),

              height:
                sx(8),

              borderRadius:
                sx(4),
            },
          ]}
        />

        <Text
          style={[
            styles.balanceLabel,

            {
              fontSize:
                sp(13),
            },
          ]}
        >
          {label}
        </Text>
      </View>

      {/* Value left */}

      <Text
        numberOfLines={1}
        style={[
          styles.balanceAmount,

          {
            fontSize:
              sp(15),
          },
        ]}
      >
        {value} {currency}
      </Text>
    </View>
  );
}

/* =========================================================
   Helpers
========================================================= */

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

function hexWithAlpha(
  hex,
  alpha
) {
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

/* =========================================================
   Responsive Styles
========================================================= */

function stylesFactory({
  sx,
  sy,
  sp,
}) {
  return StyleSheet.create({
    /* =====================================================
       Content
    ===================================================== */

    content: {
      alignSelf:
        "center",

      width:
        "100%",

      maxWidth:
        MAX_W,
    },

    /* =====================================================
       Loading / Error
    ===================================================== */

    center: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        sx(24),

      paddingBottom:
        sy(60),
    },

    loadingIcon: {
      width:
        sx(70),

      height:
        sx(70),

      borderRadius:
        sx(35),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    loadingText: {
      marginTop:
        sy(10),

      color:
        COLOR.muted,

      fontSize:
        sp(14),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    errorIcon: {
      width:
        sx(64),

      height:
        sx(64),

      borderRadius:
        sx(32),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.dangerSoft,
    },

    errorTitle: {
      marginTop:
        sy(13),

      color:
        COLOR.text,

      fontSize:
        sp(18),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    errorDescription: {
      marginTop:
        sy(6),

      maxWidth:
        sx(300),

      color:
        COLOR.muted,

      fontSize:
        sp(13),

      lineHeight:
        sp(20),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    retryButton: {
      marginTop:
        sy(16),

      minWidth:
        sx(150),

      minHeight:
        sy(44),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(7),

      paddingHorizontal:
        sx(18),

      borderRadius:
        sx(13),

      backgroundColor:
        COLOR.primary,
    },

    retryText: {
      color:
        "#FFFFFF",

      fontWeight:
        "900",

      fontSize:
        sp(14),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Currency Card
    ===================================================== */

    currencyCard: {
      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        sx(18),

      padding:
        sx(14),

      marginBottom:
        sy(17),

      shadowColor:
        "#000000",

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

    currencyHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(9),

      marginBottom:
        sy(13),
    },

    sectionIcon: {
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
        COLOR.primarySoft,
    },

    currencyHeaderText: {
      flex: 1,

      alignItems:
        "flex-end",
    },

    sectionTitle: {
      flex: 1,

      color:
        COLOR.text,

      fontSize:
        sp(15),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    sectionSub: {
      width:
        "100%",

      marginTop:
        sy(2),

      color:
        COLOR.muted,

      fontSize:
        sp(11.5),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    currencySelector: {
      flexDirection:
        "row-reverse",

      gap:
        sx(8),
    },

    currencyButton: {
      flex: 1,

      minHeight:
        sy(46),

      flexDirection:
        "row-reverse",

      gap:
        sx(6),

      alignItems:
        "center",

      justifyContent:
        "center",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        sx(13),

      backgroundColor:
        "#F8FAFC",
    },

    currencyButtonActive: {
      borderColor:
        "#BFD7FF",

      backgroundColor:
        COLOR.primarySoft,
    },

    currencyButtonText: {
      color:
        COLOR.muted,

      fontSize:
        sp(14),

      fontWeight:
        "800",

      textAlign:
        "center",

      writingDirection:
        "ltr",
    },

    currencyButtonTextActive: {
      color:
        COLOR.primary,
    },

    /* =====================================================
       Section Heading
    ===================================================== */

    sectionHeading: {
      marginBottom:
        sy(9),

      alignItems:
        "flex-end",
    },

    sectionHeadingText: {
      color:
        COLOR.text,

      fontSize:
        sp(16),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Wallet Cards
    ===================================================== */

    walletCardsRow: {
      flexDirection:
        "row-reverse",

      gap:
        sx(10),

      marginBottom:
        sy(16),
    },

    /* =====================================================
       Totals Card
    ===================================================== */

    totalCard: {
      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        sx(18),

      padding:
        sx(14),

      marginBottom:
        sy(16),

      shadowColor:
        "#000000",

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

    totalCardHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(9),

      marginBottom:
        sy(12),
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLOR.line,

      marginVertical:
        sy(11),
    },

    /* =====================================================
       Info Card
    ===================================================== */

    infoCard: {
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      gap:
        sx(9),

      padding:
        sx(12),

      borderRadius:
        sx(14),

      backgroundColor:
        COLOR.primarySoft,

      borderWidth:
        1,

      borderColor:
        "#DDEAFF",

      marginBottom:
        sy(8),
    },

    infoIcon: {
      marginTop:
        1,
    },

    infoText: {
      flex: 1,

      color:
        "#48637E",

      fontSize:
        sp(12),

      lineHeight:
        sp(19),

      textAlign:
        "right",

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
    /* =====================================================
       Page
    ===================================================== */

    page: {
      flex: 1,

      backgroundColor:
        COLOR.bg,
    },

    /* =====================================================
       Wallet Card
    ===================================================== */

    walletCard: {
      flex: 1,

      minWidth: 0,

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      padding:
        13,

      shadowColor:
        "#00000004",

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

    walletCardTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      minHeight:
        40,
    },

    walletIcon: {
      alignItems:
        "center",

      justifyContent:
        "center",
    },

    activeBadge: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        3,

      paddingHorizontal:
        7,

      paddingVertical:
        4,

      borderRadius:
        999,
    },

    activeBadgeText: {
      fontSize:
        9,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    walletTitle: {
      width:
        "100%",

      marginTop:
        11,

      color:
        COLOR.text,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    walletAmount: {
      width:
        "100%",

      marginTop:
        5,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "ltr",
    },

    walletCurrency: {
      width:
        "100%",

      marginTop:
        2,

      color:
        COLOR.muted,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "ltr",
    },

    /* =====================================================
       Balance
    ===================================================== */

    balanceRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        12,
    },

    balanceLabelWrap: {
      flex: 1,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        8,
    },

    balanceDot: {},

    balanceLabel: {
      flex: 1,

      color:
        COLOR.muted,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    balanceAmount: {
      color:
        COLOR.text,

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "ltr",
    },

    /* =====================================================
       Background Spinner
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