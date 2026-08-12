// src/ui/SideMenu.js
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthProvider";
import {
  getAccessToken,
  getFirstCompatibleUserSession,
} from "../shared/storage/authStorage";
import { useNavigationShim } from "../utils/navigation";
import { isRTL as getAppIsRTL } from "../shared/utils/rtl";
import { colors } from "./Theme";

const { width: SCREEN_W } = Dimensions.get("window");

// Premium Palette
const PALETTE = {
  primary: colors?.primary || "#0B63D8",
  primaryLight: "#EEF4FF",
  accent: "#FF9F0A",
  text: "#1A2138",
  textMuted: "#6B7B9A",
  white: "#FFFFFF",
  success: "#34C759",
  danger: "#FF3B30",
  glass: "rgba(255, 255, 255, 0.9)",
  border: "#E9F0F6",
  bgSubtle: "#F8FAFC",
};


/* ========== Helpers: robust agent detection ========== */
const str = (v) => (v == null ? "" : String(v)).toLowerCase();

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function arrayHasAgent(arr) {
  try {
    if (!Array.isArray(arr)) return false;
    return arr.some((x) => {
      if (typeof x === "string") return str(x) === "agent" || str(x).includes("agent");
      if (x && typeof x === "object") {
        return str(x.name) === "agent" || str(x.code) === "agent" || str(x.role) === "agent";
      }
      return false;
    });
  } catch {
    return false;
  }
}

function computeIsAgentFromUser(u) {
  if (!u) return { isAgent: false, reason: "no-user" };
  const roleStr = str(u.role || u.user?.role || u.Role || u.profile?.role || u?.user?.profile?.role);
  const rolesArr = Array.isArray(u.roles) ? u.roles : (Array.isArray(u.user?.roles) ? u.user.roles : []);
  const groups = Array.isArray(u.groups) ? u.groups : (Array.isArray(u.user?.groups) ? u.user.groups : []);
  const perms = Array.isArray(u.permissions) ? u.permissions : (Array.isArray(u.user?.permissions) ? u.user.permissions : []);

  const flags = {
    is_agent: u.is_agent === true || u.user?.is_agent === true || u.isAgent === true,
    roleStrAgent: roleStr === "agent",
    rolesArrAgent: arrayHasAgent(rolesArr),
    groupsAgent: arrayHasAgent(groups),
    permsAgent: arrayHasAgent(perms),
    hasAgentProfile: Boolean(u.agent_profile?.id || u.agent?.id || u.agentCode || u.agent_code),
  };

  const isAgent =
    flags.is_agent ||
    flags.roleStrAgent ||
    flags.rolesArrAgent ||
    flags.groupsAgent ||
    flags.permsAgent ||
    flags.hasAgentProfile;

  return { isAgent, reason: JSON.stringify(flags) };
}

async function hydrateStoredUser() {
  return getFirstCompatibleUserSession();
}

async function computeIsAgentDeep(currentUser) {
  const a1 = computeIsAgentFromUser(currentUser);
  if (a1.isAgent) return { ...a1, source: "context-user" };

  const stored = await hydrateStoredUser();
  const a2 = computeIsAgentFromUser(stored);
  if (a2.isAgent) return { ...a2, source: "asyncstorage" };

  try {
    const access = await getAccessToken();
    const payload = access ? decodeJwtPayload(access) : null;
    if (payload) {
      const candidate = {
        role: payload.role || payload.user_role,
        is_agent: payload.is_agent || payload.agent === true,
        roles: payload.roles || payload.groups,
        agent_profile: payload.agent_profile,
        agent: payload.agent,
      };
      const a3 = computeIsAgentFromUser(candidate);
      if (a3.isAgent) return { ...a3, source: "jwt-claims" };
    }
  } catch { }

  return { isAgent: false, reason: "fallback-false", source: "none" };
}

/* ===================================================== */

