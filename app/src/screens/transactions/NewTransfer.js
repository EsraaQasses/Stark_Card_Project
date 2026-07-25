// src/screens/transactions/NewTransfer.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  I18nManager,
} from "react-native";
import Screenn from "../../ui/Screenn";
import { getWallet, normalizeWalletsResponse } from "../../api/wallets";
import { createTransfer, lookupRecipientByWallet } from "../../api/transactions";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function NewTransfer({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const params = useMemo(() => route?.params ?? {}, [route?.params]);

  const [recipientId, setRecipientId] = useState(params.recipient_id || null);
  const [recipientWalletId] = useState(
    params.recipient_wallet_id || params.toWallet || null
  );
  const [recipient, setRecipient] = useState(
    params.recipient_name || params.recipient_phone
      ? {
          name: params.recipient_name || "",
          phone: params.recipient_phone || "",
        }
      : null
  );

  const [wallets, setWallets] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getWallet();
        const list = normalizeWalletsResponse(data);
        setWallets(list);

        const preferred = data?.preferred_currency || data?.currency_preference;
        const preferredWallet = list.find((w) => w.currency === preferred);
        setSelectedWalletId(String(preferredWallet?.id || list?.[0]?.id || ""));
      } catch {
        setWallets([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (recipientId && !recipient) {
      setRecipient({
        id: recipientId,
        name: params.recipient_name || "",
        phone: params.recipient_phone || "",
      });
    }
  }, [recipientId, recipient, params]);

  useEffect(() => {
    if (!recipientWalletId || recipient) return;

    (async () => {
      try {
        const res = await lookupRecipientByWallet(recipientWalletId);
        if (res?.ok && res.data) {
          setRecipient({
            id: res.data.id,
            name: res.data.name || "",
            phone: res.data.phone || "",
          });
          setRecipientId(res.data.id);
        }
      } catch {}
    })();
  }, [recipientWalletId, recipient]);

  const selectedWallet = useMemo(
    () => wallets.find((w) => String(w.id) === String(selectedWalletId)),
    [wallets, selectedWalletId]
  );

  const parsedAmount = Number(amount);
  const canSubmit =
    !loading &&
    !!selectedWalletId &&
    !!(recipient || recipientId) &&
    !!parsedAmount &&
    parsedAmount > 0;

  const submit = async () => {
    if (loading) return;

    const amt = Number(amount);
    const walletId = Number(selectedWalletId);

    if (!walletId) {
      return Alert.alert("مطلوب", "اختر المحفظة أولاً.");
    }
    if (!recipient && !recipientId) {
      return Alert.alert("مطلوب", "امسح QR لاختيار المستلم.");
    }
    if (!amt || amt <= 0) {
      return Alert.alert("تنبيه", "المبلغ يجب أن يكون أكبر من صفر.");
    }

    try {
      setLoading(true);

      const payload = {
        wallet_id: walletId,
        amount: amt,
        note: note || "",
      };

      if (recipientId) payload.recipient_id = recipientId;
      else if (recipient?.phone) payload.recipient_phone = recipient.phone;

      console.log("[NewTransfer] transfer payload:", payload);

      const res = await createTransfer(payload);

      console.log("[NewTransfer] transfer response:", res);

      if (!res.ok) throw new Error(res.error || "Transfer failed");

      Alert.alert("تم التحويل", "تم تحويل المبلغ بنجاح.");
      navigation.navigate("TransactionsList");
    } catch (e) {
      console.log("[NewTransfer] transfer error:", e?.response?.data || e?.message || e);
      Alert.alert("خطأ", e?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screenn>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 150 + insets.bottom,
          }}
        >
          <View style={[styles.hero, { paddingTop: insets.top + 10 }]}>
            <View style={styles.heroTopRow}>
              <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
                <Ionicons
                  name={isRTL ? "chevron-forward" : "chevron-back"}
                  size={18}
                  color="#0B63D8"
                />
              </Pressable>

              <View style={styles.heroBadge}>
                <Ionicons name="swap-horizontal" size={14} color="#0B63D8" />
                <Text style={styles.heroBadgeText}>Stark to Stark</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>تحويل أموال</Text>
            <Text style={styles.heroSubtitle}>
              أرسل مبلغًا بشكل فوري وآمن عبر مسح رمز QR الخاص بالمستلم.
            </Text>
          </View>

          <View style={styles.container}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="person-outline" size={18} color="#0B63D8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>بيانات المستلم</Text>
                  <Text style={styles.sectionHint}>ابدأ بمسح رمز QR لاختيار المستلم</Text>
                </View>
              </View>

              <Pressable
                onPress={() => navigation.navigate("QRScanner")}
                style={styles.scanBtn}
              >
                <Ionicons name="qr-code-outline" size={18} color="#fff" />
                <Text style={styles.scanTxt}>مسح QR</Text>
              </Pressable>

              {recipient ? (
                <View style={styles.recipientCard}>
                  <View style={styles.avatarCircle}>
                    <Ionicons name="person" size={18} color="#0B63D8" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipientLabel}>المستلم المحدد</Text>
                    <Text style={styles.recipientName}>
                      {recipient.name?.trim() || "مستخدم"}
                    </Text>
                    {!!recipient.phone && (
                      <Text style={styles.recipientPhone}>{recipient.phone}</Text>
                    )}
                  </View>

                  <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="scan-circle-outline" size={22} color="#94A3B8" />
                  <Text style={styles.emptyStateText}>
                    لم يتم اختيار مستلم بعد
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="wallet-outline" size={18} color="#0B63D8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>المحفظة والمبلغ</Text>
                  <Text style={styles.sectionHint}>
                    اختر المحفظة ثم أدخل قيمة التحويل
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>المحفظة</Text>
              <View style={styles.walletsRow}>
                {wallets.map((w) => {
                  const active = String(w.id) === String(selectedWalletId);

                  return (
                    <Pressable
                      key={String(w.id)}
                      onPress={() => setSelectedWalletId(String(w.id))}
                      style={[styles.walletChip, active && styles.walletChipActive]}
                    >
                      <Text
                        style={[styles.walletCurrency, active && styles.walletCurrencyActive]}
                      >
                        {w.currency}
                      </Text>
                      <Text
                        style={[styles.walletBalance, active && styles.walletBalanceActive]}
                      >
                        {Number(w.available || 0).toFixed(2)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>المبلغ</Text>
              <View style={styles.amountWrap}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  style={styles.amountInput}
                />
                <View style={styles.currencyPill}>
                  <Text style={styles.currencyPillText}>
                    {selectedWallet?.currency || "---"}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>ملاحظة</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="أضف ملاحظة قصيرة..."
                placeholderTextColor="#94A3B8"
                style={styles.noteInput}
                multiline
              />
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>ملخص سريع</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>المستلم</Text>
                <Text style={styles.summaryValue}>
                  {recipient?.name || recipient?.phone || "غير محدد"}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>المحفظة</Text>
                <Text style={styles.summaryValue}>
                  {selectedWallet?.currency || "غير محددة"}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>المبلغ</Text>
                <Text style={styles.summaryAmount}>
                  {amount?.trim() ? amount : "0.00"} {selectedWallet?.currency || ""}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                <Text style={styles.submitTxt}>إرسال التحويل</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screenn>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#DCE8FF",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE8FF",
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#DCE8FF",
  },

  heroBadgeText: {
    color: "#0B63D8",
    fontWeight: "900",
    fontSize: 12,
  },

  heroTitle: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: "900",
    color: "#0B1220",
  },

  heroSubtitle: {
    color: "#64748B",
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },

  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0B1220",
  },

  sectionHint: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B",
  },

  scanBtn: {
    marginTop: 4,
    backgroundColor: "#0B63D8",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  scanTxt: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  recipientCard: {
    marginTop: 14,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D8E7FF",
    backgroundColor: "#F5F9FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E9F1FF",
    alignItems: "center",
    justifyContent: "center",
  },

  recipientLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
  },

  recipientName: {
    marginTop: 2,
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "900",
  },

  recipientPhone: {
    marginTop: 2,
    fontSize: 13,
    color: "#475569",
  },

  emptyState: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FAFCFF",
  },

  emptyStateText: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 14,
  },

  fieldLabel: {
    marginTop: 10,
    marginBottom: 8,
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14,
  },

  walletsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  walletChip: {
    minWidth: 110,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },

  walletChipActive: {
    borderColor: "#0B63D8",
    backgroundColor: "#EAF2FF",
  },

  walletCurrency: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 13,
  },

  walletCurrencyActive: {
    color: "#0B63D8",
  },

  walletBalance: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },

  walletBalanceActive: {
    color: "#1D4ED8",
  },

  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    minHeight: 45,
    overflow: "hidden",
  },

  amountInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
  },

  currencyPill: {
    marginHorizontal: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  currencyPillText: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 12,
  },

  noteInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 96,
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },

  summaryCard: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 14,
    marginTop: 2,
  },

  summaryTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },

  summaryKey: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "700",
  },

  summaryValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  summaryAmount: {
    color: "#93C5FD",
    fontSize: 16,
    fontWeight: "900",
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  submitBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#0B63D8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  submitBtnDisabled: {
    backgroundColor: "#94A3B8",
  },

  submitTxt: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});