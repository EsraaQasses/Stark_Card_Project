import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useScale } from "../../../ui/scale";

const ROWS: readonly (readonly (string | null)[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [null, "0", "delete"],
];

interface PinPadProps {
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onDelete: () => void;
}

export default function PinPad({ disabled = false, onDigit, onDelete }: PinPadProps) {
  const { sx, sy, sp } = useScale();

  return (
    <View style={[styles.pad, { gap: sy(12) }]} accessibilityLabel="لوحة أرقام رمز التطبيق">
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap: sx(18) }]}>
          {row.map((value, columnIndex) => {
            if (value == null) {
              return <View key={columnIndex} style={{ width: sx(72), height: sy(58) }} />;
            }

            const isDelete = value === "delete";
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={isDelete ? "حذف الرقم الأخير" : `الرقم ${value}`}
                disabled={disabled}
                onPress={() => isDelete ? onDelete() : onDigit(value)}
                style={({ pressed }) => [
                  styles.key,
                  {
                    width: sx(72),
                    height: sy(58),
                    borderRadius: sx(18),
                    opacity: disabled ? 0.42 : pressed ? 0.65 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                  isDelete && styles.deleteKey,
                ]}
              >
                {isDelete ? (
                  <Ionicons name="backspace-outline" size={sp(25)} color="#0E1B3B" />
                ) : (
                  <Text style={[styles.keyText, { fontSize: sp(23) }]}>{value}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    alignItems: "center",
    direction: "ltr",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
  },
  key: {
    alignItems: "center",
    backgroundColor: "#F0F5FB",
    justifyContent: "center",
  },
  deleteKey: {
    backgroundColor: "transparent",
  },
  keyText: {
    color: "#0E1B3B",
    fontWeight: "700",
    includeFontPadding: false,
  },
});
