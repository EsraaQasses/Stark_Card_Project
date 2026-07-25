// src/screens/Notifications.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Image,
  Alert,
  useWindowDimensions,
  I18nManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";
import { AppCard, AppEmptyState } from "../shared/ui/primitives";
import {
  colors as themeColors,
  fontFamilies,
  radius,
  shadows,
  spacing,
  typography,
} from "../shared/theme";
import { getNotifications, markNotificationAsRead, deleteNotification } from "../api/system";
import { useTranslation } from "react-i18next";
import { getCache, setCache, cacheKey } from "../utils/cache";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_W = 390, BASE_H = 844;
const COLOR = {
  text: themeColors.text.primary,
  muted: themeColors.text.muted,
  line: themeColors.border.default,
  cardBg: themeColors.surface.cardSoft,
  white: themeColors.surface.background,
  danger: themeColors.status.danger,
  pillBg: themeColors.surface.cardSoft,
  accent: themeColors.brand.primary,
};

function timeAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t) / 1000;
  if (diff < 60) return "Now";
  const m = Math.floor(diff / 60);
  if (diff < 3600) return `${m}m`;
  const h = Math.floor(diff / 3600);
  if (diff < 86400) return `${h}h`;
  const d = Math.floor(diff / 86400);
  return `${d}d`;
}

