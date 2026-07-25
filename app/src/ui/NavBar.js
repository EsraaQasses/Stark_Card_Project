// src/ui/NavBar.js
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import AppIcon from "./AppIcon";

const BLUE = "#3A86FF";
const BASE_W = 390;
const BASE_H = 844;

// -------- helpers
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const chunk2 = (arr = []) => {
  const out = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
};

// Build responsive styles using screen size + safe-area insetBottom
function makeStyles({ sx, sy, insetBottom }) {
  const BAR_H = clamp(sy(64), 56, 74);
  const SIDE = clamp(sx(16), 12, 20);
  const BAR_RADIUS = clamp(sx(20), 14, 24);
  const PAD_H = clamp(sx(16), 12, 20);

  const NAV_W = Math.max(clamp(sx(46), 40, 54), 44);
  const NAV_H = Math.max(clamp(sy(40), 38, 50), 44);
  const NAV_RADIUS = clamp(sx(10), 8, 14);

  const TILE_W = clamp(sx(130), 104, 156);
  const TILE_H = clamp(sy(120), 92, 140);
  const TILE_RADIUS = clamp(sx(22), 16, 26);
  const TILE_IMG_W = clamp(sx(50), 36, 64);
  const TILE_IMG_H = clamp(sy(40), 28, 52);
  const TILE_IMG_MB = clamp(sy(8), 6, 10);
  const TILE_TXT = clamp(sx(16), 12, 18);
  const TILE_LINE = clamp(sy(18), 16, 22);

  const BOTTOM = Math.max(sy(10), insetBottom + sy(6)); // sit above home indicator
  const POP_PAD_H = clamp(sx(14), 10, 18);
  const POP_PAD_B = Math.max(insetBottom + sy(8), sy(12));

  return StyleSheet.create({
    // bottom bar
    bar: {
      position: "absolute",
      left: SIDE,
      right: SIDE,
      bottom: BOTTOM,
      height: BAR_H,
      borderRadius: BAR_RADIUS,
      backgroundColor: "#F8FAFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: PAD_H,
      borderWidth: 1,
      borderColor: "rgba(11,99,216,0.12)",
      zIndex: 15,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        },
        android: { elevation: 15 },
        default: {},
      }),
    },

    // nav item touch targets
    navItem: {
      width: NAV_W,
      height: NAV_H,
      borderRadius: NAV_RADIUS,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "transparent",
    },
    navItemActive: {
      backgroundColor: "rgba(11,99,216,0.12)",
      borderColor: "rgba(11,99,216,0.55)",
    },

    // badge فوق زر التحميل
    badgeWrap: { position: "relative" },
    badge: {
      position: "absolute",
      top: -4,
      right: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: "#ef4444",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#fff",
      zIndex: 5,
    },
    badgeTxt: { fontSize: 10, fontWeight: "900", color: "#fff" },

    // modal layers
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },
    popWrap: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      alignItems: "center",
      paddingHorizontal: POP_PAD_H,
      paddingBottom: POP_PAD_B,
    },

    // popover card (rectangle)
    card: {
      backgroundColor: "#bbe4e9ff",
      borderRadius: BAR_RADIUS,
      borderWidth: 1,
      borderColor: BLUE,
      paddingVertical: clamp(sy(14), 10, 18),
      paddingHorizontal: clamp(sx(14), 10, 18),
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        },
        android: { elevation: 16 },
        default: {},
      }),
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    // tiles
    tileWrap: { marginHorizontal: clamp(sx(6), 4, 8) },
    tile: {
      width: TILE_W,
      height: TILE_H,
      borderRadius: TILE_RADIUS,
      backgroundColor: BLUE,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: clamp(sx(8), 6, 10),
    },
    tileImg: { width: TILE_IMG_W, height: TILE_IMG_H, tintColor: "#FFF", marginBottom: TILE_IMG_MB },
    tileText: {
      color: "#FFF",
      fontWeight: "700",
      fontSize: TILE_TXT,
      textAlign: "center",
      lineHeight: TILE_LINE,
    },
  });
}

