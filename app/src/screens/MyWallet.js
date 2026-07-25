// src/screens/MyWallet.js (backend-aligned: no wallet_id usage)
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useState } from "react";
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

import {
  normalizeWalletsResponse
} from "../api/wallets";
import { changeUserCurrencyNormalized } from "../features/wallet/api/walletApi";

import { useTranslation } from "react-i18next";
import {
  getPreferredWalletCurrency,
  selectCurrencyWallets,
} from "../features/wallet/model/walletSummary";
import { useWalletData } from "../features/wallet/hooks/useWalletData";
import {
  formatWalletDecimal,
  formatWalletInteger,
  pickWalletAmount,
} from "../features/wallet/utils/walletFormatting";
import CornerSpinner from "../ui/CornerSpinner";
import PageLayout from "../ui/PageLayout"; // ✅ الغلاف الموحّد (BottomNav + SideMenu)

/* =============================
 * Constants
 * ============================= */
const BASE_W = 390,
  BASE_H = 844;
const COLOR = {
  primary: "#0B63D8",
  text: "#0E1B3B",
  muted: "#7C8DA6",
  bg: "#FFFFFF",
  bgSoft: "#F5F8FC",
  line: "#E4ECF2",
  chip: "#E6F6FF",
  success: "#00BA00",
  danger: "#DB0004",
  violet: "#9C03B7",
  indigo: "#3D42D9",
};

/* Enable LayoutAnimation on Android */
const isNewArch = !!globalThis.__turboModuleProxy;
if (
  Platform.OS === "android" &&
  !isNewArch &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* =============================
 * Small atoms
 * ============================= */
const StatCard = React.memo(function StatCard({ sx, sy, title, value, gradient, icon }) {
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.stat, { borderRadius: sx(16) }]}
    >
      <View
        style={{
          position: "absolute",
          top: sy(10),
          right: sx(10),
          opacity: 0.8,
        }}
      >
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </LinearGradient>
  );
});

const Pill = React.memo(function Pill({ label, value, tint }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: COLOR.line,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }}
      />
      <Text style={{ color: COLOR.text, fontWeight: "800" }}>
        {label}: <Text style={{ color: tint }}>{value ?? 0}</Text>
      </Text>
    </View>
  );
});

/* =============================
 * Main Component
 * ============================= */
