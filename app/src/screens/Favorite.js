// src/screens/Favorites.js

import React, {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  Alert,
  FlatList,
  RefreshControl,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";

import ProductCard from "../components/ProductCard";

import {
  readGuestFavs,
  removeGuestFav,
} from "../utils/guestFavs";

import {
  listFavorites,
  removeFavorite,
} from "../api/store";

import { useCurrency } from "../context/CurrencyProvider";
import { useAuth } from "../context/AuthProvider";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";

import { spacing } from "../shared/theme";

import { AppHeader } from "../shared/ui/layout";
import { AppEmptyState } from "../shared/ui/primitives";

/* =========================================================
   Screen
========================================================= */

export default function Favorites({
  navigation,
}) {
  const { currency } = useCurrency();

  const { user } = useAuth();

  const isAuthenticated = Boolean(
    user?.id ||
      user?.raw?.id ||
      user?.username ||
      user?.email ||
      user?.phone
  );

  const { width: W } =
    useWindowDimensions();

  const sx = (n) =>
    (W / 390) * n;

  const [items, setItems] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    removingId,
    setRemovingId,
  ] = useState(null);

  /* =======================================================
     Load Favorites
  ======================================================= */

  const load = useCallback(async () => {
    setLoading(true);

    setError("");

    try {
      const list =
        isAuthenticated
          ? await listFavorites()
          : await readGuestFavs();

      setItems(
        Array.isArray(list)
          ? list
          : []
      );
    } catch (loadError) {
      if (isAuthenticated) {
        setItems([]);
      }

      const rawMessage =
        loadError?.response?.data?.detail ||
        loadError?.response?.data?.error ||
        loadError?.message ||
        "";

      /*
       * إذا الخطأ عربي منعرضه.
       * إذا إنكليزي أو تقني منعرض رسالة عربية عامة.
       */
      const hasArabic =
        /[\u0600-\u06FF]/.test(
          String(rawMessage)
        );

      setError(
        hasArabic
          ? String(rawMessage)
          : "تعذر تحميل المفضلة. يرجى المحاولة مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  /* =======================================================
     Reload on Focus
  ======================================================= */

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /* =======================================================
     Open Product
  ======================================================= */

  const openProduct =
    useCallback(
      (prod) => {
        navigation.navigate(
          "Payment",
          {
            product: prod,
          }
        );
      },
      [navigation]
    );

  /* =======================================================
     Remove Product
  ======================================================= */

  const removeOne =
    useCallback(
      async (prod) => {
        if (removingId) {
          return;
        }

        const productId =
          prod?.id;

        setRemovingId(
          productId ||
            "pending"
        );

        try {
          if (
            isAuthenticated
          ) {
            if (
              !productId
            ) {
              throw new Error(
                "معرّف المنتج غير متوفر."
              );
            }

            await removeFavorite(
              productId
            );
          } else {
            await removeGuestFav(
              prod
            );
          }

          await load();
        } catch (
          removeError
        ) {
          const rawMessage =
            removeError?.response?.data
              ?.detail ||
            removeError?.response?.data
              ?.error ||
            removeError?.message ||
            "";

          const hasArabic =
            /[\u0600-\u06FF]/.test(
              String(
                rawMessage
              )
            );

          Alert.alert(
            "خطأ",

            hasArabic
              ? String(
                  rawMessage
                )
              : "تعذر حذف المنتج من المفضلة."
          );
        } finally {
          setRemovingId(
            null
          );
        }
      },
      [
        isAuthenticated,
        load,
        removingId,
      ]
    );

  /* =======================================================
     Confirm Remove
  ======================================================= */

  const confirmRemove =
    useCallback(
      (prod) => {
        Alert.alert(
          "حذف من المفضلة",
          "هل تريد حذف هذا المنتج من المفضلة؟",
          [
            {
              text: "إلغاء",
              style: "cancel",
            },

            {
              text: "نعم",
              style:
                "destructive",

              onPress: () =>
                removeOne(
                  prod
                ),
            },
          ]
        );
      },
      [removeOne]
    );

  /* =======================================================
     Key
  ======================================================= */

  const keyExtractor =
    useCallback(
      (
        item,
        index
      ) =>
        String(
          item?.product
            ?.store_product_id ??
            item?.product?.id ??
            index
        ),
      []
    );

  /* =======================================================
     Product Card
  ======================================================= */

  const renderItem =
    useCallback(
      ({ item }) => {
        const prod =
          item?.product ||
          {};

        return (
          /*
           * wrapper RTL حتى اتجاه العنصر كله
           * يبدأ من اليمين.
           */
          <View
            style={
              styles.productWrap
            }
          >
            <ProductCard
              product={
                prod
              }
              onPress={() =>
                openProduct(
                  prod
                )
              }
              onRemove={() =>
                confirmRemove(
                  prod
                )
              }
              showRemove
              uiCurrency={
                currency
              }
            />
          </View>
        );
      },
      [
        confirmRemove,
        currency,
        openProduct,
      ]
    );

  /* =======================================================
     Empty
  ======================================================= */

  const emptyComponent =
    useMemo(
      () => (
        <View
          style={
            styles.emptyWrap
          }
        >
          <AppEmptyState
            icon="heart-outline"
            title="لم تحفظ أي منتجات بعد."
            style={
              styles.emptyState
            }
          />
        </View>
      ),
      []
    );

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="menu"
      withSideMenu={
        true
      }
    >
      {/* =================================================
          RTL screen wrapper
      ================================================= */}

      <View
        style={
          styles.screen
        }
      >
        {/* Background */}

        <View
          pointerEvents="none"
          style={
            styles.spinnerBg
          }
        >
          <CornerSpinner
            size={
              sx(800)
            }
            image={require("../assets/home-corner.png")}
            speedMs={
              16000
            }
            opacity={
              0.88
            }
          />
        </View>

        {/* =================================================
            Header
        ================================================= */}

        <AppHeader
          title="المفضلة"
          subtitle="المنتجات التي حفظتها سابقاً"
        />

        {/* =================================================
            Error
        ================================================= */}

        {!!error && (
          <View
            style={
              styles.errorBox
            }
          >
            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>

            <Pressable
              disabled={
                loading
              }
              onPress={
                load
              }
              style={[
                styles.retryBtn,

                loading && {
                  opacity:
                    0.6,
                },
              ]}
            >
              <Text
                style={
                  styles.retryText
                }
              >
                إعادة المحاولة
              </Text>
            </Pressable>
          </View>
        )}

        {/* =================================================
            List
        ================================================= */}

        <FlatList
          style={
            styles.list
          }
          data={
            items
          }
          keyExtractor={
            keyExtractor
          }
          renderItem={
            renderItem
          }
          contentContainerStyle={
            styles.listContent
          }
          ListEmptyComponent={
            error
              ? null
              : emptyComponent
          }
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                loading
              }
              onRefresh={
                load
              }
            />
          }
        />
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Styles
========================================================= */

const styles =
  StyleSheet.create({
    /* =====================================================
       Screen RTL
    ===================================================== */

    screen: {
      flex: 1,

      /*
       * إجبار اتجاه الصفحة من اليمين لليسار
       * بدون I18nManager وبدون تغيير التطبيق كله.
       */
      direction: "ltr",
    },

    /* =====================================================
       Background
    ===================================================== */

    spinnerBg: {
      position:
        "absolute",

      top: 0,
      left: 0,
      right: 0,

      height: 0,
    },

    /* =====================================================
       List
    ===================================================== */

    list: {
      flex: 1,

      direction: "rtl",
    },

    listContent: {
      paddingTop:
        spacing.md,

      paddingBottom:
        spacing.xl,

      paddingHorizontal:
        spacing.md +
        spacing.xxs,

      /*
       * كل العناصر تتمدد بعرض القائمة
       * وتبدأ من اليمين.
       */
      alignItems:
        "stretch",
    },

    productWrap: {
      width: "100%",

      direction: "rtl",

      alignItems:
        "stretch",
    },

    /* =====================================================
       Empty State
    ===================================================== */

    emptyWrap: {
      direction: "rtl",

      alignItems:
        "stretch",
    },

    emptyState: {
      marginTop:
        spacing.xxl +
        spacing.sm,

      marginHorizontal:
        spacing.sm,
    },

    /* =====================================================
       Error
    ===================================================== */

    errorBox: {
      marginHorizontal:
        spacing.md,

      borderWidth:
        1,

      borderColor:
        "#FECACA",

      backgroundColor:
        "#FEF2F2",

      borderRadius:
        12,

      padding:
        spacing.md,

      alignItems:
        "stretch",

      direction:
        "rtl",
    },

    errorText: {
      width: "100%",

      color:
        "#991B1B",

      fontWeight:
        "700",

      lineHeight:
        20,

      /*
       * النص العربي فعلياً يبدأ من اليمين
       */
      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    retryBtn: {
      alignSelf:
        "flex-end",

      marginTop:
        spacing.sm,

      borderRadius:
        9,

      backgroundColor:
        "#0B63D8",

      paddingHorizontal:
        spacing.md,

      paddingVertical:
        spacing.sm,
    },

    retryText: {
      color:
        "#FFFFFF",

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },
  });