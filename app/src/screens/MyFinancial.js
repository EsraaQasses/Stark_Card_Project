// src/screens/MyFinancial.js

import { Ionicons } from "@expo/vector-icons";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
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

import {
  getAgentFinancialSummary,
  getTransactions,
} from "../api/transactions";

import { getWallet } from "../api/wallets";

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

  warning: "#D97706",

  warningSoft: "#FFF7E8",

  danger: "#DC2626",

  dangerSoft: "#FEF2F2",

  syp: "#7C3AED",

  sypSoft: "#F5F3FF",
};

/* =========================================================
   Helpers
========================================================= */

function fmt(value, digits = 2) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return number.toFixed(digits);
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

function currencyLabel(value) {
  const currency =
    String(value || "")
      .trim()
      .toUpperCase();

  if (currency === "USD") {
    return "دولار";
  }

  if (
    currency === "SYP" ||
    currency === "LOCAL"
  ) {
    return "سوري";
  }

  return "";
}

function statusLabel(value) {
  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    status === "approved" ||
    status === "completed" ||
    status === "success" ||
    status === "successful"
  ) {
    return {
      label: "مكتملة",

      color:
        COLOR.success,

      bg:
        COLOR.successSoft,
    };
  }

  if (
    status === "rejected" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "canceled"
  ) {
    return {
      label: "مرفوضة",

      color:
        COLOR.danger,

      bg:
        COLOR.dangerSoft,
    };
  }

  if (
    status === "pending"
  ) {
    return {
      label:
        "قيد الانتظار",

      color:
        COLOR.warning,

      bg:
        COLOR.warningSoft,
    };
  }

  return {
    label:
      "مكتملة",

    color:
      COLOR.success,

    bg:
      COLOR.successSoft,
  };
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

function getCommissionTitle(transaction) {
  const product =
    String(
      transaction
        ?.commission_source_product_name ||
        ""
    ).trim();

  if (product) {
    return product;
  }

  const sourceNote =
    String(
      transaction
        ?.commission_source_note ||
        ""
    ).trim();

  if (
    sourceNote &&
    containsArabic(
      sourceNote
    )
  ) {
    return sourceNote;
  }

  const note =
    String(
      transaction?.note ||
        ""
    ).trim();

  if (
    note &&
    containsArabic(note)
  ) {
    return note;
  }

  return "عمولة";
}

/* =========================================================
   Screen
========================================================= */

