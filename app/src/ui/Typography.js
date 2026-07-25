// src/ui/Typography.js
import { StyleSheet } from "react-native";
import Theme from "./Theme";
import { sp } from "./scale";

export const Typography = StyleSheet.create({
  h1:   { fontSize: sp(28), fontWeight: "700", color: colors.textPrimary },
  h2:   { fontSize: sp(22), fontWeight: "700", color: colors.textPrimary },
  title:{ fontSize: sp(18), fontWeight: "600", color: colors.textPrimary },
  body: { fontSize: sp(16),               color: colors.textPrimary },
  small:{ fontSize: sp(13),               color: colors.textMuted   },
});

export default Typography;
const { colors } = Theme;
