// src/screens/payments/PaymentMethodsList.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  StyleSheet,
  Image,
  I18nManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageLayout from "../../ui/PageLayout";         // ✅ الغلاف الموحّد (BottomNav + SideMenu)
import CornerSpinner from "../../ui/CornerSpinner";
import { listUserPaymentMethods } from "../../api/paymentMethods";
import { absolutizeUrl } from "../../api/client";
import { useAuth } from "../../context/AuthProvider";
import { getCache, setCache, cacheKey } from "../../utils/cache";

const BASE_W = 390, BASE_H = 844;
const isRTL = I18nManager.isRTL !== false; // اعتبر RTL كافتراضي حالياً

const TXT = {
  title: "طرق الشحن",
  subtitle: "اختر الطريقة المناسبة لشحن محفظتك.",
  searchPlaceholder: "ابحث باسم الطريقة أو الوصف…",
  open: "تفاصيل الشحن",
  loading: "جارِ التحميل…",
  loadError: "تعذّر تحميل طرق الشحن. تأكد من تسجيل الدخول والاتصال.",
  emptyTitle: "لا توجد طرق شحن",
  emptyBody: "لم يتم العثور على أي طريقة شحن مطابقة لخياراتك الحالية.",
  tryAgain: "حاول مجددًا",
};

