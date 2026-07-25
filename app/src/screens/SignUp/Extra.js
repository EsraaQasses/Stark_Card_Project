// src/screens/SignUp/Extra.js
import React, { useMemo, useState, useCallback } from "react";
import { View, Image, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import Screen from "../../ui/Screen";
import Button from "../../ui/Button";
import theme from "../../ui/Theme";
import { sx, sy, sp } from "../../ui/scale";

const { colors: themeColors } = theme;
import Select from "../../ui/Select";
import { register as apiRegister } from "../../api/auth";

const PENDING_AGENT_KEY = "@pending_agent_code";

/* === بيانات الدول === */
const COUNTRY_DATA = {
  SYPia: { phoneCode: "+963" },
  USA: { phoneCode: "+1" },
};

// نعرض أسماء الدول بالعربي لكن نُبقي value كما يتوقعه الباك
const COUNTRY_OPTIONS = [
  { label: "سوريا", value: "SYPia" },
  { label: "الولايات المتحدة", value: "USA" },
];

export default function Extra() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // params من Expo Router غالباً strings
  // لذلك seed لازم يكون JSON string
  const seed = useMemo(() => {
    try {
      return params?.seed ? JSON.parse(String(params.seed)) : {};
    } catch {
      return {};
    }
  }, [params?.seed]);

  // اجمع params + seed (وخلي seed يغلب)
  const base = useMemo(() => ({ ...params, ...seed }), [params, seed]);

  // تحديد المزوّد
  const provider = base?.provider || (base?.email ? "email" : base?.phone ? "phone" : "email");
  const needPhone = provider === "phone" || base?.phoneRequired === "true" || base?.phoneRequired === true;

  const [country, setCountry] = useState("SYPia");
  const defaults = useMemo(() => COUNTRY_DATA[country] || { phoneCode: "" }, [country]);

  // هاتف واحد فقط
  const [phone, setPhone] = useState(String(base?.phone || ""));
  const [agentCode, setAgentCode] = useState("");
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const pending = await AsyncStorage.getItem(PENDING_AGENT_KEY);
        if (mounted && pending) {
          setAgentCode(pending);
          await AsyncStorage.removeItem(PENDING_AGENT_KEY);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const nonEmpty = (s) => (s || "").toString().trim().length > 0;
  const digits = (s) => (s || "").toString().replace(/\D+/g, "");
  const intlify = (raw, cc) => {
    if (!raw) return null;
    const trimmed = raw.toString().trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("+")) return trimmed; // المُستخدم أدخلها دولياً
    const national = digits(trimmed).replace(/^0+/, "");
    if (!national) return null;
    return `${(cc || "").toString().trim()}${national}`;
  };

  const canSubmit =
    nonEmpty(base?.full_name) &&
    nonEmpty(base?.name) &&
    nonEmpty(base?.password) &&
    (provider === "email" ? true : nonEmpty(phone));

  const onRegister = async () => {
    if (loading) return;
    if (!canSubmit) {
      Alert.alert("بيانات ناقصة", needPhone ? "رقم الهاتف مطلوب." : "تحقّق من الحقول الأساسية.");
      return;
    }

    try {

      const phoneIntl = intlify(phone, defaults.phoneCode);

      if (needPhone && !phoneIntl) {
        Alert.alert("تنسيق الرقم", "رجاءً أدخل رقم هاتف صحيح.");
        return;
      }

      // التحقق من أن البيانات الأساسية موجودة
      if (!base?.full_name || !base?.name || !base?.password) {
        Alert.alert("خطأ", "البيانات الأساسية ناقصة. يرجى العودة والتحقق.");
        return;
      }

      setLoading(true);
      const payload = {
        full_name: String(base.full_name).trim(),
        name: String(base.name).trim(),
        password: String(base.password),
        provider,

        email: provider === "email" ? String(base?.email || "").trim() : undefined,
        phone: phoneIntl || undefined,

        country,
        agent_code: nonEmpty(agentCode) ? agentCode.trim() : undefined,
        role: "user",
      };

      if (provider === "email" && !payload.email) {
        Alert.alert("خطأ", "البريد الإلكتروني مطلوب.");
        return;
      }

      await apiRegister(payload);
      await AsyncStorage.setItem("pending_name", payload.name);

      Alert.alert(
  "تم إنشاء الحساب",
  "أرسلنا رمز التحقق. الرجاء إدخاله في الصفحة التالية.",
  [
    {
      text: "متابعة",
      onPress: () => {
        router.replace({
          pathname: "/(auth)/verification",
          params: { name: payload.name },
        });
      },
    },
  ],
  { cancelable: false }
);

    } catch (err) {
      let msg = "فشل إنشاء الحساب. تحقّق من البيانات وحاول مجدداً.";

      if (err?.response?.status === 400) {
        const data = err.response.data;
        if (data?.name) msg = `اسم المستخدم: ${Array.isArray(data.name) ? data.name[0] : data.name}`;
        else if (data?.email) msg = `البريد: ${Array.isArray(data.email) ? data.email[0] : data.email}`;
        else if (data?.phone) msg = `الهاتف: ${Array.isArray(data.phone) ? data.phone[0] : data.phone}`;
        else if (data?.detail) msg = data.detail;
      } else if (err?.message) {
        msg = err.message;
      }

      Alert.alert("خطأ", String(msg));
    } finally {
      setLoading(false);
    }
  };

  const phoneLabel = needPhone ? "رقم الهاتف (مطلوب)" : "رقم الهاتف (اختياري)";

  return (
    <Screen>
      {/* الشعار */}
      <View style={styles.header}>
        <Image source={require("../../assets/Logo.png")} style={styles.logo} resizeMode="contain" />
      </View>

      {/* النموذج */}
      <View style={styles.form}>
        {/* الدولة */}
        <Text style={styles.label}>الدولة</Text>
        <View style={{ marginBottom: sy(12) }}>
          <Select value={country} options={COUNTRY_OPTIONS} onChange={setCountry} />
        </View>

        {/* الهاتف */}
        <Text style={styles.label}>{phoneLabel}</Text>
        <View style={styles.phoneRow}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>{defaults.phoneCode || "+___"}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder={needPhone ? "رقم الهاتف" : "اختياري"}
            placeholderTextColor="rgba(0,0,0,0.5)"
            keyboardType="phone-pad"
            inputMode="tel"
            textContentType="telephoneNumber"
            value={phone}
            onChangeText={setPhone}
            textAlign="right"
          />
        </View>

        {/* رمز الوكيل (اختياري) */}
        <Text style={styles.label}>رمز الوكيل (اختياري)</Text>
        <TextInput
          style={styles.input}
          placeholder="أدخل رمز الوكيل إن وُجد"
          placeholderTextColor="rgba(0,0,0,0.5)"
          autoCapitalize="characters"
          value={agentCode}
          onChangeText={setAgentCode}
          textAlign="right"
        />
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/(auth)/agent-qr-connect", params: { mode: "signup" } })}
          style={styles.scanBtn}
        >
          <Text style={styles.scanBtnText}>مسح QR للوكيل (اختياري)</Text>
        </TouchableOpacity>

        <Button
          variant="auth"
          title={loading ? "جارٍ الإرسال…" : "إنشاء حساب"}
          width={sx(143)}
          height={sy(55)}
          disabled={!canSubmit || loading}
          onPress={onRegister}
          style={{ marginTop: sy(22), alignSelf: "center", opacity: !canSubmit || loading ? 0.6 : 1 }}
        />

        {/* تخطّي مؤقّت - DISABLED: Prevent unauthorized entry into (app) */}
        {/* Redirects to login instead to maintain auth flow and avoid redirect storms */}
        {/* <TouchableOpacity
          onPress={() => router.replace("/(app)/home")}
          style={{ alignSelf: "center", marginTop: sy(12) }}
        >
          <Text style={[styles.register, { opacity: 0.85 }]}>تخطّي مؤقّتاً</Text>
        </TouchableOpacity> */}
      </View>

      {/* أسفل الصفحة */}
      <View style={styles.bottomBlock}>
        <View style={styles.bottomRow}>
          <View style={styles.line} />
          <Text style={styles.muted}>لديك حساب مسبقاً؟</Text>
          <View style={styles.line} />
        </View>
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.link}>تسجيل الدخول</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>©2025 STARK-CARD</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: sy(10), marginBottom: sy(2) },
  logo: { width: sx(370), height: sy(250) },

  form: { flex: 1, marginTop: sy(15), paddingHorizontal: sx(2) },

  label: {
    color: themeColors.textPrimary,
    opacity: 0.9,
    marginBottom: sy(6),
    fontWeight: "600",
    fontSize: sp(14),
    marginLeft: sx(6),
    textAlign: "right",
  },

  input: {
    height: sy(44),
    borderRadius: sy(25),
    paddingHorizontal: sx(14),
    color: "#000",
    borderWidth: 1,
    borderColor: "rgba(34, 9, 255, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    marginBottom: sy(12),
  },
  scanBtn: {
    alignSelf: "flex-start",
    marginBottom: sy(12),
    paddingHorizontal: sx(12),
    paddingVertical: sy(8),
    borderRadius: sy(16),
    borderWidth: 1,
    borderColor: "rgba(34, 9, 255, 0.35)",
    backgroundColor: "rgba(235, 245, 255, 0.8)",
  },
  scanBtnText: { color: themeColors.textPrimary, fontWeight: "700", fontSize: sp(12) },
  agentNote: {
    color: themeColors.textMuted || "rgba(0,0,0,0.55)",
    fontSize: sp(11),
    marginBottom: sy(8),
    textAlign: "right",
  },

  phoneRow: { flexDirection: "row", gap: sx(8), alignItems: "center" },
  prefixBox: {
    height: sy(44),
    borderRadius: sy(25),
    paddingHorizontal: sx(14),
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(34, 9, 255, 0.35)",
    minWidth: sx(90),
    marginBottom: sy(12),
  },
  prefixText: { color: "#000", fontWeight: "700", fontSize: sp(14), textAlign: "right" },
  phoneInput: { flex: 1 },

  bottomBlock: { alignItems: "center", marginBottom: sy(6) },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: sy(12),
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.5)" },
  muted: { color: themeColors.textMuted, fontWeight: "600", marginHorizontal: sx(8), fontSize: sp(12) },
  link: {
    color: themeColors.textPrimary,
    fontWeight: "800",
    marginTop: sy(10),
    textAlign: "center",
    marginBottom: sy(12),
    fontSize: sp(14),
  },

  register: { color: themeColors.textPrimary, fontWeight: "700", fontSize: sp(14) },

  footer: {
    textAlign: "center",
    color: themeColors.textPrimary,
    opacity: 0.8,
    fontSize: theme?.typography?.footer?.fontSize || sp(12),
  },
});
