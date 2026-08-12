// src/screens/transactions/TransactionsList.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  I18nManager,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screenn from "../../ui/Screenn";
import { getTransactions } from "../../api/transactions";
import { cancelCashout } from "../../api/agent";
import { getCache, setCache, cacheKey } from "../../utils/cache";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  bg: "#F7FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  primary: "#0B63D8",
  success: "#16A34A",
  warning: "#CA8A04",
  danger: "#DC2626",
  info: "#2563EB",
};

const TYPE_FILTERS = [
  { key: "all", label: "الكل" },
  { key: "deposit", label: "إيداع" },
  { key: "transfer", label: "تحويل" },
  { key: "purchase", label: "شراء" },
  { key: "cashout", label: "سحب" },
];

const STATUS_FILTERS = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "قيد الانتظار" },
  { key: "approved", label: "تمت الموافقة" },
  { key: "rejected", label: "مرفوض" },
  { key: "failed", label: "فشل" },
  { key: "cancelled", label: "أُلغي" },
];

const PAGE_SIZE = 20;

export default function TransactionsList({ navigation }) {
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);

  const load = useCallback(
    async ({ reset = false, pageOverride } = {}) => {
      if (reset) setError("");
      const currentPage = reset ? 1 : pageOverride ?? 1;
      try {
        if (reset) setLoading(true);
        const params = {
          page: currentPage,
          page_size: PAGE_SIZE,
        };
        if (type !== "all") params.transaction_type = type;
        if (status !== "all") params.status = status;

        const cacheK = cacheKey("transactions", type, status, String(currentPage));
        const cached = await getCache(cacheK, 1000 * 60 * 5);
        if (reset && cached && Array.isArray(cached)) {
          setItems(cached);
        }

        const res = await getTransactions(params);
        if (!res?.ok) {
          throw new Error(res?.error || "Failed to load transactions");
        }

        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.raw?.results)
            ? res.raw.results
            : Array.isArray(res?.raw?.data)
              ? res.raw.data
              : [];
        const pagination = res?.pagination || {};
        const total = Number(pagination.count) || list.length;
        const nextExists =
          !!pagination.next ||
          currentPage * PAGE_SIZE < total;

        setHasNext(nextExists);

        if (reset) {
          setItems(list);
          setPage(1);
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((x) => x.id));
            const merged = [...prev];
            for (const it of list) if (!seen.has(it.id)) merged.push(it);
            return merged;
          });
        }
        await setCache(cacheK, list);
      } catch (e) {
        setError(String(e?.message || "Failed to load transactions"));
        const cacheK = cacheKey("transactions", type, status, String(currentPage));
        const cached = await getCache(cacheK);
        if (reset && cached && Array.isArray(cached)) {
          setItems(cached);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [status, type]
  );

  useEffect(() => {
    load({ reset: true });
  }, [type, status, load]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate("Home");
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [navigation])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    load({ reset: true });
  };

  const loadMore = () => {
    if (loadingMore || !hasNext) return;
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    load({ pageOverride: next });
  };

  const onCancelCashout = (id) => {
    if (cancelingId) return;
    Alert.alert("تأكيد الإلغاء", "هل تريد إلغاء طلب السحب المعلق؟", [
      { text: "تراجع", style: "cancel" },
      {
        text: "إلغاء الطلب",
        style: "destructive",
        onPress: async () => {
          setCancelingId(id);
          try {
            await cancelCashout(id);
            await load({ reset: true });
            Alert.alert("تم", "تم إلغاء طلب السحب.");
          } catch (cancelError) {
            const message = cancelError?.response?.data?.error || cancelError?.message || "تعذر إلغاء طلب السحب.";
            Alert.alert("خطأ", String(message));
          } finally {
            setCancelingId(null);
          }
        },
      },
    ]);
  };

  const summary = useMemo(() => {
    const counts = { total: 0, pending: 0, approved: 0, rejected: 0, failed: 0 };
    for (const it of items || []) {
      counts.total += 1;
      const st = String(it?.status || "").toLowerCase();
      if (st in counts) counts[st] += 1;
    }
    return counts;
  }, [items]);

  return (
    <Screenn>
      <View style={[styles.heroWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.heroBgCircleA} />
        <View style={styles.heroBgCircleB} />
        <View style={[styles.header, isRTL && { alignItems: "flex-end" }]}>
          <View>
            <Text style={[styles.title, isRTL && { textAlign: "right" }]}>المعاملات</Text>
            <Text style={[styles.subtitle, isRTL && { textAlign: "right" }]}>
              تابع كل نشاطاتك في مكان واحد.
            </Text>
          </View>
          <View style={[styles.headerActions, isRTL && { flexDirection: "row-reverse" }]}>
            <QuickAction
              icon="swap-horizontal"
              label="تحويل"
              onPress={() => navigation.navigate("NewTransfer")}
            />
            <QuickAction
              icon="wallet-outline"
              label="سحب"
              onPress={() => navigation.navigate("TakeMoney")}
            />
          </View>
        </View>

        <View style={[styles.summaryCard, isRTL && { flexDirection: "row-reverse" }]}>
          <SummaryPill label="الإجمالي" value={summary.total} tint={COLORS.info} />
          <SummaryPill label="قيد الانتظار" value={summary.pending} tint={COLORS.warning} />
          <SummaryPill label="تمت الموافقة" value={summary.approved} tint={COLORS.success} />
        </View>
      </View>

      <View style={styles.filters}>
        <FilterGroup
          label="النوع"
          options={TYPE_FILTERS}
          value={type}
          onChange={setType}
        />
        <FilterGroup
          label="الحالة"
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
        />
      </View>


      {loading && items.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={({ item }) => (
            <TransactionCard
              item={item}
              onPress={() =>
                navigation.navigate("TransactionDetail", { id: item.id })
              }
              onCancelCashout={onCancelCashout}
              cancelingId={cancelingId}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, isRTL && { textAlign: "right" }]}>
              لا توجد معاملات بعد.
            </Text>
          }
          ListFooterComponent={
            hasNext ? (
              <Pressable
                style={[styles.loadMore, loadingMore && { opacity: 0.7 }]}
                onPress={loadMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loadMoreText}>تحميل المزيد</Text>
                )}
              </Pressable>
            ) : (
              <View style={{ height: 10 }} />
            )
          }
        />
      )}

      {!!error && (
        <Text style={[styles.errorText, isRTL && { textAlign: "right" }]}>{error}</Text>
      )}

    </Screenn>
  );
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {options.map((opt) => {
            const active = value === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => onChange(opt.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function TransactionCard({ item, onPress, onCancelCashout, cancelingId }) {
  const meta = getTypeMeta(item?.transaction_type);
  const statusMeta = getStatusMeta(item?.status);
  const amount = Number(item?.amount || 0);
  const sign = item?.direction === "in" ? "+" : item?.direction === "out" ? "-" : "";
  const currency = item?.currency || "";
  const subline =
    item?.transaction_type === "transfer" && (item?.recipient_name || item?.recipient_phone)
      ? `${item?.direction === "in" ? "من" : "إلى"} ${item?.recipient_name || "مستخدم"}${item?.recipient_phone ? ` • ${item.recipient_phone}` : ""}`
      : item?.note || "";
  const isRTL = I18nManager.isRTL;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.cardHeader, isRTL && { flexDirection: "row-reverse" }]}>
        <View style={[styles.cardLeft, isRTL && { flexDirection: "row-reverse" }]}>
          <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={18} color={meta.color} />
          </View>
          <View>
            <Text style={[styles.typeText, isRTL && { textAlign: "right" }]}>{meta.label}</Text>
            {!!subline && (
              <Text style={[styles.subText, isRTL && { textAlign: "right" }]} numberOfLines={1}>
                {subline}
              </Text>
            )}
          </View>
        </View>
        <View style={{ alignItems: isRTL ? "flex-start" : "flex-end" }}>
          <Text style={styles.amountText}>
            {sign}{amount.toFixed(2)} {currency}
          </Text>
          <StatusPill label={statusMeta.label} tint={statusMeta.tint} />
        </View>
      </View>
      <Text style={[styles.dateText, isRTL && { textAlign: "right" }]}>
        {item?.created_at ? new Date(item.created_at).toLocaleString() : "—"}
      </Text>
      {!!item?.wallet_currency && (
        <Text style={[styles.walletText, isRTL && { textAlign: "right" }]}>
          المحفظة: {String(item.wallet_currency).toUpperCase()}
        </Text>
      )}
      {item?.transaction_type === "cashout" && String(item?.status).toLowerCase() === "pending" && (
        <Pressable disabled={Boolean(cancelingId)} onPress={() => onCancelCashout(item.id)} style={[styles.cancelBtn, cancelingId && { opacity: 0.6 }]}>
          <Text style={styles.cancelTxt}>إلغاء السحب</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function SummaryPill({ label, value, tint }) {
  const isRTL = I18nManager.isRTL;
  return (
    <View style={[styles.summaryPill, isRTL && { flexDirection: "row-reverse" }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={styles.summaryText}>
        {label}: <Text style={{ color: tint }}>{value}</Text>
      </Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }) {
  const isRTL = I18nManager.isRTL;
  return (
    <Pressable onPress={onPress} style={[styles.quickAction, isRTL && { flexDirection: "row-reverse" }]}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function StatusPill({ label, tint }) {
  return (
    <View style={[styles.statusPill, { borderColor: tint, backgroundColor: hexWithAlpha(tint, 0.12) }]}>
      <Text style={{ color: tint, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function getTypeMeta(type) {
  switch (type) {
    case "deposit":
      return { label: "إيداع", icon: "download-outline", color: COLORS.success, bg: "#EAF8EF" };
    case "transfer":
      return { label: "تحويل", icon: "swap-horizontal", color: COLORS.info, bg: "#E8F0FE" };
    case "purchase":
      return { label: "شراء", icon: "cart-outline", color: COLORS.primary, bg: "#E8F4FF" };
    case "cashout":
      return { label: "سحب", icon: "cash-outline", color: COLORS.warning, bg: "#FFF7E6" };
    default:
      return { label: "معاملة", icon: "receipt-outline", color: COLORS.muted, bg: "#F1F5F9" };
  }
}

function getStatusMeta(status) {
  const raw = String(status || "").toLowerCase();
  if (raw === "approved" || raw === "success" || raw === "completed") {
    return { label: "تمت الموافقة", tint: COLORS.success };
  }
  if (raw === "rejected" || raw === "failed") {
    return { label: "فشل", tint: COLORS.danger };
  }
  if (raw === "cancelled" || raw === "canceled") {
    return { label: "أُلغي", tint: COLORS.muted };
  }
  return { label: "قيد الانتظار", tint: COLORS.warning };
}

function hexWithAlpha(hex, alpha) {
  try {
    const a = Math.round(alpha * 255);
    const pad = (n) => n.toString(16).padStart(2, "0");
    return `${hex}${pad(a)}`;
  } catch {
    return hex;
  }
}

const styles = StyleSheet.create({
  heroWrap: {
    backgroundColor: "#F5F9FF",
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#DCE8FF",
    overflow: "hidden",
  },
  heroBgCircleA: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#E6F0FF",
    top: -60,
    right: -40,
  },
  heroBgCircleB: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#ECF4FF",
    bottom: -50,
    left: -30,
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "900", color: COLORS.text },
  subtitle: { marginTop: 4, color: COLORS.muted },
  headerActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#fff",
  },
  quickText: { color: COLORS.primary, fontWeight: "700" },
  summaryCard: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: Platform.OS === "android" ? 1 : 0,
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  summaryText: { color: COLORS.text, fontWeight: "700" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  filters: {
    paddingHorizontal: 16,
    paddingTop: 6,
    backgroundColor: "#F7FAFC",
  },
  label: { color: COLORS.text, fontWeight: "800", marginBottom: 6, textAlign: "right" },
  filterRow: { flexDirection: "row-reverse", gap: 8, paddingBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: "#E8F0FE",
    borderColor: COLORS.primary,
  },
  chipText: { color: COLORS.text, fontWeight: "600" },
  chipTextActive: { color: COLORS.primary },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: Platform.OS === "android" ? 1 : 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardLeft: { flexDirection: "row", gap: 10, flex: 1 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: { color: COLORS.text, fontWeight: "800" },
  subText: { color: COLORS.muted, marginTop: 2 },
  amountText: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  statusPill: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dateText: { marginTop: 8, color: COLORS.muted, fontSize: 12 },
  walletText: { marginTop: 4, color: COLORS.muted, fontSize: 12, fontWeight: "700" },
  cancelBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#FCEDEE",
    borderWidth: 1,
    borderColor: "#F8B4B4",
  },
  cancelTxt: { color: "#B3261E", fontWeight: "700" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "right", marginTop: 40, color: COLORS.muted },
  loadMore: {
    marginTop: 8,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  loadMoreText: { color: "#fff", fontWeight: "800" },
  errorText: { textAlign: "center", color: COLORS.danger, marginBottom: 10 },
});