export default function SideMenu({ visible, onClose, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const auth = useAuth?.();
  const { signOut, user } = auth || { signOut: async () => { }, user: null };
  const isRTL = getAppIsRTL();
  const shimNav = useNavigationShim();
  const nav = navigation || shimNav;

  const SHEET_W = Math.min(310, Math.round(SCREEN_W * 0.8));
  // حل جذري: نفرض LTR محلياً للتحكم بالاتجاهات فيزيائياً
  // right: 0 = يمين الشاشة.
  // translateX موجب = يتحرك لليمين (للخارج).
  const CLOSE_X = SHEET_W;

  const tx = useRef(new Animated.Value(CLOSE_X)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const itemsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      tx.setValue(CLOSE_X);
      backdrop.setValue(0);
      itemsAnim.setValue(0);
    }
  }, [CLOSE_X, visible, tx, backdrop, itemsAnim]);

  const openAnim = useCallback(() => {
    tx.setValue(CLOSE_X);
    Animated.parallel([
      Animated.spring(tx, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
      Animated.timing(backdrop, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(itemsAnim, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
    ]).start();
  }, [tx, backdrop, itemsAnim, CLOSE_X]);

  const closeAnim = useCallback((cb) => {
    Animated.parallel([
      Animated.timing(tx, { toValue: CLOSE_X, duration: 250, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(itemsAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => finished && cb?.());
  }, [tx, backdrop, itemsAnim, CLOSE_X]);

  useEffect(() => {
    if (visible) {
      openAnim();
    } else {
      closeAnim();
    }
  }, [visible, openAnim, closeAnim]);

  const safeClose = useCallback(() => {
    if (!visible) return;
    closeAnim(() => {
      onClose?.();
    });
  }, [visible, onClose, closeAnim]);

  const handlePress = (callback) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    safeClose();
    setTimeout(callback, 300);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          const absDx = Math.abs(g.dx);
          const absDy = Math.abs(g.dy);
          return absDx > absDy * 1.5 && absDx > 10 && (isRTL ? g.dx > 0 : g.dx < 0);
        },
        onPanResponderMove: (_, g) => {
          const val = isRTL ? Math.max(0, g.dx) : Math.min(0, g.dx);
          tx.setValue(val);
          backdrop.setValue(1 - Math.abs(val) / SHEET_W);
        },
        onPanResponderRelease: (_, g) => {
          const threshold = SHEET_W * 0.25;
          const velocity = Math.abs(g.vx);
          if (Math.abs(g.dx) > threshold || velocity > 0.5) {
            safeClose();
          } else {
            openAnim();
          }
        },
      }),
    [SHEET_W, isRTL, safeClose, tx, backdrop, openAnim]
  );

  const [agentInfo, setAgentInfo] = useState({ isAgent: false, reason: "", source: "" });
  useEffect(() => {
    let mounted = true;
    (async () => {
      const ai = await computeIsAgentDeep(user);
      if (mounted) setAgentInfo(ai);
    })();
    return () => { mounted = false; };
  }, [user]);
  const isAgent = agentInfo.isAgent;

  const [contactOpen, setContactOpen] = useState(false);
  const contactAnim = useRef(new Animated.Value(0)).current;

  const toggleContact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const toValue = contactOpen ? 0 : 1;
    setContactOpen(!contactOpen);
    Animated.spring(contactAnim, {
      toValue,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  };

  const contactHeight = contactAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const contactOpacity = contactAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const contactRotate = contactAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });

  const doLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await signOut?.();
      safeClose();
      if (nav?.reset) {
        nav.reset({ index: 0, routes: [{ name: "FirstPage" }] });
      } else {
        nav.navigate("FirstPage");
      }
    } catch { safeClose(); }
  };

  const safeOpenURL = async (url) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) return Linking.openURL(url);
    } catch { }
  };

  const ITEMS = [
    { key: "profile", label: t("menu.myProfile", "ملفي الشخصي"), icon: "person-outline", route: "Profile", color: "#6366F1" },
    { key: "payments", label: t("menu.myPayments", "مدفوعاتي"), icon: "card-outline", route: "MyPayments", color: "#8B5CF6" },
    { key: "shippings", label: t("menu.myShippings", "شحناتي"), icon: "cube-outline", route: "MyShippings", color: "#2563EB" },
    { key: "wallet", label: t("menu.myWallet", "محفظتي"), icon: "wallet-outline", route: "MyWallet", color: "#F59E0B" },
    { key: "favorite", label: t("menu.favorite", "المفضلة"), icon: "heart-outline", route: "Favorite", color: "#EC4899" },
    ...(isAgent ? [{ key: "agent_clients", label: t("menu.agentClients", "????????????"), icon: "people-outline", route: "AgentUsers", color: "#16A34A" }] : []),
    ...(isAgent ? [{ key: "agent_requests", label: t("menu.agentRequests", "طلبات الوكيل"), icon: "inbox-outline", route: "AgentRequests", color: "#0B63D8" }] : []),
    ...(isAgent ? [{ key: "agent_cashouts", label: t("menu.agentCashouts", "طلبات سحب العملاء"), icon: "cash-outline", route: "AgentCashouts", color: "#16A34A" }] : []),
    ...(isAgent ? [{ key: "my_financial", label: t("menu.myFinancial", "????? ??????"), icon: "stats-chart-outline", route: "MyFinancial", color: "#0B63D8" }] : []),
    ...(isAgent ? [] : [{ key: "agents", label: t("menu.ourAgents", "وكلاؤنا"), icon: "globe-outline", route: "OurAgents", color: "#10B981" }]),
    { key: "transfers", label: t("menu.transactions", "المعاملات"), icon: "swap-horizontal-outline", route: "TransactionsList", color: "#0EA5E9" },
  ];

  const displayName = user?.full_name || user?.name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username || user?.email || t("menu.userName", "مستخدم زائر");

  const displayEmail = user?.email || user?.username || t("menu.noEmail", "اضغط لإكمال الملف الشخصي");
  const connectedAgent = user?.raw?.connected_agent || user?.raw?.agent || user?.connected_agent || user?.agent || null;
  const connectedAgentName = connectedAgent?.full_name || connectedAgent?.name || connectedAgent?.username || null;

  const renderItem = (item, index) => {
    const translateY = itemsAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [20 * (index + 1), 0],
    });

    return (
      <Animated.View key={item.key} style={{ transform: [{ translateY }], opacity: itemsAnim }}>
        <Pressable
          onPress={() => handlePress(() => nav?.navigate(item.route))}
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: item.color + "15" }]}>
            <Ionicons name={item.icon} size={24} color={item.color} />
          </View>
          <Text style={styles.rowText}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={PALETTE.textMuted} />
        </Pressable>
      </Animated.View>
    );
  };

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.mainOverlay]}>
      <Animated.View
        pointerEvents="auto"
        style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}
      >
        <Pressable style={{ flex: 1 }} onPress={safeClose} />
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        pointerEvents="auto"
        style={[
          styles.sheet,
          {
            width: SHEET_W,
            left: 0,
            right: undefined,
            transform: [{ translateX: tx }],
            paddingTop: insets.top,
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* Top Profile Card */}
          <View style={styles.profileSection}>
            <LinearGradient
              colors={[PALETTE.primary, "#0047AB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileGradient}
            />
            <View style={[styles.profileContent, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={styles.avatarContainer}>
                <Image
                  source={require("../assets/icons/user.png")}
                  style={styles.avatarImg}
                  tintColor={PALETTE.white}
                />
                <View style={styles.activeBadge} />
              </View>
              <View style={[styles.profileInfo, { alignItems: isRTL ? "flex-end" : "flex-start", marginHorizontal: 15 }]}>
                <Text numberOfLines={1} style={styles.nameText}>{displayName}</Text>
                <Text numberOfLines={1} style={styles.emailText}>{displayEmail}</Text>
                {!!connectedAgentName && (
                  <Text numberOfLines={1} style={[styles.emailText, { marginTop: 2 }]}>{t("menu.agent", "Agent")}: {connectedAgentName}</Text>
                )}
              </View>
              <Pressable onPress={safeClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={PALETTE.white} />
              </Pressable>
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.menuContainer}>
            <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{t("menu.general", "عام")}</Text>
            {ITEMS.map((it, idx) => renderItem(it, idx))}

            <View style={styles.spacer} />

            {/* Support Section */}
            <Text style={[styles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>{t("menu.support", "الدعم")}</Text>
            <Pressable
              onPress={toggleContact}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: PALETTE.accent + "15" }]}>
                <Ionicons name="help-buoy-outline" size={24} color={PALETTE.accent} />
              </View>
              <Text style={styles.rowText}>{t("menu.contactUs", "تواصل معنا")}</Text>
              <Animated.View style={{ transform: [{ rotate: contactRotate }] }}>
                <Ionicons name="chevron-forward" size={18} color={PALETTE.textMuted} />
              </Animated.View>
            </Pressable>

            <Animated.View style={{ height: contactHeight, opacity: contactOpacity, overflow: "hidden" }}>
              <View style={[styles.contactOptions, { flexDirection: isRTL ? "row-reverse" : "row", paddingStart: isRTL ? 0 : 55, paddingEnd: isRTL ? 55 : 0 }]}>
                <Pressable
                  onPress={() => safeOpenURL("https://wa.me/+963957494706")}
                  style={[styles.contactSmallBtn, { borderColor: "#25D366", flexDirection: isRTL ? "row-reverse" : "row" }]}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  <Text style={[styles.contactSmallText, { color: "#25D366" }]}>WhatsApp</Text>
                </Pressable>
                <Pressable
                  onPress={() => safeOpenURL("https://t.me/starkcard")}
                  style={[styles.contactSmallBtn, { borderColor: "#0088CC", flexDirection: isRTL ? "row-reverse" : "row" }]}
                >
                  <Ionicons name="paper-plane" size={18} color="#0088CC" />
                  <Text style={[styles.contactSmallText, { color: "#0088CC" }]}>Telegram</Text>
                </Pressable>
              </View>
            </Animated.View>

          </View>
        </ScrollView>

        {/* Logout Bottom */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable
            onPress={doLogout}
            style={({ pressed }) => [
              styles.logoutBtn,
              { flexDirection: isRTL ? "row-reverse" : "row" },
              pressed && { opacity: 0.7 }
            ]}
          >
            <Ionicons name="log-out-outline" size={20} color={PALETTE.danger} />
            <Text style={[styles.logoutText, { textAlign: isRTL ? "right" : "left" }]}>{t("menu.logout", "تسجيل الخروج")}</Text>
          </Pressable>
          <Text style={styles.versionText}>v1.0.0 • Stark Card</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainOverlay: {
    zIndex: 1000,
    elevation: 10,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "#FAFBFC",
    shadowColor: "#000",
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 25,
    elevation: 15,
  },
  profileSection: {
    height: 180,
    marginBottom: 25,
  },
  profileGradient: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    opacity: 1,
  },
  profileContent: {
    flex: 1,
    padding: 24,
    paddingTop: 50,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarImg: {
    width: 38,
    height: 38,
  },
  activeBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#34C759",
    borderWidth: 3,
    borderColor: "#0047AB",
  },
  profileInfo: {
    flex: 1,
    marginHorizontal: 16,
  },
  nameText: {
    color: PALETTE.white,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "left",
    letterSpacing: 0.3,
  },
  emailText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    marginTop: 4,
    textAlign: "left",
    fontWeight: "500",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuContainer: {
    paddingHorizontal: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8B9BB0",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 14,
    marginTop: 20,
    textAlign: "left",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginVertical: 4,
    backgroundColor: PALETTE.white,
    shadowColor: "#0B63D8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowPressed: {
    backgroundColor: "#EEF4FF",
    transform: [{ scale: 0.98 }],
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  rowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1A2138",
    textAlign: "left",
    letterSpacing: 0.2,
  },
  spacer: {
    height: 50,
  },
  contactOptions: {
    flexDirection: "row",
    paddingStart: 64,
    gap: 12,
    marginTop: 8,
  },
  contactSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: PALETTE.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  contactSmallText: {
    fontSize: 13,
    fontWeight: "800",
    marginHorizontal: 6,
  },
  agentPortal: {
    marginTop: 28,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#0B63D8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  agentPortalInner: {
    padding: 18,
  },
  agentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  agentTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: PALETTE.primary,
    flex: 1,
    textAlign: "left",
    letterSpacing: 0.3,
  },
  proBadge: {
    backgroundColor: "#0B63D8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: "#0B63D8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  proText: {
    color: PALETTE.white,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 22,
    borderTopWidth: 1,
    borderTopColor: "#E5E9F0",
    backgroundColor: "#FAFBFC",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F0",
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FFE5E5",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoutText: {
    color: "#FF3B30",
    fontSize: 17,
    fontWeight: "800",
    marginHorizontal: 10,
    letterSpacing: 0.3,
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#9BA8BA",
    marginTop: 16,
    fontWeight: "600",
  },
});
