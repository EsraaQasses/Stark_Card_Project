import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useState } from "react";
import { Image, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getMe, login } from "../api/auth";
import { useAuth } from "../context/AuthProvider";
import { normalizeApiError } from "../shared/api/errors/apiError";
import Button from "../ui/Button";
import Screen from "../ui/Screen";
import { colors as themeColors, typography } from "../ui/Theme";
import { sp, sx, sy } from "../ui/scale";

/* ========== Helpers ========== */
export function normalizeApiErrors(data, status, fallbackMsg) {
  const fields = {};
  const messages = [];

  if (!data) {
    if (status === 401) messages.push("اسم المستخدم أو كلمة المرور غير صحيحة.");
    else if (status >= 500) messages.push("خطأ في الخادم. حاول مجدّدًا.");
    else messages.push(fallbackMsg || "فشل تسجيل الدخول");
    return { fields, messages };
  }

  if (typeof data.detail === "string") messages.push(data.detail);
  if (Array.isArray(data.non_field_errors)) messages.push(...data.non_field_errors.map(String));

  const addField = (k, v) => {
    const arr = Array.isArray(v) ? v : [v];
    fields[k] = arr.map((x) => String(x));
  };

  for (const k of Object.keys(data)) {
    if (["detail", "non_field_errors"].includes(k)) continue;
    const v = data[k];
    if (v != null && (typeof v === "string" || Array.isArray(v))) addField(k, v);
  }

  if (status === 401 && messages.length === 0) messages.push("اسم المستخدم أو كلمة المرور غير صحيحة.");
  if (messages.length === 0 && Object.keys(fields).length === 0) {
    messages.push(typeof data === "object" ? JSON.stringify(data) : String(data));
  }
  return { fields, messages };
}