export default function NavBar({
  active = "home",
  onPressHome,
  onPressQR, // e.g., () => navigation.navigate("QRScanner")
  onPressShipping, // فتح قائمة الشحن (يُمرَّر من BottomNav)
  onPressMenu,
  // Send actions
  onSendStark,
  onTakeMoney,
  // Shipping actions (يُمرَّر من BottomNav فقط — لا fallback)
  shippingItems,
  // ✅ شارة "جديد" تأتي من BottomNav لما تضاف وسيلة شحن جديدة
  shippingHasNew = false,
  insetBottom = 0, // pass insets.bottom from screens
}) {
  const { width: W, height: H } = useWindowDimensions();
  const sx = useCallback((n) => (W / BASE_W) * n, [W]);
  const sy = useCallback((n) => (H / BASE_H) * n, [H]);

  const styles = useMemo(() => makeStyles({ sx, sy, insetBottom }), [sx, sy, insetBottom]);

  // which popover is open: null | "send" | "shipping"
  const [openMenu, setOpenMenu] = useState(null);
  const scale = useRef(new Animated.Value(0.98)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const openPopover = (key) => {
    setOpenMenu(key);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const closePopover = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.98, duration: 120, useNativeDriver: true }),
    ]).start(({ finished }) => finished && setOpenMenu(null));
  };

  const Item = ({ k, name, onPress, onLongPress }) => {
    // Only the opened tab is active-blue; otherwise follow "active" prop
    const isActive = openMenu ? k === openMenu : k === active;
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={k}
        style={[styles.navItem, isActive && styles.navItemActive]}
      >
        <AppIcon name={name} size={22} active={isActive} />
      </Pressable>
    );
  };

  // Responsive popover sizing & position
  const sideGap = clamp(sx(28), 20, 32);
  const CARD_W = Math.min(W - sideGap * 2, clamp(sx(360), 280, 420)); // subtract both sides
  const POP_BOTTOM = Math.max(insetBottom + sy(8), sy(72)); // keep above bar comfortably

  // القائمة النهائية: إمّا ما يُمرَّر من BottomNav أو لا شيء
  const list = Array.isArray(shippingItems) && shippingItems.length > 0 ? shippingItems : [];

  // الضغط العادي على زر "الدفع/Downloads":
  // - إذا في عناصر ديناميكية: افتح البوبوفر
  // - إذا ما في عناصر (لسه ما اجت من الـAPI): افتح PaymentMethodsList مباشرة
  const handleShippingPress = () => {
    if (list.length > 0) {
      if (openMenu === "shipping") closePopover();
      else openPopover("shipping");
    } else {
      onPressShipping?.(); // fallback لفتح القائمة
    }
  };

  const canSend = typeof onSendStark === "function";
  const canTake = typeof onTakeMoney === "function";
  const showUnavailable = () =>
    Alert.alert("غير متوفرة حالياً", "هذه الخدمة غير متوفرة حالياً، جرّب لاحقاً.");

  return (
    <>
      {/* One modal handles both popovers */}
      <Modal visible={!!openMenu} transparent animationType="fade" onRequestClose={closePopover}>
        <TouchableWithoutFeedback onPress={closePopover}>
          <Animated.View style={[styles.scrim, { opacity: fade }]} />
        </TouchableWithoutFeedback>

        <Animated.View
          pointerEvents="box-none"
          style={[styles.popWrap, { transform: [{ scale }], opacity: fade }]}
        >
          <View style={[styles.card, { width: CARD_W, marginBottom: POP_BOTTOM }]}>
            {/* Send menu */}
            {openMenu === "send" && (
              <View>
                <View style={styles.row}>
                  <View style={styles.tileWrap}>
                    {/* ✅ Stark to Stark غير متوفرة */}
                    <Tile
                      title="ستارك إلى ستارك"
                      img={require("../assets/icons/money.png")}
                      onPress={() => {
                        closePopover();
                        if (canSend) onSendStark();
                        else showUnavailable();
                      }}
                      disabled={!canSend}
                      style={[styles.tile, !canSend && { opacity: 0.55 }]}
                      imgStyle={[styles.tileImg, !canSend && { opacity: 0.7 }]}
                      textStyle={styles.tileText}
                    />
                  </View>

                  <View style={styles.tileWrap}>
                    {/* ✅ سحب الأموال غير متوفرة */}
                    <Tile
                      title="سحب أموال"
                      img={require("../assets/icons/funds-transfer.png")}
                      onPress={() => {
                        closePopover();
                        if (canTake) onTakeMoney();
                        else showUnavailable();
                      }}
                      disabled={!canTake}
                      style={[styles.tile, !canTake && { opacity: 0.55 }]}
                      imgStyle={[styles.tileImg, !canTake && { opacity: 0.7 }]}
                      textStyle={styles.tileText}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Downloads menu (بدون fallback) */}
            {openMenu === "shipping" &&
              (list.length > 0 ? (
                <View>
                  {chunk2(list).map((row, idx) => (
                    <View
                      key={`row-${idx}`}
                      style={[styles.row, idx > 0 && { marginTop: clamp(sy(12), 8, 16) }]}
                    >
                      {row.map((it, i) => (
                        <View key={String(it?.id ?? `${idx}-${i}`)} style={styles.tileWrap}>
                          <Tile
                            title={it.title}
                            img={it.img}
                            onPress={() => {
                              closePopover();
                              it.onPress?.();
                            }}
                            style={styles.tile}
                            imgStyle={styles.tileImg}
                            textStyle={styles.tileText}
                          />
                        </View>
                      ))}
                      {/* إذا آخر صف وفيه عنصر واحد فقط، حافظ على المحاذاة */}
                      {row.length === 1 && <View style={[styles.tileWrap, { width: styles.tile.width }]} />}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ paddingVertical: clamp(sy(6), 4, 8) }}>
                  <Text style={{ textAlign: "center", color: "#0E1B3B", fontWeight: "700" }}>
                    لا توجد عناصر.
                  </Text>
                </View>
              ))}
          </View>
        </Animated.View>
      </Modal>

      {/* Bottom bar */}
      <View style={styles.bar}>
        <Item k="menu" name="menu" onPress={onPressMenu} />

        {/* زر الشحن + شارة "جديد" */}
        <View style={styles.badgeWrap}>
          <Item
            k="shipping"
            name="shipping"
            onPress={handleShippingPress}
            onLongPress={onPressShipping} // يفتح القائمة مباشرة
          />
          {shippingHasNew && (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>جديد</Text>
            </View>
          )}
        </View>

        <Item
          k="qr"
          name="qr"
          onPress={() => {
            if (openMenu) closePopover();
            onPressQR?.();
          }}
        />
        <Item
          k="send"
          name="send"
          onPress={() => (openMenu === "send" ? closePopover() : openPopover("send"))}
        />
        <Item k="home" name="home" onPress={onPressHome} />
      </View>
    </>
  );
}

// Reusable blue tile with PNG image (يدعم require() أو { uri })
function Tile({ title, img, onPress, style, imgStyle, textStyle, disabled = false }) {
  const press = useRef(new Animated.Value(1)).current;

  const onIn = () => {
    if (disabled) return;
    Animated.spring(press, { toValue: 0.97, useNativeDriver: true }).start();
  };
  const onOut = () => {
    if (disabled) return;
    Animated.spring(press, { toValue: 1, useNativeDriver: true }).start();
  };

  const source = typeof img === "number" ? img : img?.uri ? { uri: img.uri } : img;

  return (
    <Animated.View style={{ transform: [{ scale: press }], opacity: disabled ? 0.8 : 1 }}>
      <Pressable
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={style}
      >
        <Image source={source} resizeMode="contain" style={imgStyle} />
        <Text style={textStyle}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}
