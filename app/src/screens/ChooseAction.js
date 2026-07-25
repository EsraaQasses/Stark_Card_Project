// src/screens/ChooseAction.js
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BLUE = "#1274F5";
const GRAY = "#64748b";
const LINE = "#E4ECF2";
const CARD = "#FFFFFF";
const BG = "#F7FAFC";
const TEXT = "#0E1B3B";

// ✅ عدّل اسم الراوت هون إذا لزم
const TARGET_ROUTE = "Products";

export default function ChooseAction({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const recipient = useMemo(() => route?.params?.recipient || {}, [route?.params?.recipient]);

  const info = useMemo(() => {
    const name = recipient?.name ?? "—";
    const phone = recipient?.phone ?? "—";
    const id = recipient?.user_id ?? recipient?.id ?? "—";
    return { name, phone, id };
  }, [recipient]);

  const go = (mode) => {
    // ⬅️ استبدال PayToUser بـ Products وتمرير نفس recipient + mode
    navigation.replace(TARGET_ROUTE, { recipient, mode });
    // ملاحظة: إن حابب ترجع بالسهم بعد العملية، استخدم navigation.navigate بدل replace.
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={[styles.card, { width: Math.min(W - 24, 480) }]}>
        <Text style={styles.title}>اختر الإجراء</Text>
        <Text style={styles.sub}>
          {`المستلم: ${info.name}\nالهاتف: ${info.phone}\nID: ${info.id}`}
        </Text>

        <View style={{ height: 10 }} />

        <Pressable
          style={styles.btnPrimary}
          android_ripple={Platform.OS === "android" ? { color: "#e5e7eb" } : undefined}
          onPress={() => go("transfer")}
        >
          <Text style={styles.btnPrimaryTxt}>شراء منتج لهذا المستخدم</Text>
          <Text style={styles.btnHint}>اختيار منتج والدفع نيابةً عن المستلم</Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          style={styles.btnSecondary}
          android_ripple={Platform.OS === "android" ? { color: "#e5e7eb" } : undefined}
          onPress={() => go("pay")}
        >
          <Text style={styles.btnSecondaryTxt}>دفع/تسديد لمنتج</Text>
          <Text style={styles.btnHintDark}>الانتقال لقائمة المنتجات ومتابعة الدفع</Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => navigation.goBack()}>
          <Text style={styles.linkTxt}>رجوع</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  title: { fontSize: 20, fontWeight: "900", color: TEXT, textAlign: "center" },
  sub: { marginTop: 8, color: GRAY, textAlign: "center", lineHeight: 20 },
  btnPrimary: {
    backgroundColor: BLUE,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  btnPrimaryTxt: { color: "#fff", fontWeight: "900", fontSize: 16, textAlign: "center" },
  btnHint: { color: "rgba(255,255,255,0.9)", textAlign: "center", marginTop: 6, fontSize: 12 },
  btnSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: LINE,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  btnSecondaryTxt: { color: TEXT, fontWeight: "900", fontSize: 16, textAlign: "center" },
  btnHintDark: { color: GRAY, textAlign: "center", marginTop: 6, fontSize: 12 },
  link: { marginTop: 14, alignSelf: "center", padding: 6 },
  linkTxt: { color: GRAY, fontWeight: "700" },
});