export default function Login({ navigation, onLoginSuccess }) {
  const { signIn } = useAuth();

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errBanner, setErrBanner] = useState([]);
  const [infoBanner, setInfoBanner] = useState([]);
  const [fieldErr, setFieldErr] = useState({});

  const canLogin = userName.trim().length > 0 && password.trim().length > 0;

  const onLogin = async () => {
    if (loading || !canLogin) return; // منع الضغط المزدوج
    Keyboard.dismiss();
    setErrBanner([]);
    setInfoBanner([]);
    setFieldErr({});
    try {
      setLoading(true);

      // ⬅️ login بيرجع { access, refresh, user }
      const { access, refresh, user: userFromLogin } = await login(userName.trim(), password);
      if (!access) throw new Error("استجابة غير صالحة من الخادم (لا يوجد access token)");

      // اختياري: جيب الملف الشخصي لو السيرفر ما رجّعه مع login
      let profile = userFromLogin || null;
      if (!profile) {
        try {
          profile = await getMe();
        } catch {}
      }

      // ⬅️ AuthProvider.signIn يقبل { access, refresh, profile | user }
      const signedUser = await signIn({ access, refresh, profile });

      // ✅ Call onLoginSuccess callback to let Expo Router handle navigation
      if (onLoginSuccess) {
        onLoginSuccess(signedUser);
      }
    } catch (e) {
      const isNetwork = String(e?.message || "").toLowerCase().includes("network");
      if (isNetwork) {
        setInfoBanner(["خطأ في الشبكة. تأكّد أن الهاتف والخادوم على نفس الشبكة/IP."]);
      } else {
        const normalized = normalizeApiError(e, "ar");
        const status = normalized.status ?? 0;
        const fields = Object.fromEntries(
          Object.entries(normalized.fields || {}).map(([key, value]) => [
            key,
            (Array.isArray(value) ? value : [value]).map(String),
          ])
        );
        const messages = [normalized.message].filter(Boolean);
        if (status === 400 || status === 401 || messages.join(" ").toLowerCase().includes("password")) {
          fields.name = fields.name || ["تحقّق من اسم المستخدم."];
          fields.password = fields.password || ["تحقّق من كلمة المرور."];
        }
        setFieldErr(fields);
        setErrBanner(messages.length ? messages : ["فشل تسجيل الدخول"]);
      }
    } finally {
      setLoading(false);
    }
  };

  const nameHasError = Boolean(fieldErr.name?.length || fieldErr.username?.length);
  const passHasError = Boolean(fieldErr.password?.length);

  return (
    <Screen>
      {/* Header / Logo */}
      <View style={styles.header}>
        <Image source={require("../assets/Logo.png")} style={styles.logo} resizeMode="contain" />
      </View>

      {/* Banners */}
      {infoBanner.length > 0 && (
        <View style={styles.infoBanner}>
          {infoBanner.map((m, i) => (
            <Text key={i} style={styles.infoBannerText}>
              {m}
            </Text>
          ))}
        </View>
      )}

      {errBanner.length > 0 && (
        <View style={styles.errorBanner}>
          {errBanner.map((m, i) => (
            <Text key={i} style={styles.errorBannerText}>
              {m}
            </Text>
          ))}
        </View>
      )}

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.label}>اسم المستخدم</Text>
        <TextInput
          style={[styles.input, nameHasError && { borderColor: "tomato" }]}
          placeholder="اكتب اسم المستخدم"
          placeholderTextColor="rgba(0,0,0,0.5)"
          value={userName}
          onChangeText={setUserName}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => {}}
          textAlign="left"
        />
        {nameHasError && (
          <Text style={styles.helpError}>{(fieldErr.name || fieldErr.username || []).join(", ")}</Text>
        )}

        <View style={{ marginTop: sy(12) }}>
          <Text style={styles.label}>كلمة المرور</Text>
          <View style={{ position: "relative" }}>
            <TextInput
              style={[styles.input, styles.passwordInput, passHasError && { borderColor: "tomato" }]}
              placeholder="اكتب كلمة المرور"
              placeholderTextColor="rgba(0,0,0,0.5)"
              secureTextEntry={!show}
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={onLogin}
              textAlign="left"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eye}
              onPress={() => setShow((s) => !s)}
              hitSlop={{ top: sy(8), bottom: sy(8), left: sx(8), right: sx(8) }}
              disabled={loading}
            >
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={sp(18)} color="#0E1B3B" />
            </TouchableOpacity>
          </View>

          {/* ✅ Removed Forget Password button */}
        </View>

        <Button
          variant="auth"
          title="تسجيل الدخول"
          width={sx(226)}
          height={sy(52)}
          loading={loading}
          onPress={onLogin}
          disabled={!canLogin || loading}
          contentStyle={styles.loginButtonContent}
          textStyle={styles.loginButtonText}
          style={{ marginTop: sy(22), alignSelf: "center", opacity: canLogin && !loading ? 1 : 0.6 }}
        />
      </View>

      {/* OR divider */}
      <View style={styles.orBlock}>
        <View style={styles.line} />
        <Text style={styles.orText}>أو</Text>
        <View style={styles.line} />
      </View>

      {/* Register link */}
      <Link href="/(auth)/signup" asChild>
        <TouchableOpacity disabled={loading}>
          <Text style={styles.register}>إنشاء حساب جديد</Text>
        </TouchableOpacity>
      </Link>

      <Text style={styles.footer}>©2025 STARK-CARD</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: sy(6), marginBottom: sy(2) },
  logo: { width: sx(370), height: sy(250) },

  infoBanner: {
    marginHorizontal: sx(16),
    marginTop: sy(6),
    paddingVertical: sy(10),
    paddingHorizontal: sx(12),
    backgroundColor: "#E8F2FF",
    borderLeftWidth: 4,
    borderLeftColor: "#276EF1",
    borderRadius: sy(10),
  },
  infoBannerText: {
    color: "#0b3ea8",
    fontWeight: "700",
    fontSize: sp(12),
    marginBottom: sy(2),
    textAlign: "right",
  },

  errorBanner: {
    marginHorizontal: sx(16),
    marginTop: sy(6),
    paddingVertical: sy(10),
    paddingHorizontal: sx(12),
    backgroundColor: "#FFE8E8",
    borderLeftWidth: 4,
    borderLeftColor: "tomato",
    borderRadius: sy(10),
  },
  errorBannerText: {
    color: "#9b1c1c",
    fontWeight: "800",
    fontSize: sp(12),
    marginBottom: sy(2),
    textAlign: "right",
  },

  form: { flex: 1, marginTop: sy(8), paddingHorizontal: sx(2) },
  label: {
    color: themeColors.textPrimary,
    opacity: 0.9,
    marginBottom: sy(6),
    fontWeight: "600",
    fontSize: sp(14),
    marginLeft: sx(2),
    textAlign: "left",
  },
  input: {
    height: sy(48),
    borderRadius: sy(18),
    paddingHorizontal: sx(16),
    color: "#000",
    borderWidth: 1,
    borderColor: "rgba(34, 9, 255, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    fontSize: sp(14),
  },
  helpError: {
    color: "tomato",
    marginTop: sy(4),
    marginLeft: sx(4),
    fontSize: sp(12),
    fontWeight: "600",
    textAlign: "left",
  },

  eye: {
    position: "absolute",
    right: sx(6),
    top: sy(5),
    width: sy(38),
    height: sy(38),
    borderRadius: sy(19),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 99, 216, 0.08)",
  },
  loginButtonContent: {
    borderRadius: sy(18),
    paddingHorizontal: sx(20),
  },
  loginButtonText: {
    fontSize: sp(16),
    lineHeight: sy(22),
  },
  passwordInput: { paddingRight: sx(50) },

  orBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: sx(8),
    width: "100%",
    marginBottom: sy(12),
    borderBottomWidth: 0,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.5)" },
  orText: { color: themeColors.textPrimary, fontWeight: "800", fontSize: sp(13) },

  register: {
    color: themeColors.textPrimary,
    fontWeight: "800",
    textAlign: "center",
    marginTop: sy(4),
    marginBottom: sy(15),
    fontSize: sp(14),
  },

  footer: {
    textAlign: "center",
    color: themeColors.textPrimary,
    opacity: 0.8,
    fontSize: typography.footer.fontSize,
  },
});
