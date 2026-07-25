// src/screens/PayToUser.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, useWindowDimensions,
  Alert, KeyboardAvoidingView, Platform, ScrollView, I18nManager, ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import PageLayout from "../ui/PageLayout";   // الغلاف الموحّد (BottomNav + SideMenu)

export default function PayToUser({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const RTL = I18nManager.isRTL;

  // مقاسات متكيفة قريبة من Payment
  const { width: W, height: H } = useWindowDimensions();
  const BASE_W = 390, BASE_H = 844;
  const sx = (n) => (W / BASE_W) * n;
  const sy = (n) => (H / BASE_H) * n;
  const RADIUS = sx(16);
  const MAX_W = 480;

  // ---- قراءة كل الأسماء المحتملة القادمة من الصفحة السابقة (Products/AgentPurchase) ----
  const params = useMemo(() => route?.params ?? {}, [route?.params]);
  const productFromRoute = params.product ?? null;

  // أولوية لاختيار store_product_id الصحيح
  const storeProductId = useMemo(() => {
    return (
      params?.store_product_id ??
      productFromRoute?.store_product_id ??
      params?.product_id ??                 // fallback إن تم تمرير product_id (غير مفضّل)
      productFromRoute?.id ??
      null
    );
  }, [params, productFromRoute]);

  // اسم المنتج (اختياري للعرض فقط)
  const productName =
    params?.productDisplayName ||
    params?.product_name ||
    productFromRoute?.name ||
    productFromRoute?.name_ar ||
    productFromRoute?.name_en ||
    "";

  // تعبئة مبدئية لحقول المستلم لو وصلت من الشاشة السابقة
  const [userId, setUserId] = useState(String(params?.user_id ?? ""));
  const [name, setName]     = useState(params?.name ?? "");
  const [busy, setBusy]     = useState(false);

  // Debug اختياري
  useEffect(() => {
    try { console.log("PayToUser route params =>", params); } catch {}
  }, [params]);

  const goPayment = async () => {
    const uid = Number(String(userId || "").replace(/[^\d]/g, ""));
    if (!uid || uid <= 0) {
      Alert.alert("الدفع إلى مستخدم", "أدخل رقم مستخدم صحيح.");
      return;
    }
    if (!storeProductId) {
      Alert.alert("الدفع إلى مستخدم", "لا يوجد منتج مرتبط للدفع. أعد المحاولة من شاشة المنتج.");
      return;
    }

    try {
      setBusy(true);
      navigation.navigate("Payment", {
  // المنتج المطلوب
  store_product_id: Number(storeProductId),

  // نفس السعر/العملة اللي أجت من Products (لو موجودين)
  unit_price_display: route?.params?.unit_price_display ?? undefined,
  display_currency: route?.params?.display_currency ?? route?.params?.currency ?? undefined,

  // أعلام الوكيل لو جاي من منتجات لمستخدم وكيل
  is_agent: route?.params?.is_agent === true || route?.params?.flow === "agent",
  flow: route?.params?.flow || (route?.params?.is_agent ? "agent" : undefined),

  // تعبئة user_inputs
  user_inputs_prefill: {
    target_user_id: uid,
    target_user_name: name?.trim() || `User #${uid}`,
    // مفاتيح متوافقة مع أسماء شائعة
    user_id: uid,
    name: name?.trim() || `User #${uid}`,
  },

  // معلومات عرض
  productDisplayName: productName || undefined,


      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout navigation={navigation} active="shipping" withSideMenu>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: sy(120) + insets.bottom }}
          style={{ backgroundColor: "#FFFFFF" }}
          showsVerticalScrollIndicator={false}
        >
          {/* ===== هيدر شبيه بـ Payment ===== */}
          <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W }}>
            <View style={{ paddingTop: insets.top + sy(8), paddingHorizontal: sx(14) }}>
              <View style={[styles.header, { borderRadius: RADIUS }]}>
                <Text style={styles.headerTitle}>الدفع إلى مستخدم</Text>
                <Text style={styles.headerSub}>أدخل بيانات المستلم ثم تابع لصفحة الدفع</Text>
              </View>
            </View>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "#E4ECF2" }} />
          </View>

          {/* ===== بطاقة معلومات المنتج ===== */}
          <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W, paddingHorizontal: sx(14), marginTop: sy(12) }}>
            {(productName || storeProductId) && (
              <View style={[styles.infoCard, { borderRadius: RADIUS }]}>
                <LinearGradient
                  colors={["#ECF4FF", "#E7F5FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: RADIUS }]}
                />
                {!!productName && (
                  <Text style={styles.infoTitle}>
                    المنتج: <Text style={styles.infoStrong}>{productName}</Text>
                  </Text>
                )}
                {!!storeProductId && (
                  <Text style={[styles.infoTitle, { marginTop: 4 }]}>
                    store_product_id: <Text style={styles.infoStrong}>{String(storeProductId)}</Text>
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* ===== بطاقة مدخلات المستلم ===== */}
          <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W, paddingHorizontal: sx(14), marginTop: sy(8) }}>
            <View style={[styles.card, { borderRadius: RADIUS }]}>
              <Text style={styles.cardTitle}>بيانات المستلم</Text>

              <Field
                label={"رقم المستخدم (ID)"}
                value={userId}
                onChangeText={setUserId}
                keyboardType="number-pad"
                placeholder="مثال: 1024"
                RTL={RTL}
              />

              <Field
                label={"الاسم (اختياري)"}
                value={name}
                onChangeText={setName}
                placeholder="اسم المستلم ليس ضرورياً"
                RTL={RTL}
              />

              <Pressable
                onPress={goPayment}
                disabled={busy}
                style={[
                  styles.primaryBtn,
                  { borderRadius: sx(12), height: sy(48), marginTop: sy(6) },
                  busy && { opacity: 0.7 }
                ]}
              >
                <LinearGradient
                  colors={["#1274F5", "#0B63D8"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: sx(12) }]}
                />
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>المتابعة للدفع</Text>
                )}
              </Pressable>

              {!!storeProductId && (
                <View style={styles.hint}>
                  <Text style={styles.hintText}>سيتم دفع قيمة المنتج رقم: {String(storeProductId)}</Text>
                </View>
              )}
            </View>

            {/* ملاحظات بسيطة */}
            <View style={{ marginTop: sy(6) }}>
              <Text style={styles.note}>• سيتم تمرير بيانات المستلم تلقائيًا إلى صفحة الدفع، وتُضمَّن في user_inputs.</Text>
              <Text style={styles.note}>• تأكد من اختيار وسيلة الدفع وملء حقولها في الخطوة التالية.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PageLayout>
  );
}