export default function MyFinancial({
  navigation,
}) {
  const { user } =
    useAuth();

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
    data,
    setData,
  ] =
    useState(null);

  const [
    walletData,
    setWalletData,
  ] =
    useState(null);

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
    error,
    setError,
  ] =
    useState("");

  const [
    commissionTxs,
    setCommissionTxs,
  ] =
    useState([]);

  const [
    trendDays,
    setTrendDays,
  ] =
    useState(7);

  /* =======================================================
     Wallet Summary
  ======================================================= */

  const walletSummary =
    user?.wallet_summary ||
    user?.balances ||
    {};

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

        try {
          /* ===============================================
             Financial summary
          =============================================== */

          const response =
            await getAgentFinancialSummary();

          if (!response?.ok) {
            throw new Error();
          }

          setData(
            response?.data ||
              {}
          );

          /* ===============================================
             Wallet
          =============================================== */

          try {
            const wallet =
              await getWallet();

            setWalletData(
              wallet
            );
          } catch {
            // نستخدم بيانات المستخدم كـ fallback
          }

          /* ===============================================
             Commission transactions
          =============================================== */

          try {
            const txResponse =
              await getTransactions({
                transaction_type:
                  "deposit",

                page_size:
                  50,
              });

            if (
              txResponse?.ok
            ) {
              const list =
                Array.isArray(
                  txResponse?.data
                )
                  ? txResponse.data
                  : [];

              const filtered =
                list.filter(
                  (
                    transaction
                  ) => {
                    const note =
                      String(
                        transaction
                          ?.note ||
                          ""
                      ).toLowerCase();

                    return (
                      note.includes(
                        "عمولة"
                      ) ||
                      note.includes(
                        "commission"
                      )
                    );
                  }
                );

              setCommissionTxs(
                filtered
              );
            } else {
              setCommissionTxs(
                []
              );
            }
          } catch {
            setCommissionTxs(
              []
            );
          }
        } catch {
          setError(
            "تعذر تحميل الحساب المالي. حاول مرة أخرى."
          );
        } finally {
          setLoading(false);

          setRefreshing(false);
        }
      },
      []
    );

  /* =======================================================
     Initial Load
  ======================================================= */

  useEffect(() => {
    load({
      showLoading:
        true,
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
     Totals
  ======================================================= */

  const totals =
    useMemo(() => {
      const source =
        data || {};

      return {
        revenueUsd:
          source
            ?.total_revenue_usd,

        revenueSyp:
          source
            ?.total_revenue_syp,

        txCount:
          source
            ?.transactions_count,

        avgPct:
          source
            ?.average_profit_percentage,

        commissionUsd:
          source
            ?.commission_by_currency
            ?.USD ??
          source
            ?.estimated_commission_usd,

        commissionSyp:
          source
            ?.commission_by_currency
            ?.SYP ??
          source
            ?.estimated_commission_syp,

        totalEarningsUsd:
          source
            ?.total_earnings_by_currency
            ?.USD ??
          source
            ?.total_earnings_usd,

        totalEarningsSyp:
          source
            ?.total_earnings_by_currency
            ?.SYP ??
          source
            ?.total_earnings_syp,

        commissionRate:
          source
            ?.commission_rate,

        trend7:
          Array.isArray(
            source
              ?.trend_7d
          )
            ? source
                .trend_7d
            : [],

        trend30:
          Array.isArray(
            source
              ?.trend_30d
          )
            ? source
                .trend_30d
            : [],

        trend7Syp:
          Array.isArray(
            source
              ?.trend_7d_syp
          )
            ? source
                .trend_7d_syp
            : [],

        trend30Syp:
          Array.isArray(
            source
              ?.trend_30d_syp
          )
            ? source
                .trend_30d_syp
            : [],
      };
    }, [data]);

  /* =======================================================
     Wallet balances
  ======================================================= */

  const usdAvail =
    walletData?.USD
      ?.available ??
    walletData?.USD
      ?.available_balance ??
    walletData?.totals
      ?.usd ??
    walletSummary
      ?.available_usd ??
    walletSummary
      ?.USD ??
    walletSummary
      ?.usd ??
    0;

  const sypAvail =
    walletData?.SYP
      ?.available ??
    walletData?.SYP
      ?.available_balance ??
    walletData?.totals
      ?.syp ??
    walletSummary
      ?.available_syp ??
    walletSummary
      ?.SYP ??
    walletSummary
      ?.syp ??
    0;

  /* =======================================================
     Commission totals fallback
  ======================================================= */

  const commissionTotals =
    useMemo(() => {
      let usd = 0;
      let syp = 0;

      for (
        const transaction of
        commissionTxs
      ) {
        const amount =
          Number(
            transaction
              ?.amount ||
              0
          );

        const currency =
          String(
            transaction
              ?.currency ||
              ""
          ).toUpperCase();

        if (
          currency === "USD"
        ) {
          usd += amount;
        }

        if (
          currency === "SYP"
        ) {
          syp += amount;
        }
      }

      return {
        usd,
        syp,
      };
    }, [commissionTxs]);

  /* =======================================================
     Trends
  ======================================================= */

  const trendData =
    trendDays === 7
      ? totals.trend7
      : totals.trend30;

  const trendDataSyp =
    trendDays === 7
      ? totals.trend7Syp
      : totals.trend30Syp;

  const maxTrend =
    Math.max(
      1,

      ...trendData.map(
        (item) =>
          Number(
            item
              ?.total_usd
          ) || 0
      )
    );

  const maxTrendSyp =
    Math.max(
      1,

      ...trendDataSyp.map(
        (item) =>
          Number(
            item
              ?.total_syp
          ) || 0
      )
    );

  /* =======================================================
     Bottom padding
  ======================================================= */

  const contentPadBottom =
    insets.bottom +
    sy(105);

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
        {/* =================================================
            Background decoration
        ================================================= */}

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

        {/* =================================================
            App Header
        ================================================= */}

        <AppHeader
          title="المخلص المالي"
        />

        {/* =================================================
            Loading
        ================================================= */}

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
              جاري تحميل البيانات المالية...
            </Text>
          </View>
        ) : error ? (
          /* =================================================
             Error
          ================================================= */

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
                      COLOR.dangerSoft,
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={
                    sp(28)
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
                تعذر تحميل الحساب المالي
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
          </View>
        ) : (
          /* =================================================
             Content
          ================================================= */

          <ScrollView
            style={
              styles.scroll
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
                  COLOR.primary
                }
                colors={[
                  COLOR.primary,
                ]}
              />
            }
            contentContainerStyle={{
              paddingBottom:
                contentPadBottom,
            }}
          >
            <View
              style={[
                styles.content,

                {
                  paddingHorizontal:
                    sx(14),

                  paddingTop:
                    sy(12),
                },
              ]}
            >
              {/* ===========================================
                  Overview
              =========================================== */}

              

              <View
                style={
                  styles.summaryGrid
                }
              >
                <FinancialCard
                  label="عدد المعاملات"
                  value={
                    String(
                      totals.txCount ??
                        0
                    )
                  }
                  icon="swap-horizontal-outline"
                  color={
                    COLOR.primary
                  }
                  background={
                    COLOR.primarySoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />

                <FinancialCard
                  label="متوسط الربح"
                  value={`${fmt(
                    totals.avgPct,
                    2
                  )}%`}
                  icon="trending-up-outline"
                  color={
                    COLOR.success
                  }
                  background={
                    COLOR.successSoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />

                <FinancialCard
                  label="نسبة العمولة"
                  value={`${fmt(
                    totals.commissionRate,
                    2
                  )}%`}
                  icon="pie-chart-outline"
                  color={
                    COLOR.warning
                  }
                  background={
                    COLOR.warningSoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />

                <FinancialCard
                  label="حركات العمولة"
                  value={
                    String(
                      commissionTxs.length
                    )
                  }
                  icon="receipt-outline"
                  color={
                    COLOR.syp
                  }
                  background={
                    COLOR.sypSoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />
              </View>

              {/* ===========================================
                  Revenue
              =========================================== */}

              <SectionHeader
                title="الإيرادات"
                styles={
                  styles
                }
              />

              <View
                style={
                  styles.currencyGrid
                }
              >
                <MoneyCard
                  title="الإيرادات بالدولار"
                  amount={fmt(
                    totals.revenueUsd,
                    2
                  )}
                  currency="دولار"
                  icon="logo-usd"
                  color={
                    COLOR.primary
                  }
                  background={
                    COLOR.primarySoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />

                <MoneyCard
                  title="الإيرادات بالسوري"
                  amount={fmt(
                    totals.revenueSyp,
                    2
                  )}
                  currency="سوري"
                  icon="cash-outline"
                  color={
                    COLOR.syp
                  }
                  background={
                    COLOR.sypSoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />
              </View>

              {/* ===========================================
                  Wallet
              =========================================== */}

              <SectionHeader
                title="المحفظة"
                styles={
                  styles
                }
              />

              <View
                style={
                  styles.currencyGrid
                }
              >
                <MoneyCard
                  title="الرصيد المتاح"
                  amount={fmt(
                    usdAvail,
                    2
                  )}
                  currency="دولار"
                  icon="wallet-outline"
                  color={
                    COLOR.primary
                  }
                  background={
                    COLOR.primarySoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />

                <MoneyCard
                  title="الرصيد المتاح"
                  amount={fmt(
                    sypAvail,
                    2
                  )}
                  currency="سوري"
                  icon="wallet-outline"
                  color={
                    COLOR.syp
                  }
                  background={
                    COLOR.sypSoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />
              </View>

              {/* ===========================================
                  Earnings
              =========================================== */}

              <SectionHeader
                title="الأرباح والعمولات"
                styles={
                  styles
                }
              />

              <View
                style={
                  styles.currencyGrid
                }
              >
                <MoneyCard
                  title="إجمالي الأرباح"
                  amount={fmt(
                    totals.totalEarningsUsd,
                    2
                  )}
                  currency="دولار"
                  icon="trending-up-outline"
                  color={
                    COLOR.success
                  }
                  background={
                    COLOR.successSoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />

                <MoneyCard
                  title="إجمالي الأرباح"
                  amount={fmt(
                    totals.totalEarningsSyp,
                    2
                  )}
                  currency="سوري"
                  icon="trending-up-outline"
                  color={
                    COLOR.syp
                  }
                  background={
                    COLOR.sypSoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />

                <MoneyCard
                  title="العمولة"
                  amount={fmt(
                    totals.commissionUsd ??
                      commissionTotals.usd,
                    2
                  )}
                  currency="دولار"
                  icon="gift-outline"
                  color={
                    COLOR.primary
                  }
                  background={
                    COLOR.primarySoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />

                <MoneyCard
                  title="العمولة"
                  amount={fmt(
                    totals.commissionSyp ??
                      commissionTotals.syp,
                    2
                  )}
                  currency="سوري"
                  icon="gift-outline"
                  color={
                    COLOR.warning
                  }
                  background={
                    COLOR.warningSoft
                  }
                  styles={
                    styles
                  }
                  sp={sp}
                />
              </View>

              {/* ===========================================
                  Trends
              =========================================== */}

              <View
                style={
                  styles.trendHeading
                }
              >
                <View
                  style={
                    styles.trendTitleBox
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    حركة الإيرادات
                  </Text>

                  <Text
                    style={
                      styles.sectionSubtitle
                    }
                  >
                    آخر {trendDays} أيام
                  </Text>
                </View>

                <View
                  style={
                    styles.toggleGroup
                  }
                >
                  <Pressable
                    onPress={() =>
                      setTrendDays(
                        7
                      )
                    }
                    style={[
                      styles.toggleButton,

                      trendDays ===
                        7 &&
                        styles.toggleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,

                        trendDays ===
                          7 &&
                          styles.toggleTextActive,
                      ]}
                    >
                      7 أيام
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setTrendDays(
                        30
                      )
                    }
                    style={[
                      styles.toggleButton,

                      trendDays ===
                        30 &&
                        styles.toggleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,

                        trendDays ===
                          30 &&
                          styles.toggleTextActive,
                      ]}
                    >
                      30 يوم
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Dollar Chart */}

              <TrendCard
                title="الإيرادات بالدولار"
                currency="دولار"
                data={
                  trendData
                }
                valueKey="total_usd"
                max={
                  maxTrend
                }
                color={
                  COLOR.primary
                }
                emptyText="لا توجد حركة بالدولار خلال هذه الفترة."
                styles={
                  styles
                }
              />

              {/* SYP Chart */}

              <View
                style={{
                  height:
                    sy(10),
                }}
              />

              <TrendCard
                title="الإيرادات بالسوري"
                currency="سوري"
                data={
                  trendDataSyp
                }
                valueKey="total_syp"
                max={
                  maxTrendSyp
                }
                color={
                  COLOR.syp
                }
                emptyText="لا توجد حركة بالسوري خلال هذه الفترة."
                styles={
                  styles
                }
              />

              {/* ===========================================
                  Commission Transactions
              =========================================== */}

              <SectionHeader
                title="حركات العمولة"
                subtitle="آخر العمليات التي تمت إضافة عمولة منها"
                styles={
                  styles
                }
              />

              {commissionTxs.length ===
              0 ? (
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
                      name="receipt-outline"
                      size={
                        sp(27)
                      }
                      color={
                        COLOR.primary
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    لا توجد عمولات بعد
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    ستظهر حركات العمولة هنا عند وجود عمليات مكتملة.
                  </Text>
                </View>
              ) : (
                commissionTxs
                  .slice(0, 10)
                  .map(
                    (
                      transaction
                    ) => {
                      const sourceName =
                        transaction
                          ?.commission_source_user_name ||
                        "—";

                      const sourceTime =
                        transaction
                          ?.commission_source_created_at ||
                        transaction
                          ?.created_at;

                      const currency =
                        currencyLabel(
                          transaction
                            ?.currency
                        );

                      const status =
                        statusLabel(
                          transaction
                            ?.status
                        );

                      return (
                        <View
                          key={
                            transaction
                              ?.id ||
                            `${transaction?.amount}-${sourceTime}`
                          }
                          style={
                            styles.commissionCard
                          }
                        >
                          {/* Top */}

                          <View
                            style={
                              styles.commissionTop
                            }
                          >
                            <View
                              style={
                                styles.commissionIcon
                              }
                            >
                              <Ionicons
                                name="gift-outline"
                                size={
                                  sp(19)
                                }
                                color={
                                  COLOR.primary
                                }
                              />
                            </View>

                            <View
                              style={
                                styles.commissionInfo
                              }
                            >
                              <Text
                                numberOfLines={
                                  2
                                }
                                style={
                                  styles.commissionTitle
                                }
                              >
                                {getCommissionTitle(
                                  transaction
                                )}
                              </Text>

                              <Text
                                style={
                                  styles.commissionCustomer
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                العميل:{" "}
                                {
                                  sourceName
                                }
                              </Text>
                            </View>

                            <View
                              style={
                                styles.commissionAmountBox
                              }
                            >
                              <Text
                                style={
                                  styles.commissionAmount
                                }
                              >
                                {fmt(
                                  transaction
                                    ?.amount,
                                  2
                                )}
                              </Text>

                              {!!currency && (
                                <Text
                                  style={
                                    styles.commissionCurrency
                                  }
                                >
                                  {currency}
                                </Text>
                              )}
                            </View>
                          </View>

                          <View
                            style={
                              styles.divider
                            }
                          />

                          {/* Bottom */}

                          <View
                            style={
                              styles.commissionBottom
                            }
                          >
                            <View
                              style={[
                                styles.statusBadge,

                                {
                                  backgroundColor:
                                    status.bg,
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusDot,

                                  {
                                    backgroundColor:
                                      status.color,
                                  },
                                ]}
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

                            <View
                              style={
                                styles.dateRow
                              }
                            >
                              <Ionicons
                                name="time-outline"
                                size={
                                  sp(13)
                                }
                                color={
                                  COLOR.muted
                                }
                              />

                              <Text
                                style={
                                  styles.dateText
                                }
                              >
                                {formatDate(
                                  sourceTime
                                )}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    }
                  )
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Section Header
========================================================= */

function SectionHeader({
  title,
  subtitle,
  styles,
}) {
  return (
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
        {title}
      </Text>

      {!!subtitle && (
        <Text
          style={
            styles.sectionSubtitle
          }
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

/* =========================================================
   Financial Card
========================================================= */

function FinancialCard({
  label,
  value,
  icon,
  color,
  background,
  styles,
  sp,
}) {
  return (
    <View
      style={
        styles.financialCard
      }
    >
      <View
        style={[
          styles.financialIcon,

          {
            backgroundColor:
              background,
          },
        ]}
      >
        <Ionicons
          name={
            icon
          }
          size={
            sp(20)
          }
          color={
            color
          }
        />
      </View>

      <View
        style={
          styles.financialInfo
        }
      >
        <Text
          style={
            styles.financialLabel
          }
        >
          {label}
        </Text>

        <Text
          style={[
            styles.financialValue,

            {
              color,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   Money Card
========================================================= */

function MoneyCard({
  title,
  amount,
  currency,
  icon,
  color,
  background,
  styles,
  sp,
}) {
  return (
    <View
      style={
        styles.moneyCard
      }
    >
      <View
        style={[
          styles.moneyIcon,

          {
            backgroundColor:
              background,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={
            sp(20)
          }
          color={
            color
          }
        />
      </View>

      <Text
        style={
          styles.moneyTitle
        }
      >
        {title}
      </Text>

      <View
        style={
          styles.moneyValueRow
        }
      >
        <Text
          style={
            styles.moneyValue
          }
        >
          {amount}
        </Text>

        <Text
          style={[
            styles.moneyCurrency,

            {
              color,
            },
          ]}
        >
          {currency}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   Trend Card
========================================================= */

function TrendCard({
  title,
  currency,
  data,
  valueKey,
  max,
  color,
  emptyText,
  styles,
}) {
  return (
    <View
      style={
        styles.chartCard
      }
    >
      <View
        style={
          styles.chartHeader
        }
      >
        <Text
          style={
            styles.chartTitle
          }
        >
          {title}
        </Text>

        <View
          style={
            styles.chartCurrencyBadge
          }
        >
          <Text
            style={[
              styles.chartCurrencyText,

              {
                color,
              },
            ]}
          >
            {currency}
          </Text>
        </View>
      </View>

      {data.length ===
      0 ? (
        <View
          style={
            styles.chartEmpty
          }
        >
          <Text
            style={
              styles.chartEmptyText
            }
          >
            {emptyText}
          </Text>
        </View>
      ) : (
        <View
          style={
            styles.chartBars
          }
        >
          {data.map(
            (
              item,
              index
            ) => {
              const value =
                Number(
                  item?.[
                    valueKey
                  ]
                ) || 0;

              const height =
                Math.max(
                  6,

                  Math.round(
                    (
                      value /
                      Math.max(
                        max,
                        1
                      )
                    ) *
                      82
                  )
                );

              return (
                <View
                  key={`${item?.date || index}-${index}`}
                  style={
                    styles.barWrap
                  }
                >
                  <View
                    style={[
                      styles.bar,

                      {
                        height,

                        backgroundColor:
                          color,
                      },
                    ]}
                  />
                </View>
              );
            }
          )}
        </View>
      )}
    </View>
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

    scroll: {
      flex: 1,

      backgroundColor:
        COLOR.bg,
    },

    content: {
      width:
        "100%",

      maxWidth:
        MAX_W,

      alignSelf:
        "center",
    },

    spinnerBg: {
      position:
        "absolute",

      top: 0,

      left: 0,

      right: 0,

      height: 0,
    },

    /* =====================================================
       Sections
    ===================================================== */

    sectionHeading: {
      width:
        "100%",

      alignItems:
        "flex-end",

      marginTop:
        sy(8),

      marginBottom:
        sy(11),
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

    summaryGrid: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      flexWrap:
        "wrap",

      gap:
        sx(9),

      marginBottom:
        sy(8),
    },

    financialCard: {
      width:
        "48.5%",

      minHeight:
        sy(86),

      padding:
        sx(11),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(9),

      backgroundColor:
        COLOR.card,

      borderWidth: 1,

      borderColor:
        COLOR.line,

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

      elevation: 1,
    },

    financialIcon: {
      width:
        sx(40),

      height:
        sx(40),

      borderRadius:
        sx(12),

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    financialInfo: {
      flex: 1,

      minWidth: 0,

      alignItems:
        "flex-end",
    },

    financialLabel: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontSize:
        sp(10.5),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    financialValue: {
      width:
        "100%",

      marginTop:
        sy(3),

      fontSize:
        sp(18),

      fontWeight:
        "900",

      textAlign:
        "right",
    },

    /* =====================================================
       Money Cards
    ===================================================== */

    currencyGrid: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      flexWrap:
        "wrap",

      gap:
        sx(9),

      marginBottom:
        sy(8),
    },

    moneyCard: {
      width:
        "48.5%",

      minHeight:
        sy(125),

      padding:
        sx(13),

      alignItems:
        "flex-end",

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

    moneyIcon: {
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

    moneyTitle: {
      width:
        "100%",

      marginTop:
        sy(9),

      color:
        COLOR.muted,

      fontSize:
        sp(10.5),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    moneyValueRow: {
      width:
        "100%",

      marginTop:
        sy(4),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "flex-start",

      gap:
        sx(5),
    },

    moneyValue: {
      color:
        COLOR.text,

      fontSize:
        sp(18),

      fontWeight:
        "900",
    },

    moneyCurrency: {
      fontSize:
        sp(10.5),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Trend Header
    ===================================================== */

    trendHeading: {
      width:
        "100%",

      marginTop:
        sy(12),

      marginBottom:
        sy(10),

      flexDirection:
        "row-reverse",

      alignItems:
        "flex-end",

      justifyContent:
        "space-between",

      gap:
        sx(10),
    },

    trendTitleBox: {
      flex: 1,

      minWidth:
        0,

      alignItems:
        "flex-end",
    },

    toggleGroup: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(5),
    },

    toggleButton: {
      minHeight:
        sy(34),

      paddingHorizontal:
        sx(9),

      alignItems:
        "center",

      justifyContent:
        "center",

      borderRadius:
        sx(10),

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      backgroundColor:
        COLOR.card,
    },

    toggleButtonActive: {
      backgroundColor:
        COLOR.primarySoft,

      borderColor:
        "#CFE1FF",
    },

    toggleText: {
      color:
        COLOR.muted,

      fontSize:
        sp(10.5),

      fontWeight:
        "800",

      writingDirection:
        "rtl",
    },

    toggleTextActive: {
      color:
        COLOR.primary,

      fontWeight:
        "900",
    },

    /* =====================================================
       Chart
    ===================================================== */

    chartCard: {
      width:
        "100%",

      minHeight:
        sy(145),

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

    chartHeader: {
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

    chartTitle: {
      flex: 1,

      color:
        COLOR.text,

      fontSize:
        sp(13),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    chartCurrencyBadge: {
      paddingHorizontal:
        sx(8),

      paddingVertical:
        sy(4),

      borderRadius:
        999,

      backgroundColor:
        COLOR.bg,
    },

    chartCurrencyText: {
      fontSize:
        sp(10),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    chartBars: {
      height:
        sy(92),

      width:
        "100%",

      marginTop:
        sy(12),

      flexDirection:
        "row-reverse",

      alignItems:
        "flex-end",

      justifyContent:
        "space-between",

      gap:
        sx(3),
    },

    barWrap: {
      flex: 1,

      height:
        "100%",

      alignItems:
        "center",

      justifyContent:
        "flex-end",

      minWidth:
        2,
    },

    bar: {
      width:
        "65%",

      maxWidth:
        sx(9),

      minWidth:
        sx(3),

      borderRadius:
        sx(5),
    },

    chartEmpty: {
      height:
        sy(92),

      marginTop:
        sy(10),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#FAFBFD",

      borderRadius:
        sx(12),
    },

    chartEmptyText: {
      color:
        COLOR.muted,

      fontSize:
        sp(11),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Commission
    ===================================================== */

    commissionCard: {
      width:
        "100%",

      marginBottom:
        sy(10),

      padding:
        sx(13),

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

    commissionTop: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(10),
    },

    commissionIcon: {
      width:
        sx(42),

      height:
        sx(42),

      borderRadius:
        sx(13),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    commissionInfo: {
      flex: 1,

      minWidth:
        0,

      alignItems:
        "flex-end",
    },

    commissionTitle: {
      width:
        "100%",

      color:
        COLOR.text,

      fontSize:
        sp(13),

      lineHeight:
        sp(19),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    commissionCustomer: {
      width:
        "100%",

      marginTop:
        sy(3),

      color:
        COLOR.muted,

      fontSize:
        sp(10.5),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    commissionAmountBox: {
      flexShrink:
        0,

      alignItems:
        "flex-start",
    },

    commissionAmount: {
      color:
        COLOR.text,

      fontSize:
        sp(14),

      fontWeight:
        "900",
    },

    commissionCurrency: {
      marginTop:
        sy(1),

      color:
        COLOR.primary,

      fontSize:
        sp(9.5),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    divider: {
      width:
        "100%",

      height:
        StyleSheet.hairlineWidth,

      marginVertical:
        sy(10),

      backgroundColor:
        COLOR.line,
    },

    commissionBottom: {
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

    statusBadge: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(4),

      paddingHorizontal:
        sx(8),

      paddingVertical:
        sy(4),

      borderRadius:
        sx(10),
    },

    statusDot: {
      width:
        sx(6),

      height:
        sx(6),

      borderRadius:
        sx(3),
    },

    statusText: {
      fontSize:
        sp(9.5),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    dateRow: {
      flex:
        1,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "flex-start",

      gap:
        sx(4),
    },

    dateText: {
      flexShrink:
        1,

      color:
        COLOR.muted,

      fontSize:
        sp(9.5),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Empty
    ===================================================== */

    emptyCard: {
      width:
        "100%",

      paddingVertical:
        sy(34),

      paddingHorizontal:
        sx(18),

      alignItems:
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

    emptyIcon: {
      width:
        sx(56),

      height:
        sx(56),

      borderRadius:
        sx(18),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    emptyTitle: {
      marginTop:
        sy(11),

      color:
        COLOR.text,

      fontSize:
        sp(14),

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
        COLOR.muted,

      fontSize:
        sp(11.5),

      lineHeight:
        sp(18),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Loading / Error
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
        COLOR.muted,

      fontSize:
        sp(12),

      fontWeight:
        "700",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    stateContainer: {
      flex: 1,

      width:
        "100%",

      maxWidth:
        MAX_W,

      alignSelf:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        sx(14),

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
    },

    stateTitle: {
      marginTop:
        sy(11),

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
        sx(5),

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
  });
}