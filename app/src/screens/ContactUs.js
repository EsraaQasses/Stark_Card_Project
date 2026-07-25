import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Screenn from "../ui/Screenn";
import NavBar from "../ui/NavBar";

const BASE_W = 390, BASE_H = 844;
const LINE = "#E4ECF2";
const ROW_BG = "#FFFFFF";


export default function ContactUs({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const sx = useCallback((n) => (W / BASE_W) * n, [W]);
  const sy = useCallback((n) => (H / BASE_H) * n, [H]);

  const NAV_HEIGHT = sy(64);
  const NAV_BOTTOM_OFFSET = sy(0);

  const headerTop = useMemo(() => insets.top + sy(24), [insets.top, sy]);
  const contentPadBottom = useMemo(
    () => NAV_HEIGHT + insets.bottom + sy(12),
    [NAV_HEIGHT, insets.bottom, sy]
  );

  const rows = [
    { key: "profile", label: "My Profile", screen: "Profile" },
    { key: "payments", label: "My Payments", screen: "MyPayments" },
    { key: "wallet", label: "My Wallet", screen: "MyWallet" },
    { key: "orders", label: "My Orders" },
    { key: "favorite", label: "Favorite", screen: "Favorite" },
    { key: "agents", label: "Our Agents", screen: "OurAgents" },
    { key: "contact", label: "Contact Us" },
  ];

  const openWhatsApp = () => Linking.openURL("https://wa.me/0000000000");  // put real number
  const openTelegram = () => Linking.openURL("https://t.me/your_handle");  // put real handle

  return (
    <Screenn bgColor="#fff" useDefaultBg={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: contentPadBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: headerTop, paddingHorizontal: sx(14) }}>
          {/* User pill */}
          <View
            style={{
              backgroundColor: "#D6F5FF",
              borderRadius: sx(22),
              paddingVertical: sy(10),
              paddingHorizontal: sx(12),
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="person-circle-outline" size={sx(28)} color="#2F8CFF" />
            <Text style={{ marginLeft: sx(8), fontSize: sx(18), fontWeight: "700", color: "#0E1B3B" }}>
              User Name
            </Text>
          </View>

          {/* Rows */}
          <View style={{ marginTop: sy(12) }}>
            {rows.map((r, i) => (
              <View key={r.key}>
                <Pressable
                  onPress={() => r.screen && navigation.navigate(r.screen)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      height: sy(50),
                      paddingHorizontal: sx(16),
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="chevron-forward" size={sx(18)} color="#0E1B3B" />
                  <Text style={styles.rowText}>{r.label}</Text>
                </Pressable>

                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: LINE,
                    marginHorizontal: sx(14),
                  }}
                />
              </View>
            ))}
          </View>

          {/* Contact buttons */}
          <View style={{ marginTop: sy(18), flexDirection: "row", gap: sx(12) }}>
            <Pressable onPress={openWhatsApp} style={[styles.cta, { backgroundColor: "#E7FFF0" }]}>
              <Text style={{ fontSize: sx(16) }}>🟢 WhatsApp</Text>
            </Pressable>

            <Pressable onPress={openTelegram} style={[styles.cta, { backgroundColor: "#E6F4FF" }]}>
              <Text style={{ fontSize: sx(16) }}>📨 Telegram</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* bottom cover */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: insets.bottom + NAV_HEIGHT + NAV_BOTTOM_OFFSET + sy(6),
          backgroundColor: "#fff",
        }}
      />

      <NavBar
        active="menu"
        insetBottom={insets.bottom + NAV_BOTTOM_OFFSET}
        onPressHome={() => navigation.navigate("Home")}
        onPressMenu={() => navigation.navigate("Menu")}
        onPressShipping={() => navigation.navigate("PaymentMethodsList")}
        onPressQR={() => navigation.navigate("QRScanner")}
        onPressSend={() => { }}
      />
    </Screenn>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ROW_BG,
  },
  rowText: {
    marginLeft: 8,
    fontWeight: "600",
    color: "#0E1B3B",
    fontSize: 16,
  },
  cta: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
  },
});
