import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { approveCashout, cancelCashout, listCashouts } from "../api/agent";
import Screenn from "../ui/Screenn";

const PAGE_SIZE = 20;

export default function AgentCashouts({ navigation }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async ({ targetPage = 1, reset = false } = {}) => {
    if (reset) setError("");
    try {
      if (reset) setLoading(true);
      const data = await listCashouts({ as_agent: true, page: targetPage, page_size: PAGE_SIZE });
      const rows = Array.isArray(data) ? data : data?.results || [];
      const count = Number(data?.count) || rows.length;
      setHasNext(Boolean(data?.next) || targetPage * PAGE_SIZE < count);
      if (reset) setItems(rows);
      else setItems((previous) => {
        const ids = new Set(previous.map((item) => item.id));
        return [...previous, ...rows.filter((item) => !ids.has(item.id))];
      });
      setPage(targetPage);
    } catch (loadError) {
      setError(String(loadError?.response?.data?.error || loadError?.message || "تعذر تحميل طلبات السحب."));
      if (reset) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load({ reset: true }); }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load({ targetPage: 1, reset: true });
  };

  const loadMore = () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    load({ targetPage: page + 1 });
  };

  const decide = (item, action) => {
    if (actingId) return;
    const approving = action === "approve";
    Alert.alert(
      approving ? "تأكيد دفع السحب" : "رفض طلب السحب",
      `${approving ? "تأكيد دفع" : "رفض"} ${Number(item.amount || 0).toFixed(2)} ${item.currency || item.wallet_currency || ""} للعميل ${item.user_name || ""}؟`,
      [
        { text: "تراجع", style: "cancel" },
        {
          text: approving ? "تأكيد الدفع" : "رفض",
          style: approving ? "default" : "destructive",
          onPress: async () => {
            setActingId(item.id);
            try {
              if (approving) await approveCashout(item.id);
              else await cancelCashout(item.id);
              await load({ reset: true });
              Alert.alert("تم", approving ? "تم اعتماد طلب السحب." : "تم رفض طلب السحب.");
            } catch (actionError) {
              const message = actionError?.response?.data?.error || actionError?.message || "تعذر تنفيذ الإجراء.";
              Alert.alert("خطأ", String(message));
            } finally {
              setActingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const pending = String(item.status).toLowerCase() === "pending";
    return (
      <View style={styles.card}>
        <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.name}>{item.user_name || `مستخدم #${item.user_id || "—"}`}</Text><Text style={styles.meta}>{item.user_phone || item.user_email || ""}</Text></View><Text style={styles.amount}>{Number(item.amount || 0).toFixed(2)} {item.currency || item.wallet_currency || ""}</Text></View>
        <View style={[styles.row, { marginTop: 10 }]}><Text style={styles.meta}>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</Text><Text style={styles.status}>{item.status}</Text></View>
        {!!item.note && <Text style={styles.note}>{item.note}</Text>}
        {pending && <View style={styles.actions}><Pressable disabled={Boolean(actingId)} onPress={() => decide(item, "cancel")} style={[styles.button, styles.reject, actingId && styles.disabled]}><Text style={styles.rejectText}>رفض</Text></Pressable><Pressable disabled={Boolean(actingId)} onPress={() => decide(item, "approve")} style={[styles.button, styles.approve, actingId && styles.disabled]}>{actingId === item.id ? <ActivityIndicator color="#FFF" /> : <Text style={styles.approveText}>تأكيد الدفع</Text>}</Pressable></View>}
      </View>
    );
  };

  return (
    <Screenn>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}><Pressable onPress={() => navigation.goBack()} style={styles.back}><Ionicons name="chevron-back" size={22} color="#0B63D8" /></Pressable><View style={{ flex: 1 }}><Text style={styles.title}>طلبات سحب العملاء</Text><Text style={styles.subtitle}>راجع طلبات العملاء المرتبطين بك وأكد الدفع مرة واحدة.</Text></View></View>
      {loading && items.length === 0 ? <View style={styles.center}><ActivityIndicator size="large" color="#0B63D8" /></View> : error && items.length === 0 ? <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={() => load({ reset: true })} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View> : items.length === 0 ? <View style={styles.center}><Ionicons name="cash-outline" size={52} color="#94A3B8" /><Text style={styles.empty}>لا توجد طلبات سحب.</Text></View> : <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} onEndReached={loadMore} onEndReachedThreshold={0.4} ListFooterComponent={loadingMore ? <ActivityIndicator color="#0B63D8" /> : error ? <Text style={styles.error}>{error}</Text> : null} />}
    </Screenn>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", backgroundColor: "#EEF4FF", flexDirection: "row", gap: 12, paddingBottom: 16, paddingHorizontal: 16 },
  back: { alignItems: "center", backgroundColor: "#FFF", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  title: { color: "#0E1B3B", fontSize: 21, fontWeight: "900" },
  subtitle: { color: "#64748B", fontSize: 12, marginTop: 4 },
  list: { gap: 12, padding: 16, paddingBottom: 100 },
  card: { backgroundColor: "#FFF", borderColor: "#E2E8F0", borderRadius: 14, borderWidth: 1, padding: 14 },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  name: { color: "#0E1B3B", fontSize: 16, fontWeight: "800" },
  meta: { color: "#64748B", fontSize: 12, marginTop: 3 },
  amount: { color: "#0B63D8", fontSize: 17, fontWeight: "900" },
  status: { color: "#CA8A04", fontSize: 12, fontWeight: "800" },
  note: { backgroundColor: "#F8FAFC", borderRadius: 8, color: "#475569", marginTop: 10, padding: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  button: { alignItems: "center", borderRadius: 10, flex: 1, justifyContent: "center", minHeight: 44 },
  approve: { backgroundColor: "#16A34A" },
  reject: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5", borderWidth: 1 },
  approveText: { color: "#FFF", fontWeight: "800" },
  rejectText: { color: "#B42318", fontWeight: "800" },
  disabled: { opacity: 0.55 },
  center: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  error: { color: "#B42318", marginVertical: 12, textAlign: "center" },
  empty: { color: "#64748B", fontSize: 16, fontWeight: "700", marginTop: 12 },
  retry: { backgroundColor: "#0B63D8", borderRadius: 10, marginTop: 12, paddingHorizontal: 20, paddingVertical: 11 },
  retryText: { color: "#FFF", fontWeight: "800" },
});
