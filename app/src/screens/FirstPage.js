// src/screens/FirstPage.js
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthProvider";
import Screen from "../ui/Screen";
import theme from "../ui/Theme";
import { sp, sx, sy } from "../ui/scale";

// مدة عرض الـ Splash بالميلي ثانية (3 ثواني)
const SPLASH_DURATION = 3000;

export default function FirstPage() {
  const navigated = useRef(false);
  const router = useRouter();
  const { user, booting } = useAuth();

  // دالة التنقل
  const navigateToNext = () => {
    if (navigated.current) return;
    navigated.current = true;

    // حسب حالة المستخدم
    if (user) {
      router.replace("/(app)/home");
    } else {
      router.replace("/(auth)/login");
    }
  };

  useEffect(() => {
    // انتظار انتهاء التحميل الأولي
    if (booting) return;
    if (navigated.current) return;

    // إضافة تأخير لعرض الـ Splash
    const timer = setTimeout(navigateToNext, SPLASH_DURATION);

    return () => clearTimeout(timer);
  }, [booting, user]);

  // دعم "اضغط للمتابعة" كـ fallback
  const handlePress = () => {
    if (!booting) {
      navigateToNext();
    }
  };

  return (
    <Screen>
      <Pressable style={styles.flex} onPress={handlePress}>
        <View style={styles.center}>
          <Image
            source={require("../assets/Logo.png")}
            resizeMode="contain"
            style={styles.logo}
          />
        </View>
        <Text style={styles.tap}>اضغط للمتابعة</Text>
        <Text style={styles.footer}>©2025 STARK-CARD</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: sx(370), height: sy(250) },
  tap: {
    textAlign: "center",
    color: theme.colors.textPrimary,
    opacity: 0.7,
    fontSize: sp(12),
    marginBottom: sy(8),
    fontWeight: "600",
  },
  footer: {
    textAlign: "center",
    color: theme.colors.textPrimary,
    opacity: 0.8,
    fontSize: theme.typography.footer.fontSize,
    marginBottom: sy(8),
  },
});
