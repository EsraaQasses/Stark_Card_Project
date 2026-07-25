/* eslint-disable react-hooks/exhaustive-deps */
// src/screens/AgentQRConnect.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Vibration,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthProvider";
import { connectToAgent } from "../api/agent";

const BLUE = "#3A86FF";
const PENDING_KEY = "@pending_agent_code";

function parseAgentCode(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  try {
    const obj = JSON.parse(text);
    if (obj && obj.agent_code) return String(obj.agent_code).trim();
  } catch {}
  if (text.toLowerCase().startsWith("agent_code:")) {
    return text.split(":").slice(1).join(":").trim().toUpperCase();
  }
  if (text.toLowerCase().startsWith("agent:")) {
    return text.split(":").slice(1).join(":").trim().toUpperCase();
  }
  return null;
}

export default function AgentQRConnect({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { width: W, height: H } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoConnectRef = useRef(false);

  const mode = route?.params?.mode || "connect"; // "connect" | "signup"
  const prefillAgentCode = route?.params?.agent_code || null;

  useEffect(() => {
    if (!permission || permission.status !== "granted") {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      return () => {};
    }, [])
  );

  const FRAME_SIZE = Math.min(W * 0.72, 270);
  const frameLeft = (W - FRAME_SIZE) / 2;
  const frameTop = (H - FRAME_SIZE) / 2;

  const connectedAgent = user?.raw?.connected_agent || user?.raw?.agent || null;

  const handleScanData = useCallback(async (data) => {
    const agentCode = parseAgentCode(data);
    if (!agentCode) {
      Alert.alert("QR غير صالح", "لم يتم العثور على رمز وكيل صالح.", [
        { text: "حسناً", onPress: () => setScanned(false) },
      ]);
      return;
    }

    if (mode === "signup") {
      await AsyncStorage.setItem(PENDING_KEY, agentCode);
      Alert.alert("تم حفظ الرمز", "تم حفظ رمز الوكيل للاستخدام أثناء التسجيل.");
      navigation.goBack();
      return;
    }

    if (connectedAgent) {
      Alert.alert(
        "تبديل الوكيل؟",
        "أنت مرتبط بوكيل حالياً. هل تريد التبديل لهذا الوكيل؟",
        [
          { text: "إلغاء", style: "cancel", onPress: () => setScanned(false) },
          { text: "تبديل", style: "destructive", onPress: () => doConnect(agentCode, true) },
        ]
      );
      return;
    }

    await doConnect(agentCode, false);
  });

  useEffect(() => {
    if (!prefillAgentCode || autoConnectRef.current) return;
    autoConnectRef.current = true;
    if (mode === "signup") return;
    handleScanData(prefillAgentCode);
  }, [prefillAgentCode, mode, handleScanData]);

  const doConnect = async (agentCode, allowSwitch = false) => {
    setBusy(true);
    try {
      const res = await connectToAgent({ agent_code: agentCode, allow_switch: allowSwitch });
      await refreshUser();
      Alert.alert("تم الربط", res?.message || "تم ربط حسابك بالوكيل بنجاح.");
      navigation.goBack();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "فشل الربط. حاول مرة أخرى.";
      Alert.alert("خطأ", String(msg));
      setScanned(false);
    } finally {
      setBusy(false);
    }
  };

  const handleScan = async ({ data }) => {
    if (scanned || busy) return;
    setScanned(true);
    try {
      Vibration.vibrate(40);
    } catch {}

    await handleScanData(data);
  };

  const handleScanFromImage = async () => {
    if (busy) return;
    Alert.alert(
      "غير مدعوم حالياً",
      "قراءة QR من الصورة غير مدعومة في Expo Go. استخدم الكاميرا المباشرة أو قم ببناء dev client."
    );
    return;
  };

  const handleScanFromImageDisabled = true;


  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.info}>جارٍ طلب إذن الكاميرا…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={[styles.info, { color: "#000" }]}>
          نحتاج إذن الكاميرا لمسح رمز الوكيل.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>السماح بالوصول</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
        facing="back"
      />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: frameTop }]} />
        <View style={[styles.dim, { top: frameTop, left: 0, width: frameLeft, height: FRAME_SIZE }]} />
        <View style={[styles.dim, { top: frameTop, right: 0, width: frameLeft, height: FRAME_SIZE }]} />
        <View style={[styles.dim, { top: frameTop + FRAME_SIZE, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.frame, { width: FRAME_SIZE, height: FRAME_SIZE, top: frameTop, left: frameLeft }]} />
        <Text style={[styles.hint, { top: frameTop + FRAME_SIZE + 18 }]}>
          وجّه الكاميرا إلى QR الخاص بالوكيل
        </Text>
      </View>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Ionicons name="people-outline" size={18} color="#fff" />
        <Text style={styles.headerText}>
          {mode === "signup" ? "ربط الوكيل أثناء التسجيل" : "ربط حسابك بوكيل"}
        </Text>
      </View>

      <View style={[styles.actions, { bottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.actionBtn, handleScanFromImageDisabled && { opacity: 0.6 }]}
          onPress={handleScanFromImage}
          disabled={handleScanFromImageDisabled}
        >
          <Ionicons name="image-outline" size={18} color="#fff" />
          <Text style={styles.actionText}>قراءة QR من الصورة</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()}>
        <Text style={styles.closeTxt}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  info: { color: "#fff", marginTop: 10, opacity: 0.85, textAlign: "center" },
  btn: {
    marginTop: 14,
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.45)" },
  frame: {
    position: "absolute",
    borderColor: BLUE,
    borderWidth: 3,
    borderRadius: 16,
  },
  hint: {
    position: "absolute",
    alignSelf: "center",
    color: "#000",
    fontWeight: "600",
  },
  close: {
    position: "absolute",
    top: Platform.select({ ios: 54, android: 24 }),
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeTxt: { color: "#fff", fontSize: 24, lineHeight: 24, marginTop: -2 },
  header: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerText: { color: "#fff", fontWeight: "700" },
  actions: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: { color: "#fff", fontWeight: "700" },
});
