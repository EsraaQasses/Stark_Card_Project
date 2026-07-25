import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ErrorStateProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function ErrorState({ message, actionLabel, onAction }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
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
  message: {
    color: "#B42318",
    lineHeight: 20,
    textAlign: "center",
  },
  action: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: {
    color: "#0B63D8",
    fontWeight: "800",
  },
});
