import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  ActivityIndicator,
  StyleSheet as RNStyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { colors } from "../ui/Theme";
import CornerSpinner from "../ui/CornerSpinner";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCurrency } from "../context/CurrencyProvider";
import { useAuth } from "../context/AuthProvider";
import { useProductPricing } from "../features/store/hooks/useProductPricing";
import { useProductsData } from "../features/store/hooks/useProductsData";
import {
  filterProductsBySearch,
  getProductsForActiveSection,
} from "../features/store/model/productFilters";
import { findSectionById } from "../features/store/model/sectionTree";
import {
  getProductDescription,
  getProductName,
} from "../features/store/utils/productFormatting";
import {
  getProductDisplayImage,
  getSectionImage,
} from "../features/store/utils/productImages";
import {
  getAdaptiveImageHeight,
  getImageAspectRatioFromLoad,
} from "../features/store/utils/imageSizing";
import { AppSearchBox } from "../shared/ui/primitives";
import {
  rowDirection,
  textAlignStart,
  writingDirection,
} from "../shared/utils/rtl";

// ✅ الغلاف الموحّد الذي يحتوي BottomNav + SideMenu تلقائياً
import PageLayout from "../ui/PageLayout";
import { useScale } from "../ui/scale";

const COLOR = {
  primary: "#0B63D8",
  text: "#0E1B3B",
  muted: "#7C8DA6",
  bgSoft: "#F3F7FB",
  line: "#E4ECF2",
  white: "#FFFFFF",
};

const pname = getProductName;
const pdesc = getProductDescription;
const EMPTY_LIST = [];

