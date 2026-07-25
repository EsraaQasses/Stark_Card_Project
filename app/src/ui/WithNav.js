// src/ui/WithNav.js
import React, { useRef, useState } from "react";
import { View, Pressable, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sy } from "../ui/scale";
import NavBar from "./NavBar";
import AppIcon from "./AppIcon";

export default function WithNav({ children, navigation, active }) {
  const insets = useSafeAreaInsets();
  const NAV_HEIGHT = sy(64), NAV_BOTTOM_OFFSET = sy(10);
  const POP_BOTTOM = insets.bottom + NAV_BOTTOM_OFFSET + NAV_HEIGHT + sy(12);

  // popover state + animation
  const [open, setOpen] = useState(false);
  const scale = useRef(new Animated.Value(0.96)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const openSend = () => {
    setOpen(true);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };
  const closeSend = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: 120, useNativeDriver: true }),
    ]).start(({ finished }) => finished && setOpen(false));
  };

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* spacer so content doesn't sit under the navbar */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: insets.bottom + NAV_HEIGHT + NAV_BOTTOM_OFFSET + sy(6),
          backgroundColor: "#fff",
        }}
      />

      {/* SEND POPOVER — positioned at screen level so it never jumps to the top */}
      {open && (
        <>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: fade, backgroundColor: "rgba(0,0,0,0.15)", zIndex: 30 },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={closeSend} />
          </Animated.View>

          <Animated.View
            style={[
              styles.popover,
              { bottom: POP_BOTTOM, transform: [{ scale }], opacity: fade },
            ]}
          >
            <View style={styles.caret} />
            <View style={styles.row}>
              <Quick
                title="Stark To Stark"
                subtitle="Instant transfer"
                onPress={() => {
                  closeSend();
                  navigation.navigate("SendStark");
                }}
              />
              <Quick
                title="Take Money"
                subtitle="Cash / Agent"
                onPress={() => {
                  closeSend();
                  navigation.navigate("TakeMoney");
                }}
              />
            </View>
          </Animated.View>
        </>
      )}

      <NavBar
        active={active}
        insetBottom={insets.bottom + NAV_BOTTOM_OFFSET}
        onPressHome={() => navigation.navigate("Home")}
        onPressMenu={() => navigation.navigate("Menu")}
        onPressShipping={() => navigation.navigate("PaymentMethodsList")}
        onPressQR={() => navigation.navigate("MyQRCode")}
        onPressSend={() => (open ? closeSend() : openSend())} // toggle popover
      />
    </View>
  );
}

function Quick({ title, subtitle, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.quick}>
      <AppIcon name="send" size={20} style={{ marginBottom: 6 }} active />
      <Animated.Text style={styles.quickTitle}>{title}</Animated.Text>
      {subtitle ? <Animated.Text style={styles.quickSub}>{subtitle}</Animated.Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 22,
    zIndex: 31,
  },
  caret: {
    position: "absolute",
    bottom: -8,
    left: "50%",
    marginLeft: -8,
    width: 16,
    height: 16,
    backgroundColor: "#fff",
    transform: [{ rotate: "45deg" }],
    borderRadius: 2,
  },
  row: { flexDirection: "row", gap: 10 },
  quick: {
    flex: 1,
    backgroundColor: "#F3F6FF",
    borderWidth: 1,
    borderColor: "#E4ECF2",
    borderRadius: 14,
    padding: 12,
  },
  quickTitle: { fontWeight: "700" },
  quickSub: { fontSize: 12, opacity: 0.7, marginTop: 2 },
});
