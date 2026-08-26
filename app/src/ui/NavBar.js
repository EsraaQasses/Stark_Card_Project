// src/ui/NavBar.js

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

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

/* =========================================================
   Colors
========================================================= */

const BLUE = "#0B63D8";

const COLORS = {
  primary: "#0B63D8",

  primaryPressed: "#0957BD",

  primarySoft: "#EEF5FF",

  popup: "#F7FAFF",

  bar: "#FFFFFF",

  border: "#D8E5F5",

  text: "#0E1B3B",

  muted: "#6B7B90",

  white: "#FFFFFF",

  danger: "#EF4444",
};

const BASE_W = 390;
const BASE_H = 844;

/* =========================================================
   Helpers
========================================================= */

const clamp = (
  value,
  min,
  max
) =>
  Math.min(
    Math.max(
      value,
      min
    ),
    max
  );

const chunk2 = (
  arr = []
) => {
  const out = [];

  for (
    let i = 0;
    i < arr.length;
    i += 2
  ) {
    out.push(
      arr.slice(
        i,
        i + 2
      )
    );
  }

  return out;
};

/* =========================================================
   Responsive Styles
========================================================= */

function makeStyles({
  sx,
  sy,
  insetBottom,
}) {
  const BAR_H =
    clamp(
      sy(64),
      56,
      74
    );

  const SIDE =
    clamp(
      sx(16),
      12,
      20
    );

  const BAR_RADIUS =
    clamp(
      sx(20),
      14,
      24
    );

  const PAD_H =
    clamp(
      sx(16),
      12,
      20
    );

  const NAV_W =
    Math.max(
      clamp(
        sx(46),
        40,
        54
      ),
      44
    );

  const NAV_H =
    Math.max(
      clamp(
        sy(40),
        38,
        50
      ),
      44
    );

  const NAV_RADIUS =
    clamp(
      sx(10),
      8,
      14
    );

  const TILE_W =
    clamp(
      sx(130),
      104,
      156
    );

  const TILE_H =
    clamp(
      sy(120),
      92,
      140
    );

  const TILE_RADIUS =
    clamp(
      sx(22),
      16,
      26
    );

  const TILE_IMG_W =
    clamp(
      sx(50),
      36,
      64
    );

  const TILE_IMG_H =
    clamp(
      sy(40),
      28,
      52
    );

  const TILE_IMG_MB =
    clamp(
      sy(8),
      6,
      10
    );

  const TILE_TXT =
    clamp(
      sx(16),
      12,
      18
    );

  const TILE_LINE =
    clamp(
      sy(18),
      16,
      22
    );

  const BOTTOM =
    Math.max(
      sy(10),
      insetBottom +
        sy(6)
    );

  const POP_PAD_H =
    clamp(
      sx(14),
      10,
      18
    );

  const POP_PAD_B =
    Math.max(
      insetBottom +
        sy(8),
      sy(12)
    );

  return StyleSheet.create({
    /* =====================================================
       Bottom Bar
    ===================================================== */

    bar: {
      position:
        "absolute",

      left:
        SIDE,

      right:
        SIDE,

      bottom:
        BOTTOM,

      height:
        BAR_H,

      borderRadius:
        BAR_RADIUS,

      backgroundColor:
        COLORS.bar,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      paddingHorizontal:
        PAD_H,

      borderWidth:
        1,

      borderColor:
        COLORS.border,

      zIndex:
        15,

      ...Platform.select({
        ios: {
          shadowColor:
            "#000000",

          shadowOpacity:
            0.08,

          shadowRadius:
            12,

          shadowOffset: {
            width: 0,
            height: 6,
          },
        },

        android: {
          elevation: 15,
        },

        default: {},
      }),
    },

    /* =====================================================
       Nav Item
    ===================================================== */

    navItem: {
      width:
        NAV_W,

      height:
        NAV_H,

      borderRadius:
        NAV_RADIUS,

      alignItems:
        "center",

      justifyContent:
        "center",

      borderWidth:
        1,

      borderColor:
        "transparent",
    },

    navItemActive: {
      backgroundColor:
        COLORS.primarySoft,

      borderColor:
        "rgba(11,99,216,0.45)",
    },

    /* =====================================================
       Badge
    ===================================================== */

    badgeWrap: {
      position:
        "relative",
    },

    badge: {
      position:
        "absolute",

      top:
        -4,

      right:
        -2,

      minWidth:
        18,

      height:
        18,

      paddingHorizontal:
        4,

      borderRadius:
        9,

      backgroundColor:
        COLORS.danger,

      alignItems:
        "center",

      justifyContent:
        "center",

      borderWidth:
        1,

      borderColor:
        COLORS.white,

      zIndex:
        5,
    },

    badgeTxt: {
      fontSize:
        10,

      fontWeight:
        "900",

      color:
        COLORS.white,
    },

    /* =====================================================
       Modal
    ===================================================== */

    scrim: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        "rgba(15,23,42,0.16)",
    },

    popWrap: {
      ...StyleSheet.absoluteFillObject,

      justifyContent:
        "flex-end",

      alignItems:
        "center",

      paddingHorizontal:
        POP_PAD_H,

      paddingBottom:
        POP_PAD_B,
    },

    /* =====================================================
       Popup Card
    ===================================================== */

    card: {
      backgroundColor:
        COLORS.popup,

      borderRadius:
        BAR_RADIUS,

      borderWidth:
        1,

      borderColor:
        COLORS.border,

      paddingVertical:
        clamp(
          sy(14),
          10,
          18
        ),

      paddingHorizontal:
        clamp(
          sx(14),
          10,
          18
        ),

      ...Platform.select({
        ios: {
          shadowColor:
            "#000000",

          shadowOpacity:
            0.1,

          shadowRadius:
            14,

          shadowOffset: {
            width: 0,
            height: 6,
          },
        },

        android: {
          elevation: 16,
        },

        default: {},
      }),
    },

    /* =====================================================
       Rows
    ===================================================== */

    row: {
      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",
    },

    /* =====================================================
       Tiles
    ===================================================== */

    tileWrap: {
      marginHorizontal:
        clamp(
          sx(6),
          4,
          8
        ),
    },

    tile: {
      width:
        TILE_W,

      height:
        TILE_H,

      borderRadius:
        TILE_RADIUS,

      backgroundColor:
        COLORS.primary,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        clamp(
          sx(8),
          6,
          10
        ),

      borderWidth:
        1,

      borderColor:
        "rgba(255,255,255,0.18)",

      ...Platform.select({
        ios: {
          shadowColor:
            COLORS.primary,

          shadowOpacity:
            0.14,

          shadowRadius:
            8,

          shadowOffset: {
            width: 0,
            height: 3,
          },
        },

        android: {
          elevation: 3,
        },

        default: {},
      }),
    },

    tilePressed: {
      backgroundColor:
        COLORS.primaryPressed,
    },

    tileImg: {
      width:
        TILE_IMG_W,

      height:
        TILE_IMG_H,

      tintColor:
        COLORS.white,

      marginBottom:
        TILE_IMG_MB,
    },

    tileText: {
      color:
        COLORS.white,

      fontWeight:
        "800",

      fontSize:
        TILE_TXT,

      textAlign:
        "center",

      lineHeight:
        TILE_LINE,

      writingDirection:
        "rtl",
    },

    emptyText: {
      textAlign:
        "center",

      color:
        COLORS.text,

      fontWeight:
        "700",

      writingDirection:
        "rtl",
    },
  });
}

