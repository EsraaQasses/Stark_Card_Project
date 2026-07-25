import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, fontFamilies, radius, shadows, spacing, typography } from "../../theme";

type LoadingStateProps = {
  message?: string;
};

export default function LoadingState({ message }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    minWidth: 168,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadows.soft,
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  message: {
    color: colors.text.muted,
    fontFamily: fontFamilies.bold,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  spinnerWrap: {
    alignItems: "center",
    backgroundColor: colors.surface.cardSoft,
    borderColor: colors.border.default,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
});
