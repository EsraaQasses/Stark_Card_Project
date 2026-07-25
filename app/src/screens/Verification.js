import React, { useMemo, useState } from "react";
import { Alert, Image, StyleSheet, Text, TextInput, View } from "react-native";

import { resendOtp, verifyOtp } from "../api/auth";
import Button from "../ui/Button";
import Screen from "../ui/Screen";
import theme from "../ui/Theme";
import { sp, sx, sy } from "../ui/scale";

const { colors: themeColors, typography } = theme;
const OTP_LEN = 6;

// تحويل الأرقام العربية/الفارسية إلى إنجليزية
function toAsciiDigits(str) {
  const ar = "٠١٢٣٤٥٦٧٨٩";
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return (str || "").replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ar.indexOf(d);
    if (i !== -1) return String(i);
    const j = fa.indexOf(d);
    if (j !== -1) return String(j);
    return d;
  });
}

export default function Verification({ initialName = "", onVerified }) {
  const initial = useMemo(() => String(initialName || ""), [initialName]);

  const [name, setName] = useState(initial);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const canEnter = code.trim().length === OTP_LEN && (name || "").trim().length > 0;

  const onChangeCode = (v) => {
    const ascii = toAsciiDigits(v);
    const digits = ascii.replace(/[^0-9]/g, "").slice(0, OTP_LEN);
    setCode(digits);
  };

  const goAfterVerified = () => {
    if (typeof onVerified === "function") onVerified();
  };

  const handleVerify = async () => {
    if (!canEnter) return;

    try {
      setLoading(true);
      await verifyOtp({ name: name.trim(), code: code.trim() });

      // ✅ لا تعمل replace مباشرة بعد Alert
      Alert.alert("تم التفعيل", "تم تفعيل الحساب بنجاح.", [
        { text: "متابعة", onPress: goAfterVerified },
      ]);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data ||
        "فشل التحقق من الرمز.";
      Alert.alert("فشل التحقق", String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!name.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال اسم المستخدم أولاً.");
      return;
    }

    try {
      setResending(true);
      await resendOtp({ name: name.trim() });
      Alert.alert("تم الإرسال", "أعدنا إرسال رمز التحقق. تفقد صندوق الوارد/الرسائل.");
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.response?.data ||
        "تعذّر إعادة إرسال الرمز.";
      Alert.alert("خطأ", String(msg));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Image source={require("../assets/Logo.png")} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.center} pointerEvents="box-none">
        <Text style={styles.title}>رمز التحقق</Text>

        {!initial ? (
          <>
            <Text style={styles.label}>اسم المستخدم</Text>
            <TextInput
              style={styles.input}
              placeholder="اكتب اسم المستخدم"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              textAlign="right"
            />
          </>
        ) : null}

        <Text style={[styles.label, { marginTop: sy(6) }]}>أدخل الرمز المؤلف من 6 أرقام</Text>
        <TextInput
          style={[styles.input, styles.otpInput]}
          value={code}
          onChangeText={onChangeCode}
          autoFocus
          showSoftInputOnFocus
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={OTP_LEN}
          placeholder="••••••"
          placeholderTextColor="rgba(0,0,0,0.3)"
        />

        <Button
          variant="auth"
          title={loading ? "يرجى الانتظار…" : "تحقّق"}
          width={sx(160)}
          height={sy(55)}
          onPress={handleVerify}
          disabled={!canEnter || loading}
          style={{ marginTop: sy(18), opacity: canEnter && !loading ? 1 : 0.6 }}
        />

        <Text
          onPress={resending ? undefined : handleResend}
          style={[styles.resend, { opacity: resending ? 0.6 : 1 }]}
        >
          {resending ? "جارٍ إعادة الإرسال…" : "إعادة إرسال الرمز"}
        </Text>
      </View>

      <View style={styles.bottomBlock}>
        <View style={styles.bottomRow}>
          <View style={styles.line} />
          <Text style={styles.muted}>لديك حساب مسبقاً؟</Text>
          <View style={styles.line} />
        </View>

        <Text style={styles.link} onPress={goAfterVerified}>
          تسجيل الدخول
        </Text>
      </View>

      <Text style={styles.footer}>©2025 STARK-CARD</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: sy(10), marginBottom: sy(2) },
  logo: { width: sx(370), height: sy(250) },

  center: { flex: 1, alignItems: "center", marginTop: sy(10), width: "100%", paddingHorizontal: sx(16) },

  title: { color: themeColors.textPrimary, fontWeight: "800", fontSize: sp(18), marginBottom: sy(8) },
  label: {
    color: themeColors.textPrimary,
    opacity: 0.9,
    marginBottom: sy(6),
    fontWeight: "700",
    fontSize: sp(14),
    textAlign: "right",
    width: "100%",
  },

  input: {
    width: "100%",
    height: sy(48),
    borderRadius: sy(25),
    paddingHorizontal: sx(14),
    color: "#000",
    borderWidth: 1,
    borderColor: "rgba(34, 9, 255, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: sy(8),
  },
  otpInput: {
    letterSpacing: sx(6),
    textAlign: "center",
    fontWeight: "800",
    fontSize: sp(18),
  },

  resend: {
    marginTop: sy(10),
    fontSize: sp(13),
    fontWeight: "800",
    color: themeColors.textPrimary,
  },

  bottomBlock: { alignItems: "center", marginBottom: sy(6) },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", marginBottom: sy(4) },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.5)" },
  muted: { color: themeColors.textMuted, fontWeight: "600", marginHorizontal: sx(8), fontSize: sp(12) },
  link: { color: themeColors.textPrimary, fontWeight: "800", marginTop: sy(4), textAlign: "center", fontSize: sp(14) },

  footer: { textAlign: "center", color: themeColors.textPrimary, opacity: 0.8, fontSize: typography?.footer?.fontSize || sp(12) },
});
