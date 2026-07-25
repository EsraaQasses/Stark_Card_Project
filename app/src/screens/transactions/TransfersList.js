// src/screens/transactions/TransfersList.js
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, FlatList, RefreshControl, Pressable, ActivityIndicator, StyleSheet
} from "react-native";
import Screenn from "../../ui/Screenn";
import { getTransactions } from "../../api/transactions";
import { getCache, setCache, cacheKey } from "../../utils/cache";

const STATUS = ["all", "pending", "approved", "rejected"];
const DIRECTION = ["all", "in", "out"];

export default function TransfersList({ navigation }) {
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");

  const load = useCallback(async () => {
    setPending(true);
    try {
      const params = { transaction_type: "transfer" };
      if (status !== "all") params.status = status;
      const cacheK = cacheKey("transfers", status);
      const cached = await getCache(cacheK, 1000 * 60 * 5);
      if (cached && Array.isArray(cached)) setItems(cached);
      const res = await getTransactions(params);
      const list = Array.isArray(res?.data) ? res.data : [];
      setItems(list);
      await setCache(cacheK, list);
    } catch (_e) {
    } finally {
      setPending(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

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

      {pending && filteredItems.length === 0 ? (
        <View style={styles.loader}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={pending} onRefresh={load} />}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 40, color: "#667" }}>
              لا توجد تحويلات.
            </Text>
          }
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
