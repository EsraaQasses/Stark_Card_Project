// src/ui/Screen.js
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "./Theme";

const { colors: themeColors, sizes } = theme;

const { height: H, width: W } = Dimensions.get("window");

export default function Screen({
  children,
  center = false,
  style,
  keyboardOffset = 24,
  useDefaultBg = true,
  bgImage,
  bgColor,
}) {
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const onShow = (e) => {

      if (Platform.OS === "android") setKbHeight(e.endCoordinates?.height ?? 0);
    };
    const onHide = () => setKbHeight(0);

    const sub1 = Keyboard.addListener("keyboardDidShow", onShow);
    const sub2 = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  // Fallback for safe area insets in case provider is not available (production builds)
  const iosOffset = ((insets?.top ?? 0) || 0) + keyboardOffset;

  return (
    <View style={[styles.root, bgColor ? { backgroundColor: bgColor } : null, style]}>
      {/* Background */}
      {useDefaultBg ? (
        <ImageBackground
          source={require("../assets/bg.png")}
          style={{ position: "absolute", top: 0, left: 0, width: W, height: H * 1.1 }}
          resizeMode="cover"
        />
      ) : bgImage ? (
        <ImageBackground
          source={bgImage}
          style={{ position: "absolute", top: 0, left: 0, width: W, height: H * 1.1 }}
          resizeMode="cover"
        />
      ) : null}

      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? iosOffset : 0}
        style={styles.kav}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}

          contentContainerStyle={[
            styles.content,
            center && styles.center,
            { paddingBottom: sizes.pagePaddingBottom + 32 + (Platform.OS === "android" ? kbHeight + 12 : 12) },
          ]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: themeColors.appBg },
  kav: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: sizes.pagePaddingH,
    paddingTop: sizes.pagePaddingTop,

  },
  center: { justifyContent: "center" },
});
