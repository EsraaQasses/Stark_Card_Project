// src/screens/OurAgents.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";
import {
  AppCard,
  AppEmptyState,
  AppIconButton,
  AppSearchBox,
  AppSectionTitle,
} from "../shared/ui/primitives";
import { getAgents, getAgentRegions, connectToAgent } from "../api/agent";
import { useAuth } from "../context/AuthProvider";
import { useScale } from "../ui/scale";
import {
  colors as themeColors,
  fontFamilies,
  radius,
  shadows,
  spacing,
  typography,
} from "../shared/theme";

const COLOR = {
  primary: themeColors.brand.primary,
  primaryDark: themeColors.brand.primaryDark,
  accent: "#FFB020",
  text: themeColors.text.primary,
  muted: themeColors.text.muted,
  bgSoft: themeColors.surface.soft,
  line: themeColors.border.default,
  white: themeColors.surface.background,
  card: themeColors.surface.cardSoft,
  ink: themeColors.text.primary,
  success: themeColors.status.success,
  successBg: "#ECFDF3",
  successBorder: "#BBF7D0",
  blueSoft: themeColors.surface.cardSoft,
  blueLine: "#DCE8FF",
};

export default function OurAgents({ navigation, route }) {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { sx, sy } = useScale();

  const NAV_HEIGHT = sy(64);
  const contentPadBottom = NAV_HEIGHT + insets.bottom + sy(12);
  const MAX_W = 480;
  const H_PAD = sx(16);

  const [agents, setAgents] = useState([]);
  const [regions, setRegions] = useState([]);
  const [search, setSearch] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [connectingCode, setConnectingCode] = useState(false);
  const [showAllAgents, setShowAllAgents] = useState(true);
  const [showConnectPanel, setShowConnectPanel] = useState(true);

  const scrollRef = useRef(null);
  const connectPanelY = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const normalizeList = (val) => {
    if (Array.isArray(val)) return val;
    if (val && Array.isArray(val.results)) return val.results;
    return [];
  };

  const regionForAgent = useCallback(
    (fullName) => {
      if (!regions || regions.length === 0) return null;
      const norm = (s) => String(s ?? "").trim().toLowerCase();
      const target = norm(fullName);
      const r = regions.find((x) => norm(x.agent_name) === target);
      return r?.region || null;
    },
    [regions]
  );

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);

    try {
      const agentsRes = await getAgents();
      const agentsList = normalizeList(agentsRes);
      if (mounted.current) setAgents(agentsList);

      try {
        const regionsRes = await getAgentRegions();
        const regionsList = normalizeList(regionsRes);
        if (mounted.current) setRegions(regionsList);
      } catch (_e) {
        if (mounted.current) setRegions([]);
      }
    } catch (e) {
      console.error(e);
      if (mounted.current) {
        setLoadError("تعذّر تحميل الوكلاء. تأكد من الاتصال وتسجيل الدخول.");
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const connectedAgent = user?.raw?.connected_agent || user?.raw?.agent || null;
  const connectedAgentId = connectedAgent?.id ?? connectedAgent?.user_id ?? null;
  const isPublic = route?.params?.public === true;

  useEffect(() => {
    const hasAgent = !!connectedAgentId;
    setShowAllAgents(!hasAgent);
    setShowConnectPanel(!hasAgent);
  }, [connectedAgentId]);

  const doConnect = async ({ agentId, agentCodeValue, allowSwitch = false }) => {
    try {
      setConnectingCode(true);

      const res = await connectToAgent({
        agent_id: agentId,
        agent_code: agentCodeValue,
        allow_switch: allowSwitch,
      });

      await refreshUser();

      Alert.alert(
        "تم الربط",
        res?.message || "تم ربط حسابك بالوكيل بنجاح."
      );
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "فشل الربط. حاول مرة أخرى.";

      Alert.alert("خطأ", String(msg));
    } finally {
      setConnectingCode(false);
    }
  };

  const confirmSwitchIfNeeded = ({ agentId, agentCodeValue }) => {
    if (connectedAgentId && agentId && connectedAgentId === agentId) {
      return doConnect({ agentId, agentCodeValue, allowSwitch: false });
    }

    if (connectedAgentId) {
      Alert.alert(
        "تبديل الوكيل؟",
        "أنت مرتبط بوكيل حاليًا. هل تريد التبديل؟",
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "تبديل",
            style: "destructive",
            onPress: () =>
              doConnect({ agentId, agentCodeValue, allowSwitch: true }),
          },
        ]
      );
      return;
    }

    return doConnect({ agentId, agentCodeValue, allowSwitch: false });
  };

  const handleConnectByCode = () => {
    const code = String(agentCode || "").trim();

    if (!code) {
      Alert.alert("رمز الوكيل", "الرجاء إدخال رمز الوكيل أولًا.");
      return;
    }

    confirmSwitchIfNeeded({ agentCodeValue: code });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;

    return (agents || []).filter((a) =>
      `${a.full_name || ""} ${a.username || ""}`.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const AgentCard = ({ ag }) => {
    const reg = ag.region || regionForAgent(ag.full_name);
    const initials = makeInitials(ag.full_name || ag.username || "");
    const avatarBg = pickAvatarColor(ag.id);
    const isCurrent =
      connectedAgentId && (connectedAgentId === ag.id || connectedAgentId === ag.user_id);

    const handlePickAgent = () => {
      if (connectingCode) return;
      confirmSwitchIfNeeded({ agentId: ag.id, agentCodeValue: null });
    };

    return (
      <Pressable
        style={({ pressed }) => [
          pressed && styles.cardPressed,
        ]}
        android_ripple={{ color: "#EAF2FF" }}
        onPress={handlePickAgent}
      >
        <AppCard
          style={[
            styles.agentCard,
            isCurrent && styles.agentCardActive,
          ]}
        >
        <View style={styles.agentCardTop}>
          <View style={[styles.agentAvatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.agentAvatarText}>{initials}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.agentName}>
              {ag.full_name || ag.username || `وكيل #${ag.id}`}
            </Text>

            <View style={styles.agentMetaRow}>
              <Ionicons name="location-outline" size={14} color={COLOR.muted} />
              <Text numberOfLines={1} style={styles.agentMetaText}>
                {reg || "المنطقة غير متوفرة"}
              </Text>
            </View>

            {!!ag.username && (
              <View style={styles.agentMetaRow}>
                <Ionicons name="person-outline" size={14} color={COLOR.muted} />
                <Text numberOfLines={1} style={styles.agentMetaText}>
                  {ag.username}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.agentStatusPill}>
            <Ionicons
              name={isCurrent ? "checkmark-circle" : "shield-checkmark-outline"}
              size={13}
              color={isCurrent ? COLOR.success : COLOR.primary}
            />
            <Text
              style={[
                styles.agentStatusText,
                isCurrent && { color: "#166534" },
              ]}
            >
              {isCurrent ? "وكيلك الحالي" : "موثوق"}
            </Text>
          </View>
        </View>

        <View style={styles.agentDivider} />

        <View style={styles.agentActions}>
          <View style={styles.agentHintBox}>
            <Ionicons name="flash-outline" size={14} color={COLOR.primary} />
            <Text style={styles.agentHintText}>
              ربط سريع ودعم مباشر
            </Text>
          </View>

          <Pressable
            onPress={handlePickAgent}
            disabled={connectingCode}
            style={[
              styles.agentConnectBtn,
              connectingCode && { opacity: 0.6 },
              isCurrent && styles.agentConnectBtnSecondary,
            ]}
          >
            <Text
              style={[
                styles.agentConnectBtnText,
                isCurrent && { color: COLOR.primary },
              ]}
            >
              {isCurrent ? "مرتبط الآن" : "تعيين هذا الوكيل"}
            </Text>
          </Pressable>
        </View>
        </AppCard>
      </Pressable>
    );
  };

  return (
    <PageLayout navigation={navigation} active="menu" withSideMenu={!isPublic}>
      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: COLOR.white }}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: contentPadBottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: MAX_W,
            paddingHorizontal: H_PAD,
            paddingTop: insets.top + sy(8),
          }}
        >
          <AppHeader
            safeTop={false}
            title={
              connectedAgent
                ? `الوكلاء · ${
                    connectedAgent.full_name ||
                    connectedAgent.name ||
                    connectedAgent.username ||
                    "-"
                  }`
                : "الوكلاء"
            }
            subtitle="ابحث عن وكيل موثوق قريب منك واربط حسابك معه بسهولة."
            right={
              !isPublic && (
                <View style={styles.heroActions}>
                  <AppIconButton
                    onPress={() => navigation.navigate("Notifications")}
                    accessibilityLabel="الإشعارات"
                    name="notifications-outline"
                    color={COLOR.white}
                    style={styles.headerIconBtn}
                  />
                  <AppIconButton
                    onPress={() => navigation.navigate("Profile")}
                    accessibilityLabel="الملف الشخصي"
                    name="person-outline"
                    color={COLOR.white}
                    style={styles.headerIconBtn}
                  />
                </View>
              )
            }
            style={styles.hero}
          />
        </View>

        {!!connectedAgent && !showAllAgents && (
          <View
            style={{
              alignSelf: "center",
              width: "100%",
              maxWidth: MAX_W,
              paddingHorizontal: H_PAD,
              paddingTop: sy(12),
            }}
          >
            <AppCard soft style={styles.connectedCard}>
              <View style={styles.connectedHeader}>
                <View style={styles.connectedAvatar}>
                  <Text style={styles.connectedAvatarText}>
                    {makeInitials(
                      connectedAgent.full_name ||
                        connectedAgent.name ||
                        connectedAgent.username ||
                        "وكيل"
                    )}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.connectedTitle}>وكيلك الحالي</Text>
                  <Text style={styles.connectedName}>
                    {connectedAgent.full_name ||
                      connectedAgent.name ||
                      connectedAgent.username ||
                      "—"}
                  </Text>
                </View>

                <View style={styles.connectedBadgePill}>
                  <Ionicons name="checkmark-circle" size={14} color={COLOR.success} />
                  <Text style={styles.connectedBadgeText}>نشط</Text>
                </View>
              </View>

              <View style={styles.connectedInfoGrid}>
                <View style={styles.connectedInfoBox}>
                  <Ionicons name="call-outline" size={16} color={COLOR.primary} />
                  <Text style={styles.connectedInfoLabel}>الهاتف</Text>
                  <Text style={styles.connectedInfoValue}>
                    {connectedAgent.phone || connectedAgent.mobile || "—"}
                  </Text>
                </View>

                <View style={styles.connectedInfoBox}>
                  <Ionicons name="location-outline" size={16} color={COLOR.primary} />
                  <Text style={styles.connectedInfoLabel}>المنطقة</Text>
                  <Text style={styles.connectedInfoValue}>
                    {connectedAgent.region ||
                      regionForAgent(connectedAgent.full_name) ||
                      "—"}
                  </Text>
                </View>
              </View>

              <View style={styles.connectedActions}>
                <Pressable
                  onPress={() => setShowAllAgents(true)}
                  style={[styles.secondaryBtn, { flex: 1 }]}
                >
                  <Text style={styles.secondaryBtnText}>عرض كل الوكلاء</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setShowConnectPanel(true);
                    scrollRef.current?.scrollTo({
                      y: Math.max(0, connectPanelY.current - 12),
                      animated: true,
                    });
                  }}
                  style={[styles.primaryBtn, { flex: 1 }]}
                >
                  <Text style={styles.primaryBtnText}>تغيير الوكيل</Text>
                </Pressable>
              </View>
            </AppCard>
          </View>
        )}

        {(showConnectPanel || !connectedAgent) && (
          <View
            onLayout={(e) => {
              connectPanelY.current = e.nativeEvent.layout.y;
            }}
            style={{
              alignSelf: "center",
              width: "100%",
              maxWidth: MAX_W,
              paddingHorizontal: H_PAD,
              paddingTop: sy(12),
            }}
          >
            <AppCard soft style={styles.guideCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="sparkles-outline" size={18} color={COLOR.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitleLarge}>كيف يساعدك الوكيل؟</Text>
                  <Text style={styles.sectionSubtle}>
                    خطوات بسيطة للعثور على الوكيل المناسب
                  </Text>
                </View>
              </View>

              <View style={{ gap: sy(10) }}>
                <GuideRow icon="search-outline" text="اختر وكيلًا قريبًا منك لتسهيل الشحن والدعم." />
                <GuideRow icon="scan-outline" text="يمكنك الربط عبر مسح رمز QR أو إدخال رمز الوكيل." />
                <GuideRow icon="card-outline" text="بعد الربط يمكنك الشحن وطلب المساعدة بسهولة." />
              </View>
            </AppCard>

            <AppCard style={styles.quickCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="link-outline" size={18} color={COLOR.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitleLarge}>ربط سريع</Text>
                  <Text style={styles.sectionSubtle}>
                    امسح الرمز أو أدخل كود الوكيل
                  </Text>
                </View>
              </View>

              {!!connectedAgent && (
                <View style={styles.connectedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLOR.success} />
                  <Text style={styles.connectedText}>
                    مرتبط مع: {connectedAgent.full_name || connectedAgent.name || "—"}
                  </Text>
                </View>
              )}

              <View style={styles.quickActionsGrid}>
                <Pressable
                  onPress={() =>
                    navigation.navigate("AgentQRConnect", { mode: "connect" })
                  }
                  style={styles.actionCard}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="scan-outline" size={20} color={COLOR.primary} />
                  </View>
                  <Text style={styles.actionCardTitle}>مسح رمز QR</Text>
                  <Text style={styles.actionCardSub}>الأسرع للربط المباشر</Text>
                </Pressable>

                <Pressable
                  onPress={handleConnectByCode}
                  disabled={connectingCode}
                  style={[styles.actionCard, connectingCode && { opacity: 0.6 }]}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="key-outline" size={20} color={COLOR.primary} />
                  </View>
                  <Text style={styles.actionCardTitle}>ربط بالرمز</Text>
                  <Text style={styles.actionCardSub}>استخدم كود الوكيل يدويًا</Text>
                </Pressable>
              </View>

              <View style={styles.codeRow}>
                <Ionicons name="barcode-outline" size={16} color={COLOR.muted} />
                <TextInput
                  value={agentCode}
                  onChangeText={setAgentCode}
                  placeholder="أدخل رمز الوكيل"
                  placeholderTextColor={COLOR.muted}
                  autoCapitalize="characters"
                  style={styles.codeInput}
                />
              </View>
            </AppCard>
          </View>
        )}

        {showAllAgents && (
          <View
            style={{
              alignSelf: "center",
              width: "100%",
              maxWidth: MAX_W,
              paddingHorizontal: H_PAD,
              paddingTop: sy(12),
              marginBottom: sy(8),
            }}
          >
            <AppSectionTitle
              title="قائمة الوكلاء"
              right={
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{filtered.length}</Text>
                </View>
              }
              style={styles.listHeader}
            />

            <AppSearchBox
              value={search}
              onChangeText={setSearch}
              onClear={() => setSearch("")}
              placeholder="ابحث عن وكيل بالاسم أو اسم المستخدم"
              style={styles.searchBox}
            />
          </View>
        )}

        {showAllAgents && (
          <View
            style={{
              alignSelf: "center",
              width: "100%",
              maxWidth: MAX_W,
              paddingHorizontal: H_PAD,
              paddingBottom: sy(140),
            }}
          >
            {loading ? (
              <View style={{ paddingVertical: sy(30) }}>
                <ActivityIndicator size="large" color={COLOR.primary} />
              </View>
            ) : loadError ? (
              <StateBox
                icon="alert-circle"
                color="#B00020"
                text={loadError}
                onRetry={load}
                sx={sx}
                sy={sy}
              />
            ) : filtered.length === 0 ? (
              <AppEmptyState
                icon="information-circle"
                title="لا توجد نتائج مطابقة."
                style={styles.emptyAgentsState}
              />
            ) : (
              <View style={styles.agentList}>
                {filtered.map((ag) => (
                  <AgentCard key={ag.id} ag={ag} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </PageLayout>
  );
}

function GuideRow({ icon, text }) {
  return (
    <View style={styles.guideRow}>
      <View style={styles.guideRowIcon}>
        <Ionicons name={icon} size={16} color={COLOR.primary} />
      </View>
      <Text style={styles.guideRowText}>{text}</Text>
    </View>
  );
}

function StateBox({ icon, color, text, onRetry, sx, sy }) {
  return (
    <AppCard soft style={styles.stateBox}>
      <Ionicons name={icon} size={sx(22)} color={color} />
      <Text style={styles.stateText}>{text}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={[styles.retryBtn, { marginTop: sy(8) }]}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>إعادة المحاولة</Text>
        </Pressable>
      )}
    </AppCard>
  );
}

function makeInitials(s) {
  const parts = String(s).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "وك";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function pickAvatarColor(seed) {
  const palette = ["#2F8CFF", "#6C5CE7", "#E67E22", "#00B894", "#D63031", "#0984E3"];
  const idx = Math.abs(Number(seed) || 0) % palette.length;
  return palette[idx];
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIconBtn: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.28)",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  sectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: COLOR.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleLarge: {
    fontFamily: fontFamilies.bold,
    color: COLOR.ink,
    fontWeight: "900",
    fontSize: typography.body.fontSize,
  },
  sectionSubtle: {
    fontFamily: fontFamilies.regular,
    color: COLOR.muted,
    marginTop: 2,
    fontSize: typography.caption.fontSize,
  },

  guideCard: {
    backgroundColor: COLOR.card,
    borderColor: COLOR.blueLine,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    ...shadows.soft,
  },
  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  guideRowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: COLOR.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  guideRowText: {
    fontFamily: fontFamilies.regular,
    color: COLOR.text,
    fontSize: typography.caption.fontSize + 1,
    flex: 1,
    lineHeight: 18,
  },

  quickCard: {
    backgroundColor: COLOR.white,
    borderColor: COLOR.blueLine,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginTop: 4,
    marginBottom: 10,
  },
  actionCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "#DCE8FF",
    backgroundColor: COLOR.card,
    padding: spacing.md,
    minHeight: 108,
    justifyContent: "space-between",
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: COLOR.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCardTitle: {
    fontFamily: fontFamilies.bold,
    color: COLOR.ink,
    fontWeight: "900",
    fontSize: 14,
    marginTop: 8,
  },
  actionCardSub: {
    fontFamily: fontFamilies.regular,
    color: COLOR.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  codeRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLOR.card,
  },
  codeInput: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    color: COLOR.text,
    fontSize: 14,
    fontWeight: "700",
  },

  connectedCard: {
    backgroundColor: COLOR.card,
    borderColor: COLOR.blueLine,
    borderWidth: 1,
    borderRadius: radius.button,
    padding: spacing.md,
    ...shadows.soft,
  },
  connectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  connectedAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0B63D8",
    alignItems: "center",
    justifyContent: "center",
  },
  connectedAvatarText: {
    fontFamily: fontFamilies.bold,
    color: "#fff",
    fontWeight: "900",
    fontSize: 17,
  },
  connectedTitle: {
    fontFamily: fontFamilies.bold,
    color: COLOR.muted,
    fontWeight: "800",
    fontSize: 12,
  },
  connectedName: {
    fontFamily: fontFamilies.extraBold,
    color: COLOR.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  connectedBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: COLOR.successBg,
    borderWidth: 1,
    borderColor: COLOR.successBorder,
  },
  connectedBadgeText: {
    fontFamily: fontFamilies.bold,
    color: "#166534",
    fontWeight: "800",
    fontSize: 11,
  },
  connectedInfoGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  connectedInfoBox: {
    flex: 1,
    backgroundColor: COLOR.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#E5EEFF",
    padding: 12,
  },
  connectedInfoLabel: {
    fontFamily: fontFamilies.bold,
    color: COLOR.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  connectedInfoValue: {
    fontFamily: fontFamilies.bold,
    color: COLOR.text,
    fontWeight: "800",
    marginTop: 4,
  },
  connectedActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },

  primaryBtn: {
    backgroundColor: COLOR.primary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryBtnText: {
    fontFamily: fontFamilies.bold,
    color: "#fff",
    fontWeight: "900",
  },
  secondaryBtn: {
    backgroundColor: COLOR.blueSoft,
    borderWidth: 1,
    borderColor: "#D6E4FF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.bold,
    color: COLOR.primary,
    fontWeight: "900",
  },

  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLOR.successBg,
    borderColor: COLOR.successBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  connectedText: {
    fontFamily: fontFamilies.bold,
    color: "#166534",
    fontWeight: "700",
    fontSize: 12,
    flex: 1,
  },

  listHeader: {
    marginBottom: 8,
  },
  countPill: {
    minWidth: 32,
    height: 32,
    borderRadius: radius.card,
    backgroundColor: COLOR.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  countPillText: {
    fontFamily: fontFamilies.bold,
    color: COLOR.primary,
    fontWeight: "900",
    fontSize: 12,
  },

  searchBox: {
    marginBottom: 16,
  },

  agentList: {
    gap: 12,
  },
  agentCard: {
    overflow: "hidden",
    backgroundColor: COLOR.white,
    borderWidth: 1,
    borderColor: "rgba(2,6,23,0.08)",
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.soft,
  },
  agentCardActive: {
    borderColor: "#BBF7D0",
    backgroundColor: "#FBFFFC",
  },
  agentCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  agentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  agentAvatarText: {
    fontFamily: fontFamilies.bold,
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  agentName: {
    fontFamily: fontFamilies.extraBold,
    color: COLOR.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  agentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  agentMetaText: {
    fontFamily: fontFamilies.bold,
    color: COLOR.muted,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  agentStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: COLOR.blueSoft,
    borderWidth: 1,
    borderColor: "#D7E6FF",
  },
  agentStatusText: {
    fontFamily: fontFamilies.bold,
    color: COLOR.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  agentDivider: {
    height: 1,
    backgroundColor: "#EEF2F7",
    marginVertical: 12,
  },
  agentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  agentHintBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FBFF",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#E4EEFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  agentHintText: {
    fontFamily: fontFamilies.bold,
    color: COLOR.text,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  agentConnectBtn: {
    backgroundColor: COLOR.primary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  agentConnectBtnSecondary: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D6E4FF",
  },
  agentConnectBtnText: {
    fontFamily: fontFamilies.bold,
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  stateBox: {
    alignItems: "center",
    marginTop: 12,
    padding: 14,
  },
  emptyAgentsState: {
    marginTop: 12,
  },
  stateText: {
    fontFamily: fontFamilies.regular,
    color: COLOR.text,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: COLOR.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  spinnerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
  },
});
