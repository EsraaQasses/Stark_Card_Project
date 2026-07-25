// src/screens/SignUp/SignUp.js
import React from "react";
import { Image, ImageBackground, StatusBar, StyleSheet, Text, View } from "react-native";
import Button from "../../ui/Button";
import { sp, sx, sy } from "../../ui/scale";

import { useRouter } from "expo-router";

export default function SignUp() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require("../../assets/bg.png")}
        style={StyleSheet.absoluteFill}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      />
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={require("../../assets/Logo.png")} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>تابِع إلى التطبيق عبر</Text>

          <Button
            variant="auth"
            title="البريد الإلكتروني"
            onPress={() => router.push("/(auth)/signup-email")}
            width={sx(330)}
            height={sy(60)}
          />
          <Button
            variant="auth"
            title="رقم الهاتف"
            onPress={() => router.push("/(auth)/signup-phone")}
            width={sx(330)}
            height={sy(60)}
          />
        </View>

        <Text style={styles.footer}>©2025 STARK-CARD</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#2137fbec" },
  bgImage: { width: "101%", height: "113%" },
  content: { flex: 1, paddingHorizontal: sx(20), paddingTop: sy(24), paddingBottom: sy(24) },
  header: { alignItems: "center", marginTop: sy(24) },
  logo: { width: sx(370), height: sy(250) },
  body: { flex: 1, justifyContent: "center", gap: sy(16) },
  title: { color: "white", fontSize: sp(28), textAlign: "center", marginBottom: sy(25), fontWeight: "700" },
  footer: { textAlign: "center", color: "#cfe8ff", opacity: 0.8, fontSize: sp(12) },
});
