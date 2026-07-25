// src/screens/SignUp/Phone.js
import React, { useState } from "react";
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import { useRouter } from "expo-router";

import Screen from "../../ui/Screen";
import Button from "../../ui/Button";
import theme from "../../ui/Theme";
import { sx, sy, sp } from "../../ui/scale";

const { colors: themeColors, typography } = theme;

const Field = ({
  label,
  placeholder,
  secureTextEntry,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize = "none",
}) => (
  <View style={{ marginBottom: sy(12) }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor="rgba(0,0,0,0.5)"
      secureTextEntry={secureTextEntry}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      textAlign="right"
      returnKeyType="next"
    />
  </View>
);

export default function Phone() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");

  const nonEmpty = (s) => (s || "").trim().length > 0;
  const strongPass = (password || "").trim().length >= 6;
  const canContinue = [fullName, userName].every(nonEmpty) && strongPass;

  const goNext = () => {
    const seed = {
      full_name: fullName.trim(),
      name: userName.trim(),
      password, // لا نعمل trim لكلمة السر
      provider: "phone",
    };

    // ✅ expo-router params لازم تكون strings
    router.push({
      pathname: "/(auth)/signup-extra",
      params: {
        phoneRequired: "true",
        seed: JSON.stringify(seed),
      },
    });
  };

  return (
    <Screen>
      {/* الشعار */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/Logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* النموذج */}
      <View style={styles.form}>
        <Field
          label="الاسم الكامل"
          placeholder="اكتب اسمك الكامل"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />
        <Field
          label="اسم المستخدم"
          placeholder="اكتب اسم المستخدم"
          value={userName}
          onChangeText={setUserName}
          autoCapitalize="none"
        />
        <Field
          label="كلمة المرور"
          placeholder="اكتب كلمة المرور (6 أحرف على الأقل)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          variant="auth"
          title="متابعة"
          width={sx(143)}
          height={sy(55)}
          onPress={goNext}
          disabled={!canContinue}
          style={{
            alignSelf: "center",
            marginTop: sy(10),
            opacity: canContinue ? 1 : 0.6,
          }}
        />
      </View>

      {/* أسفل الصفحة */}
      <View style={styles.bottomRow}>
        <View style={styles.line} />
        <Text style={styles.muted}>لديك حساب مسبقاً؟</Text>
        <View style={styles.line} />
      </View>

      {/* ✅ Login route with expo-router */}
      <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.link}>تسجيل الدخول</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>©2025 STARK-CARD</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: sy(10), marginBottom: sy(2) },
  logo: { width: sx(370), height: sy(250) },

  form: { flex: 1, marginTop: sy(10), paddingHorizontal: sx(2) },

  label: {
    color: themeColors.textPrimary,
    opacity: 0.9,
    marginBottom: sy(8),
    fontWeight: "600",
    marginLeft: sx(12),
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

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: sy(12),
    gap: sx(8),
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  muted: { color: themeColors.textMuted, fontWeight: "600", fontSize: sp(12) },

  link: {
    color: themeColors.textPrimary,
    fontWeight: "800",
    marginTop: sy(4),
    textAlign: "center",
    marginBottom: sy(12),
    fontSize: sp(14),
  },

  footer: {
    textAlign: "center",
    color: themeColors.textPrimary,
    opacity: 0.8,
    fontSize: typography.footer.fontSize,
  },
});
