// src/screens/payments/ShippingMethodInfo.js
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import PageLayout from "../../ui/PageLayout";
import {
  createDepositRequest,
  createAgentShippingRequest, // (موجود عندك سابقاً - خليته مثل ما هو)
  createAgentAdminShippingRequest,
} from "../../api/deposits";
import { getWallet } from "../../api/wallets";
import { useAuth } from "../../context/AuthProvider";
import { listUserPaymentMethods } from "../../api/paymentMethods";
import { absolutizeUrl } from "../../api/client";
import { getCache, setCache, cacheKey } from "../../utils/cache";

const BASE_W = 390,
  BASE_H = 844;


export default function ShippingMethodInfo({ navigation, route }) {
  const rawParams = route?.params || {};

  const adminKey = rawParams?.adminKey || null;
  let methodParam = rawParams?.method || null;
  const methodIdParam = rawParams?.methodId ?? rawParams?.id ?? null;

  // expo-router stringifies non-serializable params; guard against that.
  if (methodParam === "[object Object]" || typeof methodParam === "object") {
    methodParam = null;
  }

  const forceAgent =
    rawParams?.forceAgent === true ||
    String(rawParams?.forceAgent || "").toLowerCase() === "true";

  const forceAdminShipping =
    rawParams?.forceAdminShipping === true ||
    String(rawParams?.forceAdminShipping || "").toLowerCase() === "true";

  const ADMIN_METHOD = useMemo(
    () => ({
      id: "agent-shipping-admin",
      title: "اشحن رصيدك عبر الإدارة",
      name: "agent_shipping_admin",
      is_agent_admin_shipping: true,
      icon_url: null,
      fields: [
        { field_key: "agent_number", field_name: "رقم التحويل", is_required: true },
      ],
      instructions: "أدخل رقم التحويل واختر المحفظة ثم أرسل الطلب للإدارة.",
      requires_receipt: false,
    }),
    []
  );

  let parsedMethod = null;
  if (typeof methodParam === "string") {
    try {
      const maybe = JSON.parse(methodParam);
      if (maybe && typeof maybe === "object") parsedMethod = maybe;
    } catch { }
  }

  const initialMethod =
    adminKey === "agent-shipping-admin" ? ADMIN_METHOD : parsedMethod;
  const [method, setMethod] = useState(initialMethod);

  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const sx = (n) => (W / BASE_W) * n;
  const sy = (n) => (H / BASE_H) * n;

  const { user } = useAuth();

  // ✅ مهم: عرفهم قبل أي useEffect يستخدمهم
  const isAgentShippingMethod = !!(
    method?.is_agent_shipping || initialMethod?.is_agent_shipping
  );
  const isAdminShippingMethod = !!(
    method?.is_agent_admin_shipping || initialMethod?.is_agent_admin_shipping
  );
  const effectiveForceAgent = forceAgent || isAgentShippingMethod;
  const effectiveForceAdmin = forceAdminShipping || isAdminShippingMethod;

  const connectedAgent =
    user?.raw?.connected_agent ||
    user?.raw?.agent ||
    user?.connected_agent ||
    (typeof user?.agent === "object" ? user.agent : null) ||
    null;

  const hasAgent = !!(
    user?.agent_profile ||
    user?.agent ||
    user?.agent_id ||
    connectedAgent
  );

  const requiresReceipt =
    method?.requires_receipt !== false &&
    !effectiveForceAgent &&
    !effectiveForceAdmin;

  const agentName =
    user?.agent_profile?.user?.name ||
    user?.agent_profile?.name ||
    user?.agent?.name ||
    connectedAgent?.name ||
    connectedAgent?.full_name ||
    "";

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [receipt, setReceipt] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const redirectedRef = useRef(false);

  React.useEffect(() => {
    /*
    if (__DEV__) {
      console.log("[ShippingMethodInfo] mount", {
        forceAdminShipping,
        forceAgent,
        effectiveForceAdmin,
        effectiveForceAgent,
        methodIdParam,
        methodId: method?.id || method?.name,
      });
    }
    */
  }, [
    forceAdminShipping,
    forceAgent,
    effectiveForceAdmin,
    effectiveForceAgent,
    methodIdParam,
    method,
  ]);

  // تحميل طريقة الدفع حسب methodIdParam
  React.useEffect(() => {
    let alive = true;
    const numericMethodId = Number(methodIdParam);
    const hasNumericMethodId = Number.isFinite(numericMethodId);
    if (methodParam || adminKey === "agent-shipping-admin") return;
    if (!hasNumericMethodId) return;

    (async () => {
      try {
        const cached = await getCache(cacheKey("paymentMethods", "list"));
        if (alive && Array.isArray(cached)) {
          const c = cached.find(
            (m) => String(m?.id) === String(methodIdParam)
          );
          if (c) setMethod(c);
        }

        const list = await listUserPaymentMethods();
        const found = Array.isArray(list)
          ? list.find((m) => String(m?.id) === String(methodIdParam))
          : null;

        if (alive && found) {
          setMethod(found);
          await setCache(cacheKey("paymentMethods", "list"), list);
        }
      } catch (e) {
        if (__DEV__) console.log("[ShippingMethodInfo] load method error", e?.message);
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [methodParam, methodIdParam, adminKey]);

  // Build admin method locally when only adminKey is provided.
  React.useEffect(() => {
    if (adminKey === "agent-shipping-admin") {
      setMethod(ADMIN_METHOD);
    }
  }, [adminKey, ADMIN_METHOD]);

  // لو forced agent ومفيش وكيل
  React.useEffect(() => {
    /*
    if (__DEV__)
      console.log("[ShippingMethodInfo] agent check", {
        effectiveForceAgent,
        hasAgent,
        methodIdParam,
      });
    */
    if (!effectiveForceAgent) return;
    if (!hasAgent && !redirectedRef.current) {
      redirectedRef.current = true;
      Alert.alert(
        "Agent Required",
        "Please assign an agent before shipping via agent."
      );
      navigation.navigate("OurAgents", { public: true, mode: "assign" });
    }
  }, [effectiveForceAgent, hasAgent, navigation, methodIdParam]);

  const methodFields = useMemo(() => {
    const fields = Array.isArray(method?.fields) ? method.fields : [];
    return fields.filter((f) => f?.input_type !== "file");
  }, [method]);

  const pickReceipt = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("صلاحيات الصور", "يرجى السماح بالوصول للصور لرفع الإيصال.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (res.canceled || !res.assets?.[0]) return;

      const asset = res.assets[0];
      setReceipt({
        uri: asset.uri,
        name: asset.fileName || `receipt-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });
    } catch (_e) {
      Alert.alert("خطأ", "فشل اختيار الصورة.");
    }
  }, []);

  const clearReceipt = () => setReceipt(null);

  const updateField = (key, value) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const amt = Number(String(amount || "").replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert("مطلوب", "أدخل مبلغاً صحيحاً.");
      if (__DEV__) console.log("[ShippingMethodInfo] validate: invalid amount", amount);
      return false;
    }

    for (const f of methodFields) {
      if (f?.is_required && !String(fieldValues[f.field_key] || "").trim()) {
        Alert.alert("مطلوب", `يرجى تعبئة الحقل: ${f.field_name}`);
        if (__DEV__) console.log("[ShippingMethodInfo] validate: missing field", f.field_key);
        return false;
      }
    }

    if (requiresReceipt && !receipt) {
      Alert.alert("مطلوب", "يرجى رفع صورة إيصال واضحة.");
      if (__DEV__) console.log("[ShippingMethodInfo] validate: missing receipt");
      return false;
    }

    return true;
  };

  const onSubmit = useCallback(async () => {
    if (submitting || submitLockRef.current) return;

    // ✅ lock مرة واحدة فقط
    submitLockRef.current = true;

    try {
      if (!method && !effectiveForceAdmin && !effectiveForceAgent) {
        Alert.alert("خطأ", "طريقة الشحن غير معروفة.");
        if (__DEV__) console.log("[ShippingMethodInfo] onSubmit blocked: no method");
        return;
      }

      if (!validate()) return;

      const amt = Number(String(amount || "").replace(",", "."));
      const walletData = await getWallet().catch(() => null);
      const walletCurrency = (currency || walletData?.preferred_currency || "USD")
        .toUpperCase();

      const paymentMethodId = Number.isFinite(Number(method?.id))
        ? Number(method.id)
        : undefined;

      const extra = {
        ...fieldValues,
        shipping_channel: effectiveForceAgent ? "agent" : "admin",
        wallet_currency: walletCurrency,
        user_phone: user?.phone || "",
      };

      setSubmitting(true);

      if (__DEV__) {
        console.log("[ShippingMethodInfo] submit", {
          mode: effectiveForceAdmin ? "admin" : effectiveForceAgent ? "agent" : "deposit",
          amount: amt,
          currency: walletCurrency,
          note: note || "",
          paymentMethodId,
          extra,
          hasReceipt: !!receipt,
        });
      }

      const resp = effectiveForceAdmin
        ? await createAgentAdminShippingRequest({
          amount: amt,
          currency: walletCurrency,
          wallet_currency: walletCurrency,
          note: note || "",
          extra,
        })
        : effectiveForceAgent
          ? await createAgentShippingRequest({
            amount: amt,
            currency: walletCurrency,
            note: note || "",
            ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
            wallet_currency: walletCurrency,
            extra,
            receipt,
          })
          : await createDepositRequest({
            amount: amt,
            currency: walletCurrency,
            method: method?.name || method?.title || "manual",
            note: note || "",
            ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
            receipt,
            extra,
          });

      if (!resp || resp.ok === false) {
        throw new Error(resp?.error || "فشل إنشاء طلب الشحن");
      }

      Alert.alert("تم الإرسال", "تم تسجيل الطلب بنجاح.");
      navigation.navigate("MyShippings");
    } catch (e) {
      Alert.alert("خطأ", e?.message || "فشل إرسال الطلب.");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }, [submitting, method, effectiveForceAdmin, effectiveForceAgent, validate, amount, currency, fieldValues, user?.phone, note, receipt, navigation]);

  return (
    <PageLayout navigation={navigation} active="shipping" withSideMenu={true}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + sy(10),
          paddingBottom: insets.bottom + sy(90),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { marginHorizontal: sx(14) }]}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>شحن</Text>
          </View>

          <Text style={[styles.heroTitle, { fontSize: sx(20) }]}>
            {effectiveForceAgent
              ? "شحن عبر الوكيل"
              : method?.title || method?.name || "طريقة الشحن"}
          </Text>

          {!!method?.icon_url && (
            <View style={styles.heroIconWrap}>
              <Image
                source={{ uri: absolutizeUrl(method.icon_url) }}
                style={styles.heroIconImg}
                resizeMode="contain"
              />
            </View>
          )}

          <Text style={styles.heroSub}>
            {effectiveForceAgent
              ? "بدون إيصال. الوكيل يؤكد الطلب ويعالج الشحن."
              : "أكمل التفاصيل لإرسال طلب شحن رصيدك بسرعة."}
          </Text>

          <View style={styles.heroRow}>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{currency}</Text>
            </View>

            {effectiveForceAgent && (
              <View style={[styles.heroChip, styles.heroChipAgent]}>
                <Text style={[styles.heroChipText, styles.heroChipAgentText]}>
                  بدون إيصال
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.card, { marginHorizontal: sx(14) }]}>
          {!!method?.account_details && (
            <InfoBlock label="بيانات الحساب" text={method.account_details} />
          )}
          {!!method?.instructions && (
            <InfoBlock label="التعليمات" text={method.instructions} />
          )}
          {!!method?.note && <InfoBlock label="ملاحظات" text={method.note} />}

          {__DEV__ && (
            <Text style={{ marginTop: 6, color: "#64748B", fontSize: 12 }}>
              debug: admin={String(effectiveForceAdmin)} agent=
              {String(effectiveForceAgent)} method=
              {String(method?.id || method?.name || "-")}
            </Text>
          )}

          {forceAgent && (
            <InfoBlock label="الوكيل" text={agentName || "تم ربط وكيل لهذا الحساب"} />
          )}
        </View>

        <View style={[styles.card, { marginHorizontal: sx(14), marginTop: sy(12) }]}>
          <View style={styles.stepsRow}>
            <View style={styles.stepPillActive}>
              <Text style={styles.stepTextActive}>1. التفاصيل</Text>
            </View>
            <View style={styles.stepPill}>
              <Text style={styles.stepText}>2. إرسال الطلب</Text>
            </View>
            <View style={styles.stepPill}>
              <Text style={styles.stepText}>3. المراجعة</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>تفاصيل الشحن</Text>

          <Label>المبلغ</Label>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Label>عملة المحفظة</Label>
          <View style={styles.row}>
            {["USD", "SYP"].map((cur) => {
              const active = currency === cur;
              return (
                <Pressable
                  key={cur}
                  onPress={() => setCurrency(cur)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                    {cur}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {methodFields.length > 0 && (
            <View style={{ marginTop: sy(8) }}>
              {methodFields.map((f) => (
                <View key={f.field_key} style={{ marginTop: sy(10) }}>
                  <Label>
                    {f.field_name} {f.is_required ? "*" : ""}
                  </Label>
                  <TextInput
                    value={fieldValues[f.field_key] || ""}
                    onChangeText={(v) => updateField(f.field_key, v)}
                    placeholder={f.placeholder || ""}
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    keyboardType={
                      f.input_type === "number"
                        ? "numeric"
                        : f.input_type === "phone"
                          ? "phone-pad"
                          : "default"
                    }
                  />
                </View>
              ))}
            </View>
          )}

          <View style={{ marginTop: sy(10) }}>
            <Label>ملاحظات (اختياري)</Label>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="رقم المرسل أو أي تفاصيل إضافية"
              placeholderTextColor="#94a3b8"
              style={[styles.input, styles.textarea]}
              multiline
              numberOfLines={4}
            />
          </View>

          {requiresReceipt && (
            <View style={{ marginTop: sy(12) }}>
              <Label>صورة الإيصال</Label>
              <Text style={styles.hint}>يرجى رفع صورة واضحة ومقروءة.</Text>

              {receipt ? (
                <View style={styles.receiptWrap}>
                  <Image source={{ uri: receipt.uri }} style={styles.receiptImg} />
                  <Pressable onPress={clearReceipt} style={styles.removeReceipt}>
                    <Text style={styles.removeReceiptTxt}>إزالة</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={pickReceipt} style={styles.uploadBtn}>
                  <Text style={styles.uploadTxt}>رفع الإيصال</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={submitting || submitLockRef.current}
          style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
        >
          <Text style={styles.primaryTxt}>
            {submitting ? "جارٍ الإرسال..." : "إرسال طلب الشحن"}
          </Text>
        </Pressable>
      </ScrollView>
    </PageLayout>
  );
}

function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

function InfoBlock({ label, text }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#0B63D8",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBadgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  heroTitle: { marginTop: 8, fontWeight: "900", color: "#fff" },
  heroSub: { marginTop: 6, color: "rgba(255,255,255,0.9)" },
  heroRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  heroChip: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroChipText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  heroChipAgent: { backgroundColor: "rgba(255,186,61,0.25)" },
  heroChipAgentText: { color: "#FFD89B" },
  heroIconWrap: {
    marginTop: 10,
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconImg: { width: "100%", height: "100%" },

  stepsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  stepPillActive: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E6F6FF",
    borderWidth: 1,
    borderColor: "#BFDFFF",
  },
  stepText: { color: "#475569", fontWeight: "800", fontSize: 12 },
  stepTextActive: { color: "#0B63D8", fontWeight: "900", fontSize: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E4ECF2",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },

  title: { fontWeight: "900", color: "#0E1B3B" },
  sectionTitle: { fontWeight: "900", color: "#0E1B3B", marginBottom: 8 },

  infoBlock: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  infoLabel: { color: "#0E1B3B", fontWeight: "800", marginBottom: 4 },
  infoText: { color: "#334155" },

  label: { marginTop: 10, fontWeight: "800", color: "#0E1B3B" },

  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    color: "#0F172A",
    fontWeight: "700",
  },
  textarea: { height: 110, textAlignVertical: "top" },

  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },

  chip: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "#E6F6FF", borderColor: "#BFDFFF" },
  chipTxt: { color: "#0E1B3B", fontWeight: "800" },
  chipTxtActive: { color: "#0B63D8" },

  hint: { color: "#64748b", marginTop: 4 },

  uploadBtn: {
    marginTop: 8,
    backgroundColor: "#1274f5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  uploadTxt: { color: "#fff", fontWeight: "900" },

  receiptWrap: { marginTop: 8, alignItems: "center" },
  receiptImg: { width: "100%", height: 180, borderRadius: 12 },

  removeReceipt: { marginTop: 6 },
  removeReceiptTxt: { color: "#e11d48", fontWeight: "800" },

  primaryBtn: {
    marginTop: 14,
    marginHorizontal: 14,
    backgroundColor: "#0B63D8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryTxt: { color: "#fff", fontWeight: "900" },
});
