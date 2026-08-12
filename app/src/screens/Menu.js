// src/screens/Menu.js
import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  I18nManager,
  Alert,
  Linking,
  LayoutAnimation,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Screenn from "../ui/Screenn";
import BottomNav from "../ui/BottomNav";
import { useAuth } from "../context/AuthProvider";

const BASE_W = 390, BASE_H = 844;


export default function Menu({ navigation }) {
  const { signOut, user } = useAuth?.() || { signOut: async () => { }, user: null };
  const isAgent = String(user?.role || "").toLowerCase() === "agent" || user?.is_agent === true;
  const { width: W, height: H } = useWindowDimensions();
  const sx = (n) => (W / BASE_W) * n;
  const sy = (n) => (H / BASE_H) * n;
  const isRTL = I18nManager.isRTL;

  const NAV_HEIGHT = sy(64);

  const [contactOpen, setContactOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const doLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      try { await signOut(); } catch { }
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      "تسجيل الخروج",
      loggingOut ? "جارٍ تسجيل الخروج…" : "هل أنت متأكد من تسجيل الخروج؟",
      loggingOut
        ? [{ text: "حسناً" }]
        : [
          { text: "إلغاء", style: "cancel" },
          { text: "تسجيل الخروج", style: "destructive", onPress: doLogout },
        ],
      { cancelable: true }
    );
  };

  const openWhatsApp = () => Linking.openURL("https://wa.me/0000000000");
  const openTelegram = () => Linking.openURL("https://t.me/your_handle");

  const ITEMS = [
    {
      key: "profile",
      label: "ملفي الشخصي",
      icon: "👤",
      iconBg: "#E3F2FD",
      iconColor: "#2196F3",
      onPress: () => navigation.navigate("Profile")
    },
    {
      key: "payments",
      label: "مدفوعاتي",
      icon: "💳",
      iconBg: "#F3E5F5",
      iconColor: "#9C27B0",
      onPress: () => navigation.navigate("MyPayments")
    },
    {
      key: "transactions",
      label: "المعاملات",
      icon: "📑",
      iconBg: "#E7F0FF",
      iconColor: "#2563EB",
      onPress: () => navigation.navigate("TransactionsList")
    },
    {
      key: "shippings",
      label: "شحناتي",
      icon: "🚚",
      iconBg: "#E3F2FD",
      iconColor: "#1976D2",
      onPress: () => navigation.navigate("MyShippings")
    },
    {
      key: "wallet",
      label: "محفظتي",
      icon: "💰",
      iconBg: "#FFF3E0",
      iconColor: "#FF9800",
      onPress: () => navigation.navigate("MyWallet")
    },
    {
      key: "orders",
      label: "طلباتي",
      icon: "📦",
      iconBg: "#E8F5E9",
      iconColor: "#4CAF50",
      onPress: () => navigation.navigate("MyOrders")
    },
    {
      key: "favorite",
      label: "المفضلة",
      icon: "❤️",
      iconBg: "#FFEBEE",
      iconColor: "#F44336",
      onPress: () => navigation.navigate("Favorite")
    },
    ...(isAgent ? [
      {
        key: "agent_users",
        label: "????????????",
        icon: "????",
        iconBg: "#E8F5E9",
        iconColor: "#16A34A",
        onPress: () => navigation.navigate("AgentUsers")
      },
    ] : []),
    ...(isAgent ? [
      {
        key: "agent_requests",
        label: "طلبات الوكيل",
        icon: "📥",
        iconBg: "#E8F1FF",
        iconColor: "#0B63D8",
        onPress: () => navigation.navigate("AgentRequests")
      },
    ] : []),
    ...(isAgent ? [
      {
        key: "agent_cashouts",
        label: "طلبات سحب العملاء",
        icon: "💵",
        iconBg: "#E8F5E9",
        iconColor: "#16A34A",
        onPress: () => navigation.navigate("AgentCashouts")
      },
    ] : []),
    ...(isAgent ? [
      {
        key: "my_financial",
        label: "????? ??????",
        icon: "????",
        iconBg: "#E8F1FF",
        iconColor: "#0B63D8",
        onPress: () => navigation.navigate("MyFinancial")
      },
    ] : []),
    ...(isAgent ? [] : [
      {
        key: "agents",
        label: "وكلاؤنا",
        icon: "🌐",
        iconBg: "#E0F2F1",
        iconColor: "#009688",
        onPress: () => navigation.navigate("OurAgents")
      },
      {
        key: "agent_connect",
        label: "ربط وكيل",
        icon: "🤝",
        iconBg: "#EAF3FF",
        iconColor: "#0B63D8",
        onPress: () => navigation.navigate("OurAgents")
      },
    ]),
    {
      key: "logout",
      label: loggingOut ? "جارٍ الخروج…" : "تسجيل الخروج",
      icon: "🚪",
      iconBg: "#FFEBEE",
      iconColor: "#D32F2F",
      danger: true,
      onPress: confirmLogout
    },
  ];

  const MenuRow = ({ label, icon, iconBg, iconColor, onPress, danger }) => (
    <Pressable
      onPress={onPress}
      disabled={loggingOut}
      hitSlop={10}
      style={({ pressed }) => [
        styles.menuRow,
        {
          height: sy(64),
          paddingHorizontal: sx(20),
          flexDirection: isRTL ? "row" : "row-reverse",
          opacity: loggingOut ? 0.6 : (pressed ? 0.7 : 1),
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowContent}>
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
          <Text style={[styles.iconText, { color: iconColor }]}>{icon}</Text>
        </View>
        <Text
          style={[
            styles.menuLabel,
            {
              color: danger ? "#D32F2F" : "#1A1A2E",
              fontSize: sx(17),
              marginRight: isRTL ? 0 : sx(12),
              marginLeft: isRTL ? sx(12) : 0,
            },
          ]}
        >
          {label}
        </Text>
      </View>
      <Text style={[styles.chevron, { transform: [{ rotate: isRTL ? "180deg" : "0deg" }] }]}>
        ›
      </Text>
    </Pressable>
  );

  return (
    <Screenn bgColor="#F8F9FA" useDefaultBg={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: sy(20), paddingBottom: NAV_HEIGHT + sy(20) }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        <View style={{ paddingHorizontal: sx(16), marginBottom: sy(24) }}>
          <LinearGradient
            colors={['#2196F3', '#1976D2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.userCard,
              {
                borderRadius: sx(20),
                paddingVertical: sy(20),
                paddingHorizontal: sx(20),
                flexDirection: isRTL ? "row" : "row-reverse",
              },
            ]}
          >
            <View
              style={[
                styles.avatarContainer,
                {
                  width: sy(70),
                  height: sy(70),
                  borderRadius: sy(35),
                  marginRight: isRTL ? 0 : sx(16),
                  marginLeft: isRTL ? sx(16) : 0,
                },
              ]}
            >
              <Image
                source={require("../assets/icons/user.png")}
                style={{ width: sy(36), height: sy(36), tintColor: "#2196F3" }}
              />
            </View>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={{ fontSize: sx(22), fontWeight: "700", color: "#FFFFFF", marginBottom: sy(4) }}>
                {user?.full_name || user?.name || "اسم المستخدم"}
              </Text>
              <View style={styles.usageBadge}>
                <Text style={styles.usageBadgeText}>⚡ مستخدم منذ 35 يوم</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Menu Items */}
        <View style={{ paddingHorizontal: sx(16) }}>
          <View style={styles.menuContainer}>
            {ITEMS.map((item, index) => {
              if (item.key === "logout") {
                return (
                  <View key="contact-logout-section">
                    {/* Contact Us */}
                    <Pressable
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setContactOpen((s) => !s);
                      }}
                      style={({ pressed }) => [
                        styles.menuRow,
                        {
                          height: sy(64),
                          paddingHorizontal: sx(20),
                          flexDirection: isRTL ? "row" : "row-reverse",
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <View style={styles.rowContent}>
                        <View style={[styles.iconContainer, { backgroundColor: "#FFF3E0" }]}>
                          <Text style={[styles.iconText, { color: "#FF9800" }]}>📞</Text>
                        </View>
                        <Text style={[styles.menuLabel, {
                          fontSize: sx(17),
                          marginRight: isRTL ? 0 : sx(12),
                          marginLeft: isRTL ? sx(12) : 0,
                        }]}>
                          تواصل معنا
                        </Text>
                      </View>
                      <Text style={[
                        styles.chevron,
                        {
                          transform: [{
                            rotate: contactOpen
                              ? (isRTL ? "0deg" : "90deg")
                              : (isRTL ? "180deg" : "0deg")
                          }]
                        }
                      ]}>
                        ›
                      </Text>
                    </Pressable>

                    {/* Contact Dropdown */}
                    {contactOpen && (
                      <View style={styles.contactDropdown}>
                        <Pressable
                          onPress={openWhatsApp}
                          style={({ pressed }) => [
                            styles.contactButton,
                            {
                              backgroundColor: "#E7FFF0",
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Text style={styles.contactIcon}>💬</Text>
                          <Text style={[styles.contactText, { color: "#25D366" }]}>WhatsApp</Text>
                        </Pressable>

                        <Pressable
                          onPress={openTelegram}
                          style={({ pressed }) => [
                            styles.contactButton,
                            {
                              backgroundColor: "#E3F2FD",
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Text style={styles.contactIcon}>✈️</Text>
                          <Text style={[styles.contactText, { color: "#0088CC" }]}>Telegram</Text>
                        </Pressable>
                      </View>
                    )}

                    <View style={styles.divider} />

                    {/* Logout */}
                    <MenuRow
                      label={item.label}
                      icon={item.icon}
                      iconBg={item.iconBg}
                      iconColor={item.iconColor}
                      onPress={item.onPress}
                      danger={item.danger}
                    />
                  </View>
                );
              }

              return (
                <View key={item.key}>
                  <MenuRow
                    label={item.label}
                    icon={item.icon}
                    iconBg={item.iconBg}
                    iconColor={item.iconColor}
                    onPress={item.onPress}
                  />
                  {index < ITEMS.length - 2 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>©2025 STARK-CARD</Text>
          <Text style={styles.footerSubtext}>الإصدار 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <BottomNav navigation={navigation} active="menu" />
    </Screenn>
  );
}

const styles = StyleSheet.create({
  userCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarContainer: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  usageBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  usageBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  menuContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  menuRow: {
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
  },
  menuLabel: {
    fontWeight: "600",
    color: "#1A1A2E",
  },
  chevron: {
    fontSize: 24,
    color: "#B0B0B0",
    fontWeight: "300",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 20,
  },
  contactDropdown: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FAFAFA",
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  contactIcon: {
    fontSize: 20,
  },
  contactText: {
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 16,
  },
  footerText: {
    color: "#9E9E9E",
    fontSize: 13,
    fontWeight: "600",
  },
  footerSubtext: {
    color: "#BDBDBD",
    fontSize: 11,
    marginTop: 4,
  },
});
