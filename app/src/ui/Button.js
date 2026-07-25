import React from "react";
import { ActivityIndicator, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors as themeColors, sizes, shadow, typography } from "./Theme";

export default function Button({
  title,
  onPress,
  style,
  contentStyle,
  textStyle,
  disabled,
  width,
  height,
  colors,            // manual override (optional)
  start,
  end,
  loading,
  accessibilityLabel,
  variant = "app",   // ✅ "auth" | "app"
}) {
  const handlePress = () => {
    if (disabled || loading) return;
    onPress?.();
  };

  // pick gradient
  const pickVariant = () => {
    if (colors && Array.isArray(colors) && colors.length > 0) return colors; // explicit override
    if (variant === "auth") {
      return [
        themeColors.authBtnGradientStart,
        themeColors.authBtnGradientMid,
        themeColors.authBtnGradientEnd,
      ];
    }
    // default app style
    return [
      themeColors.appBtnGradientStart,
      themeColors.appBtnGradientMid,
      themeColors.appBtnGradientEnd,
    ];
  };

  const gradientColors = pickVariant();

  return (
    <View style={[styles.shadowWrap, style, { width: width ?? sizes.buttonWidth }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        accessibilityLabel={accessibilityLabel || (typeof title === "string" ? title : "button")}
        hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
        style={{ width: "100%", height: height ?? sizes.buttonHeight }}
      >
        <LinearGradient
          colors={gradientColors}
          start={start ?? { x: 0, y: 0.5 }}
          end={end ?? { x: 1, y: 0.5 }}
          style={[styles.btn, contentStyle, (disabled || loading) && { opacity: 0.6 }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={themeColors.textPrimary} />
          ) : (
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.text, textStyle]}>
              {title}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    alignSelf: "center",
    marginVertical: 8,
    shadowColor: shadow.shadowColor,
    shadowOffset: shadow.shadowOffset,
    shadowOpacity: shadow.shadowOpacity,
    shadowRadius: shadow.shadowRadius,
    elevation: shadow.elevation,
  },
  btn: {
    flex: 1,
    borderRadius: sizes.buttonRadius,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  text: {
    color: themeColors.textPrimary,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
    textAlign: "center",
  },
});
