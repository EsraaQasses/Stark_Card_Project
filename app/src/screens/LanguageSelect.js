import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import Screen from "../ui/Screen";
import Button from "../ui/Button";
import theme from "../ui/Theme";
import { sx, sy, sp } from "../ui/scale";
import { setAppLanguage } from "../utils/lang";

const { colors: themeColors, typography } = theme;

// (اختياري) Reload تلقائي عند تبديل RTL على Expo
let reloadAsync = null;
try {
  reloadAsync = require("expo-updates").reloadAsync;
} catch { }

export default function LanguageSelect({ navigation }) {
  const { i18n } = useTranslation();

  const apply = async (code) => {
    // خزّن اللغة (للدوال أو الشاشات التي ما تستخدم setAppLanguage)
    await AsyncStorage.setItem("app_lang", code);

    // فضّل util لأنها بتطبق i18n + RTL
    let needsReload = false;
    try {
      const res = await setAppLanguage(code);
      needsReload = !!res?.needsReload;
    } catch {
      // fallback: غيّر i18n فقط
      try { await i18n.changeLanguage(code); } catch { }
    }

    if (needsReload && typeof reloadAsync === "function") {
      await reloadAsync(); // يطبّق RTL فوراً
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    // نفس خلفية وصف هوامش صفحة تسجيل الدخول (عن طريق Screen)
    <Screen>
      {/* Logo مثل Login */}
      <View style={styles.header}>
        <Image
          source={require("../assets/Logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* عنوان وملاحظة بنفس الروح */}
      <Text style={styles.title}>اختر لغة التطبيق</Text>
      <Text style={styles.subtitle}>يمكنك تغيير اللغة لاحقاً من الإعدادات</Text>

      {/* أزرار بنفس زر Login: variant="auth" وارتفاع sy(55) */}
      <View style={styles.btns}>
        <Button
          variant="auth"
          title="العربية"
          width={"100%"}
          height={sy(55)}
          onPress={() => apply("ar")}
        />
      </View>

      <Text style={styles.footer}>©2025 STARK-CARD</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginTop: sy(6), marginBottom: sy(2) },
  logo: { width: sx(370), height: sy(250) },

  title: {
    textAlign: "center",
    color: themeColors.textPrimary,
    fontWeight: "800",
    fontSize: sp(18),
    marginTop: sy(-6),
  },
  subtitle: {
    textAlign: "center",
    color: themeColors.textPrimary,
    opacity: 0.8,
    fontSize: sp(12),
    marginTop: sy(4),
    marginBottom: sy(10),
  },

  btns: {
    flex: 1,
    width: "100%",
    paddingHorizontal: sx(16),
    justifyContent: "flex-start",
    marginTop: sy(6),
  },

  footer: {
    textAlign: "center",
    color: themeColors.textPrimary,
    opacity: 0.8,
    fontSize: typography.footer.fontSize,
    marginBottom: sy(8),
  },
});
