// src/screens/Home.js
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  Image,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSections, normalizeImageUrl } from "../api/store";
import { getAds, getUnreadCount } from "../api/system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthProvider";
import { useCurrency } from "../context/CurrencyProvider";
import CornerSpinner from "../ui/CornerSpinner";
import PageLayout from "../ui/PageLayout";
// 👇 جديد: نستعمل نفس API تبع المحفظة زي MyWallet
import { getWallet } from "../api/wallets";
import { useScale } from "../ui/scale";
import { getCache, setCache, cacheKey } from "../utils/cache";
import { getSectionImage } from "../features/store/utils/productImages";
import {
  getAdaptiveImageHeight,
  getImageAspectRatioFromLoad,
} from "../features/store/utils/imageSizing";
import {
  colors,
  fontFamilies,
  fontWeights,
  radius,
  responsiveSpacing,
  shadows,
  spacing,
  typography,
} from "../shared/theme";
import { AppSearchBox } from "../shared/ui/primitives";
import {
  endMarginProp,
  rowDirection,
  textAlignStart,
  writingDirection,
} from "../shared/utils/rtl";

const COLOR = {
  primary: colors.brand.primary,
  text: colors.text.primary,
  muted: colors.text.muted,
  bgSoft: colors.surface.soft,
  line: colors.border.default,
  white: colors.surface.background,
};
const MAX_W = 480;

