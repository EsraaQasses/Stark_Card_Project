import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet } from "react-native";

import { colors, radius } from "../../theme";
import { useScale } from "../../../ui/scale";

export default function AppIconButton({
  name,
  source,
  onPress,
  accessibilityLabel,
  color = colors.text.primary,
  size,
  style,
  disabled = false,
}) {
  const { sx } = useScale();
  const iconSize = size ?? sx(18);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderRadius: sx(radius.lg) },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          resizeMode="contain"
          style={{ width: iconSize, height: iconSize, tintColor: color }}
        />
      ) : (
        <Ionicons name={name} size={iconSize} color={color} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.surface.soft,
    borderColor: colors.border.default,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
