// src/screens/transactions/NewDeposit.js
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import Screenn from "../../ui/Screenn";
import { createDepositRequest } from "../../api/deposits";
import { getWallet } from "../../api/wallets";
import { listUserPaymentMethods } from "../../api/paymentMethods";

const Label = ({ children }) => <Text style={styles.label}>{children}</Text>;

export default function NewDeposit({ navigation, route }) {
  // بنستقبل العملة (اختياري) من الشاشة السابقة؛ وإلا بناخد المفضلة من الخادم
  const initialCurrency = (route?.params?.currency || "").toUpperCase();
  const [currency, setCurrency] = useState(
    initialCurrency === "SYP" ? "SYP" : initialCurrency === "USD" ? "USD" : null
  );

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("رقم المرسل:\nملاحظات إضافية:");
  const [sending, setSending] = useState(false);

  // payment methods
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [loadingMethods, setLoadingMethods] = useState(true);

  // محاولة جلب العملة المفضلة إذا ما اجتنا من الروت
  useEffect(() => {
    (async () => {
      if (!currency) {
        try {
          const w = await getWallet();
          const pref = w?.preferred_currency;
          if (pref === "USD" || pref === "SYP") setCurrency(pref);
          else setCurrency("USD");
        } catch {
          setCurrency("USD");
        }
      }
    })();
  }, [currency]);

  // جلب payment methods
  useEffect(() => {
    (async () => {
      try {
        const methods = await listUserPaymentMethods();
        setPaymentMethods(methods || []);
        if (methods && methods.length > 0) setSelectedPaymentMethod(methods[0]);
      } catch (e) {
        Alert.alert("خطأ", "فشل تحميل طرق الدفع: " + (e?.message || ""));
      } finally {
        setLoadingMethods(false);
      }
    })();
  }, []);

  const cleanNumber = useCallback((s) => {
    const t = String(s || "").trim().replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }, []);

  const disableSubmit = useMemo(() => {
    const n = cleanNumber(amount);
    return (
      sending ||
      !selectedPaymentMethod ||
      !amount ||
      !Number.isFinite(n) ||
      n <= 0 ||
      !currency
    );
  }, [sending, selectedPaymentMethod, amount, currency, cleanNumber]);

  const onSubmit = useCallback(async () => {
    if (sending) return;

    if (!selectedPaymentMethod) {
      return Alert.alert("مطلوب", "اختر طريقة دفع.");
    }

    const amt = cleanNumber(amount);
    const nt = (note || "").trim();

    if (!Number.isFinite(amt) || amt <= 0) {
      return Alert.alert("مطلوب", "أدخل مبلغًا صحيحًا أكبر من 0.");
    }
    if (!currency) {
      return Alert.alert("مطلوب", "العملة غير معروفة.");
    }

    try {
      setSending(true);

      const resp = await createDepositRequest({
        amount: amt,
        currency: (currency || "").toUpperCase(),
        method: selectedPaymentMethod.name || "manual",
        note: nt,
        payment_method: selectedPaymentMethod.id,
      });

      if (!resp || resp.ok === false) {
        throw new Error(resp?.error || "فشل إنشاء طلب الشحن");
      }

      Alert.alert("تم الإرسال", "تم تسجيل طلب الشحن، حالته: قيد المراجعة.");
      setAmount("");
      setNote("رقم المرسل:\nملاحظات إضافية:");
      navigation.navigate("MyWallet");
    } catch (e) {
      Alert.alert("خطأ", e?.message || "فشل إرسال الطلب، حاول مجدداً.");
    } finally {
      setSending(false);
    }
  }, [sending, selectedPaymentMethod, amount, note, currency, cleanNumber, navigation]);

  return (
    <Screenn>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerCard}>
            <Text style={styles.title}>شحن الرصيد</Text>
            <Text style={styles.subTitle}>
              اختر طريقة الدفع، حدّد العملة، واكتب المبلغ والملاحظات (رقم المرسل).
            </Text>
          </View>

          {/* Payment Methods */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>طريقة الدفع</Text>
              {loadingMethods ? (
                <View style={styles.inlineRow}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.mutedSm}>جارٍ التحميل...</Text>
                </View>
              ) : null}
            </View>

            {!loadingMethods && paymentMethods.length === 0 ? (
              <Text style={styles.emptyTxt}>لا توجد طرق دفع متاحة.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipsRow}>
                  {paymentMethods.map((pm) => {
                    const active = selectedPaymentMethod?.id === pm.id;
                    return (
                      <Pressable
                        key={pm.id}
                        onPress={() => setSelectedPaymentMethod(pm)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                          {pm.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {!!selectedPaymentMethod && (
              <View style={styles.selectedHint}>
                <Text style={styles.selectedHintTxt}>
                  تم اختيار: <Text style={{ fontWeight: "900" }}>{selectedPaymentMethod.name}</Text>
                </Text>
              </View>
            )}
          </View>

          {/* Currency */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>العملة</Text>
            <View style={[styles.chipsRow, { marginTop: 10 }]}>
              {["USD", "SYP"].map((cur) => {
                const active = currency === cur;
                return (
                  <Pressable
                    key={cur}
                    onPress={() => setCurrency(cur)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{cur}</Text>
                  </Pressable>
                );
              })}
            </View>

            {!!currency && (
              <Text style={styles.mutedSm}>
                سيتم شحن محفظتك <Text style={{ fontWeight: "900" }}>{currency}</Text> تلقائيًا.
              </Text>
            )}
          </View>

          {/* Amount + Note */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>تفاصيل الطلب</Text>

            <View style={{ marginTop: 10 }}>
              <Label>المبلغ</Label>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <Label>ملاحظات (اكتب رقمك)</Label>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={5}
                style={[styles.input, styles.textarea]}
                placeholder={"رقم المرسل:\nملاحظات إضافية:"}
                placeholderTextColor="#94a3b8"
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={disableSubmit}
            style={[
              styles.primaryBtn,
              disableSubmit && { opacity: 0.55 },
              sending && { opacity: 0.75 },
            ]}
          >
            <Text style={styles.primaryBtnTxt}>
              {sending ? "جارٍ الإرسال..." : "طلب شحن الرصيد"}
            </Text>
          </Pressable>

          <Text style={styles.footerHint}>
            بعد الإرسال، سيتم مراجعة الطلب وتحديث الحالة تلقائيًا.
          </Text>

          <View style={{ height: 90 }} />
        </ScrollView>

      </View>
    </Screenn>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8FC" },
  content: { padding: 16, paddingBottom: 24 },

  headerCard: {
    backgroundColor: "#0B63D8",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "900" },
  subTitle: { color: "rgba(255,255,255,0.9)", marginTop: 6, lineHeight: 18 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9EEF7",
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontWeight: "900", color: "#0E1B3B", fontSize: 14 },

  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mutedSm: { color: "#64748b", fontSize: 12, marginTop: 8 },

  emptyTxt: { color: "#64748b", marginTop: 10, fontWeight: "700" },

  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  chip: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: "#E6F6FF",
    borderColor: "#BFDFFF",
  },
  chipTxt: { color: "#0E1B3B", fontWeight: "800" },
  chipTxtActive: { color: "#0B63D8" },

  selectedHint: {
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  selectedHintTxt: { color: "#334155", fontSize: 12 },

  label: { fontWeight: "900", color: "#0E1B3B", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    color: "#0F172A",
    fontWeight: "700",
  },
  textarea: { height: 130 },

  primaryBtn: {
    backgroundColor: "#0B63D8",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#0B63D8",
        shadowOpacity: 0.25,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14 },

  footerHint: {
    marginTop: 10,
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
});
