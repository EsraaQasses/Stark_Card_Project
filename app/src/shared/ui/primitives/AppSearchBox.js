import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { colors, fontFamilies, radius, shadows, spacing, typography } from "../../theme";
import { rowDirection, textAlignStart, writingDirection } from "../../utils/rtl";

export default function AppSearchBox({
  value,
  onChangeText,
  placeholder,
  onClear,
  style,
  returnKeyType = "search",
}) {
  const canClear = !!value && typeof onClear === "function";

  return (
    <View
      style={[
        styles.wrap,
        { flexDirection: rowDirection() },
        style,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="search-outline" size={18} color={colors.brand.primary} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        returnKeyType={returnKeyType}
        style={[
          styles.input,
          { textAlign: textAlignStart(), writingDirection: writingDirection() },
        ]}
      />
      {canClear && (
        <Pressable onPress={onClear} style={styles.clearBtn}>
          <Ionicons name="close" size={16} color={colors.text.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clearBtn: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.surface.cardSoft,
    borderColor: colors.border.default,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    marginHorizontal: spacing.xs,
    width: 34,
  },
  input: {
    color: colors.text.primary,
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: typography.body.fontSize,
  },
  wrap: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    ...shadows.soft,
  },
});
