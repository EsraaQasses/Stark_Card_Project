// src/ui/Screenn.js
import React from "react";
import { View, StyleSheet } from "react-native";

export default function Screenn({ children, bgColor = "#fff" }) {
  return (
    <View style={[styles.root, { backgroundColor: bgColor }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative", // important for BottomNav absolute positioning
  },
});
