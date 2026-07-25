import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, shadows, spacing } from "../../theme";

export default function AppCard({
  children,
  style,
  padded = true,
  soft = false,
}) {
  return (
    <View
      style={[
        styles.card,
        soft && styles.soft,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    ...shadows.soft,
  },
  soft: {
    backgroundColor: colors.surface.cardSoft,
  },
  padded: {
    padding: spacing.lg,
  },
});
