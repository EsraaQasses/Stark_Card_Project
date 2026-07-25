import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontFamilies, radius, spacing, typography } from "../../theme";
import { rowDirection, textAlignStart, writingDirection } from "../../utils/rtl";

export default function AppHeader({
  title,
  subtitle,
  right,
  children,
  safeTop = true,
  compact = false,
  style,
  titleStyle,
  subtitleStyle,
}) {
  const insets = useSafeAreaInsets();
  const topPadding = safeTop ? insets.top + spacing.lg : spacing.lg;

  return (
    <LinearGradient
      colors={[colors.brand.primary, colors.brand.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.header,
        {
          paddingTop: topPadding,
          paddingBottom: compact ? spacing.md : spacing.lg,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.row,
          { flexDirection: rowDirection() },
        ]}
      >
        <View style={styles.titleBlock}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { textAlign: textAlignStart(), writingDirection: writingDirection() },
              titleStyle,
            ]}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text
              numberOfLines={2}
              style={[
                styles.subtitle,
                { textAlign: textAlignStart(), writingDirection: writingDirection() },
                subtitleStyle,
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
  },
  row: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  subtitle: {
    color: colors.text.inverseMuted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    marginTop: spacing.xs,
  },
  title: {
    color: colors.text.inverse,
    fontFamily: fontFamilies.extraBold,
    fontSize: typography.title.fontSize,
    fontWeight: "900",
    lineHeight: typography.title.lineHeight,
  },
  titleBlock: {
    flex: 1,
  },
});
