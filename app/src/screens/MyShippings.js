// src/screens/MyShippings.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  ScrollView,
  useWindowDimensions,
  I18nManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import Theme from "../ui/Theme";
import { listDepositRequests } from "../api/deposits";
import { useAuth } from "../context/AuthProvider";
import { getCache, setCache, cacheKey } from "../utils/cache";

const { colors: tcolors = {} } = Theme;
const COLORS = {
  card: "#FFFFFF",
  text: tcolors.text || "#0E1B3B",
  textMuted: tcolors.muted || "#64748b",
  line: tcolors.line || "#E4ECF2",
  primary: tcolors.primary || "#1274F5",
  success: "#16a34a",
  pending: "#ca8a04",
  rejected: "#dc2626",
  slate: "#334155",
};

const BASE_W = 390, BASE_H = 844;
const PAGE_SIZE = 12;

export default function MyShippings({ navigation }) {
  const { user } = useAuth();
  const role = String(user?.role || user?.raw?.role || "").toLowerCase();
  const isAgent = role === "agent" || user?.is_agent === true || user?.raw?.is_agent === true;
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const sx = (n) => (W / BASE_W) * n;
  const sy = (n) => (H / BASE_H) * n;
  const sp = (n) => n * Math.min(W / BASE_W, H / BASE_H);
  const isRTL = I18nManager.isRTL;

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const getItemKey = useCallback((it) => {
    const type = String(it?._shipping_type || it?.shipping_type || it?.type || "standard");
    const id = it?.id ?? it?.pk ?? "noid";
    return `${type}:${id}`;
  }, []);

  const fetchPage = useCallback(
    async ({ reset = false, pageOverride } = {}) => {
      try {
        if (reset) setError("");
        const currentPage = reset ? 1 : pageOverride ?? 1;
        const cacheK = cacheKey("shippings", String(currentPage));
        if (reset) {
          const cached = await getCache(cacheK, 1000 * 60 * 5);
          if (cached && Array.isArray(cached)) {
            setItems(cached);
          }
        }
        const params = {
          page: currentPage,
          page_size: PAGE_SIZE,
        };

        const res = await listDepositRequests(params);

        if (!res.ok) throw new Error(res.error || "Failed to load shippings");

        let list = Array.isArray(res.data) ? res.data : [];
        // For agents, hide customer via-agent requests from "My Shippings"
        if (isAgent) {
          list = list.filter((x) => String(x?._shipping_type || "") !== "via_agent");
        }

        const p = res.pagination || {};
        const _hasNext =
          !!p.next ||
          ((p.page || currentPage) * (p.page_size || PAGE_SIZE) < (p.count || list.length));

        setHasNext(_hasNext);
        setSummary(normalizeCounts(buildCounts(list)));

        if (reset) {
          setItems(list);
          setPage(1);
          await setCache(cacheK, list);
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((x) => getItemKey(x)));
            const merged = [...prev];
            for (const it of list) {
              const k = getItemKey(it);
              if (!seen.has(k)) merged.push(it);
            }
            return merged;
          });
        }
      } catch (_e) {
        setError(String(_e?.message || "تعذر تحميل الشحنات."));
        const cacheK = cacheKey("shippings", String(pageOverride ?? 1));
        const cached = await getCache(cacheK);
        if (Array.isArray(cached)) setItems(cached);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [getItemKey, isAgent]
  );

  useEffect(() => {
    setLoading(true);
    fetchPage({ reset: true });
  }, [fetchPage]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchPage({ reset: true });
  };

  const loadMore = () => {
    if (loadingMore || !hasNext) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    fetchPage({ reset: false, pageOverride: next });
  };

  const S = stylesFactory({ sx, sy, sp, isRTL });

  return (
    <PageLayout navigation={navigation} active="menu" withSideMenu={true}>
      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>

      {/* Hero */}
      <View style={{ alignSelf: "center", width: "100%", maxWidth: 480, paddingHorizontal: sx(14) }}>
        <View style={[styles.hero, { marginTop: insets.top + sy(8) }]}>
          <Text style={styles.heroTitle}>شحناتي</Text>
          <Text style={styles.heroSub}>تتبّع طلبات الشحن وحالة كل طلب بسهولة.</Text>
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={[S.center, { paddingTop: sy(20) }]}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => getItemKey(it)}
          contentContainerStyle={{
            paddingHorizontal: sx(14),
            paddingBottom: sy(80) + insets.bottom + sy(12),
            paddingTop: sy(6),
          }}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={{ height: sy(10) }} />}
          renderItem={({ item }) => (
            <ShippingCard item={item} sx={sx} sy={sy} sp={sp} isRTL={isRTL} />
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={S.center}>
                <Text style={S.listEndText}>لا توجد شحنات بعد.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            <View style={{ paddingVertical: sy(12) }}>
              {hasNext ? (
                <Pressable
                  onPress={loadMore}
                  android_ripple={{ color: "#e5e7eb" }}
                  style={[styles.button, loadingMore && { opacity: 0.7 }]}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>تحميل المزيد</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={S.listEndText}>لا توجد نتائج إضافية</Text>
              )}
            </View>
          }
        />
      )}
      {!!error && (
        <View style={[S.center, { paddingHorizontal: sx(18), paddingBottom: sy(18) }]}>
          <Text style={[S.listEndText, { color: COLORS.rejected }]}>{error}</Text>
          <Pressable style={[styles.button, { marginTop: sy(10) }]} onPress={() => fetchPage({ reset: true })}>
            <Text style={styles.buttonText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      )}
    </PageLayout>
  );
}

