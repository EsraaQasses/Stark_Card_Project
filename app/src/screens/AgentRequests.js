// src/screens/AgentRequests.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  I18nManager,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PageLayout from "../ui/PageLayout";
import { useAuth } from "../context/AuthProvider";
import { listAgentShippings } from "../api/deposits";
import api from "../api/client";

const COLOR = {
  bg: "#F6F8FC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  primary: "#0B63D8",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#EF4444",
};

const statusColor = (s) => {
  const st = String(s || "").toLowerCase();
  if (st === "approved" || st === "completed") return COLOR.success;
  if (st === "rejected" || st === "cancelled") return COLOR.danger;
  return COLOR.warning;
};

export default function AgentRequests({ navigation }) {
  const { user } = useAuth();
  const isAgent = user?.role === "agent";
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const dirRow = isRTL ? "row-reverse" : "row";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [filterType, setFilterType] = useState("shipping"); // shipping only
  const [filterStatus, setFilterStatus] = useState("all"); // all | pending | approved | rejected
  const [actionLoading, setActionLoading] = useState({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const shipRes = await listAgentShippings();
      if (!shipRes?.ok) throw new Error(shipRes?.error || "Failed to load requests");

      const shippingItems = shipRes.ok
        ? (shipRes.data || []).map((s) => ({
            key: `ship-${s.id}`,
            type: "shipping",
            id: s.id,
            status: s.status,
            amount: s.amount,
            currency: s.currency,
            created_at: s.created_at,
            user_name: s.user_name,
            user_phone: s?.user_input_data?.user_phone || "",
            note: s?.user_input_data?.note || "",
            raw: s,
          }))
        : [];

      setItems([...shippingItems].sort((a, b) => {
        const ad = new Date(a.created_at || 0).getTime();
        const bd = new Date(b.created_at || 0).getTime();
        return bd - ad;
      }));
    } catch (e) {
      setError("فشل تحميل الطلبات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAgent) {
      setLoading(false);
      setItems([]);
      return;
    }
    load();
  }, [load, isAgent]);

  const filtered = useMemo(() => {
    const t = filterType;
    const s = filterStatus;
    return items.filter((it) => {
      const typeOk = t === "all" || it.type === t;
      const st = String(it.status || "").toLowerCase();
      const statusOk = s === "all" || st === s;
      return typeOk && statusOk;
    });
  }, [items, filterType, filterStatus]);

  const handleApproveShipping = async (item) => {
    if (!item || String(item.status || "").toLowerCase() !== "pending") return;
    if (actionLoading[item.id]) return;
    const confirmed = await new Promise((resolve) => Alert.alert("تأكيد الموافقة", "هل استلمت المبلغ وتريد اعتماد الطلب؟", [{ text: "تراجع", style: "cancel", onPress: () => resolve(false) }, { text: "اعتماد", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
    if (!confirmed) return;
    try {
      setActionLoading((m) => ({ ...m, [item.id]: true }));
      await api.post(`shipping/via-agent/${item.id}/update_status/`, {
        status: "approved",
        agent_notes: "Approved by agent",
      });
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, status: "approved" } : x))
      );
      load();
    } catch (approveError) {
      const msg = (approveError?.response?.data?.error || approveError?.message || "").toLowerCase();
      if (msg.includes("already approved")) {
        setItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, status: "approved" } : x))
        );
        load();
      } else {
        setError("فشل قبول الطلب");
      }
    } finally {
      setActionLoading((m) => ({ ...m, [item.id]: false }));
    }
  };

  const handleRejectShipping = async (item) => {
    if (!item || String(item.status || "").toLowerCase() !== "pending") return;
    if (actionLoading[item.id]) return;
    const confirmed = await new Promise((resolve) => Alert.alert("تأكيد الرفض", "هل تريد رفض طلب الشحن؟", [{ text: "تراجع", style: "cancel", onPress: () => resolve(false) }, { text: "رفض", style: "destructive", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
    if (!confirmed) return;
    try {
      setActionLoading((m) => ({ ...m, [item.id]: true }));
      await api.post(`shipping/via-agent/${item.id}/update_status/`, {
        status: "rejected",
        agent_notes: "Rejected by agent",
      });
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, status: "rejected" } : x))
      );
      load();
    } catch (rejectError) {
      const msg = (rejectError?.response?.data?.error || rejectError?.message || "").toLowerCase();
      if (msg.includes("already approved")) {
        setItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, status: "approved" } : x))
        );
        load();
      } else {
        setError("فشل رفض الطلب");
      }
    } finally {
      setActionLoading((m) => ({ ...m, [item.id]: false }));
    }
  };


  if (!isAgent) {
    return (
      <PageLayout navigation={navigation} active="menu" withSideMenu>
        <View style={[styles.centerBox, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.errorText}>غير مصرح</Text>
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout navigation={navigation} active="menu" withSideMenu>
      <ScrollView
        style={{ flex: 1, backgroundColor: COLOR.bg }}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 90 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>طلبات الوكيل</Text>
          <Text style={styles.headerSub}>إدارة طلبات الشحن لعملائك</Text>
        </View>

        <View style={[styles.filtersRow, { flexDirection: dirRow }]}>
          <FilterPill
            label="شحن"
            active={filterType === "shipping"}
            onPress={() => setFilterType("shipping")}
          />
        </View>

        <View style={[styles.filtersRow, { flexDirection: dirRow, marginTop: 8 }]}>
          <FilterPill
            label="الكل"
            active={filterStatus === "all"}
            onPress={() => setFilterStatus("all")}
          />
          <FilterPill
            label="معلّق"
            active={filterStatus === "pending"}
            onPress={() => setFilterStatus("pending")}
          />
          <FilterPill
            label="مقبول"
            active={filterStatus === "approved"}
            onPress={() => setFilterStatus("approved")}
          />
          <FilterPill
            label="مرفوض"
            active={filterStatus === "rejected"}
            onPress={() => setFilterStatus("rejected")}
          />
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={COLOR.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="archive-outline" size={30} color={COLOR.muted} />
            <Text style={styles.emptyText}>لا توجد طلبات حالياً</Text>
          </View>
        ) : (
          filtered.map((item) => (
            <View key={item.key} style={styles.card}>
              <View style={[styles.cardRow, { flexDirection: dirRow }]}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>شحن</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + "22" }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                    {item.status || "pending"}
                  </Text>
                </View>
              </View>

              <View style={[styles.cardRow, { flexDirection: dirRow, marginTop: 10 }]}>
                <Text style={styles.userName}>{item.user_name || "—"}</Text>
                <Text style={styles.amountText}>
                  {item.amount} {String(item.currency || "").toUpperCase()}
                </Text>
              </View>

              {item.user_phone ? (
                <Text style={styles.metaText}>{item.user_phone}</Text>
              ) : null}
              {item.note ? (
                <Text style={styles.metaText}>{item.note}</Text>
              ) : null}

              {String(item.status || "").toLowerCase() === "pending" ? (
                <View style={[styles.actionsRow, { flexDirection: dirRow }]}>
                  <Pressable
                    style={[styles.actionBtn, styles.approveBtn, actionLoading[item.id] && { opacity: 0.7 }]}
                    onPress={() => handleApproveShipping(item)}
                    disabled={!!actionLoading[item.id]}
                  >
                    <Text style={styles.actionText}>موافقة</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.rejectBtn, actionLoading[item.id] && { opacity: 0.7 }]}
                    onPress={() => handleRejectShipping(item)}
                    disabled={!!actionLoading[item.id]}
                  >
                    <Text style={styles.actionText}>رفض</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </PageLayout>
  );
}

function FilterPill({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: COLOR.text },
  headerSub: { marginTop: 4, color: COLOR.muted },
  filtersRow: { paddingHorizontal: 16, gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLOR.line,
    backgroundColor: "#fff",
  },
  pillActive: { backgroundColor: COLOR.primary, borderColor: COLOR.primary },
  pillText: { color: COLOR.muted, fontSize: 12 },
  pillTextActive: { color: "#fff", fontWeight: "700" },
  centerBox: { padding: 24, alignItems: "center" },
  errorText: { color: COLOR.danger, fontWeight: "700" },
  emptyText: { color: COLOR.muted, marginTop: 8 },
  card: {
    backgroundColor: COLOR.card,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  cardRow: { alignItems: "center", justifyContent: "space-between" },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: COLOR.primary + "22",
  },
  typeBadgeText: { color: COLOR.primary, fontWeight: "700", fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: { fontWeight: "700", fontSize: 12 },
  userName: { color: COLOR.text, fontWeight: "800" },
  amountText: { color: COLOR.text, fontWeight: "800" },
  metaText: { color: COLOR.muted, marginTop: 6, fontSize: 12 },
  actionsRow: { gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  approveBtn: { backgroundColor: COLOR.success },
  rejectBtn: { backgroundColor: COLOR.danger },
  actionText: { color: "#fff", fontWeight: "700" },
});
