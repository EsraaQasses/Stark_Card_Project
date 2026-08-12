// src/screens/transactions/TransactionDetail.js
import React, { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from "react-native";
import Screenn from "../../ui/Screenn";
import { getTransactionById, approveTransaction } from "../../api/transactions";
import { useAuth } from "../../context/AuthProvider";

const extractRecipientFromNote = (note = "") => {
  const m = String(note).match(/RECIPIENT_WALLET:(\d+)/);
  return m ? m[1] : null;
};

export default function TransactionDetail({ route, navigation }) {
  const id = route?.params?.id;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth() || {};

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getTransactionById(id);
      if (!res?.ok) throw new Error(res?.error || "Failed to load transaction");
      setItem(res?.data || null);
    } catch (loadError) {
      setItem(null);
      setError(String(loadError?.message || "Failed to load transaction"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const canModerate = user?.role === "admin" && item?.status === "pending";
  const proposedRecipient = useMemo(
    () => (!item?.recipient_wallet ? extractRecipientFromNote(item?.note) : null),
    [item]
  );

  const act = async (action) => {
    try {
      setSending(true);
      const result = await approveTransaction(item.id, action); // approve/reject
      if (!result?.ok) throw new Error(result?.error || "Failed to update transaction");
      await load();
      Alert.alert("تم", action === "approve" ? "تمت الموافقة" : "تم الرفض");
    } catch (_e) {
      Alert.alert("خطأ", "تعذر تنفيذ العملية.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Screenn>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      </Screenn>
    );
  }

  if (!item) {
    return (
      <Screenn>
        <Text style={{ textAlign: "center", marginTop: 40 }}>{error || "العنصر غير موجود."}</Text>
        {!!error && <Btn title="Retry" onPress={load} disabled={loading} />}
      </Screenn>
    );
  }

  return (
    <Screenn>
      <View style={styles.card}>
        <Row k="النوع" v={item.transaction_type} />
        <Row k="الحالة" v={item.status} />
        <Row k="المبلغ" v={String(item.amount)} />
        <Row k="محفظة المرسل" v={String(item.wallet)} />
        {!!item.recipient_wallet && <Row k="محفظة المستقبل" v={String(item.recipient_wallet)} />}
        {!!proposedRecipient && <Row k="محفظة مستقبل مقترحة (من الملاحظة)" v={String(proposedRecipient)} />}
        {!!item.note && <Row k="الملاحظة" v={item.note} />}
        <Row k="تاريخ الإنشاء" v={new Date(item.created_at).toLocaleString()} />
      </View>

      {canModerate && (
        <View style={styles.actions}>
          <Btn title="Approve" onPress={() => act("approve")} disabled={sending} />
          <Btn title="Reject"  danger onPress={() => act("reject")}  disabled={sending} />
        </View>
      )}

    </Screenn>
  );
}

function Row({ k, v }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

function Btn({ title, onPress, danger, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        danger ? { backgroundColor: "#c62828" } : { backgroundColor: "#0B63D8" },
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.btnTxt}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", margin: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  k: { color: "#334155", fontWeight: "800" },
  v: { color: "#0E1B3B", fontWeight: "700" },
  actions: { position: "absolute", left: 16, right: 16, bottom: 110, flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "800" },
});
