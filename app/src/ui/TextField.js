import React from "react";
import { View, TextInput, Text, StyleSheet } from "react-native";
import Theme from "./Theme";
import { sp, sy } from "./scale";

export default function TextField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}   // انتبه هون: ما في colors.subtext، عندك textMuted
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: sp(12), marginBottom: 6 },
  input: {
    height: sy(52),
    borderRadius: radius.lg,
    backgroundColor: "#0E141B",
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,   // حسب تعريفك ب Theme
    fontSize: sp(15),
  },
});
const { colors, radius, spacing } = Theme;
