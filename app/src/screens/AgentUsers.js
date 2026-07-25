// src/screens/AgentUsers.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  I18nManager,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import PageLayout from "../ui/PageLayout";
import { useAuth } from "../context/AuthProvider";
import { getAgentUsers } from "../api/agent";

const BASE_W = 390, BASE_H = 844;

const COLOR = {
  primary: "#0B63D8",
  primaryDark: "#0A3D91",
  primarySoft: "#E6F0FF",
  accent: "#22D3EE",
  text: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  card: "#FFFFFF",
  bg: "#F6F8FC",
  success: "#16A34A",
  warning: "#F59E0B",
};

function fmtPhone(p) {
  if (!p) return null;
  return String(p);
}

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "U";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

export default function AgentUsers({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const sx = (n) => (W / BASE_W) * n;
  const sy = (n) => (H / BASE_H) * n;
  const isRTL = I18nManager.isRTL;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const agentId = useMemo(() => {
    return user?.id || null;
  }, [user]);

  const localAgentUsers = useMemo(() => {
    const raw = user?.raw || user || {};
    const list = raw.agent_users || raw.agentUsers || [];
    return Array.isArray(list) ? list : [];
  }, [user]);

  const load = useCallback(async () => {
    setError(null);
    if (!agentId) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      setError("لا يمكن تحديد الوكيل الحالي.");
      return;
    }
    try {
      const list = await getAgentUsers(agentId);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      if (localAgentUsers.length > 0) {
        setItems(localAgentUsers);
        setError(null);
      } else {
        setError("تعذّر تحميل العملاء. حاول مرة أخرى.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentId, localAgentUsers]);

  useEffect(() => {
    load();
  }, [load]);

  const NAV_HEIGHT = sy(64);
  const contentPadBottom = NAV_HEIGHT + insets.bottom + sy(16);
  const dirRow = isRTL ? "row-reverse" : "row";

  return (
    <PageLayout navigation={navigation} active="menu" withSideMenu>
      <ScrollView
        style={{ flex: 1, backgroundColor: COLOR.bg }}
        contentContainerStyle={{ paddingTop: insets.top + sy(12), paddingBottom: contentPadBottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: sx(16) }}>
          <LinearGradient
            colors={[COLOR.primary, COLOR.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { borderRadius: sx(20), paddingVertical: sy(18), paddingHorizontal: sx(18) }]}
          >
            <View style={[styles.headerRow, { flexDirection: dirRow }]}>
              <View style={[styles.headerIcon, { marginEnd: isRTL ? 0 : sx(10), marginStart: isRTL ? sx(10) : 0 }]}>
                <Ionicons name="people-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { textAlign: isRTL ? "right" : "left", color: "#FFFFFF" }]}>عملائي</Text>
                <Text style={[styles.headerSub, { textAlign: isRTL ? "right" : "left", color: "rgba(255,255,255,0.8)" }]}>
                  إدارة قائمة المستخدمين المرتبطين بك بسهولة.
                </Text>
              </View>
              <View style={styles.countPillDark}>
                <Text style={styles.countTextDark}>{items.length}</Text>
              </View>
            </View>

            <View style={[styles.headerStats, { flexDirection: dirRow }]}>
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>إجمالي العملاء</Text>
                <Text style={styles.statValue}>{items.length}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>حالة الاتصال</Text>
                <Text style={styles.statValue}>نشط</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={{ paddingHorizontal: sx(16), marginTop: sy(14) }}>
          {loading ? (
            <View style={{ paddingVertical: sy(24), alignItems: "center" }}>
              <ActivityIndicator color={COLOR.primary} />
              <Text style={{ marginTop: sy(8), color: COLOR.muted }}>جاري التحميل...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{error}</Text>
              <Text style={styles.emptySub}>اسحب للأسفل لإعادة المحاولة.</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>لا يوجد عملاء بعد</Text>
              <Text style={styles.emptySub}>أي مستخدم يرتبط بك سيظهر هنا.</Text>
            </View>
          ) : (
            items.map((u) => {
              const name = u?.full_name || u?.name || "مستخدم";
              const phone = fmtPhone(u?.phone || u?.optional_phone);
              const country = u?.country ? String(u.country) : "";
              const wallet = u?.wallet_balance || {};
              const usd = wallet.available_usd ?? 0;
              return (
                <View key={u.id || `${name}-${phone}`} style={styles.card}>
                  <View style={[styles.cardTop, { flexDirection: dirRow }]}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{initials(name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { textAlign: isRTL ? "right" : "left" }]}>{name}</Text>
                      <View style={[styles.metaRow, { flexDirection: dirRow }]}>
                        <Ionicons name="call-outline" size={14} color={COLOR.muted} />
                        <Text style={styles.metaText}>{phone || "—"}</Text>
                        {country ? (
                          <>
                            <View style={styles.dot} />
                            <Ionicons name="location-outline" size={14} color={COLOR.muted} />
                            <Text style={styles.metaText}>{country}</Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                    {u?.customer_category ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{u.customer_category}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.cardFooter, { flexDirection: dirRow }]}>
                    <View style={styles.moneyPill}>
                      <Text style={styles.moneyLabel}>USD</Text>
                      <Text style={styles.moneyValue}>{Number(usd).toFixed(2)}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Ionicons name="checkmark-circle" size={14} color={COLOR.success} />
                      <Text style={styles.statusText}>مرتبط</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  headerRow: { alignItems: "center", gap: 10 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "900" },
  headerSub: { marginTop: 4, fontSize: 12 },
  countPillDark: {
    minWidth: 34,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  countTextDark: { color: "#FFFFFF", fontWeight: "800" },
  headerStats: {
    marginTop: 12,
    gap: 10,
  },
  statPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  statValue: { color: "#FFFFFF", fontWeight: "800", marginTop: 4 },
  card: {
    backgroundColor: COLOR.card,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0B63D8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTop: {
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLOR.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D7E6FF",
  },
  avatarText: { color: COLOR.primary, fontWeight: "900" },
  name: { fontSize: 16, fontWeight: "800", color: COLOR.text, flex: 1 },
  badge: {
    backgroundColor: "#ECFDF3",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  badgeText: { color: COLOR.success, fontSize: 11, fontWeight: "700" },
  metaRow: { marginTop: 6, alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { color: COLOR.muted, fontSize: 12 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLOR.line,
    marginHorizontal: 4,
  },
  cardFooter: { marginTop: 12, alignItems: "center", justifyContent: "space-between" },
  moneyPill: {
    backgroundColor: "#F1F5FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moneyLabel: { color: COLOR.muted, fontSize: 11 },
  moneyValue: { color: COLOR.text, fontWeight: "800" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF3",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  statusText: { color: COLOR.success, fontSize: 11, fontWeight: "700" },
  emptyBox: {
    backgroundColor: COLOR.card,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  emptyTitle: { color: COLOR.text, fontWeight: "800" },
  emptySub: { color: COLOR.muted, marginTop: 6, fontSize: 12, textAlign: "center" },
});
