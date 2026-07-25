// src/ui/LoadingOverlay.js
import React from "react";
import { View, Modal, ActivityIndicator, Text, StyleSheet } from "react-native";

import { colors, radius, shadows, spacing, typography } from "../shared/theme";

/**
 * Overlay يعرض loading state مع رسالة اختيارية
 * يستخدم لعمليات طويلة
 */
export default function LoadingOverlay({ visible = false, message = "جاري التحميل..." }) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.box}>
          <View style={styles.spinnerWrap}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
          {message && <Text style={styles.text}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  box: {
    alignItems: "center",
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    minWidth: 180,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    ...shadows.card,
  },
  spinnerWrap: {
    alignItems: "center",
    backgroundColor: colors.surface.cardSoft,
    borderColor: colors.border.default,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  text: {
    color: colors.text.primary,
    fontSize: typography.label.fontSize,
    fontWeight: "700",
    textAlign: "center",
  },
});
