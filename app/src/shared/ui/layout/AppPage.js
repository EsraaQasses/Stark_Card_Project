import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { colors, layout, spacing } from "../../theme";
import { useScale } from "../../../ui/scale";

export default function AppPage({
  children,
  scrollable = false,
  padded = true,
  contentContainerStyle,
  style,
  maxWidth = layout.maxContentWidth,
}) {
  const { sx } = useScale();

  const contentStyle = [
    styles.content,
    { maxWidth, paddingHorizontal: padded ? sx(spacing.lg) : 0 },
    !scrollable && contentContainerStyle,
  ];

  if (!scrollable) {
    return (
      <View style={[styles.root, style]}>
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={[styles.root, style]}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
    >
      <View
        style={contentStyle}
      >
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    width: "100%",
  },
  root: {
    backgroundColor: colors.surface.background,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
