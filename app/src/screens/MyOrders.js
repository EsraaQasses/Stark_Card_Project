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
import { listUserPurchases } from "../api/store";
import NavBar from "../ui/NavBar";
import Screenn from "../ui/Screenn";
import { useScale } from "../ui/scale";

const PAGE_SIZE = 20;

const productName = (order) => order?.store_product_name
  || order?.product_name
  || order?.store_product?.name
  || order?.product?.name
  || `Order #${order?.id ?? "—"}`;

const orderAmount = (order) => Number(
  order?.wallet_user_final_price
  ?? order?.wallet_final_price
  ?? order?.final_price
  ?? order?.total_price
  ?? order?.amount
  ?? 0
);

export default function MyOrders({ navigation }) {
  const { sx, sy } = useScale();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ targetPage = 1, reset = false } = {}) => {
    if (reset) setError("");
    try {
      if (reset) setLoading(true);
      const result = await listUserPurchases({ page: targetPage, page_size: PAGE_SIZE });
      if (!result?.ok) throw new Error(result?.error || "Failed to load orders.");
      const nextOrders = Array.isArray(result.data) ? result.data : [];
      const total = Number(result.pagination?.count) || nextOrders.length;
      setHasNext(Boolean(result.pagination?.next) || targetPage * PAGE_SIZE < total);
      if (reset) setOrders(nextOrders);
      else setOrders((previous) => {
        const ids = new Set(previous.map((order) => order.id));
        return [...previous, ...nextOrders.filter((order) => !ids.has(order.id))];
      });
      setPage(targetPage);
    } catch (loadError) {
      setError(String(loadError?.message || "Failed to load orders."));
      if (reset) setOrders([]);
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

  const showDetails = (order) => {
    const inputs = order?.user_inputs && typeof order.user_inputs === "object"
      ? Object.entries(order.user_inputs).map(([key, value]) => `${key}: ${String(value)}`).join("\n")
      : "";
    Alert.alert(
      productName(order),
      [
        `Order: #${order.id}`,
        `Status: ${order.status || "—"}`,
        `Amount: ${orderAmount(order).toFixed(2)} ${order.currency || order.wallet_currency || ""}`,
        order.created_at ? `Date: ${new Date(order.created_at).toLocaleString()}` : "",
        inputs,
      ].filter(Boolean).join("\n")
    );
  };

  const renderOrder = ({ item }) => {
    const status = String(item?.status || "pending").toLowerCase();
    const success = ["approved", "success", "completed", "delivered"].includes(status);
    const failed = ["failed", "rejected", "cancelled"].includes(status);
    const statusColor = success ? "#16A34A" : failed ? "#DC2626" : "#CA8A04";
    return (
      <Pressable onPress={() => showDetails(item)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Text style={styles.name} numberOfLines={2}>{productName(item)}</Text><Text style={styles.meta}>Order #{item.id}</Text></View>
          <View style={[styles.badge, { backgroundColor: `${statusColor}18` }]}><Text style={[styles.badgeText, { color: statusColor }]}>{status}</Text></View>
        </View>
        <View style={[styles.row, { marginTop: sy(14) }]}><Text style={styles.meta}>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</Text><Text style={styles.amount}>{orderAmount(item).toFixed(2)} {item.currency || item.wallet_currency || ""}</Text></View>
        <Text style={styles.details}>View details →</Text>
      </Pressable>
    );
  };

  return (
    <Screenn bgColor="#fff" useDefaultBg={false}>
      <View style={{ flex: 1, paddingTop: sy(36) }}>
        <View style={{ paddingHorizontal: sx(14), marginBottom: sy(16) }}><Text style={styles.title}>My Orders</Text><Text style={styles.subtitle}>Your real purchase history</Text></View>
        {loading && orders.length === 0 ? <View style={styles.center}><ActivityIndicator size="large" color="#0B63D8" /></View> : error && orders.length === 0 ? <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={() => load({ reset: true })} style={styles.primary}><Text style={styles.primaryText}>Try again</Text></Pressable></View> : orders.length === 0 ? <View style={styles.center}><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.subtitle}>Completed purchases will appear here.</Text><Pressable onPress={() => navigation.navigate("Products")} style={styles.primary}><Text style={styles.primaryText}>Browse products</Text></Pressable></View> : <FlatList data={orders} renderItem={renderOrder} keyExtractor={(item) => String(item.id)} contentContainerStyle={{ paddingHorizontal: sx(14), paddingBottom: sy(110), gap: sy(12) }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} onEndReached={loadMore} onEndReachedThreshold={0.4} ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: sy(16) }} color="#0B63D8" /> : error ? <Text style={styles.footerError}>{error}</Text> : null} />}
      </View>
      <NavBar active="menu" insetBottom={0} onPressHome={() => navigation.navigate("Home")} onPressMenu={() => navigation.navigate("Menu")} onPressShipping={() => navigation.navigate("PaymentMethodsList")} onPressQR={() => navigation.navigate("QRScanner")} onPressSend={() => navigation.navigate("NewTransfer")} />
    </Screenn>
  );
}

const styles = StyleSheet.create({
  title: { color: "#0E1B3B", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#64748B", fontSize: 14, marginTop: 4 },
  center: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  error: { color: "#B42318", marginBottom: 14, textAlign: "center" },
  emptyTitle: { color: "#0E1B3B", fontSize: 20, fontWeight: "800" },
  primary: { backgroundColor: "#0B63D8", borderRadius: 12, marginTop: 18, paddingHorizontal: 24, paddingVertical: 12 },
  primaryText: { color: "#FFF", fontWeight: "800" },
  card: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0", borderRadius: 14, borderWidth: 1, padding: 15 },
  row: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  name: { color: "#0E1B3B", fontSize: 16, fontWeight: "800" },
  meta: { color: "#64748B", fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  amount: { color: "#0B63D8", fontSize: 16, fontWeight: "900" },
  details: { color: "#0B63D8", fontSize: 12, fontWeight: "700", marginTop: 12 },
  footerError: { color: "#B42318", marginVertical: 12, textAlign: "center" },
});