export default function Products({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width: W } = useWindowDimensions();
  useAuth(); // موجود عندك بالمشروع حتى لو ما استخدمناه هون
  const { sx, sy, sp } = useScale();
  const RADIUS = sx(20);

  // ✅ مستلم قادم من سكان QR + المود (transfer/pay) — للعرض فقط
  const recipient = route?.params?.recipient || null;

  const [lang, setLang] = useState(i18n.language || "en");
  useEffect(() => {
    const onLang = (lng) => setLang(lng || "en");
    i18n.on("languageChanged", onLang);
    return () => {
      try {
        i18n.off("languageChanged", onLang);
      } catch {}
    };
  }, [i18n]);

  const initialSectionId = route?.params?.sectionId ?? route?.params?.section?.id ?? null;

  // ======= Header
  const { currency, setCurrency } = useCurrency();
  const flag =
    currency === "SYP"
      ? require("../assets/flags/sy.png")
      : require("../assets/flags/us.png");

  const handleCurrency = useCallback((opt) => {
    const val = opt === "ل.س" ? "SYP" : opt === "دولار" ? "USD" : opt;
    setCurrency(val);
  }, [setCurrency]);

  // ======= State
  const [mode] = useState(initialSectionId ? "products" : "sections");
  const [rootSectionId] = useState(initialSectionId || null);
  const [productImageRatios, setProductImageRatios] = useState({});
  const [sectionImageRatios, setSectionImageRatios] = useState({});
  const {
    activeSection,
    directProducts,
    error,
    loading,
    retry,
    sections,
    setActiveSection,
  } = useProductsData({ initialSectionId, mode });

  // ✅ نخزن السعر كـ object: { amount, currency }
  const { priceById, pricingBusy } = useProductPricing({
    products: directProducts,
    currency,
    mode,
  });

  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("currency");
        if (saved === "SYP" || saved === "USD") await handleCurrency(saved);
      } catch {}
    })();
  }, [handleCurrency]);


  // ✅ FIX: بدل ما نعمل find على root فقط، نبحث داخل الشجرة كاملة
  const currentSection = useMemo(
    () => findSectionById(sections, activeSection),
    [sections, activeSection]
  );
  const subsections = useMemo(
    () => currentSection?.subsections || EMPTY_LIST,
    [currentSection?.subsections]
  );

  const inRoot = useMemo(() => {
    return mode === "products" && activeSection && rootSectionId && activeSection === rootSectionId;
  }, [mode, activeSection, rootSectionId]);

  const baseListForSearch = useMemo(() => {
    return getProductsForActiveSection(directProducts, inRoot, activeSection);
  }, [directProducts, inRoot, activeSection]);

  const filteredProducts = useMemo(() => {
    return filterProductsBySearch(baseListForSearch, search, lang);
  }, [baseListForSearch, search, lang]);


  const openSubSection = useCallback((sectionId) => setActiveSection(sectionId), [setActiveSection]);

  const rememberImageRatio = useCallback((setter, itemId, event) => {
    const ratio = getImageAspectRatioFromLoad(event);
    if (!ratio) return;

    setter((prev) => {
      const key = String(itemId);
      if (Math.abs(Number(prev[key] || 0) - ratio) < 0.02) return prev;
      return { ...prev, [key]: ratio };
    });
  }, []);

  const openProductTile = useCallback((p) => {
    const productDisplayName = pname(p, lang) || p.name || p.name_en || p.name_ar || "";

    const storeProductId = p?.store_product_id ?? p?.store_product?.id ?? null;

    const row = priceById[p.id];
    const unitPriceDisplay = row?.amount ?? null;
    const displayCurrency = (row?.currency || (currency || "USD")).toUpperCase();

    navigation.navigate("Payment", {
      product_id: p.id,
      store_product_id: storeProductId,
      product: p,

      productDisplayName,
      unit_price_display: unitPriceDisplay,
      display_currency: displayCurrency,
    });
  }, [currency, lang, navigation, priceById]);

  const MIN_CARD_W = Math.max(150, Math.min(200, W * 0.42));
  const H_PAD = sx(16);
  const GAP = sx(12);
  const contentWidth = W - H_PAD * 2;
  const columns = Math.max(2, Math.floor((contentWidth + GAP) / (MIN_CARD_W + GAP)));
  const cardWidth = (contentWidth - GAP * (columns - 1)) / columns;

  const NAV_HEIGHT = sy(64);
  const contentPadBottom = NAV_HEIGHT + insets.bottom + sy(12);
  const MAX_W = 480;
  const headerTop = insets.top + sy(8);

  const productKeyExtractor = useCallback((item, index) => {
    const id = item?.id ?? item?.store_product_id ?? index;
    return `p-${id}`;
  }, []);

  const renderProductItem = useCallback(
    ({ item: p }) => {
      const row = priceById[p.id];
      const amount = row?.amount;
      const cur = (row?.currency || (currency || "USD")).toUpperCase();
      const displayImage = getProductDisplayImage(p, currentSection);
      const imageBoxWidth = Math.max(1, cardWidth - sx(20));
      const imageHeight = getAdaptiveImageHeight(
        imageBoxWidth,
        productImageRatios[String(p.id)],
        {
          fallbackRatio: 1.24,
          minHeight: sy(86),
          maxHeight: sy(142),
        }
      );

      const displayVal =
        pricingBusy && amount == null
          ? "..."
          : amount != null
            ? `${amount} ${cur}`
            : (p?.base_price != null
              ? `${p.base_price} ${(p?.currency || p?.prices?.base_currency || "USD").toUpperCase()}`
              : t("common.notAvailable", "غير متاح"));

      return (
        <Pressable
          onPress={() => openProductTile(p)}
          style={[
            styles.card,
            { width: cardWidth, borderRadius: sp(16), borderColor: "#E4ECF2" },
          ]}
        >
          {displayImage ? (
            <Image
              source={{ uri: displayImage }}
              style={{ width: "100%", height: imageHeight, backgroundColor: "#F3F7FB" }}
              resizeMode="contain"
              onLoad={(event) => rememberImageRatio(setProductImageRatios, p.id, event)}
            />
          ) : (
            <View style={{ width: "100%", height: imageHeight, backgroundColor: "#F3F7FB" }} />
          )}

          <View style={{ padding: sx(10), gap: sy(4) }}>
            <Text
              numberOfLines={2}
              style={{
                color: colors.text,
                fontSize: sp(14),
                fontWeight: "700",
                textAlign: textAlignStart(),
                writingDirection: writingDirection(),
              }}
            >
              {pname(p, lang)}
            </Text>

            {!!pdesc(p, lang) && (
              <Text
                numberOfLines={2}
                style={{
                  color: "#7C8DA6",
                  fontSize: sp(12),
                  textAlign: "center",
                  }}
              >
                {pdesc(p, lang)}
              </Text>
            )}

            <Text
              numberOfLines={1}
              style={{
                color: COLOR.primary,
                fontSize: sp(13),
                fontWeight: "800",
                marginTop: sy(4),
                textAlign: textAlignStart(),
                writingDirection: "ltr",
              }}
            >
              {displayVal}
            </Text>
          </View>
        </Pressable>
      );
    },
    [
      cardWidth,
      currency,
      currentSection,
      lang,
      openProductTile,
      priceById,
      pricingBusy,
      productImageRatios,
      rememberImageRatio,
      sp,
      sx,
      sy,
      t,
    ]
  );

  const ListHeaderComponent = useMemo(
    () => (
      <>
        <View style={{ backgroundColor: "transparent" }}>
          <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W }}>
            <View style={{ marginTop: headerTop, paddingHorizontal: H_PAD }}>
              <View
                style={[
                  styles.header,
                  {
                    flexDirection: rowDirection(),
                    borderRadius: RADIUS,
                  },
                ]}
              >
                <Image
                  source={flag}
                  style={[styles.flag, { width: sx(30), height: sy(22) }]}
                  resizeMode="contain"
                />

                <Segment
                  options={["ل.س", "دولار"]}
                  value={currency}
                  onChange={handleCurrency}
                  sx={sx}
                  sy={sy}
                />

                <View style={{ flex: 1 }} />

                {/* ✅ بانر صغير إذا كنا بوضع شراء لصالح مستخدم */}
                {recipient?.name && (
                  <View
                    style={{
                      backgroundColor: "rgba(18,116,245,0.08)",
                      borderColor: "#BFD9FF",
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      marginEnd: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: COLOR.primary,
                        fontWeight: "900",
                        fontSize: sx(12),
                        textAlign: textAlignStart(),
                        writingDirection: writingDirection(),
                      }}
                    >
                      الشراء لصالح: {recipient.name}
                      {recipient.phone ? ` — ${recipient.phone}` : ""}
                    </Text>
                  </View>
                )}

                <IconButton
                  src={require("../assets/icons/bell.png")}
                  onPress={() => navigation.navigate("Notifications")}
                  alt="الإشعارات"
                  sx={sx}
                  sy={sy}
                />
                <Pressable
                  onPress={() => navigation.navigate("Favorite")}
                  accessibilityLabel="المفضلة"
                  style={[styles.iconBtn, { borderRadius: sx(18) }]}
                >
                  <Ionicons name="heart-outline" size={sx(18)} color={COLOR.text} />
                </Pressable>
                <IconButton
                  src={require("../assets/icons/user.png")}
                  onPress={() => navigation.navigate("Profile")}
                  alt="الملف الشخصي"
                  sx={sx}
                  sy={sy}
                />
              </View>
            </View>
          </View>
          <View style={{ height: RNStyleSheet.hairlineWidth, backgroundColor: COLOR.line }} />
        </View>

        <View pointerEvents="none" style={styles.spinnerBg}>
          <CornerSpinner
            size={sx(800)}
            image={require("../assets/home-corner.png")}
            speedMs={16000}
            opacity={0.88}
          />
        </View>

        {/* BODY */}
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: MAX_W,
            paddingHorizontal: H_PAD,
            paddingTop: sy(12),
          }}
        >
          {!!error && (
            <View style={{ marginBottom: sy(12), borderWidth: 1, borderColor: "#FCA5A5", backgroundColor: "#FEF2F2", borderRadius: 12, padding: sx(12) }}>
              <Text style={{ color: "#991B1B", fontWeight: "700", textAlign: textAlignStart(), writingDirection: writingDirection() }}>
                {error}
              </Text>
              <Pressable
                onPress={retry}
                disabled={loading}
                style={{ alignSelf: "flex-start", marginTop: sy(8), backgroundColor: COLOR.primary, borderRadius: 9, paddingHorizontal: sx(14), paddingVertical: sy(8), opacity: loading ? 0.6 : 1 }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>{t("common.retry", "إعادة المحاولة")}</Text>
              </Pressable>
            </View>
          )}

          {/* Search bar داخل القسم الرئيسي فقط */}
          {inRoot && (
            <AppSearchBox
              value={search}
              onChangeText={setSearch}
              placeholder={t("products.searchPlaceholder", "بحث")}
              style={{
                marginBottom: sy(16),
                borderRadius: sy(25),
                minHeight: sy(50),
              }}
            />
          )}

          {/* Products / subsections grid */}
          {!loading && subsections.length > 0 && (
            <View style={[styles.grid(columns, sx(12)), filteredProducts.length > 0 && { marginBottom: sx(12) }]}>
              {/* الأقسام الفرعية */}
              {subsections.map((s) => {
                const sectionImage = getSectionImage(s);
                const imageBoxWidth = Math.max(1, cardWidth - sx(20));
                const sectionImageHeight = getAdaptiveImageHeight(
                  imageBoxWidth,
                  sectionImageRatios[String(s.id)],
                  {
                    fallbackRatio: 1.18,
                    minHeight: sy(86),
                    maxHeight: sy(142),
                  }
                );
                return (
                  <Pressable
                    key={`sec-${s.id}`}
                    onPress={() => openSubSection(s.id)}
                    style={[
                      styles.card,
                      {
                        width: cardWidth,
                        borderRadius: sp(16),
                        borderColor: "#E4ECF2",
                        backgroundColor: "#fff",
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: "100%",
                        height: sectionImageHeight,
                        backgroundColor: "#F3F7FB",
                        overflow: "hidden",
                      }}
                    >
                      {sectionImage ? (
                        <Image
                          source={{ uri: sectionImage }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="contain"
                          onLoad={(event) => rememberImageRatio(setSectionImageRatios, s.id, event)}
                        />
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}
                    </View>

                    <View style={{ padding: sx(10), gap: sy(4) }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          color: colors.text,
                          fontSize: sp(14),
                          fontWeight: "800",
                          textAlign: textAlignStart(),
                          writingDirection: writingDirection(),
                        }}
                      >
                        {pname(s, lang)}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: "#7C8DA6",
                          fontSize: sp(12),
                          textAlign: textAlignStart(),
                          writingDirection: writingDirection(),
                        }}
                      >
                        {t("products.subsectionLabel")}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </>
    ),
    [
      RADIUS,
      H_PAD,
      MAX_W,
      cardWidth,
      columns,
      currency,
      error,
      flag,
      filteredProducts.length,
      handleCurrency,
      headerTop,
      inRoot,
      lang,
      loading,
      navigation,
      openSubSection,
      recipient,
      retry,
      search,
      sp,
      sectionImageRatios,
      subsections,
      sx,
      sy,
      t,
      rememberImageRatio,
    ]
  );

  const ListEmptyComponent = useCallback(() => {
    if (loading) {
      return (
        <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W, paddingHorizontal: H_PAD }}>
          <View style={{ paddingVertical: sy(30) }}>
            <ActivityIndicator size="large" />
          </View>
        </View>
      );
    }

    if (error) return null;

    if (subsections.length === 0) {
      return (
        <View style={{ alignSelf: "center", width: "100%", maxWidth: MAX_W, paddingHorizontal: H_PAD }}>
          <Text
            style={{
              color: "#687189",
              textAlign: textAlignStart(),
              writingDirection: writingDirection(),
            }}
          >
            {t("common.noItems", "لا توجد منتجات")}
          </Text>
        </View>
      );
    }

    return null;
  }, [H_PAD, MAX_W, error, loading, subsections.length, sy, t]);

  return (
    <PageLayout navigation={navigation} active="products" withSideMenu={true}>
      <FlatList
        key={`products-${columns}`}
        style={{ backgroundColor: COLOR.white }}
        data={loading ? [] : filteredProducts}
        keyExtractor={productKeyExtractor}
        renderItem={renderProductItem}
        numColumns={columns}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        columnWrapperStyle={{
          alignSelf: "center",
          gap: GAP,
          justifyContent: columns > 2 ? "flex-start" : "space-between",
          marginBottom: sx(12),
          maxWidth: MAX_W,
          paddingHorizontal: H_PAD,
          width: "100%",
        }}
        contentContainerStyle={{
          paddingBottom: contentPadBottom + sy(140),
          backgroundColor: COLOR.white,
        }}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
      />
    </PageLayout>
  );
}

/* ==== مكونات صغيرة مثل الهوم ==== */
function IconButton({ src, onPress, alt, sx, sy }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={alt} style={[styles.iconBtn, { borderRadius: sx(18) }]}>
      <Image source={src} style={{ width: sx(18), height: sy(18), tintColor: COLOR.text }} />
    </Pressable>
  );
}

function Segment({ options, value, onChange, sx, sy }) {
  return (
    <View style={[styles.segment, { padding: sx(3), borderRadius: sx(10), flexDirection: rowDirection() }]}>
      {options.map((opt) => {
        const active = (opt === "ل.س" && value === "SYP") || (opt === "دولار" && value === "USD") || opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.segPill,
              { paddingVertical: sy(6), paddingHorizontal: sx(12), borderRadius: sx(8) },
              active && styles.segPillActive,
            ]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ==== Styles ==== */
const styles = StyleSheet.create({
  header: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: RNStyleSheet.hairlineWidth,
    borderColor: COLOR.line,
  },
  flag: { borderRadius: 4, marginHorizontal: 8 },
  segment: { flexDirection: "row", backgroundColor: COLOR.bgSoft, borderWidth: 1, borderColor: COLOR.line },
  segPillActive: { backgroundColor: COLOR.white, borderWidth: 1, borderColor: COLOR.line },
  segText: { color: COLOR.muted, fontWeight: "700" },
  segTextActive: { color: COLOR.primary },
  iconBtn: {
    width: 36,
    height: 36,
    marginStart: 8,
    backgroundColor: COLOR.bgSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLOR.line,
  },
  card: { overflow: "hidden", backgroundColor: "#fff", borderWidth: 1.5 },
  spinnerBg: { position: "absolute", top: 0, left: 0, right: 0, height: 0 },
  grid: (columns, gap) => ({
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: gap,
    rowGap: gap,
    justifyContent: columns > 2 ? "flex-start" : "space-between",
  }),
});




