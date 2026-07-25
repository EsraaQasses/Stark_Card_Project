import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AppScreenProps = {
  children: ReactNode;
  backgroundColor?: string;
  safeTop?: boolean;
  safeBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function AppScreen({
  children,
  backgroundColor = "#FFFFFF",
  safeTop = false,
  safeBottom = false,
  style,
  contentStyle,
}: AppScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor }, style]}>
      <View
        style={[
          styles.content,
          safeTop ? { paddingTop: insets.top } : null,
          safeBottom ? { paddingBottom: insets.bottom } : null,
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