function ShippingCard({ item, sx, sy, sp, isRTL }) {
  const status = normalizeStatus(item);
  const meta = getStatusMeta(status);
  const title = item?.title || item?.request_type || "شحن رصيد";
  const desc = item?.description || item?.note || "";
  const amount = Number(item?.amount ?? 0);
  const currency = String(item?.currency || "").toUpperCase();
  const created = formatDate(item?.created_at);

  return (
    <View style={[styles.card, { padding: sx(12), borderRadius: 16, borderColor: COLORS.line }]}>
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center" }}>
        <View style={{ flex: 1, paddingRight: isRTL ? 0 : sx(8), paddingLeft: isRTL ? sx(8) : 0 }}>
          <Text numberOfLines={1} style={{ color: COLORS.text, fontSize: sp(16), fontWeight: "800" }}>
            {title}
          </Text>
          {!!created && <Text style={{ color: COLORS.textMuted, marginTop: 2, fontSize: sp(12) }}>{created}</Text>}
        </View>
        <View style={{ alignItems: isRTL ? "flex-start" : "flex-end" }}>
          <Text style={{ color: COLORS.text, fontSize: sp(18), fontWeight: "900" }}>
            {amount.toFixed(2)} {currency}
          </Text>
          <StatusPill label={meta.label} tint={meta.tint} />
        </View>
      </View>

      {!!desc && (
        <Text numberOfLines={3} style={{ marginTop: sy(6), color: COLORS.textMuted }}>
          {desc}
        </Text>
      )}
    </View>
  );
}

function SummaryPill({ label, value, tint }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: COLORS.line,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginRight: 8,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
      <Text style={{ color: COLORS.text, fontWeight: "800" }}>
        {label}: <Text style={{ color: tint }}>{value}</Text>
      </Text>
    </View>
  );
}

function StatusPill({ label, tint }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: hexWithAlpha(tint, 0.12),
        borderWidth: 1,
        borderColor: hexWithAlpha(tint, 0.35),
      }}
    >
      <Text style={{ color: tint, fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function normalizeStatus(item) {
  const raw = String(item?.status || item?.state || "").toLowerCase();
  if (["approved", "success", "completed"].includes(raw)) return "approved";
  if (["pending", "processing"].includes(raw)) return "pending";
  if (["rejected", "failed", "declined"].includes(raw)) return "rejected";
  return raw || "pending";
}

function normalizeCounts(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    total: Number(raw.total) || 0,
    pending: Number(raw.pending) || 0,
    approved: Number(raw.approved) || 0,
    rejected: Number(raw.rejected) || 0,
  };
}

function buildCounts(list) {
  if (!Array.isArray(list)) return null;
  const st = (x) => String(x?.status || x?.state || "").toLowerCase();
  return {
    total: list.length,
    pending: list.filter((x) => ["pending", "processing"].includes(st(x))).length,
    approved: list.filter((x) => ["approved", "success", "completed"].includes(st(x))).length,
    rejected: list.filter((x) => ["rejected", "failed", "declined"].includes(st(x))).length,
  };
}

function getStatusMeta(status) {
  switch (status) {
    case "approved":
      return { label: "تمت الموافقة", tint: COLORS.success };
    case "pending":
      return { label: "قيد الانتظار", tint: COLORS.pending };
    case "rejected":
      return { label: "مرفوض", tint: COLORS.rejected };
    default:
      return { label: status || "—", tint: COLORS.textMuted };
  }
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

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function stylesFactory({ sx, sy, sp, isRTL }) {
  return StyleSheet.create({
    row: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: sx(8),
    },
    title: {
      fontSize: sp(22),
      fontWeight: "900",
      color: COLORS.text,
    },
    center: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: sx(16),
      paddingTop: sy(40),
      flex: 1,
    },
    listEndText: { color: "#94a3b8", textAlign: "center" },
  });
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#DCE8FF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
  },
  heroTitle: { fontSize: 22, fontWeight: "900", color: "#0E1B3B" },
  heroSub: { color: "#64748B", marginTop: 6, marginBottom: 10 },
  heroBtn: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  heroBtnText: { color: "#fff", fontWeight: "900" },
  button: {
    alignSelf: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: { color: "#fff", fontWeight: "900" },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
  },
  spinnerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
  },
});