/* ===== حقل موحّد (متناغم مع Payment) ===== */
function Field({ label, value, onChangeText, keyboardType, placeholder, multiline = false, RTL = false }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#7C8DA6"
        style={[
          styles.input,
          multiline && { height: 88, textAlignVertical: "top", paddingTop: 10 },
          { textAlign: RTL ? "right" : "left" },
        ]}
        multiline={multiline}
      />
    </View>
  );
}

/* ===== Styles (قريبة من Payment.js) ===== */
const styles = StyleSheet.create({
  header: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4ECF2",
  },
  headerTitle: { color: "#0E1B3B", fontWeight: "900", fontSize: 20 },
  headerSub: { color: "#5F708C", marginTop: 2 },

  infoCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E4ECF2",
    padding: 12,
  },
  infoTitle: { color: "#0E1B3B", fontWeight: "800" },
  infoStrong: { color: "#0B63D8", fontWeight: "900" },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E4ECF2",
    padding: 14,
  },
  cardTitle: { color: "#0E1B3B", fontWeight: "900", marginBottom: 8 },

  label: {
    color: "#0E1B3B",
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E4ECF2",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    color: "#0E1B3B",
  },

  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0B63D8",
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  hint: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 28,
    justifyContent: "center",
  },
  hintText: { fontSize: 12, fontWeight: "700", color: "#0E1B3B" },
  note: { color: "#5F708C", marginTop: 6, fontSize: 12, lineHeight: 18 },
});
