import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#0E1B3B",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    color: "#7C8DA6",
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  action: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    color: "#0B63D8",
    fontWeight: "800",
  },
});
