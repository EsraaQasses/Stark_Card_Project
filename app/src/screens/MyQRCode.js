// src/screens/MyQRCode.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  RefreshControl,
  Linking,
  Share,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageLayout from "../ui/PageLayout";
import Theme from "../ui/Theme";
import { sx as sxBase, sy as syBase } from "../ui/scale";
import api from "../api/client";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

const { colors = {} } = Theme;
const COLORS = {
  bg: colors.bg || "#F7FAFC",
  text: colors.text || "#0E1B3B",
  textMuted: colors.muted || "#64748b",
  line: colors.line || "#E4ECF2",
  primary: colors.primary || "#1274F5",
  card: "#FFFFFF",
};

export default function MyQRCode({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [qrUrl, setQrUrl] = useState(null);
  const [phone, setPhone] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState(null);
  const [agentCode, setAgentCode] = useState(null);
  const [qrPayload, setQrPayload] = useState(null);
  const [agentMode, setAgentMode] = useState(false);

  const sx = sxBase,
    sy = syBase;

  const qrFetchInFlight = useRef(false);
  const qrLastFetchAt = useRef(0);

  const storageKey = useCallback((uid) => (uid ? `@qr_url:${uid}` : "@qr_url"), []);

  const loadMe = useCallback(async () => {
    const hasPhone = phone || phone === "";
    const isAgent = role === "agent";
    if (userId && hasPhone && role && (!isAgent || agentCode)) {
      return { id: userId, phone, role, agent_code: agentCode };
    }
    try {
      const me = await api.get("/users/me/");
      const p = me?.data?.phone || me?.data?.mobile || null;
      const id = me?.data?.id ?? me?.data?.pk ?? null;
      const r = me?.data?.role || me?.data?.user_role || "user";
      const aCode = me?.data?.agent_code || me?.data?.agentCode || null;
      setPhone(p || null);
      setUserId(id);
      setRole(r);
      setAgentCode(aCode);
      return { id, phone: p, role: r, agent_code: aCode };
    } catch {
      return { id: null, phone: null, role: null, agent_code: null };
    }
  }, [phone, role, userId, agentCode]);

  const loadQr = useCallback(
    async (uidMaybe, { force = false } = {}) => {
      setError("");
      try {
        const uid = uidMaybe ?? userId;
        const now = Date.now();

        // 1) Cache per user
        const cached = await AsyncStorage.getItem(storageKey(uid));
        const needsAgentCode = role === "agent" && !agentCode;
        const needsPayload = role === "agent" && !qrPayload?.agent_code;
        if (cached && !force && !needsAgentCode && !needsPayload) {
          if (!qrUrl) setQrUrl(cached);
          return;
        }
        if (cached && !qrUrl) setQrUrl(cached);

        if (!force) {
          if (qrFetchInFlight.current) return;
          if (now - qrLastFetchAt.current < 30000) return;
        }

        qrFetchInFlight.current = true;
        // 2) Fetch/generate from server
        const res = await api.get("/qr_code/my-qr/");
        const baseUrl = res?.data?.qr_code_url || res?.data?.url || null;
        const qrDataRaw = res?.data?.qr_data || null;
        if (qrDataRaw) {
          try {
            const parsed = JSON.parse(qrDataRaw);
            setQrPayload(parsed);
            console.log("[MyQRCode] qr_data parsed:", parsed);
            if (parsed?.agent_code) setAgentCode(parsed.agent_code);
            if (!phone && parsed?.phone) setPhone(parsed.phone);
            if (!userId && parsed?.user_id) setUserId(parsed.user_id);
          } catch {}
        }

        // Ensure absolute URL (if backend returns relative)
        const makeAbsolute = (u) => {
          if (!u) return null;
          if (/^https?:\/\//i.test(u)) return u; // already absolute
          const apiBase = api?.defaults?.baseURL || "";
          const origin = apiBase.replace(/\/api\/?$/i, "").replace(/\/$/, "");
          return `${origin}${u.startsWith("/") ? "" : "/"}${u}`;
        };

        const abs = makeAbsolute(baseUrl);
        if (abs) {
          setQrUrl(abs);
          await AsyncStorage.setItem(storageKey(uid), abs);
          qrLastFetchAt.current = now;
        } else if (!cached) {
          setError("No QR link available right now.");
        }
      } catch (_e) {
        if (!qrUrl) setError("Failed to fetch QR. Please try again.");
      } finally {
        qrFetchInFlight.current = false;
      }
    },
    [qrUrl, storageKey, userId, role, agentCode, qrPayload, phone]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    const me = await loadMe();
    try {
      if (me?.id) {
        await AsyncStorage.removeItem(storageKey(me.id));
      }
    } catch {}
    await loadQr(me.id, { force: true });
    setRefreshing(false);
  };

  const onRegenerate = async () => {
      const uid = userId ?? (await loadMe()).id;
      try {
        const res = await api.post("/qr_code/generate/", {});
        const baseUrl =
          res?.data?.qr_code?.qr_code_url ||
          res?.data?.qr_code_url ||
          res?.data?.url ||
          null;
        const qrDataRaw = res?.data?.qr_code?.qr_data || res?.data?.qr_data || null;
        if (qrDataRaw) {
          try {
            const parsed = JSON.parse(qrDataRaw);
            setQrPayload(parsed);
            console.log("[MyQRCode] regenerate qr_data parsed:", parsed);
            if (parsed?.agent_code) setAgentCode(parsed.agent_code);
            if (!phone && parsed?.phone) setPhone(parsed.phone);
            if (!userId && parsed?.user_id) setUserId(parsed.user_id);
          } catch {}
        }
      const makeAbsolute = (u) => {
        if (!u) return null;
        if (/^https?:\/\//i.test(u)) return u;
        const apiBase = api?.defaults?.baseURL || "";
        const origin = apiBase.replace(/\/api\/?$/i, "").replace(/\/$/, "");
        return `${origin}${u.startsWith("/") ? "" : "/"}${u}`;
      };
      const abs = makeAbsolute(baseUrl);
      if (abs) {
        setQrUrl(abs);
        if (uid) await AsyncStorage.setItem(storageKey(uid), abs);
        qrLastFetchAt.current = Date.now();
        return;
      }
    } catch {}
    await loadQr(uid, { force: true });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await loadMe();
        await loadQr(me.id);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadMe, loadQr]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate("Home");
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [navigation])
  );

  const openInBrowser = () => {
    if (!qrUrl) return;
    Linking.openURL(qrUrl).catch(() => {
      Alert.alert("تعذّر الفتح", "لا يمكن فتح الرابط حالياً.");
    });
  };

  const shareQr = async () => {
    try {
      if (!qrUrl) return;
      await Share.share({ message: qrUrl, url: qrUrl, title: "My QR" });
    } catch {}
  };

  return (
    <PageLayout navigation={navigation} active="qr" withSideMenu showBottomNav>
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.bg }}
        contentContainerStyle={{ paddingBottom: insets.bottom + sy(24) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + sy(10), paddingHorizontal: sx(14) }}>
          <View className="headerBar" style={styles.headerBar}>
            <Text style={styles.title}>My QR Code</Text>
          </View>
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: sx(14), marginTop: sy(10) }}>
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.card}>
            {loading ? (
              <View style={{ alignItems: "center", paddingVertical: sy(30) }}>
                <ActivityIndicator size="large" />
              </View>
            ) : qrUrl ? (
              <>
                {role === "agent" && (
                  <Pressable
                    onPress={() => setAgentMode((v) => !v)}
                    android_ripple={{ color: "#e5e7eb" }}
                    style={[styles.btn, { alignSelf: "center", marginBottom: sy(10) }]}
                  >
                    <Text style={styles.btnText}>
                      {agentMode ? "Back to My QR" : "Connect to Me (Agent)"}
                    </Text>
                  </Pressable>
                )}

                {!agentMode ? (
                  <>
                    <Image source={{ uri: qrUrl }} style={{ width: 260, height: 260, alignSelf: "center" }} resizeMode="contain" />
                    <Text style={styles.hint}>Share this QR so others can send you money.</Text>

                    <View style={styles.kvRow}>
                      <Text style={styles.kvKey}>Wallet / Phone</Text>
                      <Text style={styles.kvVal}>{phone ? String(phone) : "???"}</Text>
                    </View>

                    {role === "agent" && (
                      <View style={styles.kvRow}>
                        <Text style={styles.kvKey}>Agent Code</Text>
                        <Text style={styles.kvVal}>
                          {agentCode || qrPayload?.agent_code || "Not available"}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.agentCard}>
                      <Text style={styles.agentTitle}>Agent Connect</Text>
                      <Text style={styles.agentHint}>Share this code or QR so users can connect to you.</Text>
                    </View>

                    <View style={styles.agentBlock}>
                      <Text style={styles.agentBlockTitle}>Connect via Code</Text>
                      <Text style={styles.agentCode}>
                        {agentCode || qrPayload?.agent_code || "Not available"}
                      </Text>
                      {!agentCode && !qrPayload?.agent_code && (
                        <Text style={styles.agentHint}>
                          Agent code is missing. Pull to refresh or contact support.
                        </Text>
                      )}
                    </View>

                    <View style={styles.agentBlock}>
                      <Text style={styles.agentBlockTitle}>Connect via QR</Text>
                      <Image source={{ uri: qrUrl }} style={{ width: 220, height: 220, alignSelf: "center" }} resizeMode="contain" />
                    </View>
                  </>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 10,
                    marginTop: sy(14),
                    flexWrap: "wrap",
                  }}
                >
                  <Pressable onPress={onRefresh} android_ripple={{ color: "#e5e7eb" }} style={styles.btn}>
                    <Text style={styles.btnText}>Refresh</Text>
                  </Pressable>

                  <Pressable onPress={onRegenerate} android_ripple={{ color: "#e5e7eb" }} style={styles.btnSec}>
                    <Text style={styles.btnSecText}>Generate QR</Text>
                  </Pressable>

                  <Pressable onPress={shareQr} android_ripple={{ color: "#e5e7eb" }} style={styles.btnSec}>
                    <Text style={styles.btnSecText}>مشاركة</Text>
                  </Pressable>

                  <Pressable onPress={openInBrowser} android_ripple={{ color: "#e5e7eb" }} style={styles.btnSec}>
                    <Text style={styles.btnSecText}>فتح</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: sy(20) }}>
                <Text style={{ color: COLORS.textMuted, textAlign: "center" }}>
                  لا يوجد QR حالياً. اسحب للتحديث أو جرّب لاحقاً.
                </Text>
                </View>
            )}
          </View>
        </View>
      </ScrollView>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  iconBtnText: { color: COLORS.primary, fontWeight: "900" },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  hint: { color: COLORS.textMuted, marginTop: 10, textAlign: "center" },
  kvRow: {
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kvKey: { color: COLORS.textMuted, fontWeight: "600" },
  kvVal: { color: COLORS.text, fontWeight: "900" },
  btn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "900" },
  btnSec: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: COLORS.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnSecText: { color: COLORS.text, fontWeight: "900" },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { color: "#991B1B", fontWeight: "800" },
  agentCard: {
    marginTop: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 12,
  },
  agentTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 6 },
  agentHint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 6 },
  agentBlock: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 14,
    padding: 12,
  },
  agentBlockTitle: { color: COLORS.textMuted, fontWeight: "700", marginBottom: 6 },
  agentCode: { color: COLORS.text, fontWeight: "900", fontSize: 18, textAlign: "center" },
});
