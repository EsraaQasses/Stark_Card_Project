// src/screens/transactions/TransfersList.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, FlatList, RefreshControl, Pressable, ActivityIndicator, StyleSheet
} from "react-native";
import Screenn from "../../ui/Screenn";
import { getTransactions } from "../../api/transactions";
import { getCache, setCache, cacheKey } from "../../utils/cache";

const STATUS = ["all", "pending", "approved", "rejected"];
const DIRECTION = ["all", "in", "out"];
const PAGE_SIZE = 20;

export default function TransfersList({ navigation }) {
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreLockRef = useRef(false);

  const load = useCallback(async ({ reset = false, pageOverride } = {}) => {
    const currentPage = reset ? 1 : pageOverride ?? 1;
    const cacheK = cacheKey("transfers", status, String(currentPage));
    if (reset) {
      setPending(true);
      setError("");
    }
    try {
      const params = { transaction_type: "transfer", page: currentPage, page_size: PAGE_SIZE };
      if (status !== "all") params.status = status;
      if (reset) {
        const cached = await getCache(cacheK, 1000 * 60 * 5);
        if (cached && Array.isArray(cached)) setItems(cached);
      }
      const res = await getTransactions(params);
      if (!res?.ok) throw new Error(res?.error || "Failed to load transfers");
      const list = Array.isArray(res?.data) ? res.data : [];
      const pagination = res?.pagination || {};
      const total = Number(pagination.count) || list.length;
      setHasNext(Boolean(pagination.next) || currentPage * PAGE_SIZE < total);
      if (reset) {
        setItems(list);
        setPage(1);
      } else {
        setItems((previous) => {
          const ids = new Set(previous.map((item) => item.id));
          return [...previous, ...list.filter((item) => !ids.has(item.id))];
        });
      }
      await setCache(cacheK, list);
    } catch (loadError) {
      setError(String(loadError?.message || "تعذر تحميل التحويلات."));
    } finally {
      setPending(false);
      setRefreshing(false);
      setLoadingMore(false);
      loadMoreLockRef.current = false;
    }
  }, [status]);

  useEffect(() => { load({ reset: true }); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ reset: true });
  }, [load]);

  const loadMore = useCallback(() => {
    if (!hasNext || loadingMore || loadMoreLockRef.current) return;
    loadMoreLockRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    load({ pageOverride: nextPage });
  }, [hasNext, load, loadingMore, page]);

  const filteredItems = direction === "all"
    ? items
    : items.filter((it) => it.direction === direction);

  const renderItem = ({ item }) => (
    <Pressable
      onPress={() => navigation.navigate("TransactionDetail", { id: item.id })}
      style={styles.card}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={styles.type}>TRANSFER</Text>
        <Text style={[styles.status, statusStyle(item.status)]}>{item.status}</Text>
      </View>
      <Text style={styles.amount}>{Number(item.amount).toFixed(2)}</Text>
      {(item?.recipient_name || item?.recipient_phone) ? (
        <Text style={styles.muted}>
          {item.direction === "in" ? "من" : "إلى"} {item.recipient_name || "User"}
          {item.recipient_phone ? ` • ${item.recipient_phone}` : ""}
        </Text>
      ) : null}
      <Text style={styles.muted}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </Pressable>
  );

  return (
    <Screenn>
      <View style={styles.filters}>
        <Segment
          value={direction}
          options={DIRECTION}
          onChange={setDirection}
          label="Transfer"
        />
        <Segment
          value={status}
          options={STATUS}
          onChange={setStatus}
          label="Status"
        />
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable disabled={pending} onPress={() => load({ reset: true })} style={styles.retryBtn}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      )}

      {pending && filteredItems.length === 0 ? (
        <View style={styles.loader}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            !error ? <Text style={{ textAlign: "center", marginTop: 40, color: "#667" }}>
              لا توجد تحويلات.
            </Text> : null
          }
          ListFooterComponent={hasNext ? (
            <Pressable disabled={loadingMore} onPress={loadMore} style={[styles.loadMore, loadingMore && { opacity: 0.65 }]}>
              {loadingMore ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>تحميل المزيد</Text>}
            </Pressable>
          ) : null}
        />
      )}

      <View style={styles.actions}>
        <Primary onPress={() => navigation.navigate("NewTransfer")} title="New Transfer" />
      </View>

    </Screenn>
  );
}

function Segment({ value, options, onChange, label }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segment}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.segBtn, active && styles.segBtnActive]}
            >
              <Text style={[styles.segTxt, active && styles.segTxtActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Primary({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.primary}>
      <Text style={styles.primaryTxt}>{title}</Text>
    </Pressable>
  );
}

function statusStyle(s) {
  if (s === "approved") return { color: "#0a8f3d" };
  if (s === "rejected") return { color: "#c62828" };
  return { color: "#b26a00" }; // pending
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 12, padding: 16, paddingTop: 20 },
  label: { color: "#0E1B3B", fontWeight: "700", marginBottom: 8 },
  segment: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1" },
  segBtnActive: { backgroundColor: "#3A86FF22", borderColor: "#3A86FF" },
  segTxt: { color: "#334155", fontWeight: "600" },
  segTxtActive: { color: "#0B63D8" },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "#e2e8f0"
  },
  type: { color: "#0E1B3B", fontWeight: "800" },
  status: { fontWeight: "700", textTransform: "capitalize" },
  amount: { marginTop: 8, fontSize: 18, fontWeight: "800", color: "#0B63D8" },
  muted: { marginTop: 4, color: "#64748b" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorBox: { marginHorizontal: 16, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", borderRadius: 12, padding: 12 },
  errorText: { color: "#991b1b", textAlign: "center", fontWeight: "700" },
  retryBtn: { alignSelf: "center", marginTop: 8, borderRadius: 9, backgroundColor: "#0B63D8", paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: "#fff", fontWeight: "800" },
  loadMore: { marginTop: 8, borderRadius: 12, backgroundColor: "#0B63D8", paddingVertical: 11, alignItems: "center" },
  actions: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 110,
    gap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  primary: {
    flex: 1, backgroundColor: "#0B63D8", borderRadius: 14, paddingVertical: 12, alignItems: "center"
  },
  primaryTxt: { color: "#fff", fontWeight: "800" },
});