/* =========================================================
   NavBar
========================================================= */

export default function NavBar({
  active = "home",

  onPressHome,

  onPressQR,

  onPressShipping,

  onPressMenu,

  onSendStark,

  onTakeMoney,

  shippingItems,

  shippingHasNew = false,

  insetBottom = 0,
}) {
  const {
    width: W,
    height: H,
  } =
    useWindowDimensions();

  const sx =
    useCallback(
      (n) =>
        (W / BASE_W) * n,
      [W]
    );

  const sy =
    useCallback(
      (n) =>
        (H / BASE_H) * n,
      [H]
    );

  const styles =
    useMemo(
      () =>
        makeStyles({
          sx,
          sy,
          insetBottom,
        }),
      [
        sx,
        sy,
        insetBottom,
      ]
    );

  /* =======================================================
     Open Menu
  ======================================================= */

  const [
    openMenu,
    setOpenMenu,
  ] =
    useState(null);

  const scale =
    useRef(
      new Animated.Value(
        0.98
      )
    ).current;

  const fade =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  /* =======================================================
     Open Popover
  ======================================================= */

  const openPopover =
    (key) => {
      setOpenMenu(
        key
      );

      Animated.parallel([
        Animated.spring(
          scale,
          {
            toValue:
              1,

            useNativeDriver:
              true,

            friction:
              7,
          }
        ),

        Animated.timing(
          fade,
          {
            toValue:
              1,

            duration:
              150,

            useNativeDriver:
              true,
          }
        ),
      ]).start();
    };

  /* =======================================================
     Close Popover
  ======================================================= */

  const closePopover =
    () => {
      Animated.parallel([
        Animated.timing(
          fade,
          {
            toValue:
              0,

            duration:
              120,

            useNativeDriver:
              true,
          }
        ),

        Animated.timing(
          scale,
          {
            toValue:
              0.98,

            duration:
              120,

            useNativeDriver:
              true,
          }
        ),
      ]).start(
        ({
          finished,
        }) =>
          finished &&
          setOpenMenu(
            null
          )
      );
    };

  /* =======================================================
     Nav Item
  ======================================================= */

  const Item = ({
    k,
    name,
    onPress,
    onLongPress,
  }) => {
    const isActive =
      openMenu
        ? k ===
          openMenu
        : k ===
          active;

    return (
      <Pressable
        onPress={
          onPress
        }
        onLongPress={
          onLongPress
        }
        accessibilityLabel={
          k
        }
        style={[
          styles.navItem,

          isActive &&
            styles.navItemActive,
        ]}
      >
        <AppIcon
          name={
            name
          }
          size={
            22
          }
          active={
            isActive
          }
        />
      </Pressable>
    );
  };

  /* =======================================================
     Popup Dimensions
  ======================================================= */

  const sideGap =
    clamp(
      sx(28),
      20,
      32
    );

  const CARD_W =
    Math.min(
      W -
        sideGap * 2,

      clamp(
        sx(360),
        280,
        420
      )
    );

  const POP_BOTTOM =
    Math.max(
      insetBottom +
        sy(8),

      sy(72)
    );

  /* =======================================================
     Shipping List
  ======================================================= */

  const list =
    Array.isArray(
      shippingItems
    ) &&
    shippingItems.length >
      0
      ? shippingItems
      : [];

  /* =======================================================
     Shipping Press
  ======================================================= */

  const handleShippingPress =
    () => {
      if (
        list.length >
        0
      ) {
        if (
          openMenu ===
          "shipping"
        ) {
          closePopover();
        } else {
          openPopover(
            "shipping"
          );
        }
      } else {
        onPressShipping?.();
      }
    };

  /* =======================================================
     Send Availability
  ======================================================= */

  const canSend =
    typeof onSendStark ===
    "function";

  const canTake =
    typeof onTakeMoney ===
    "function";

  const showUnavailable =
    () =>
      Alert.alert(
        "غير متوفرة حالياً",
        "هذه الخدمة غير متوفرة حالياً، جرّب لاحقاً."
      );

  /* =======================================================
     Render
  ======================================================= */

  return (
    <>
      {/* ===================================================
          Popup
      =================================================== */}

      <Modal
        visible={
          !!openMenu
        }
        transparent
        animationType="fade"
        onRequestClose={
          closePopover
        }
      >
        <TouchableWithoutFeedback
          onPress={
            closePopover
          }
        >
          <Animated.View
            style={[
              styles.scrim,

              {
                opacity:
                  fade,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.popWrap,

            {
              transform: [
                {
                  scale,
                },
              ],

              opacity:
                fade,
            },
          ]}
        >
          <View
            style={[
              styles.card,

              {
                width:
                  CARD_W,

                marginBottom:
                  POP_BOTTOM,
              },
            ]}
          >
            {/* =============================================
                Send Menu
            ============================================= */}

            {openMenu ===
              "send" && (
              <View>
                <View
                  style={
                    styles.row
                  }
                >
                  {/* Stark to Stark */}

                  <View
                    style={
                      styles.tileWrap
                    }
                  >
                    <Tile
                      title="ستارك إلى ستارك"
                      img={require("../assets/icons/money.png")}
                      onPress={() => {
                        closePopover();

                        if (
                          canSend
                        ) {
                          onSendStark();
                        } else {
                          showUnavailable();
                        }
                      }}
                      disabled={
                        !canSend
                      }
                      style={[
                        styles.tile,

                        !canSend && {
                          opacity:
                            0.55,
                        },
                      ]}
                      pressedStyle={
                        styles.tilePressed
                      }
                      imgStyle={[
                        styles.tileImg,

                        !canSend && {
                          opacity:
                            0.7,
                        },
                      ]}
                      textStyle={
                        styles.tileText
                      }
                    />
                  </View>

                  {/* Take Money */}

                  <View
                    style={
                      styles.tileWrap
                    }
                  >
                    <Tile
                      title="سحب أموال"
                      img={require("../assets/icons/funds-transfer.png")}
                      onPress={() => {
                        closePopover();

                        if (
                          canTake
                        ) {
                          onTakeMoney();
                        } else {
                          showUnavailable();
                        }
                      }}
                      disabled={
                        !canTake
                      }
                      style={[
                        styles.tile,

                        !canTake && {
                          opacity:
                            0.55,
                        },
                      ]}
                      pressedStyle={
                        styles.tilePressed
                      }
                      imgStyle={[
                        styles.tileImg,

                        !canTake && {
                          opacity:
                            0.7,
                        },
                      ]}
                      textStyle={
                        styles.tileText
                      }
                    />
                  </View>
                </View>
              </View>
            )}

            {/* =============================================
                Shipping Menu
            ============================================= */}

            {openMenu ===
              "shipping" &&
              (
                list.length >
                0 ? (
                  <View>
                    {chunk2(
                      list
                    ).map(
                      (
                        row,
                        idx
                      ) => (
                        <View
                          key={`row-${idx}`}
                          style={[
                            styles.row,

                            idx >
                              0 && {
                              marginTop:
                                clamp(
                                  sy(12),
                                  8,
                                  16
                                ),
                            },
                          ]}
                        >
                          {row.map(
                            (
                              item,
                              i
                            ) => (
                              <View
                                key={String(
                                  item?.id ??
                                    `${idx}-${i}`
                                )}
                                style={
                                  styles.tileWrap
                                }
                              >
                                <Tile
                                  title={
                                    item.title
                                  }
                                  img={
                                    item.img
                                  }
                                  onPress={() => {
                                    closePopover();

                                    item.onPress?.();
                                  }}
                                  style={
                                    styles.tile
                                  }
                                  pressedStyle={
                                    styles.tilePressed
                                  }
                                  imgStyle={
                                    styles.tileImg
                                  }
                                  textStyle={
                                    styles.tileText
                                  }
                                />
                              </View>
                            )
                          )}

                          {/* آخر صف فيه عنصر واحد */}

                          {row.length ===
                            1 && (
                            <View
                              style={[
                                styles.tileWrap,

                                {
                                  width:
                                    styles
                                      .tile
                                      .width,
                                },
                              ]}
                            />
                          )}
                        </View>
                      )
                    )}
                  </View>
                ) : (
                  <View
                    style={{
                      paddingVertical:
                        clamp(
                          sy(6),
                          4,
                          8
                        ),
                    }}
                  >
                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      لا توجد عناصر.
                    </Text>
                  </View>
                )
              )}
          </View>
        </Animated.View>
      </Modal>

      {/* ===================================================
          Bottom Bar
      =================================================== */}

      <View
        style={
          styles.bar
        }
      >
        <Item
          k="menu"
          name="menu"
          onPress={
            onPressMenu
          }
        />

        {/* Shipping */}

        <View
          style={
            styles.badgeWrap
          }
        >
          <Item
            k="shipping"
            name="shipping"
            onPress={
              handleShippingPress
            }
            onLongPress={
              onPressShipping
            }
          />

          {shippingHasNew && (
            <View
              style={
                styles.badge
              }
            >
              <Text
                style={
                  styles.badgeTxt
                }
              >
                جديد
              </Text>
            </View>
          )}
        </View>

        {/* QR */}

        <Item
          k="qr"
          name="qr"
          onPress={() => {
            if (
              openMenu
            ) {
              closePopover();
            }

            onPressQR?.();
          }}
        />

        {/* Send */}

        <Item
          k="send"
          name="send"
          onPress={() =>
            openMenu ===
            "send"
              ? closePopover()
              : openPopover(
                  "send"
                )
          }
        />

        {/* Home */}

        <Item
          k="home"
          name="home"
          onPress={
            onPressHome
          }
        />
      </View>
    </>
  );
}

/* =========================================================
   Tile
========================================================= */

function Tile({
  title,
  img,
  onPress,

  style,
  pressedStyle,

  imgStyle,
  textStyle,

  disabled = false,
}) {
  const press =
    useRef(
      new Animated.Value(
        1
      )
    ).current;

  const onIn =
    () => {
      if (
        disabled
      ) {
        return;
      }

      Animated.spring(
        press,
        {
          toValue:
            0.97,

          useNativeDriver:
            true,
        }
      ).start();
    };

  const onOut =
    () => {
      if (
        disabled
      ) {
        return;
      }

      Animated.spring(
        press,
        {
          toValue:
            1,

          useNativeDriver:
            true,
        }
      ).start();
    };

  const source =
    typeof img ===
    "number"
      ? img
      : img?.uri
        ? {
            uri:
              img.uri,
          }
        : img;

  return (
    <Animated.View
      style={{
        transform: [
          {
            scale:
              press,
          },
        ],

        opacity:
          disabled
            ? 0.8
            : 1,
      }}
    >
      <Pressable
        onPressIn={
          onIn
        }
        onPressOut={
          onOut
        }
        onPress={
          disabled
            ? undefined
            : onPress
        }
        disabled={
          disabled
        }
        style={({
          pressed,
        }) => [
          style,

          pressed &&
            !disabled &&
            pressedStyle,
        ]}
      >
        <Image
          source={
            source
          }
          resizeMode="contain"
          style={
            imgStyle
          }
        />

        <Text
          style={
            textStyle
          }
        >
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}