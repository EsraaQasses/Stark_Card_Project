// src/screens/MyFinancial.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  I18nManager,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import PageLayout from "../ui/PageLayout";
import { useAuth } from "../context/AuthProvider";
import { getAgentFinancialSummary, getTransactions } from "../api/transactions";
import { getWallet } from "../api/wallets";

const BASE_W = 390, BASE_H = 844;

const COLOR = {
  primary: "#0B63D8",
  primaryDark: "#073A8C",
  primarySoft: "#E6F0FF",
  accent: "#22D3EE",
  text: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  card: "#FFFFFF",
  bg: "#F6F8FC",
  success: "#16A34A",
  warning: "#F59E0B",
};

const fmt = (n, digits = 2) => {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(digits);
};

export default function MyFinancial({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const sx = (n) => (W / BASE_W) * n;
  const sy = (n) => (H / BASE_H) * n;
  const isRTL = I18nManager.isRTL;
  const dirRow = isRTL ? "row-reverse" : "row";

  const [data, setData] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [commissionTxs, setCommissionTxs] = useState([]);

  const walletSummary = user?.wallet_summary || user?.balances || {};

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getAgentFinancialSummary();
      if (!res.ok) {
        console.log("[MyFinancial] load failed", {
          status: res.status,
          error: res.error,
          raw: res.raw,
        });
        throw new Error(res.error || "Failed");
      }
      setData(res.data || {});
      try {
        const w = await getWallet();
        setWalletData(w);
      } catch {}
      const txRes = await getTransactions({ transaction_type: "deposit", page_size: 50 });
      if (txRes.ok) {
        const filtered = (txRes.data || []).filter((t) => {
          const note = (t?.note || "").toString().toLowerCase();
          return note.includes("عمولة") || note.includes("commission");
        });
        setCommissionTxs(filtered);
      } else {
        setCommissionTxs([]);
      }
    } catch (e) {
      setError("تعذّر تحميل الملخص المالي. تأكد من تسجيل الدخول كوكيل.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const NAV_HEIGHT = sy(64);
  const contentPadBottom = NAV_HEIGHT + insets.bottom + sy(16);

  const totals = useMemo(() => {
    const d = data || {};
    return {
      revenueUsd: d.total_revenue_usd,
      revenueSyp: d.total_revenue_syp,
      txCount: d.transactions_count,
      avgPct: d.average_profit_percentage,
      commissionUsd: d.commission_by_currency?.USD ?? d.estimated_commission_usd,
      commissionSyp: d.commission_by_currency?.SYP ?? d.estimated_commission_syp,
      totalEarningsUsd: d.total_earnings_by_currency?.USD ?? d.total_earnings_usd,
      totalEarningsSyp: d.total_earnings_by_currency?.SYP ?? d.total_earnings_syp,
      commissionRate: d.commission_rate,
      trend7: Array.isArray(d.trend_7d) ? d.trend_7d : [],
      trend30: Array.isArray(d.trend_30d) ? d.trend_30d : [],
      trend7Syp: Array.isArray(d.trend_7d_syp) ? d.trend_7d_syp : [],
      trend30Syp: Array.isArray(d.trend_30d_syp) ? d.trend_30d_syp : [],
    };
  }, [data]);

  const usdAvail =
    walletData?.USD?.available ??
    walletData?.USD?.available_balance ??
    walletData?.totals?.usd ??
    walletSummary?.available_usd ??
    walletSummary?.USD ??
    walletSummary?.usd ??
    0;
  const sypAvail =
    walletData?.SYP?.available ??
    walletData?.SYP?.available_balance ??
    walletData?.totals?.syp ??
    walletSummary?.available_syp ??
    walletSummary?.SYP ??
    walletSummary?.syp ??
    0;

  const [trendDays, setTrendDays] = useState(7);
  const trendData = trendDays === 7 ? totals.trend7 : totals.trend30;
  const maxTrend = Math.max(1, ...trendData.map((x) => Number(x.total_usd) || 0));
  const trendDataSyp = trendDays === 7 ? totals.trend7Syp : totals.trend30Syp;
  const maxTrendSyp = Math.max(1, ...trendDataSyp.map((x) => Number(x.total_syp) || 0));

  const commissionTotals = useMemo(() => {
    let usd = 0;
    let syp = 0;
    for (const t of commissionTxs) {
      const amt = Number(t?.amount || 0);
      const cur = (t?.currency || "").toString().toUpperCase();
      if (cur === "USD") usd += amt;
      if (cur === "SYP") syp += amt;
    }
    return { usd, syp };
  }, [commissionTxs]);

  return (
    <PageLayout navigation={navigation} active="menu" withSideMenu>
      <ScrollView
        style={{ flex: 1, backgroundColor: COLOR.bg }}
        contentContainerStyle={{ paddingTop: insets.top + sy(12), paddingBottom: contentPadBottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: sx(16) }}>
          <LinearGradient
            colors={[COLOR.primary, COLOR.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { borderRadius: sx(20), paddingVertical: sy(18), paddingHorizontal: sx(18) }]}
          >
            <View style={[styles.headerRow, { flexDirection: dirRow }]}>
              <View style={[styles.headerIcon, { marginEnd: isRTL ? 0 : sx(10), marginStart: isRTL ? sx(10) : 0 }]}>
                <Ionicons name="stats-chart-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { textAlign: isRTL ? "right" : "left" }]}>ملخصي المالي</Text>
                <Text style={[styles.headerSub, { textAlign: isRTL ? "right" : "left" }]}>
                  نظرة شاملة على أرباحك ومعاملات عملائك.
                </Text>
              </View>
            </View>
            <View style={[styles.headerStats, { flexDirection: dirRow }]}>
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>المعاملات</Text>
                <Text style={styles.statValue}>{totals.txCount ?? 0}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>متوسط الربح</Text>
                <Text style={styles.statValue}>{fmt(totals.avgPct, 2)}%</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>عمولة تقديرية</Text>
                <Text style={styles.statValue}>{fmt(totals.commissionSyp, 2)} SYP</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={{ paddingHorizontal: sx(16), marginTop: sy(14) }}>
          {loading ? (
            <View style={{ paddingVertical: sy(24), alignItems: "center" }}>
              <ActivityIndicator color={COLOR.primary} />
              <Text style={{ marginTop: sy(8), color: COLOR.muted }}>جاري التحميل...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{error}</Text>
              <Text style={styles.emptySub}>اسحب للأسفل لإعادة المحاولة.</Text>
            </View>
          ) : (
            <>
              <View style={[styles.sectionTitleRow, { flexDirection: dirRow }]}>
                <Text style={styles.sectionTitle}>الإيرادات</Text>
              </View>
              <View style={[styles.gridRow, { flexDirection: dirRow }]}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>إجمالي USD</Text>
                  <Text style={styles.kpiValue}>{fmt(totals.revenueUsd, 2)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>إجمالي SYP</Text>
                  <Text style={styles.kpiValue}>{fmt(totals.revenueSyp, 2)}</Text>
                </View>
              </View>

              <View style={[styles.sectionTitleRow, { flexDirection: dirRow }]}>
                <Text style={styles.sectionTitle}>محفظتي</Text>
              </View>
              <View style={[styles.walletCard, { flexDirection: dirRow }]}>
                <View style={styles.walletItem}>
                  <Text style={styles.walletLabel}>USD المتاح</Text>
                  <Text style={styles.walletValue}>{fmt(usdAvail, 2)}</Text>
                </View>
                <View style={styles.walletItem}>
                  <Text style={styles.walletLabel}>SYP المتاح</Text>
                  <Text style={styles.walletValue}>{fmt(sypAvail, 2)}</Text>
                </View>
              </View>

              <View style={[styles.sectionTitleRow, { flexDirection: dirRow }]}>
                <Text style={styles.sectionTitle}>أرباحي</Text>
              </View>
              <View style={[styles.gridRow, { flexDirection: dirRow }]}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>إجمالي الأرباح (USD)</Text>
                  <Text style={styles.kpiValue}>{fmt(totals.totalEarningsUsd, 2)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>نسبة العمولة</Text>
                  <Text style={styles.kpiValue}>{fmt(totals.commissionRate, 2)}%</Text>
                </View>
              </View>
              <View style={[styles.gridRow, { flexDirection: dirRow, marginTop: 10 }]}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>عمولة USD</Text>
                  <Text style={styles.kpiValue}>{fmt(totals.commissionUsd ?? commissionTotals.usd, 2)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>عمولة SYP</Text>
                  <Text style={styles.kpiValue}>{fmt(totals.commissionSyp ?? commissionTotals.syp, 2)}</Text>
                </View>
              </View>
              <View style={[styles.gridRow, { flexDirection: dirRow, marginTop: 10 }]}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>إجمالي الأرباح (SYP)</Text>
                  <Text style={styles.kpiValue}>{fmt(totals.totalEarningsSyp, 2)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>إجمالي الأرباح (USD)</Text>
                  <Text style={styles.kpiValue}>{fmt(totals.totalEarningsUsd, 2)}</Text>
                </View>
              </View>

              <View style={[styles.sectionTitleRow, { flexDirection: dirRow }]}>
                <Text style={styles.sectionTitle}>اتجاه آخر {trendDays} يوم</Text>
              </View>
              <View style={styles.chartCard}>
                <View style={[styles.chartToggleRow, { flexDirection: dirRow }]}>
                  <Text style={styles.chartHint}>إجمالي USD</Text>
                  <View style={[styles.toggleGroup, { flexDirection: dirRow }]}>
                    <Text
                      style={[styles.toggleBtn, trendDays === 7 && styles.toggleBtnActive]}
                      onPress={() => setTrendDays(7)}
                    >
                      7 أيام
                    </Text>
                    <Text
                      style={[styles.toggleBtn, trendDays === 30 && styles.toggleBtnActive]}
                      onPress={() => setTrendDays(30)}
                    >
                      30 يوم
                    </Text>
                  </View>
                </View>
                <View style={[styles.chartBars, { flexDirection: dirRow }]}>
                  {trendData.map((d, idx) => {
                    const v = Number(d.total_usd) || 0;
                    const h = Math.max(6, Math.round((v / maxTrend) * 80));
                    return (
                      <View key={`${d.date}-${idx}`} style={styles.barWrap}>
                        <View style={[styles.bar, { height: h }]} />
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={[styles.chartCard, { marginTop: 12 }]}>
                <View style={[styles.chartToggleRow, { flexDirection: dirRow }]}>
                  <Text style={styles.chartHint}>إجمالي SYP</Text>
                </View>
                <View style={[styles.chartBars, { flexDirection: dirRow }]}>
                  {trendDataSyp.map((d, idx) => {
                    const v = Number(d.total_syp) || 0;
                    const h = Math.max(6, Math.round((v / maxTrendSyp) * 80));
                    return (
                      <View key={`${d.date}-${idx}`} style={styles.barWrap}>
                        <View style={[styles.bar, { height: h, backgroundColor: COLOR.accent }]} />
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.sectionTitleRow, { flexDirection: dirRow }]}>
                <Text style={styles.sectionTitle}>حركات العمولة</Text>
              </View>
              {commissionTxs.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>لا توجد عمولات بعد</Text>
                  <Text style={styles.emptySub}>ستظهر عند وجود عمليات مكتملة.</Text>
                </View>
              ) : (
                commissionTxs.slice(0, 10).map((t) => {
                  const srcName = t?.commission_source_user_name;
                  const srcProduct = t?.commission_source_product_name;
                  const srcNote = t?.commission_source_note;
                  const srcTime = t?.commission_source_created_at || t?.created_at;
                  const timeText = srcTime ? new Date(srcTime).toLocaleString() : "—";
                  return (
                  <View key={t.id || `${t.note}-${t.amount}`} style={styles.categoryCard}>
                    <View style={[styles.categoryTop, { flexDirection: dirRow }]}>
                      <Text style={styles.categoryName}>{srcProduct || srcNote || t.note || "عمولة"}</Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {fmt(t.amount, 2)} {t.currency || ""}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.categoryRow, { flexDirection: dirRow }]}>
                      <Text style={styles.categoryMeta}>العميل</Text>
                      <Text style={styles.categoryVal}>{srcName || "—"}</Text>
                    </View>
                    <View style={[styles.categoryRow, { flexDirection: dirRow }]}>
                      <Text style={styles.categoryMeta}>الوقت</Text>
                      <Text style={styles.categoryVal}>{timeText}</Text>
                    </View>
                    <View style={[styles.categoryRow, { flexDirection: dirRow }]}>
                      <Text style={styles.categoryMeta}>الحالة</Text>
                      <Text style={styles.categoryVal}>{t.status || "—"}</Text>
                    </View>
                  </View>
                );
                })
              )}

              
            </>
          )}
        </View>
      </ScrollView>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  headerRow: { alignItems: "center", gap: 10 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#FFFFFF" },
  headerSub: { marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.8)" },
  headerStats: {
    marginTop: 12,
    gap: 10,
  },
  statPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  statValue: { color: "#FFFFFF", fontWeight: "800", marginTop: 4 },
  sectionTitleRow: { alignItems: "center", marginTop: 16, marginBottom: 8 },
  sectionTitle: { color: COLOR.text, fontWeight: "800", fontSize: 14 },
  gridRow: { gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLOR.card,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 14,
    padding: 12,
  },
  kpiLabel: { color: COLOR.muted, fontSize: 11 },
  kpiValue: { color: COLOR.text, fontWeight: "900", fontSize: 16, marginTop: 6 },
  walletCard: {
    backgroundColor: COLOR.card,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  walletItem: { flex: 1 },
  walletLabel: { color: COLOR.muted, fontSize: 11 },
  walletValue: { color: COLOR.text, fontWeight: "900", fontSize: 16, marginTop: 6 },
  categoryCard: {
    backgroundColor: COLOR.card,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: COLOR.card,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 16,
    padding: 14,
  },
  chartToggleRow: { alignItems: "center", justifyContent: "space-between", gap: 10 },
  chartHint: { color: COLOR.muted, fontSize: 12 },
  toggleGroup: { gap: 6 },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLOR.line,
    color: COLOR.muted,
    fontSize: 12,
  },
  toggleBtnActive: {
    borderColor: COLOR.primary,
    color: COLOR.primary,
    backgroundColor: COLOR.primarySoft,
    fontWeight: "800",
  },
  chartBars: { alignItems: "flex-end", gap: 6, marginTop: 12 },
  barWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: {
    width: 8,
    borderRadius: 6,
    backgroundColor: COLOR.primary,
  },
  categoryTop: { alignItems: "center", justifyContent: "space-between", gap: 8 },
  categoryName: { color: COLOR.text, fontWeight: "800", fontSize: 15 },
  categoryBadge: {
    backgroundColor: COLOR.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryBadgeText: { color: COLOR.primary, fontWeight: "800", fontSize: 11 },
  categoryRow: { alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  categoryMeta: { color: COLOR.muted, fontSize: 12 },
  categoryVal: { color: COLOR.text, fontWeight: "700" },
  emptyBox: {
    backgroundColor: COLOR.card,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  emptyTitle: { color: COLOR.text, fontWeight: "800" },
  emptySub: { color: COLOR.muted, marginTop: 6, fontSize: 12, textAlign: "center" },
});