/* ===== helpers ===== */
function sectionDisplayName(s, lang) {
  if (!s) return "";
  if (s.name) return s.name;
  const isAr = (lang || "").toLowerCase().startsWith("ar");
  const raw = s._raw || s;
  return (isAr ? raw?.name_ar : raw?.name_en) || raw?.name_en || raw?.name_ar || "";
}
/* ===== بطاقة الرصيد المرتبطة بخيار العملة ===== */
function WalletBadge({ sx, sy, user, currency, formatCurrency, defaultCurr = "USD" }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [baseAmt, setBaseAmt] = useState(null);   // المبلغ من المحفظة
  const [baseCur, setBaseCur] = useState(null);   // عملة المحفظة (USD / SYP)

  useEffect(() => {
    let mounted = true;

    async function loadBalance() {
      if (!user) {
        if (!mounted) return;
        setBaseAmt(null);
        setBaseCur(null);
        return;
      }

      setLoading(true);
      try {
        // 👈 نجيب المحفظة من /wallets/wallet/
        const walletData = await getWallet();

        // العملة اللي اختارها المستخدم من الـ Segment
        const targetCur = (currency || defaultCurr || "USD").toUpperCase();

        // نحاول نجيب كائن المحفظة مباشرة: walletData.USD أو walletData.SYP
        const w = walletData?.[targetCur] || null;

        // ✅ Backend يرجع: { available, pending, total }
        const amt = w?.available ?? 0;

        if (!mounted) return;
        setBaseAmt(Number(amt));
        setBaseCur(targetCur);
      } catch (_e) {
        if (!mounted) return;
        // لو صار خطأ نرجّع 0 بس ما نكسّر واجهة الهوم
        setBaseAmt(0);
        setBaseCur((currency || defaultCurr || "USD").toUpperCase());
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBalance();

    return () => {
      mounted = false;
    };
  }, [user, currency, defaultCurr]);

  const fmt = useCallback(
    (amount, cur) => {
      if (typeof amount !== "number") return "--";
      if (formatCurrency && typeof formatCurrency === "function") {
        try {
          return formatCurrency(amount, cur);
        } catch {
          /* ignore */
        }
      }
      return `${amount.toLocaleString()} ${cur}`;
    },
    [formatCurrency]
  );

  const curToShow = (currency || baseCur || defaultCurr || "USD").toUpperCase();
  const amtToShow = typeof baseAmt === "number" ? baseAmt : 0;

  return (
    <View style={{ width: "100%" }}>

      <View
        style={[
          styles.badge,
          {
            borderRadius: sx(radius.lg),
            flexDirection: rowDirection(),
            paddingVertical: sy(spacing.sm),
            paddingHorizontal: sx(spacing.md),
          },
        ]}
      >
        <Text
          style={[
            styles.badgeLabel,
            {
              [endMarginProp()]: sx(spacing.sm),
              textAlign: textAlignStart(),
              writingDirection: writingDirection(),
            },
          ]}
        >
          {t("wallet.title")}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <View style={{ alignItems: "center", flexDirection: rowDirection() }}>
            <View style={styles.badgeChip}>
              <Text style={[styles.badgeChipText, styles.ltrValue]}>
                {fmt(amtToShow, curToShow)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>

  );
}

export default function Home({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { width: W } = useWindowDimensions();
  const { sx, sy } = useScale();
  const RADIUS = sx(20);
  const statusBarTop = Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0;
  const safeTop = Math.max(insets.top, statusBarTop);

  const currencyCtx = useCurrency?.();
  const { currency = "USD", setCurrency, formatCurrency } = currencyCtx || {};

  // تثبيت scaling للنصوص
  useEffect(() => {
    if (!Text.defaultProps) Text.defaultProps = {};
    Text.defaultProps.allowFontScaling = false;
  }, []);

  // تلوين شريط النظام أندرويد
  useEffect(() => {
    if (Platform.OS !== "android") return;
    (async () => {
      try {
        const NavigationBar = await import("expo-navigation-bar");
        if (typeof NavigationBar?.setBackgroundColorAsync !== "function") return;
        const behavior = await NavigationBar?.getBehaviorAsync?.();
        // When edge-to-edge is enabled, behavior is usually "overlay" and setBackgroundColorAsync warns.
        if (behavior === "overlay") return;
        await NavigationBar.setBackgroundColorAsync(COLOR.white);
        await NavigationBar.setButtonStyleAsync("dark");
      } catch { }
    })();
  }, []);

  // تحويل الوكيل - REMOVED: Agent routing now handled by Expo Router RootLayout to prevent redirect storms
  // useEffect(() => {
  //   const isAgent =
  //     user?.role === "agent" || user?.is_agent === true || !!user?.agent_profile || !!user?.agent;
  //   if (isAgent) navigation.replace("AgentHome");
  // }, [user, navigation]);

  /* ===== لغة ===== */
  const [lang, setLang] = useState(i18n.language || "en");
  useEffect(() => {
    const onLang = (lng) => setLang(lng || "en");
    i18n.on("languageChanged", onLang);
    return () => {
      try {
        i18n.off("languageChanged", onLang);
      } catch { }
    };
  }, [i18n]);

  /* ===== أقسام ===== */
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sectionImageRatios, setSectionImageRatios] = useState({});

  useEffect(() => {
    let alive = true;
    if (!user) {
      setSections([]);
      setErrorMsg("");
      setLoadingSections(false);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        setErrorMsg("");
        setLoadingSections(true);
        const cached = await getCache(cacheKey("sections", user?.id), 1000 * 60 * 60 * 6);
        if (cached && Array.isArray(cached)) {
          setSections(cached);
        }
        const data = await getSections();
        const list = Array.isArray(data) ? data : data?.results || [];
        if (alive) {
          setSections(list);
          await setCache(cacheKey("sections", user?.id), list);
        }
      } catch (e) {
        const status = e?.response?.status;
        if (alive) {
          setSections([]);
          setErrorMsg(status === 401 ? "" : "تعذّر تحميل الأقسام");
        }
      } finally {
        if (alive) setLoadingSections(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  /* ===== إعلانات ===== */
  const [ads, setAds] = useState([]);
  const [adsLoading, setAdsLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    if (!user) {
      setAds([]);
      setAdsLoading(false);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        setAdsLoading(true);
        if (typeof getAds === "function") {
          const res = await getAds();
          const raw = res?.ok ? res?.data : res;
          const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.results)
              ? raw.results
              : Array.isArray(raw?.data)
                ? raw.data
                : [];
          const normalized = list.map((ad) => ({
            ...ad,
            title: ad?.title ?? "",
            text: ad?.text ?? ad?.title ?? "",
            image: ad?.image ? normalizeImageUrl(ad.image) : null,
            link: ad?.link ?? null,
            background_color: ad?.background_color ?? "#ECF4FF",
            text_color: ad?.text_color ?? "black",
            font_size: ad?.font_size ?? 16,
          }));
          if (alive) setAds(normalized);
        } else {
          if (alive) setAds([]);
        }
      } catch {
        if (alive) setAds([]);
      } finally {
        if (alive) setAdsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  /* ===== Notifications badge ===== */
  const [notifCount, setNotifCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      try {
        const override = await AsyncStorage.getItem("@notif_unread_override");
        if (override === "0") {
          if (alive) setNotifCount(0);
          await AsyncStorage.removeItem("@notif_unread_override");
          return;
        }
        const res = await getUnreadCount();
        const count = res?.ok ? Number(res?.data?.unread || 0) : 0;
        if (alive) setNotifCount(count);
      } catch {
        if (alive) setNotifCount(0);
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  /* ===== عملة + بحث ===== */
  const [search, setSearch] = useState("");
  const flag =
    currency === "SYP"
      ? require("../assets/flags/sy.png")
      : require("../assets/flags/us.png");

  const handleCurrency = useCallback((opt) => {
    const val = String(opt || "").toUpperCase();
    if (val === "USD" || val === "SYP") setCurrency?.(val);
  }, [setCurrency]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return (sections || []).filter((s) =>
      sectionDisplayName(s, lang).toLowerCase().includes(q)
    );
  }, [sections, search, lang]);

  const listData = useMemo(() => {
    if (errorMsg) return [{ id: "error", errorMsg }];
    if (loadingSections) return Array.from({ length: 6 }).map((_, i) => ({ id: `ph-${i}`, isPlaceholder: true }));
    return filteredSections || [];
  }, [errorMsg, loadingSections, filteredSections]);

  // حساب عرض الكرت للشبكة
  const spacingProfile =
    W < 360
      ? responsiveSpacing.smallPhone
      : W >= 430
        ? responsiveSpacing.largePhone
        : responsiveSpacing.phone;
  const gridHorizontalPadding = sx(spacingProfile.pagePaddingH);
  const cardGap = sx(spacingProfile.cardGap);
  const gridContentWidth = Math.min(W, MAX_W) - gridHorizontalPadding * 2;
  const cardWidth = (gridContentWidth - cardGap) / 2;
  const cardInnerPadding = sx(6);

  /* ===== Banner ===== */
    const pagerX = useRef(new Animated.Value(0)).current;
    const adsScrollRef = useRef(null);
    const adsIndexRef = useRef(0);
    const [pageWidth, setPageWidth] = useState(useWindowDimensions().width);

  const handlePressAd = useCallback((ad) => async () => {
    if (ad?.link) {
      try {
        const supported = await Linking.canOpenURL(ad.link);
        if (supported) return Linking.openURL(ad.link);
      } catch { }
    }
  }, []);

    const renderAdCard = useCallback(({ item }) => {
      const hasContent = item && (item.text || item.title || item.image || item.link);
      const bg = item?.background_color || "#ECF4FF";
      const isWhite = item?.text_color === "white";
      return (
        <Pressable
          onPress={hasContent ? handlePressAd(item) : undefined}
          style={[
            styles.bannerCard,
            {
              width: pageWidth,
              borderRadius: RADIUS,
              backgroundColor: bg,
              borderWidth: 1,
              borderColor: COLOR.line,
            },
          ]}
        >
          <View style={styles.adImageWrap}>
            {item?.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.adImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.adImagePlaceholder}>
                <Text style={styles.adImagePlaceholderText}>إعلان</Text>
              </View>
            )}
          </View>
          <View style={styles.adBody}>
            {!!(item?.text || item?.title) && (
              <Text
                numberOfLines={2}
                style={[
                  styles.adTitle,
                  {
                    color: isWhite ? "#FFF" : COLOR.text,
                    fontSize: sx(Number(item?.font_size || 16)),
                    textAlign: textAlignStart(),
                    writingDirection: writingDirection(),
                  },
                ]}
              >
                {item.text || item.title}
              </Text>
            )}
            {!!item?.link && (
              <Text
                style={[
                  styles.adCta,
                  {
                    color: isWhite ? "#FFF" : "#1E2A3A",
                    textAlign: textAlignStart(),
                    writingDirection: writingDirection(),
                  },
                ]}
              >
                {t("home.openAd", "اضغط للفتح")}
              </Text>
            )}
          </View>
        </Pressable>
      );
    }, [RADIUS, handlePressAd, pageWidth, sx, t]);

    const adsData = useMemo(
      () => (ads.length > 0 ? ads : [{ id: "fallback-1" }, { id: "fallback-2" }]),
      [ads]
    );

    useEffect(() => {
      if (adsLoading || !adsData || adsData.length <= 1) return;
      const timer = setInterval(() => {
        const next = (adsIndexRef.current + 1) % adsData.length;
        adsIndexRef.current = next;
        if (adsScrollRef.current && pageWidth) {
          adsScrollRef.current.scrollTo({ x: pageWidth * next, animated: true });
        }
      }, 10000);
      return () => clearInterval(timer);
    }, [adsLoading, adsData, pageWidth]);


  const navigateNotifications = useCallback(() => {
    navigation.navigate("Notifications");
  }, [navigation]);

  const navigateProfile = useCallback(() => {
    navigation.navigate("Profile");
  }, [navigation]);

  const navigateFavorite = useCallback(() => {
    navigation.navigate("Favorite");
  }, [navigation]);

  const navigateSection = useCallback((item, displayName) => {
    navigation.navigate("Products", {
      sectionId: item.id,
      sectionName: displayName || "",
      section: item,
    });
  }, [navigation]);

  const rememberSectionImageRatio = useCallback((itemId, event) => {
    const ratio = getImageAspectRatioFromLoad(event);
    if (!ratio) return;

    setSectionImageRatios((prev) => {
      const key = String(itemId);
      if (Math.abs(Number(prev[key] || 0) - ratio) < 0.02) return prev;
      return { ...prev, [key]: ratio };
    });
  }, []);

  const keyExtractor = useCallback((item) => String(item.id), []);

  const renderHeader = useCallback(() => (
    <>
      <View style={{ backgroundColor: "transparent" }}>
        <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W }}>
          <View style={{ marginTop: safeTop + sy(spacing.lg), paddingHorizontal: sx(14) }}>
            <View
              style={[
                styles.headerTop,
                {
                  flexDirection: rowDirection(),
                  borderRadius: sx(16),
                  paddingVertical: sy(8),
                  paddingHorizontal: sx(10),
                },
              ]}
            >
              <Image
                source={flag}
                style={[styles.flag, { width: sx(30), height: sy(22) }]}
                resizeMode="contain"
              />
              <View style={{ flexShrink: 1 }}>
                <Segment
                  options={["USD", "SYP"]}
                  value={currency}
                  onChange={handleCurrency}
                  sx={sx}
                  sy={sy}
                />
              </View>
              <View style={{ flex: 1 }} />
              <BellButton
                count={notifCount}
                onPress={navigateNotifications}
                sx={sx}
                sy={sy}
              />
              <IconButton
                src={require("../assets/icons/user.png")}
                alt="الملف الشخصي"
                sx={sx}
                sy={sy}
                onPress={navigateProfile}
              />
            </View>

            <WalletBadge
              sx={sx}
              sy={sy}
              user={user}
              currency={currency}
              formatCurrency={formatCurrency}
            />
          </View>
        </View>
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: COLOR.line,
          }}
        />
      </View>

      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>

      <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W }}>
        <View
          style={[
            styles.bannerWrap,
            { marginTop: sy(10), paddingHorizontal: sx(14) },
          ]}
          onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
        >
          {adsLoading ? (
            <View
              style={[
                styles.bannerCard,
                {
                  width: "100%",
                  aspectRatio: 16 / 9,
                  borderRadius: sx(20),
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLOR.line,
                },
              ]}
            >
              <ActivityIndicator />
            </View>
          ) : (
              <ScrollView
                ref={adsScrollRef}
                horizontal
                pagingEnabled
                snapToInterval={pageWidth}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                bounces={false}
                overScrollMode="never"
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => {
                  const x = e?.nativeEvent?.contentOffset?.x || 0;
                  if (pageWidth) {
                    adsIndexRef.current = Math.round(x / pageWidth);
                  }
                }}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: pagerX } } }],
                  { useNativeDriver: false }
                )}
              >
              {adsData.map((item, idx) => (
                <View key={String(item.id ?? idx)}>
                  {renderAdCard({ item })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <Dots
          count={adsData.length}
          pagerX={pagerX}
          pageW={pageWidth}
          sx={sx}
          sy={sy}
        />

        <View style={{ paddingHorizontal: gridHorizontalPadding, marginTop: sy(12) }}>
          <AppSearchBox
            value={search}
            onChangeText={setSearch}
            placeholder={t("home.searchPlaceholder", "ابحث عن قسم")}
            style={{
              borderRadius: sy(25),
              minHeight: sy(50),
            }}
          />
        </View>
      </View>

      <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W }}>
        <View
          style={{
            paddingHorizontal: gridHorizontalPadding,
            marginTop: sy(spacing.md),
            marginBottom: sy(spacing.sm),
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Text
            style={{
              color: COLOR.text,
              flex: 1,
              fontFamily: fontFamilies.almaraiExtraBold,
              fontSize: sx(25),
              fontWeight: fontWeights.black,
              marginRight: sx(spacing.md),
              textAlign: "right",
              writingDirection: "ltr",
            }}
          >
            {t("home.sectionsTitle", "الأقسام")}
          </Text>
          <Pressable
            onPress={navigateFavorite}
            style={{
              width: sx(34),
              height: sx(34),
              borderRadius: sx(10),
              borderWidth: 1,
              borderColor: COLOR.line,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
            }}
            hitSlop={10}
          >
            <Ionicons name="heart" size={sx(18)} color={COLOR.primary} />
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop: sy(6) }} />
    </>
  ), [
    adsData,
    adsLoading,
    currency,
    flag,
    formatCurrency,
    gridHorizontalPadding,
    handleCurrency,
    safeTop,
    navigateFavorite,
    navigateNotifications,
    navigateProfile,
    notifCount,
    pageWidth,
    pagerX,
    renderAdCard,
    search,
    sx,
    sy,
    t,
    user,
  ]);

  const renderItem = useCallback(({ item }) => {
    if (item.isPlaceholder) {
      return (
        <View
          style={[
            styles.card,
            {
              flex: 1,
              width: cardWidth,
              maxWidth: cardWidth,
              borderRadius: sx(20),
              opacity: 0.6,
              backgroundColor: "#F5F8FC",
              marginBottom: cardGap,
              padding: cardInnerPadding,
            },
          ]}
        >
          <View
            style={{
              width: "100%",
              aspectRatio: 1,
              borderRadius: sx(12),
              backgroundColor: "#E8EFF7",
              borderWidth: 1,
              borderColor: COLOR.line,
            }}
          />
          <View
            style={{
              height: sx(16),
              marginTop: sy(spacing.sm),
              backgroundColor: "#E8EFF7",
              borderRadius: radius.xs,
            }}
          />
        </View>
      );
    }

    if (item.errorMsg) {
      return (
        <View style={{ width: "100%", paddingHorizontal: sx(14), paddingVertical: sy(20) }}>
          <Text
            style={{
              color: "#c00",
              fontWeight: "700",
              textAlign: textAlignStart(),
              writingDirection: writingDirection(),
            }}
          >
            {item.errorMsg}
          </Text>
        </View>
      );
    }

    const displayName = sectionDisplayName(item, lang);
    const imgUrl = getSectionImage(item);
    const imageBoxWidth = Math.max(1, cardWidth - cardInnerPadding * 2);
    const imageHeight = getAdaptiveImageHeight(
      imageBoxWidth,
      sectionImageRatios[String(item.id)],
      {
        fallbackRatio: 1.18,
        minHeight: sy(92),
        maxHeight: sy(150),
      }
    );
    return (
      <Pressable
        onPress={() => navigateSection(item, displayName)}
        style={({ pressed }) => [
          styles.card,
          {
            flex: 1,
            width: cardWidth,
            maxWidth: cardWidth,
            borderRadius: sx(20),
            marginBottom: cardGap,
            padding: cardInnerPadding,
          },
          pressed && {
            transform: [{ scale: 0.98 }],
            opacity: 0.95,
          },
        ]}
      >
        <View
          style={{
            width: "100%",
            height: imageHeight,
            borderRadius: sx(12),
            overflow: "hidden",
            borderWidth: 1,
            borderColor: COLOR.line,
            backgroundColor: "#E8EFF7",
          }}
        >
          {imgUrl ? (
            <Image
              source={{ uri: imgUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
              onLoad={(event) => rememberSectionImageRatio(item.id, event)}
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>

        <View
          style={{
            marginTop: sx(10),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              textAlign: textAlignStart(),
              color: COLOR.text,
              fontFamily: fontFamilies.almaraiBold,
              fontWeight: fontWeights.heavy,
              fontSize: sx(16),
              lineHeight: sy(22),
              writingDirection: writingDirection(),
            }}
            numberOfLines={2}
          >
            {displayName}
          </Text>
        </View>
      </Pressable>
    );
  }, [cardGap, cardInnerPadding, cardWidth, lang, navigateSection, rememberSectionImageRatio, sectionImageRatios, sx, sy]);

  return (
    <PageLayout navigation={navigation} active="home" withSideMenu={true} showBottomNav>
      <FlatList
        key="home-2col"
        data={listData}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={{
          flexDirection: "row",
          gap: cardGap,
          justifyContent: "flex-start",
          paddingHorizontal: gridHorizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        initialNumToRender={6}
        windowSize={7}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{
          alignSelf: "center",
          paddingBottom: sy(64) + insets.bottom + sy(12),
          backgroundColor: COLOR.white,
          width: "100%",
          maxWidth: MAX_W,
        }}
        renderItem={renderItem}
      />
    </PageLayout>
  );
}

/* ===== مكونات مساعدة ===== */
function IconButton({ src, onPress, alt, sx, sy }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={alt}
      style={[styles.iconBtn, { borderRadius: sx(18) }]}
    >
      <Image
        source={src}
        style={{ width: sx(18), height: sy(18), tintColor: COLOR.text }}
      />
    </Pressable>
  );
}

function BellButton({ count = 0, onPress, sx, sy }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="الإشعارات"
      style={[styles.iconBtn, { borderRadius: sx(18) }]}
    >
      <Image
        source={require("../assets/icons/bell.png")}
        style={{ width: sx(18), height: sy(18), tintColor: COLOR.text }}
      />
      {count > 0 && (
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>{count > 99 ? "99+" : String(count)}</Text>
        </View>
      )}
    </Pressable>
  );
}
function Segment({ options, value, onChange, sx, sy }) {
  return (
    <View style={[styles.segment, { padding: sx(3), borderRadius: sx(10), flexDirection: rowDirection() }]}>
      {options.map((opt) => {
        const active = String(opt).toUpperCase() === String(value).toUpperCase();
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.segPill,
              {
                paddingVertical: sy(6),
                paddingHorizontal: sx(12),
                borderRadius: sx(8),
              },
              active && styles.segPillActive,
            ]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
function Dots({ count, pagerX, pageW, sx, sy }) {
  if (!count || count < 2) return null;
  return (
    <View style={[styles.dotsRow, { marginTop: sy(8) }]}>
      {Array.from({ length: count }).map((_, i) => {
        const input = [(i - 1) * pageW, i * pageW, (i + 1) * pageW];
        const dotW = pagerX.interpolate({
          inputRange: input,
          outputRange: [sx(6), sx(16), sx(6)],
          extrapolate: "clamp",
        });
        const op = pagerX.interpolate({
          inputRange: input,
          outputRange: [0.45, 1, 0.45],
          extrapolate: "clamp",
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { width: dotW, height: sy(6), borderRadius: sy(3), opacity: op },
            ]}
          />
        );
      })}
    </View>
  );
}

/* ===== أنماط ===== */
const styles = StyleSheet.create({
  /* Header */
  headerTop: {
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLOR.line,
    gap: 8,
  },
  flag: { borderRadius: 4, marginHorizontal: 4 },

  /* Segment */
  segment: {
    flexDirection: rowDirection(),
    backgroundColor: COLOR.bgSoft,
    borderWidth: 1,
    borderColor: COLOR.line,
  },
  segPill: {},
  segPillActive: {
    backgroundColor: COLOR.white,
    borderWidth: 1,
    borderColor: COLOR.line,
  },
  segText: {
    color: COLOR.muted,
    fontFamily: fontFamilies.almaraiBold,
    fontWeight: fontWeights.bold,
    writingDirection: "ltr",
  },
  segTextActive: { color: COLOR.primary },

  /* Header icons */
  iconBtn: {
    width: 36,
    height: 36,
    backgroundColor: COLOR.bgSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLOR.line,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
  },

  /* Wallet badge (صف مستقل) */
  badgeRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#0B63D8",
    borderWidth: 1,
    borderColor: "#084ea8",
  },
  badgeLabel: {
    color: "#fff",
    flexShrink: 1,
    fontFamily: fontFamilies.almaraiExtraBold,
    fontWeight: fontWeights.black,
    fontSize: typography.label.fontSize,
  },
  badgeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  badgeChipText: {
    color: "#fff",
    fontFamily: fontFamilies.almaraiExtraBold,
    fontWeight: fontWeights.black,
  },
  ltrValue: {
    textAlign: "left",
    writingDirection: "ltr",
  },

  /* Banner */
  bannerWrap: {},
  bannerCard: {
    aspectRatio: 16 / 8.5,
    overflow: "hidden",
    backgroundColor: COLOR.white,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  adImageWrap: {
    flex: 75,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  adImage: {
    width: "100%",
    height: "100%",
  },
  adImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  adImagePlaceholderText: {
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 2,  },
  adBody: {
    flex: 25,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  adTitle: {
    fontFamily: fontFamilies.almaraiExtraBold,
    fontWeight: fontWeights.black,
  },
  adCta: {
    fontFamily: fontFamilies.almaraiBold,
    fontWeight: fontWeights.bold,
    opacity: 0.9,
  },

  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { backgroundColor: COLOR.primary, marginHorizontal: 3 },

  /* Grid */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: 14,
  },
  card: {
    backgroundColor: COLOR.white,
    borderWidth: 1,
    borderColor: COLOR.line,
    borderRadius: 20,
    ...shadows.soft,
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
