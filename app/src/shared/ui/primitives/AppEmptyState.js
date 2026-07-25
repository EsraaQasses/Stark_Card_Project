import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text } from "react-native";

import { colors, fontFamilies, spacing, typography } from "../../theme";
import { textAlignStart, writingDirection } from "../../utils/rtl";
import AppCard from "./AppCard";

export default function AppEmptyState({
  title,
  subtitle,
  icon = "information-circle-outline",
  style,
}) {
  return (
    <AppCard soft style={[styles.card, style]}>
      {!!icon && <Ionicons name={icon} size={28} color={colors.brand.primary} />}
      <Text
        style={[
          styles.title,
          { textAlign: textAlignStart(), writingDirection: writingDirection() },
        ]}
      >
        {title}
      </Text>
      {!!subtitle && (
        <Text
          style={[
            styles.subtitle,
            { textAlign: textAlignStart(), writingDirection: writingDirection() },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: spacing.sm,
  },
  subtitle: {
    color: colors.text.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    width: "100%",
  },
  title: {
    color: colors.text.primary,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body.fontSize,
    fontWeight: "800",
    lineHeight: typography.body.lineHeight,
    width: "100%",
  },
});