export default function MyWallet({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const sx = useCallback((n) => (W / BASE_W) * n, [W]);
  const sy = useCallback((n) => (H / BASE_H) * n, [H]);
  const sp = useCallback(
    (n) => n * Math.min(W / BASE_W, H / BASE_H),
    [W, H]
  );

  const NAV_HEIGHT = useMemo(() => sy(64), [sy]);
  const headerTop = useMemo(() => insets.top + sy(22), [insets.top, sy]);
  const contentPadBottom = useMemo(
    () => NAV_HEIGHT + insets.bottom + sy(12),
    [NAV_HEIGHT, insets.bottom, sy]
  );
  const scrollContentStyle = useMemo(
    () => ({
      paddingBottom: contentPadBottom,
      paddingHorizontal: 14,
    }),
    [contentPadBottom]
  );

  // ====== الحالة ======
  const [active, setActive] = useState("all");
  const {
    depositSummary,
    error,
    loading,
    refreshWalletData,
    refreshing,
    reloadWalletData,
    setWallet,
    wallet,
  } = useWalletData({ loadErrorMessage: t("wallet.errors.load") });

  const preferredCurrency = useMemo(() => {
    // ✅ تطابق مع الباك: الباك يرجّع currency_preference
    return getPreferredWalletCurrency(wallet);
  }, [wallet]);

  // ====== جلب البيانات ======
  useFocusEffect(
    useCallback(() => {
      reloadWalletData();
      const intervalId = setInterval(reloadWalletData, 15000);
      return () => clearInterval(intervalId);
    }, [reloadWalletData])
  );

  const onChangeCurrency = useCallback(async (currency) => {
    try {
      const prev = wallet || {};
      // ✅ خليك مطابق للباك: currency_preference
      const optimistic = { ...prev, currency_preference: currency };
      setWallet(optimistic);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      const currencyResult = await changeUserCurrencyNormalized(currency);
      if (!currencyResult.ok) throw currencyResult.error;
      const res = currencyResult.data;
      if (res?.currency_preference) {
        setWallet((wPrev) => ({
          ...(wPrev || {}),
          currency_preference: res.currency_preference,
        }));
      }

      await reloadWalletData();

      Alert.alert(
        t("wallet.alerts.currencyChanged.title"),
        t("wallet.alerts.currencyChanged.body", { currency })
      );
    } catch {
      await reloadWalletData();
      Alert.alert(t("common.networkError"), t("wallet.errors.changeCurrency"));
    }
  }, [reloadWalletData, setWallet, t, wallet]);

  // ====== استنتاج المحافظ (بدون IDs) ======
  const { walletUSDObj, walletSYPObj } = useMemo(() => {
    const list = normalizeWalletsResponse(wallet);
    return selectCurrencyWallets(wallet, list);
  }, [wallet]);

  // ====== كروت الإحصائيات ======
  const stats = useMemo(() => {
    if (!wallet) return [];
    return [
      {
        key: "total_usd",
        title: t("wallet.totals.usd"),
        value: formatWalletDecimal(wallet?.totals?.usd ?? pickWalletAmount(walletUSDObj)),
        gradient: ["#22C55E", "#16A34A"],
        icon: "cash-outline",
      },
      {
        key: "total_syp",
        title: t("wallet.totals.syp"),
        value: formatWalletInteger(wallet?.totals?.syp ?? pickWalletAmount(walletSYPObj)),
        gradient: ["#EF4444", "#DC2626"],
        icon: "wallet-outline",
      },
      {
        key: "usd_balance",
        title: t("wallet.balances.usd"),
        value: formatWalletDecimal(pickWalletAmount(walletUSDObj)),
        gradient: ["#8B5CF6", "#7C3AED"],
        icon: "logo-usd",
      },
      {
        key: "syp_balance",
        title: t("wallet.balances.syp"),
        value: formatWalletInteger(pickWalletAmount(walletSYPObj)),
        gradient: ["#3B82F6", "#2563EB"],
        icon: "card-outline",
      },
    ];
  }, [wallet, walletUSDObj, walletSYPObj, t]);

  const topStats = useMemo(() => stats.slice(0, 2), [stats]);
  const bottomStats = useMemo(() => stats.slice(2, 4), [stats]);

  const currencyOptions = useMemo(
    () => [
      { key: "USD", label: t("currency.usd") },
      { key: "SYP", label: t("currency.SYP") },
    ],
    [t]
  );

  const categories = useMemo(
    () => [
      { key: "all", label: t("common.all"), count: 0, color: COLOR.success },
      { key: "orders", label: t("wallet.categories.orders"), count: 0, color: COLOR.danger },
      { key: "charging", label: t("wallet.categories.charging"), count: 0, color: COLOR.indigo },
    ],
    [t]
  );

  const handleCategoryPress = useCallback((key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActive(key);
  }, []);

  const totalLine = useMemo(
    () =>
      t("wallet.totalLine", {
        usd: formatWalletDecimal(wallet?.totals?.usd ?? pickWalletAmount(walletUSDObj)),
        syp: formatWalletInteger(wallet?.totals?.syp ?? pickWalletAmount(walletSYPObj)),
      }),
    [t, wallet, walletSYPObj, walletUSDObj]
  );

  return (
    <PageLayout navigation={navigation} active="wallet" withSideMenu={true}>
      {/* خلفية سبينر شكلية */}
      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>

      {/* ==== Loading / Error ==== */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ color: COLOR.muted, marginTop: 10 }}>
            {t("common.loading")}
          </Text>
        </View>
      ) : error ? (
        <View style={[styles.center, { paddingHorizontal: 14 }]}>
          <Text style={{ color: COLOR.text, textAlign: "center", lineHeight: 20 }}>
            {error}
          </Text>
          <Pressable
            onPress={refreshWalletData}
            style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 10 }}
          >
            <Text style={{ color: COLOR.primary, fontWeight: "800" }}>
              {t("common.tryAgain")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={scrollContentStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshWalletData}
              tintColor={COLOR.primary}
            />
          }
        >
          {/* Header */}
          <View
            style={{
              paddingTop: headerTop,
              paddingBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: sp(26),
                  fontWeight: "900",
                  color: "#000A52",
                }}
              >
                {t("wallet.title")}
              </Text>
              <Text style={{ color: COLOR.muted, marginTop: 4, fontSize: sp(12) }}>
                {t("wallet.lastRefreshHint")}
              </Text>
            </View>

            {/* ✅ تطابق مع الباك: التبديل يحدّث currency_preference */}
            <View style={styles.segmentWrap}>
              {currencyOptions.map((option, idx) => (
                <Pressable
                  key={option.key}
                  onPress={() => onChangeCurrency(option.key)}
                  style={({ pressed }) => [
                    styles.segmentBtn,
                    idx === 0 ? styles.segmentLeft : null,
                    preferredCurrency === option.key && styles.segmentActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      preferredCurrency === option.key && styles.segmentTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Stat cards (2 x 2) */}
          <View style={{ rowGap: 14, marginTop: 8 }}>
            <View style={{ flexDirection: "row", columnGap: 12 }}>
              {topStats.map((s) => (
                <StatCard
                  key={s.key}
                  sx={sx}
                  sy={sy}
                  title={s.title}
                  value={s.value}
                  gradient={s.gradient}
                  icon={s.icon}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", columnGap: 12 }}>
              {bottomStats.map((s) => (
                <StatCard
                  key={s.key}
                  sx={sx}
                  sy={sy}
                  title={s.title}
                  value={s.value}
                  gradient={s.gradient}
                  icon={s.icon}
                />
              ))}
            </View>
          </View>

          {/* ===== Deposits Summary ===== */}
          {depositSummary && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
              }}
            >
              <Pill label={t("wallet.deposits.total", "الإجمالي")} value={depositSummary.total_count} tint="#334155" />
              <Pill label={t("wallet.deposits.pending", "بانتظار")} value={depositSummary.pending_count} tint="#ca8a04" />
              <Pill label={t("wallet.deposits.approved", "مقبول")} value={depositSummary.approved_count} tint="#16a34a" />
              <Pill label={t("wallet.deposits.rejected", "مرفوض")} value={depositSummary.rejected_count} tint="#dc2626" />
            </View>
          )}

          {/* Categories (كما هي) */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: 14,
              gap: 8,
            }}
          >
            {categories.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => handleCategoryPress(c.key)}
              >
                <View
                  style={[
                    styles.catChip,
                    active === c.key && { backgroundColor: COLOR.chip, borderColor: "#BFDFFF" },
                  ]}
                >
                  <Text style={{ fontSize: 12, color: COLOR.text, fontWeight: "700" }}>{c.label}</Text>
                  <View style={[styles.countBadge, { backgroundColor: c.color }]}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10 }}>{c.count}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Total pill */}
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <View style={styles.totalPill}>
              <Text style={{ fontWeight: "800", color: COLOR.text }}>
                {totalLine}
              </Text>
            </View>
          </View>

          {/* Empty Transactions state */}
          <View style={styles.emptyBox}>
            <Ionicons name="list-circle-outline" size={30} color={COLOR.muted} />
            <Text style={{ color: COLOR.muted, marginTop: 8, textAlign: "center" }}>
              {t("wallet.empty.body")}
            </Text>
          </View>
        </ScrollView>
      )}
    </PageLayout>
  );
}

/* =============================
 * Styles
 * ============================= */
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  stat: {
    flex: 1,
    height: 124,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  statTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    opacity: 0.9,
  },
  statValue: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
    marginTop: 6,
  },

  catChip: {
    backgroundColor: "#EFEFEF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },

  totalPill: {
    backgroundColor: "#EEF5FF",
    borderWidth: 1,
    borderColor: "#D7E7FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  segmentWrap: {
    flexDirection: "row",
    backgroundColor: COLOR.bgSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.line,
    overflow: "hidden",
  },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  segmentLeft: { borderRightWidth: 1, borderRightColor: COLOR.line },
  segmentActive: { backgroundColor: "#FFFFFF" },
  segmentText: { fontWeight: "800", color: COLOR.muted },
  segmentTextActive: { color: COLOR.text },

  emptyBox: {
    marginTop: 18,
    alignItems: "center",
    paddingVertical: 18,
    backgroundColor: COLOR.bgSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLOR.line,
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
