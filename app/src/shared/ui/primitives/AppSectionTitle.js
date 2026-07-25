import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontFamilies, spacing, typography } from "../../theme";
import { rowDirection, textAlignStart, writingDirection } from "../../utils/rtl";

export default function AppSectionTitle({
  title,
  subtitle,
  right,
  style,
}) {
  return (
    <View
      style={[
        styles.wrap,
        { flexDirection: rowDirection() },
        style,
      ]}
    >
      <View style={styles.textBlock}>
        <Text
          style={[
            styles.title,
            { textAlign: textAlignStart(), writingDirection: writingDirection() },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={[
              styles.subtitle,
              { textAlign: textAlignStart(), writingDirection: writingDirection() },
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.text.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    marginTop: spacing.xxs,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body.fontSize,
    fontWeight: "900",
    lineHeight: typography.body.lineHeight,
  },
  wrap: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "space-between",
  },
});
