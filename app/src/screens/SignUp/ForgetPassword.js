// src/screens/SignUp/ForgetPassword.js
import React, { useState } from "react";
import { View, Image, Text, TextInput, StyleSheet, Keyboard } from "react-native";
import Screen from "../../ui/Screen";
import Button from "../../ui/Button";
import theme from "../../ui/Theme";
import { sx, sy, sp } from "../../ui/scale";
import { requestPasswordReset } from "../../api/auth";

const { colors: themeColors, typography } = theme;

export default function ForgetPassword({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errBanner, setErrBanner] = useState([]);
  const [infoBanner, setInfoBanner] = useState([]);

  const emailTrim = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
  const canSend = validEmail;

  const onSend = async () => {
    if (!canSend || loading) return;
    Keyboard.dismiss();
    setErrBanner([]);
    setInfoBanner([]);

    try {
      setLoading(true);
      await requestPasswordReset(emailTrim);
      setInfoBanner([
        "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.",
      ]);
    } catch (err) {
      const resp = err?.response;
      const data = resp?.data;
      const msg =
        data?.detail ||
        data?.error ||
        (typeof data === "string" ? data : null) ||
        "تعذر إرسال رابط إعادة التعيين. حاول مرة أخرى.";
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

      {infoBanner.length > 0 && (
        <View style={styles.infoBanner}>
          {infoBanner.map((m, i) => (
            <Text key={i} style={styles.infoBannerText}>{m}</Text>
          ))}
        </View>
      )}
      {errBanner.length > 0 && (
        <View style={styles.errorBanner}>
          {errBanner.map((m, i) => (
            <Text key={i} style={styles.errorBannerText}>{m}</Text>
          ))}
        </View>
      )}

      <View style={styles.form}>
        <Text style={styles.title}>???? ???? ??????</Text>

        <Text style={styles.label}>?????? ??????????</Text>
        <TextInput
          style={styles.input}
          placeholder="???? ???? ?????"
          placeholderTextColor="rgba(0,0,0,0.5)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
          returnKeyType="send"
          onSubmitEditing={() => canSend && onSend()}
        />

        <Button
          variant="auth"
          title={loading ? "???? ???????..." : "????? ?????"}
          width={sx(143)}
          height={sy(55)}
          onPress={onSend}
          disabled={!canSend || loading}
          style={{ marginTop: sy(16), alignSelf: "center", opacity: canSend && !loading ? 1 : 0.6 }}
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
  infoBannerText: { color: "#0b3ea8", fontWeight: "700", fontSize: sp(12), marginBottom: sy(2), textAlign: "right" },

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
