// src/screens/Favorites.js
import React, { useCallback, useMemo, useState } from "react";
import { View, Alert, FlatList, RefreshControl, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import ProductCard from "../components/ProductCard";
import { readGuestFavs, removeGuestFav } from "../utils/guestFavs";
import { useCurrency } from "../context/CurrencyProvider";
import PageLayout from "../ui/PageLayout"; // âœ… Ø§Ù„ØºÙ„Ø§Ù Ø§Ù„Ù…ÙˆØ­Ø¯ (BottomNav + SideMenu)
import CornerSpinner from "../ui/CornerSpinner";
import { spacing } from "../shared/theme";
import { AppHeader } from "../shared/ui/layout";
import { AppEmptyState } from "../shared/ui/primitives";

/* ==== helpers ==== */

export default function Favorites({ navigation }) {
  const { currency } = useCurrency();
  const { width: W } = useWindowDimensions();
  const sx = (n) => (W / 390) * n;
  const [items, setItems] = useState([]); // [{ product, saved_at }]
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await readGuestFavs();
    setItems(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ÙØªØ­ Ø§Ù„Ù…Ù†ØªØ¬: Payment ÙÙ‚Ø· (Ø¥Ù„ØºØ§Ø¡ Ù…Ø³Ø§Ø± Ø§Ù„ÙˆÙƒÙŠÙ„)
  const openProduct = useCallback((prod) => {
    navigation.navigate("Payment", { product: prod });
  }, [navigation]);

  const removeOne = useCallback(async (prod) => {
    await removeGuestFav(prod);
    await load();
  }, [load]);

  const confirmRemove = useCallback((prod) => {
    Alert.alert("حذف من المفضلة", "متأكدة؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "نعم", onPress: () => removeOne(prod) },
    ]);
  }, [removeOne]);

  const keyExtractor = useCallback(
    (it, idx) => String(it?.product?.store_product_id ?? it?.product?.id ?? idx),
    []
  );

  const renderItem = useCallback(({ item }) => {
    const prod = item.product || {};
    return (
      <ProductCard
        product={prod}
        onPress={() => openProduct(prod)}
        onRemove={() => confirmRemove(prod)}
        showRemove
        uiCurrency={currency}
      />
    );
  }, [confirmRemove, currency, openProduct]);

  const emptyComponent = useMemo(
    () => (
      <AppEmptyState
        icon="heart-outline"
        title="لم تحفظي أي منتجات بعد."
        style={styles.emptyState}
      />
    ),
    []
  );

  return (
    <PageLayout navigation={navigation} active="menu" withSideMenu={true}>
      {/* Ø®Ù„ÙÙŠØ© Ø³Ø¨ÙŠÙ†Ø± Ø´ÙƒÙ„ÙŠØ© */}
      <View pointerEvents="none" style={styles.spinnerBg}>
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.88}
        />
      </View>

      <AppHeader
        title={"\u0627\u0644\u0645\u0641\u0636\u0644\u0629"}
        subtitle={"\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0627\u0644\u062a\u064a \u062d\u0641\u0638\u062a\u0647\u0627 \u0633\u0627\u0628\u0642\u0627"}
      />

      {/* ===== List ===== */}
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={emptyComponent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      />
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
  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md + spacing.xxs,
  },
  emptyState: {
    marginTop: spacing.xxl + spacing.sm,
    marginHorizontal: spacing.sm,
  },
});

