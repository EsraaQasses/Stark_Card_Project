// src/ui/ErrorBanner.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Banner يعرض الأخطاء بشكل واضح
 * يمكن إغلاؤه بالضغط أو يختفي تلقائياً
 */
export default function ErrorBanner({
  message = "",
  onClose,
  autoHideMs = 5000,
  style,
}) {
  const [visible, setVisible] = React.useState(!!message);

  React.useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);

    if (autoHideMs > 0) {
      const timeout = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, autoHideMs);

      return () => clearTimeout(timeout);
    }
  }, [message, autoHideMs, onClose]);

  if (!visible || !message) return null;

  return (
    <View style={[styles.container, style]}>
      <Ionicons name="alert-circle" size={20} color="#FFFFFF" style={styles.icon} />
      <Text style={styles.text} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={() => {
          setVisible(false);
          onClose?.();
        }}
      >
        <Ionicons name="close" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#DB0004",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
  },
});
