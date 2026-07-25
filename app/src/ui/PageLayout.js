// src/ui/PageLayout.js
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Screenn from "./Screenn";
import BottomNav from "./BottomNav";
import SideMenu from "./SideMenu"; // نفس السايد منيو اللي بالـHome
import OfflineBanner from "./OfflineBanner";
import CornerSpinner from "./CornerSpinner";
import { useScale } from "./scale";

const COLOR_WHITE = "#FFFFFF";

/**
 * PageLayout:
 * - غلاف موحّد يزوّد كل شاشة بنفس BottomNav الخاص بالهوم
 * - يوفّر Overlay SideMenu جاهز من زر القائمة
 * - يضيف خلفية بيضاء خلف الناف بار (مثل الهوم)
 *
 * Props:
 *  - navigation: من React Navigation
 *  - active: اسم التاب الحالي ("home" | "products" | "agents" | "wallet" | ...الخ)
 *  - children: محتوى الشاشة
 *  - useDynamicPayments, staticItems, onOpenShippingList: تُمرّر إلى BottomNav كما في الهوم
 *  - withSideMenu: تفعيل/تعطيل الـSideMenu (افتراضي true)
 *  - showBottomNav: إظهار شريط التبويب السفلي (افتراضي false)
 */
export default function PageLayout({
  navigation,
  active = "home",
  children,
  useDynamicPayments = true,
  staticItems,
  onOpenShippingList,
  showCornerSpinner = false,
  cornerSpinnerProps,
  withSideMenu = true,
  showBottomNav = false,
}) {
  const insets = useSafeAreaInsets();
  const { sx } = useScale();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  return (
    <Screenn useDefaultBg={false} bgColor={COLOR_WHITE}>
      <View style={styles.container}>
        <OfflineBanner />
        {showCornerSpinner && (
          <View pointerEvents="none" style={styles.spinnerBg}>
            <CornerSpinner
              size={cornerSpinnerProps?.size ?? sx(800)}
              image={cornerSpinnerProps?.image ?? require("../assets/home-corner.png")}
              speedMs={cornerSpinnerProps?.speedMs ?? 16000}
              opacity={cornerSpinnerProps?.opacity ?? 0.88}
            />
          </View>
        )}
        {/* محتوى الصفحة */}
        <View style={styles.content}>{children}</View>

        {showBottomNav && (
          <>
            {/* خلفية بيضاء خلف الناف بار (مطابقة للهوم) */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: insets.bottom + 64 + 6, // نفس ارتفاع الهوم
                backgroundColor: COLOR_WHITE,
                zIndex: 10,
                elevation: 10,
              }}
            />

            {/* نفس BottomNav تبع الهوم */}
            <BottomNav
              navigation={navigation}
              active={active}
              useDynamicPayments={useDynamicPayments}
              staticItems={staticItems}
              onOpenShippingList={
                onOpenShippingList || (() => navigation.navigate("PaymentMethodsList"))
              }
              onOpenMenu={
                withSideMenu ? () => setSideMenuOpen(true) : undefined
              }
            />
          </>
        )}

        {/* Overlay SideMenu نفس الهوم */}
        {withSideMenu && (
          <SideMenu
            visible={sideMenuOpen}
            onClose={() => setSideMenuOpen(false)}
            navigation={navigation}
          />
        )}
      </View>
    </Screenn>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  spinnerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 0,
  },
});