export default function PaymentMethodsList({ navigation, route }) {
  const { user, refreshUser } = useAuth();
  const role = String(
    user?.role ||
      user?.raw?.role ||
      user?.raw?.user?.role ||
      user?.raw?.profile?.role ||
      ""
  ).toLowerCase();
  const hasAgentProfile =
    Boolean(user?.agent_profile) ||
    Boolean(user?.raw?.agent_profile) ||
    Boolean(user?.raw?.profile?.agent_profile);
  const hasAgentCode =
    Boolean(user?.agent_code) ||
    Boolean(user?.raw?.agent_code) ||
    Boolean(user?.raw?.agentCode);
  const isAgent =
    role === "agent" ||
    user?.is_agent === true ||
    user?.raw?.is_agent === true ||
    hasAgentProfile ||
    hasAgentCode;

  useEffect(() => {
    console.log("[PaymentMethodsList] role:", role, "isAgent:", isAgent, "user:", user);
  }, [role, isAgent, user]);
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const sx = (n) => (W / BASE_W) * n;
  const sy = (n) => (H / BASE_H) * n;

  const onPick = route?.params?.onPick || null; // ✅ اختياري للتوافق القديم

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const agentAdminShippingMethod = useMemo(() => {
    if (!isAgent) return null;
    return {
      id: "agent-shipping-admin",
      title: "اشحن رصيدك عبر الإدارة",
      name: "agent_shipping_admin",
      is_agent_admin_shipping: true,
      icon_url: null,
      fields: [
        {
          field_key: "agent_number",
          field_name: "رقم التحويل",
          is_required: true,
        },
      ],
      instructions: "أدخل رقم التحويل واختر المحفظة ثم أرسل الطلب للإدارة.",
      requires_receipt: false,
    };
  }, [isAgent]);

  const fetchData = useCallback(async () => {
  try {
    setError("");
    setLoading(true);
    const cached = await getCache(cacheKey("paymentMethods", "list"), 1000 * 60 * 30);
    if (cached && Array.isArray(cached)) {
      setItems(cached);
    }
    const data = await listUserPaymentMethods(); // يقدر يرمي خطأ الآن
    let arr = Array.isArray(data) ? data : [];
    setItems(arr);
    await setCache(cacheKey("paymentMethods", "list"), arr);
  } catch (e) {
    // اعرض الخطأ الحقيقي بدل النص العام
    const msg =
      e?.message ||
      "تعذّر تحميل وسائل الدفع. تأكد من تسجيل الدخول والاتصال.";
    setError(msg);
    console.log("💥 PaymentMethodsList error:", msg);
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Ensure we have the latest role/agent flags (helps after promote-to-agent)
    refreshUser?.();
  }, [refreshUser]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  // فلترة محلية بسيطة على العنوان/الاسم/الوصف
  const filtered = useMemo(() => {
    const baseItems = isAgent
      ? (items || []).filter((pm) => !pm?.is_agent_shipping)
      : (items || []);
    const visibleItems = agentAdminShippingMethod
      ? [agentAdminShippingMethod, ...baseItems]
      : baseItems;
    const n = q.trim().toLowerCase();
    if (!n) return visibleItems;
    return visibleItems.filter((pm) => {
      const hay = [
        pm?.title, pm?.name, pm?.instructions, pm?.note,
      ].map((x) => (x || "").toString().toLowerCase()).join(" ");
      return hay.includes(n);
    });
  }, [q, items, isAgent, agentAdminShippingMethod]);

  const handlePress = (item) => {
    if (item?.is_agent_admin_shipping) {
      navigation.navigate("ShippingMethodInfo", {
        adminKey: "agent-shipping-admin",
        forceAdminShipping: true,
      });
      return;
    }
    if (item?.is_agent_shipping) {
      const connectedAgent =
        user?.raw?.connected_agent ||
        user?.raw?.agent ||
        user?.connected_agent ||
        (typeof user?.agent === "object" ? user.agent : null) ||
        null;
      const hasAgent = !!(user?.agent_profile || user?.agent || user?.agent_id || connectedAgent);

      // If no agent is linked yet, force the user to the agents directory to pick one first.
      if (!hasAgent) {
        navigation.navigate("OurAgents", { public: true, mode: "assign" });
        return;
      }

      const numericId = Number(item?.id);
      const params =
        Number.isFinite(numericId) ? { methodId: numericId, forceAgent: true } : { forceAgent: true };
      navigation.navigate("ShippingMethodInfo", params);
      return;
    }
    // ✅ لو أُرسلت دالة onPick من صفحة الدفع: نختار ونرجع
    if (typeof onPick === "function") {
      onPick(item);
      navigation.goBack();
      return;
    }
    // وإلا: افتح تفاصيل طريقة الشحن
    navigation.navigate("ShippingMethodInfo", { methodId: item?.id });
  };

  const renderItem = ({ item }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => handlePress(item)}
      style={[styles.card, { borderRadius: sx(16), padding: sx(16) }]}
    >
      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {/* أيقونة (إن وُجدت) */}
        <View
          style={[
            styles.iconWrap,
            {
              width: sx(46),
              height: sx(46),
              borderRadius: sx(12),
              marginLeft: isRTL ? sx(10) : 0,
              marginRight: isRTL ? 0 : sx(10),
            },
          ]}
        >
          {item?.icon_url ? (
            <Image
              source={{ uri: absolutizeUrl(item.icon_url) }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ fontSize: sx(22) }}>💳</Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontSize: sx(18), textAlign: "right" }]}>
            {item?.title || item?.name}
          </Text>

          {!!item?.instructions && (
            <Text
              numberOfLines={2}
              style={{
                marginTop: sy(4),
                color: "#5F708C",
                fontSize: sx(13),
                textAlign: "right",
              }}
            >
              {item.instructions}
            </Text>
          )}
        </View>
      </View>

      {/* زر الفتح السريع */}
      <Pressable
        accessibilityRole="button"
        onPress={() => handlePress(item)}
        style={{
          marginTop: sy(12),
          backgroundColor: "#1274f5ff",
          borderRadius: sx(12),
          height: sy(42),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "900" }}>{TXT.open}</Text>
      </Pressable>
    </Pressable>
  );

  // حشوة سفلية كافية خلف الـ BottomNav
  const BOTTOM_PAD = insets.bottom + sy(64) + sy(12);

  return (
    <PageLayout navigation={navigation} active="shipping" withSideMenu={true} showBottomNav>
      {/* خلفية سبينر شكلية */}
      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>

      <FlatList
        contentContainerStyle={{
          paddingTop: insets.top + sy(20),
          paddingBottom: BOTTOM_PAD,
          paddingHorizontal: sx(14),
          minHeight: H,
        }}
        data={filtered}
        keyExtractor={(it, idx) => String(it?.id ?? it?.name ?? idx)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: sy(10) }} />}
        ListHeaderComponent={
          <View>
            <Text style={{ fontSize: sx(30), fontWeight: "900", color: "#0E1B3B", textAlign: "right" }}>
              {TXT.title}
            </Text>
            <Text style={{ opacity: 0.6, marginTop: sy(2), textAlign: "right", fontSize: sx(12) }}>
              role: {role || "-"} | isAgent: {isAgent ? "true" : "false"}
            </Text>
            <Text style={{ opacity: 0.7, marginTop: sy(4), marginBottom: sy(10), textAlign: "right" }}>
              {TXT.subtitle}
            </Text>

            {/* حقل البحث */}
            <View
              style={[
                styles.searchWrap,
                { flexDirection: isRTL ? "row-reverse" : "row", height: sy(48), borderRadius: sx(14), paddingHorizontal: sx(12) },
              ]}
            >
              <Text style={{ marginHorizontal: sx(8), fontSize: sx(18) }}>🔎</Text>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={TXT.searchPlaceholder}
                placeholderTextColor="#8AA0B5"
                style={{ flex: 1, color: "#0E1B3B", textAlign: "right" }}
                returnKeyType="search"
              />
            </View>

            {loading && (
              <View style={{ alignItems: "center", marginVertical: sy(20) }}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: sy(8) }}>{TXT.loading}</Text>
              </View>
            )}

            {!!error && !loading && (
              <View style={{ backgroundColor: "rgba(255,0,0,0.06)", padding: sx(12), borderRadius: sx(12) }}>
                <Text style={{ color: "#9b1c1c", textAlign: "right" }}>{error}</Text>
              </View>
            )}
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: "center", marginTop: sy(30) }}>
              <Text style={{ fontWeight: "700", color: "#0E1B3B", textAlign: "center" }}>
                {TXT.emptyTitle}
              </Text>
              <Text style={{ opacity: 0.7, marginTop: sy(6), textAlign: "center" }}>
                {TXT.emptyBody}
              </Text>
              <Pressable
                onPress={onRefresh}
                style={{
                  marginTop: sy(14),
                  backgroundColor: "#1274f5ff",
                  borderRadius: sx(12),
                  height: sy(42),
                  paddingHorizontal: sx(16),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>{TXT.tryAgain}</Text>
              </Pressable>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#DCE8FF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  heroTitle: { fontSize: 24, fontWeight: "900", color: "#0E1B3B", textAlign: "right" },
  heroSub: { opacity: 0.7, marginTop: 6, textAlign: "right", color: "#475569" },
  agentCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4ECF2",
    padding: 14,
    marginBottom: 12,
  },
  agentBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(11,99,216,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  agentBadgeText: { color: "#0B63D8", fontWeight: "900", fontSize: 12 },
  agentTitle: { color: "#0E1B3B", fontWeight: "900", fontSize: 16, textAlign: "right" },
  agentDesc: { color: "#64748B", marginTop: 4, textAlign: "right" },
  agentCta: {
    marginTop: 10,
    alignSelf: "flex-end",
    backgroundColor: "#1274f5ff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  agentCtaText: { color: "#fff", fontWeight: "900" },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E4ECF2",
    shadowColor: "#0B63D8",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  row: {
    alignItems: "center",
  },
  iconWrap: {
    backgroundColor: "rgba(58,134,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  title: {
    fontWeight: "800",
    color: "#0E1B3B",
  },
  searchWrap: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#DCE8FF",
    marginBottom: 12,
  },
  /* Decorative spinner bg */
  spinnerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
  },
});
