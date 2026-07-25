// src/ui/HeaderBar.js
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import AppIcon from "./AppIcon"; // uses your icon wrapper

export default function HeaderBar({ title = "My Profile", onPressProfile }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>

      <Pressable onPress={onPressProfile} hitSlop={12}>
        <AppIcon name="user" size={26} active tintActive="#0B63D8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 18, fontWeight: "600", color: "#0E1B3B" },
  userBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