export default function Notifications({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;

  const { width: W, height: H } = useWindowDimensions();
  const sx = useCallback((n) => (W / BASE_W) * n, [W]);
  const sy = useCallback((n) => (H / BASE_H) * n, [H]);
  const sp = useCallback((n) => n * Math.min(W / BASE_W, H / BASE_H), [W, H]);

  const bottomPad = useMemo(() => insets.bottom + sy(76), [insets.bottom, sy]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all | unread
  const autoMarkRef = useRef(false);
  const UNREAD_OVERRIDE_KEY = "@notif_unread_override";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const cached = await getCache(cacheKey("notifications", "list"), 1000 * 60 * 10);
      if (cached && Array.isArray(cached)) {
        setItems(cached);
      }
      const res = await getNotifications();
      const list = res?.ok
        ? (Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.raw?.results)
            ? res.raw.results
            : Array.isArray(res.raw?.data)
              ? res.raw.data
              : [])
        : [];
      setItems(list);
      await setCache(cacheKey("notifications", "list"), list);
    } catch (e) {
      console.warn("getNotifications:", e?.response?.status || e?.message);
      const cached = await getCache(cacheKey("notifications", "list"));
      setItems(Array.isArray(cached) ? cached : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const unreadCount = useMemo(
    () =>
      (items || []).filter(
        (x) => x?.is_read === false || x?.read_at === null
      ).length,
    [items]
  );

  const filteredItems = useMemo(() => {
    if (filter === "unread") {
      return (items || []).filter((x) => x?.is_read === false || x?.read_at === null);
    }
    return items || [];
  }, [items, filter]);

  const onPressItem = useCallback(async (id) => {
    try {
      await markNotificationAsRead(id);
      const next = (items || []).map((x) => (x.id === id ? { ...x, is_read: true } : x));
      setItems(next);
      await setCache(cacheKey("notifications", "list"), next);
    } catch (e) {
      console.warn("markNotificationRead:", e?.response?.status || e?.message);
    }
  }, [items]);

  const onDelete = useCallback((id) => {
    Alert.alert(
      t("notificationsScreen.deleteTitle", "Delete notification"),
      t("notificationsScreen.deleteBody", "Do you want to delete this notification?"),
      [
        { text: t("common.no", "No"), style: "cancel" },
        {
          text: t("common.yes", "Yes"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteNotification(id);
              setItems((prev) => prev.filter((x) => x.id !== id));
            } catch (e) {
              console.warn("deleteNotification:", e?.response?.status || e?.message);
            }
          },
        },
      ]
    );
  }, [t]);

  const onMarkAllRead = useCallback(async () => {
    const unread = (items || []).filter((x) => x?.is_read === false || x?.read_at === null);
    if (!unread.length) return;
    try {
      await Promise.allSettled(unread.map((n) => markNotificationAsRead(n.id)));
      const next = (items || []).map((x) => ({ ...x, is_read: true }));
      setItems(next);
      await setCache(cacheKey("notifications", "list"), next);
    } catch {
      // silent
    }
  }, [items]);

  // Mark all as read once when screen opens (real-world behavior)
  useEffect(() => {
    if (loading || autoMarkRef.current) return;
    if (!items || items.length === 0) return;
    autoMarkRef.current = true;
    (async () => {
      await onMarkAllRead();
      try {
        await AsyncStorage.setItem(UNREAD_OVERRIDE_KEY, "0");
      } catch {}
    })();
  }, [loading, items, onMarkAllRead]);

  const keyExtractor = useCallback((it) => String(it.id), []);

  const renderSeparator = useCallback(() => <View style={{ height: sy(10) }} />, [sy]);

  const renderEmpty = useMemo(
    () => (
      <AppEmptyState
        icon="notifications-outline"
        title={t("common.noNotifications", "No notifications yet")}
        style={styles.emptyState}
      />
    ),
    [t]
  );

  const renderItem = useCallback(({ item }) => {
    const isUnread = item?.is_read === false || (!item?.read_at && item?.is_read !== true);
    const typeText = item?.type ? String(item.type).replace(/_/g, " ") : null;
    const initials = (item?.title || "N").trim().charAt(0).toUpperCase();

    return (
      <Pressable
        onPress={() => onPressItem(item.id)}
        onLongPress={() => onDelete(item.id)}
        delayLongPress={400}
        style={({ pressed }) => [
          pressed && styles.cardPressed,
        ]}
      >
        <AppCard
          padded={false}
          soft
          style={[
            styles.card,
            {
              borderRadius: sx(18),
              paddingVertical: sx(12),
              paddingHorizontal: sx(12),
              flexDirection: isRTL ? "row-reverse" : "row",
              borderColor: isUnread ? "#CFE0FF" : COLOR.line,
              backgroundColor: isUnread ? "#F6FAFF" : COLOR.cardBg,
            },
          ]}
        >
          <View style={[styles.leftBar, isUnread ? styles.leftBarUnread : styles.leftBarRead]} />

          <View style={styles.iconColumn}>
            {item?.icon ? (
              <Image
                source={{ uri: item.icon }}
                style={{ width: sx(46), height: sx(46), borderRadius: sx(12) }}
              />
            ) : (
              <View style={styles.iconFallback}>
                <Text style={styles.iconInitial}>{initials}</Text>
              </View>
            )}
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          <View style={{ flex: 1, marginHorizontal: sx(12) }}>
            <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: sx(8) }}>
              <Text
                style={[
                  styles.itemTitle,
                  {
                    fontSize: sp(15.5),
                    textAlign: isRTL ? "right" : "left",
                  },
                ]}
                numberOfLines={1}
              >
                {item?.title || t("notifications.itemTitle", "Notification")}
              </Text>
              <Text style={styles.timePill}>{timeAgo(item?.created_at)}</Text>
            </View>

            {!!item?.message && (
              <Text
                style={[
                  styles.itemMessage,
                  {
                    marginTop: sy(6),
                    fontSize: sp(13.5),
                    lineHeight: sp(19),
                    textAlign: isRTL ? "right" : "left",
                  },
                ]}
                numberOfLines={3}
              >
                {item.message}
              </Text>
            )}

            {typeText && (
              <View style={styles.typePill}>
                <Text style={styles.typeText} numberOfLines={1}>
                  {typeText}
                </Text>
              </View>
            )}
          </View>
        </AppCard>
      </Pressable>
    );
  }, [isRTL, onDelete, onPressItem, sp, sx, sy, t]);

  const ListHeader = useMemo(
    () => (
      <View style={{ paddingBottom: sy(10) }}>
        <AppHeader
          title={t("notifications.title", "Notifications")}
          subtitle={t("notifications.subtitle", "Latest updates and messages from the system.")}
          right={
            <View style={styles.countPill}>
              <Text style={styles.countText}>{unreadCount}</Text>
              <Text style={styles.countLabel}>{t("notifications.unread", "Unread")}</Text>
            </View>
          }
        >
          <View style={[styles.toolbar, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Text style={styles.toolbarHint}>{t("notifications.all", "All")}</Text>
          </View>
        </AppHeader>
      </View>
    ),
    [isRTL, sy, t, unreadCount]
  );

  return (
    <PageLayout navigation={navigation} active="home" withSideMenu>
      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>


      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: bottomPad }}>
          <ActivityIndicator />
          <Text style={[styles.loadingText, { marginTop: sy(8) }]}>
            {t("common.loading", "Loading...")}
          </Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <FlatList
          data={[]}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          initialNumToRender={6}
          windowSize={7}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={{ paddingHorizontal: sx(16), paddingBottom: bottomPad }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          windowSize={7}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
        />
      )}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  spinnerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
  },
  emptyState: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  countPill: {
    minWidth: 68,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  countText: {
    fontFamily: fontFamilies.extraBold,
    fontWeight: "900",
    fontSize: 18,
    color: themeColors.text.inverse,
  },
  countLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: typography.caption.fontSize,
    fontWeight: "700",
    color: themeColors.text.inverseMuted,
  },
  toolbar: {
    marginTop: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  toolbarHint: {
    color: themeColors.text.inverseMuted,
    fontFamily: fontFamilies.bold,
    fontSize: typography.caption.fontSize,
    fontWeight: "700",
  },
  card: {
    alignItems: "flex-start",
    backgroundColor: COLOR.cardBg,
    borderWidth: 1,
    borderColor: COLOR.line,
    ...shadows.soft,
  },
  cardPressed: {
    opacity: 0.98,
    transform: [{ scale: 0.997 }],
  },
  leftBar: {
    width: 4,
    borderRadius: radius.pill,
    marginEnd: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  leftBarUnread: {
    backgroundColor: COLOR.accent,
  },
  leftBarRead: {
    backgroundColor: "#D7E6FF",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: COLOR.accent,
    marginTop: spacing.xs,
  },
  iconColumn: {
    alignItems: "center",
  },
  iconFallback: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: COLOR.pillBg,
    borderWidth: 1,
    borderColor: COLOR.line,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInitial: {
    fontFamily: fontFamilies.extraBold,
    fontSize: typography.body.fontSize,
    fontWeight: "900",
    color: COLOR.accent,
  },
  itemTitle: {
    color: COLOR.text,
    flexShrink: 1,
    fontFamily: fontFamilies.extraBold,
    fontWeight: "900",
  },
  itemMessage: {
    color: "#30415F",
    fontFamily: fontFamilies.regular,
  },
  timePill: {
    backgroundColor: COLOR.pillBg,
    color: COLOR.muted,
    fontFamily: fontFamilies.bold,
    fontSize: typography.caption.fontSize,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  typePill: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: COLOR.white,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: radius.pill,
  },
  typeText: {
    fontFamily: fontFamilies.bold,
    fontSize: typography.caption.fontSize,
    color: COLOR.text,
    fontWeight: "700",
  },
  loadingText: {
    color: COLOR.muted,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body.fontSize,
  },
});
