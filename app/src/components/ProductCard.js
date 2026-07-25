// src/components/ProductCard.js
import React, { useCallback, useState } from "react";
import { View, Text, Image, Pressable, useWindowDimensions } from "react-native";
import { displayPrice } from "../api/store";
import { getProductDisplayImage } from "../features/store/utils/productImages";
import {
  getAdaptiveImageHeight,
  getImageAspectRatioFromLoad,
} from "../features/store/utils/imageSizing";

/** يحدد نص السعر للعرض */
function pickPriceLabel(p, uiCurrency) {
  const res = displayPrice(p, uiCurrency);
  const amt = res?.amount != null ? Number(res.amount) : null;
  const cur = (res?.currency || p?.currency || "").toUpperCase();
  if (amt != null && !Number.isNaN(amt) && amt > 0) return `${amt} ${cur}`.trim();
  if (p?.price != null && Number(p.price) > 0) return `${p.price} ${cur}`.trim();
  return cur || ""; // no amount available, show currency if present
}

/**
 * ProductCard
 * props:
 * - product (object)
 * - onPress()   → فتح صفحة الدفع
 * - onRemove()  → إزالة من المفضلة (اختياري)
 * - showRemove  → هل نظهر زر حذف؟ (افتراضي true)
 */
export default function ProductCard({
  product = {},
  onPress,
  onRemove,
  showRemove = true,
  uiCurrency,
}) {
  const { width } = useWindowDimensions();
  const [imageRatio, setImageRatio] = useState(null);
  const img = getProductDisplayImage(product, product?.section);
  const price = pickPriceLabel(product, uiCurrency);
  const imageBoxWidth = Math.max(1, Math.min(width - 32, 448));
  const imageHeight = getAdaptiveImageHeight(imageBoxWidth, imageRatio, {
    fallbackRatio: 1.35,
    minHeight: 128,
    maxHeight: 190,
  });

  const rememberImageRatio = useCallback((event) => {
    const ratio = getImageAspectRatioFromLoad(event);
    if (!ratio) return;
    setImageRatio((prev) => (Math.abs(Number(prev || 0) - ratio) < 0.02 ? prev : ratio));
  }, []);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#eef2ff" }}
      style={{
        backgroundColor: "#fff",
        borderColor: "#E4ECF2",
        borderWidth: 1.5,
        borderRadius: 18,
        marginHorizontal: 16,
        marginVertical: 8,
        overflow: "hidden",
      }}
    >
      {/* صورة */}
      <View style={{ height: imageHeight, backgroundColor: "#f1f5f9" }}>
        {img ? (
          <Image
            source={{ uri: img }}
            resizeMode="contain"
            style={{ width: "100%", height: "100%" }}
            onLoad={rememberImageRatio}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              borderBottomColor: "#E4ECF2",
              borderBottomWidth: 1,
            }}
          >
            <Text style={{ color: "#94a3b8" }}>لا توجد صورة</Text>
          </View>
        )}
      </View>

      {/* معلومات */}
      <View style={{ padding: 12, gap: 6 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 16, fontWeight: "900", color: "#0E1B3B" }}
        >
          {product?.name || "منتج"}
        </Text>

        {!!product?.description && (
          <Text numberOfLines={2} style={{ fontSize: 13, color: "#5F708C" }}>
            {product.description}
          </Text>
        )}

        {/* السعر */}
        {!!price && (
          <Text style={{ marginTop: 2, fontSize: 14, fontWeight: "800", color: "#0E1B3B" }}>
            {price}
          </Text>
        )}

        {/* الأزرار */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <Pressable
            onPress={onPress}
            android_ripple={{ color: "#1d4ed880" }}
            style={{
              flex: 1,
              backgroundColor: "#1274f5",
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>شراء</Text>
          </Pressable>

          {showRemove && (
            <Pressable
              onPress={onRemove}
              android_ripple={{ color: "#e5e7eb" }}
              style={{
                paddingHorizontal: 14,
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#0E1B3B", fontWeight: "800" }}>حذف</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}
