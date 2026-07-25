// src/ui/OfflineBanner.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();

  const isOffline =
    netInfo.isConnected === false ||
    netInfo.isInternetReachable === false;

  if (!isOffline) return null;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <Text style={styles.text}>أنت غير متصل الآن — نعرض آخر بيانات محفوظة</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    alignItems: "center",
    paddingBottom: 6,
    backgroundColor: "#FEF3C7",
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
  },
  text: {
    color: "#92400E",
    fontWeight: "800",
    fontSize: 12,
  },
});
