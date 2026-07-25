// src/screens/SignUp/ResetPassword.js
import React, { useEffect, useState } from "react";
import { View, Image, Text, TextInput, StyleSheet, Keyboard } from "react-native";
import Screen from "../../ui/Screen";
import Button from "../../ui/Button";
import theme from "../../ui/Theme";
import { sx, sy, sp } from "../../ui/scale";
import { resetPassword } from "../../api/auth";

const { colors: themeColors, typography } = theme;

function firstParam(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value == null ? "" : String(value);
}

export default function ResetPassword({ navigation, route }) {
  const routeToken = firstParam(route?.params?.token);

  const [token, setToken] = useState(routeToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errBanner, setErrBanner] = useState([]);

  useEffect(() => {
    setToken(routeToken);
  }, [routeToken]);

  const tokenTrim = token.trim();
  const hasRouteToken = routeToken.trim().length > 0;
  const canSubmit = tokenTrim.length > 0 && password.length >= 6 && password === confirm;

  const onSubmit = async () => {
    if (!canSubmit || loading) return;
    Keyboard.dismiss();
    setErrBanner([]);
    try {
      setLoading(true);
      await resetPassword({
        token: tokenTrim,
        new_password: password,
        confirm_password: confirm,
      });
      navigation.replace("Login");
    } catch (err) {
      const resp = err?.response;
      const data = resp?.data;
      const msg =
        data?.detail ||
        data?.error ||
        (typeof data === "string" ? data : null) ||
        "تعذر تغيير كلمة المرور. تحقق من الرابط وحاول مرة أخرى.";
      setErrBanner([String(msg)]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Image
          source={require("../../assets/Logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {errBanner.length > 0 && (
        <View style={styles.errorBanner}>
          {errBanner.map((m, i) => (
            <Text key={i} style={styles.errorBannerText}>{m}</Text>
          ))}
        </View>
      )}

      <View style={styles.form}>
        <Text style={styles.title}>إعادة تعيين كلمة المرور</Text>

        {!hasRouteToken && (
          <>
            <Text style={styles.label}>رمز إعادة التعيين</Text>
            <TextInput
              style={styles.input}
              placeholder="الصق token من رابط البريد"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="left"
            />
          </>
        )}

        <Text style={styles.label}>كلمة المرور الجديدة</Text>
        <TextInput
          style={styles.input}
          placeholder="أدخل كلمة المرور الجديدة"
          placeholderTextColor="rgba(0,0,0,0.5)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textAlign="right"
        />

        <Text style={styles.label}>تأكيد كلمة المرور</Text>
        <TextInput
          style={styles.input}
          placeholder="أعد إدخال كلمة المرور"
          placeholderTextColor="rgba(0,0,0,0.5)"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          textAlign="right"
        />

        <Button
          variant="auth"
          title={loading ? "جار التغيير..." : "تغيير كلمة المرور"}
          width={sx(160)}
          height={sy(55)}
          onPress={onSubmit}
          disabled={!canSubmit || loading}
          style={{ marginTop: sy(16), alignSelf: "center", opacity: canSubmit && !loading ? 1 : 0.6 }}
        />
      </View>

      <View style={styles.bottomBlock}>
        <View style={styles.bottomRow}>
          <View style={styles.line} />
          <Text style={styles.muted}>?????? ???? ???????</Text>
          <View style={styles.line} />
        </View>
        <Text style={styles.link} onPress={() => navigation.replace("Login")}>
          ????? ??????
        </Text>
      </View>

      <Text style={styles.footer}>?2025 STARK-CARD</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: sy(6), marginBottom: sy(2) },
  logo: { width: sx(370), height: sy(250) },

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
  errorBannerText: { color: "#9b1c1c", fontWeight: "800", fontSize: sp(12), marginBottom: sy(2), textAlign: "right" },

  form: { flex: 1, marginTop: sy(8), paddingHorizontal: sx(2) },
  title: {
    color: themeColors.textPrimary,
    fontWeight: "800",
    fontSize: sp(22),
    marginBottom: sy(12),
    textAlign: "center",
  },
  label: {
    color: themeColors.textPrimary,
    opacity: 0.9,
    marginBottom: sy(6),
    fontWeight: "600",
    fontSize: sp(14),
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
    marginBottom: sy(10),
  },

  bottomBlock: { alignItems: "center", marginBottom: sy(6) },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: sy(4),
    gap: sx(8),
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.5)" },
  muted: { color: themeColors.textMuted, fontWeight: "600", fontSize: sp(12) },
  link: {
    color: themeColors.textPrimary,
    fontWeight: "800",
    marginTop: sy(4),
    textAlign: "center",
    fontSize: sp(14),
  },

  footer: {
    textAlign: "center",
    color: themeColors.textPrimary,
    opacity: 0.8,
    fontSize: typography.footer.fontSize,
  },
});
