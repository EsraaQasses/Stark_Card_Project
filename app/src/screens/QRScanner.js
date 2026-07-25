// src/screens/QRScanner.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Vibration,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";

const BLUE = "#3A86FF";

export default function QRScanner({ navigation }) {
  const { width: W, height: H } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission || permission.status !== "granted") {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // السماح بالمسح من جديد كل ما الشاشة ترجع فوكس
  useFocusEffect(
    React.useCallback(() => {
      setScanned(false);
      return () => {};
    }, [])
  );

  // 🟦 حجم إطار المسح
  const FRAME_SIZE = Math.min(W * 0.7, 260);
  const frameLeft = (W - FRAME_SIZE) / 2;
  const frameTop = (H - FRAME_SIZE) / 2;

  // 🆕 دالة لاستخراج رقم المحفظة من النص (بس أرقام)
  const extractWalletId = (raw) => {
    if (!raw) return null;
    const digits = String(raw).replace(/[^\d]/g, ""); // نخلي أرقام فقط
    if (!digits) return null;
    // فيك تحطي شروط زيادة (مثلاً طول معيّن)
    return digits;
  };

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      Vibration.vibrate(40);
    } catch {}

    let payload = null;
    try {
      payload = JSON.parse(String(data || ""));
    } catch {}

    if (payload && typeof payload === "object") {
      const recipientPhone = payload.phone || payload.userPhone || payload.recipient_phone || "";
      const recipientId =
        payload.user_id ||
        payload.userId ||
        payload.id ||
        payload.recipient_id ||
        payload.recipientId ||
        null;
      const recipientName = payload.username || payload.name || payload.full_name || "";
      const walletId = payload.wallet_id || payload.walletId || null;
      if (recipientPhone || recipientId || walletId) {
        navigation.replace("NewTransfer", {
          recipient_phone: recipientPhone,
          recipient_id: recipientId,
          recipient_name: recipientName,
          recipient_wallet_id: walletId,
        });
        return;
      }
    }

    const walletId = extractWalletId(data);
    if (walletId) {
      navigation.replace("NewTransfer", {
        recipient_wallet_id: walletId,
      });
      return;
    }

    Alert.alert("QR غير صالح", "تعذر قراءة بيانات المستلم من QR.", [
      { text: "حسناً", onPress: () => setScanned(false) },
    ]);
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.info}>جاري طلب إذن الكاميرا…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={[styles.info, { color: "#000" }]}>
          يحتاج التطبيق لإذن الكاميرا لمسح رموز QR.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>سماح بالوصول</Text>
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

      {/* dim around square */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: frameTop }]} />
        <View style={[styles.dim, { top: frameTop, left: 0, width: frameLeft, height: FRAME_SIZE }]} />
        <View style={[styles.dim, { top: frameTop, right: 0, width: frameLeft, height: FRAME_SIZE }]} />
        <View
          style={[
            styles.dim,
            { top: frameTop + FRAME_SIZE, left: 0, right: 0, bottom: 0 },
          ]}
        />
        <View
          style={[
            styles.frame,
            { width: FRAME_SIZE, height: FRAME_SIZE, top: frameTop, left: frameLeft },
          ]}
        />
        <Text style={[styles.hint, { top: frameTop + FRAME_SIZE + 18 }]}>
          ضع QR داخل الإطار
        </Text>
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
});
