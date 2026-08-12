// src/screens/transactions/TakeMoney.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  I18nManager,
} from "react-native";
import Screenn from "../../ui/Screenn";
import { getWallet, normalizeWalletsResponse } from "../../api/wallets";
import { createCashout } from "../../api/agent";
import { createAgentCashoutRequest } from "../../api/deposits";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthProvider";

export default function TakeMoney({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const isAgent = user?.role === "agent" || user?.is_agent === true;
  const connectedAgent =
    user?.raw?.connected_agent ||
    user?.raw?.agent ||
    user?.connected_agent ||
    user?.agent ||
    null;
  const hasAgent = !!connectedAgent;
  const modeLabel = isAgent ? "سحب عبر الإدارة" : "سحب عبر الوكيل";
  const modeSubtitle = isAgent
    ? "سيتم إرسال طلبك للإدارة وسيتم خصم المبلغ بعد الموافقة."
    : "سيتم حجز المبلغ حتى موافقة الوكيل.";

  const loadWallets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWallet();
      const list = normalizeWalletsResponse(data);
      setWallets(list);
      if (list.length && !selected) setSelected(list[0]);
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  useEffect(() => {
    if (!selected && wallets.length) setSelected(wallets[0]);
  }, [selected, wallets]);

  const safeAmount = useMemo(() => Number(String(amount).replace(/[^0-9.]/g, "")) || 0, [amount]);
  const selectedCurrency = selected?.currency || wallets[0]?.currency || "";

  const onSubmit = async () => {
    if (submitting || submitLockRef.current) return;
    if (!isAgent && !hasAgent) {
      Alert.alert("تنبيه", "لا يمكنك سحب الأموال بدون وكيل مرتبط بحسابك.");
      return;
    }
    if (!selected?.id || String(selected.id).startsWith("LOCAL-")) {
      Alert.alert("خطأ", "لا يمكن استخدام محفظة غير معروفة.");
      return;
    }
    if (!safeAmount || safeAmount <= 0) {
      Alert.alert("خطأ", "أدخل مبلغاً صحيحاً.");
      return;
    }
    const confirmed = await new Promise((resolve) => {
      Alert.alert(
        "تأكيد طلب السحب",
        `إرسال طلب سحب بقيمة ${safeAmount.toFixed(2)} ${selectedCurrency}؟`,
        [
          { text: "إلغاء", style: "cancel", onPress: () => resolve(false) },
          { text: "تأكيد", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
    if (!confirmed) return;
    submitLockRef.current = true;
    try {
      setSubmitting(true);
      if (isAgent) {
        const payload = {
          amount: safeAmount,
          currency: selectedCurrency,
          wallet_currency: selectedCurrency,
          note: note?.trim() || "",
        };
        console.log("[TakeMoney] agent cashout payload:", payload);
        const res = await createAgentCashoutRequest(payload);
        if (!res?.ok) throw new Error(res?.error || "تعذر إرسال طلب السحب.");
        console.log("[TakeMoney] agent cashout response:", res);
        Alert.alert("تم", "تم إرسال طلب السحب للإدارة.");
      } else {
        const payload = {
          wallet_id: Number(selected.id),
          amount: safeAmount,
          note: note?.trim() || "",
        };
        console.log("[TakeMoney] cashout payload:", payload);
        const res = await createCashout(payload);
        console.log("[TakeMoney] cashout response:", res);
        Alert.alert("تم", "تم إرسال طلب السحب للوكيل.");
      }
      navigation.goBack();

    } catch (e) {
      console.log("[TakeMoney] cashout error:", e?.response?.data || e?.message || e);
      const msg = e?.response?.data?.error || e?.message || "تعذر إرسال الطلب.";
      Alert.alert("خطأ", String(msg));
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screenn>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={styles.heroRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="cash-outline" size={14} color="#0B63D8" />
              <Text style={styles.heroBadgeText}>{modeLabel}</Text>
            </View>
            <Pressable onPress={() => navigation.goBack()} style={styles.heroBack}>
              <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={18} color="#0B63D8" />
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>اسحب أموالك بسرعة</Text>
          <Text style={styles.heroSubtitle}>اختر المحفظة وأدخل المبلغ. {modeSubtitle}</Text>
        </View>

        <View style={styles.container}>
          {!isAgent && !hasAgent && (
            <>
              <View style={styles.warnCard}>
                <Ionicons name="alert-circle" size={18} color="#B42318" />
                <Text style={styles.warnText}>
                  لا يمكنك سحب الأموال بدون وكيل مرتبط بحسابك.
                </Text>
              </View>
              <Pressable onPress={() => navigation.navigate("OurAgents")} style={styles.warnBtn}>
                <Text style={styles.warnBtnText}>الذهاب لربط وكيل</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.sectionTitle}>اختر المحفظة</Text>
          {loading ? (
            <ActivityIndicator />
          ) : wallets.length === 0 ? (
            <View style={styles.emptyWallets}>
              <Ionicons name="wallet-outline" size={18} color="#64748B" />
              <Text style={styles.emptyWalletsText}>لا توجد محافظ متاحة الآن.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {wallets.map((w) => {
                const active = selected?.id === w.id;
                return (
                  <Pressable
                    key={String(w.id)}
                    onPress={() => setSelected(w)}
                    style={[styles.walletCard, active && styles.walletActive]}
                  >
                    <View style={styles.walletRow}>
                      <View>
                        <Text style={styles.walletTitle}>{w.currency}</Text>
                        <Text style={styles.walletMeta}>ID: {String(w.id)}</Text>
                      </View>
                      <View style={styles.walletBalance}>
                        <Text style={styles.walletAmount}>{Number(w.available || 0).toFixed(2)}</Text>
                        <Text style={styles.walletMeta}>متاح</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

        <Text style={styles.sectionTitle}>المبلغ</Text>
        <View style={styles.amountRow}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0.00"
            style={styles.amountInput}
          />
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyText}>{selectedCurrency || "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ملاحظة (اختياري)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="رقم هاتف أو ملاحظة"
          style={[styles.input, { height: 90, textAlignVertical: "top" }]}
          multiline
        />

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>الإجمالي</Text>
          <Text style={styles.summaryValue}>
            {safeAmount.toFixed(2)} {selected?.currency || ""}
          </Text>
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={submitting || (!isAgent && !hasAgent)}
          style={[styles.btn, (submitting || (!isAgent && !hasAgent)) && { opacity: 0.6 }]}
        >
          <Text style={styles.btnText}>{submitting ? "جارٍ الإرسال..." : "إرسال الطلب"}</Text>
        </Pressable>
        </View>
      </ScrollView>
    </Screenn>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#DCE8FF",
  },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroBadge: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#DCE8FF",
  },
  heroBadgeText: { color: "#0B63D8", fontWeight: "900", fontSize: 12 },
  heroBack: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE8FF",
  },
  heroTitle: { marginTop: 10, fontSize: 22, fontWeight: "900", color: "#0B1220" },
  heroSubtitle: { color: "#64748B", marginTop: 6, fontSize: 13, lineHeight: 18 },
  container: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { marginTop: 12, marginBottom: 6, color: "#0E1B3B", fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  walletCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
  },
  walletActive: {
    borderColor: "#0B63D8",
    backgroundColor: "#EEF4FF",
  },
  walletRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  walletTitle: { fontWeight: "900", color: "#0E1B3B" },
  walletMeta: { color: "#64748B", marginTop: 4, fontSize: 12 },
  walletBalance: { alignItems: "flex-end" },
  walletAmount: { color: "#0B63D8", fontWeight: "900", fontSize: 18 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  currencyBadge: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0B63D8",
    alignItems: "center",
    justifyContent: "center",
  },
  currencyText: { color: "#fff", fontWeight: "900" },
  btn: {
    marginTop: 18,
    backgroundColor: "#0B63D8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800" },
  warnCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF1F2",
    marginBottom: 6,
  },
  warnText: { color: "#B42318", fontWeight: "700", flex: 1 },
  warnBtn: {
    marginTop: 10,
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  warnBtnText: { color: "#B42318", fontWeight: "800" },
  summaryCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE8FF",
    backgroundColor: "#F3F7FF",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyWallets: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#F8FAFC",
  },
  emptyWalletsText: { color: "#64748B", fontWeight: "700" },
  summaryLabel: { color: "#64748B", fontWeight: "700" },
  summaryValue: { color: "#0B63D8", fontWeight: "900", fontSize: 16 },
});
