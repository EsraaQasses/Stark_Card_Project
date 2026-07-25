// src/ui/SuccessBanner.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Banner يعرض رسائل النجاح
 */
export default function SuccessBanner({
  message = "",
  onClose,
  autoHideMs = 3000,
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
      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={styles.icon} />
      <Text style={styles.text} numberOfLines={2}>
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
    backgroundColor: "#00BA00",
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
