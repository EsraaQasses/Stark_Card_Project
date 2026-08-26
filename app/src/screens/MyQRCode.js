// src/screens/MyQRCode.js

import { Ionicons } from "@expo/vector-icons";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";

import { AppHeader } from "../shared/ui/layout";

import {
  sx as sxBase,
  sy as syBase,
} from "../ui/scale";

import api from "../api/client";

/* =========================================================
   Constants
========================================================= */

const MAX_W = 480;

const COLORS = {
  bg: "#F7F9FC",

  card: "#FFFFFF",

  text: "#0E1B3B",

  muted: "#718198",

  line: "#E4ECF2",

  primary: "#0B63D8",

  primarySoft: "#EEF5FF",

  success: "#16A34A",

  successSoft: "#F0FDF4",

  danger: "#DC2626",

  dangerSoft: "#FEF2F2",
};

/* =========================================================
   Helpers
========================================================= */

function makeAbsoluteUrl(url) {
  if (!url) {
    return null;
  }

  if (
    /^https?:\/\//i.test(url)
  ) {
    return url;
  }

  const apiBase =
    api?.defaults?.baseURL ||
    "";

  const origin =
    apiBase
      .replace(
        /\/api\/?$/i,
        ""
      )
      .replace(
        /\/$/,
        ""
      );

  return `${origin}${
    url.startsWith("/")
      ? ""
      : "/"
  }${url}`;
}

/* =========================================================
   Screen
========================================================= */

export default function MyQRCode({
  navigation,
}) {
  const insets =
    useSafeAreaInsets();

  const sx = sxBase;
  const sy = syBase;

  /* =======================================================
     State
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    qrUrl,
    setQrUrl,
  ] = useState(null);

  const [
    phone,
    setPhone,
  ] = useState(null);

  const [
    userId,
    setUserId,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    role,
    setRole,
  ] = useState(null);

  const [
    agentCode,
    setAgentCode,
  ] = useState(null);

  const [
    qrPayload,
    setQrPayload,
  ] = useState(null);

  const [
    agentMode,
    setAgentMode,
  ] = useState(false);

  /* =======================================================
     Request protection
  ======================================================= */

  const qrFetchInFlight =
    useRef(false);

  const qrLastFetchAt =
    useRef(0);

  /* =======================================================
     Cache key
  ======================================================= */

  const storageKey =
    useCallback(
      (uid) =>
        uid
          ? `@qr_url:${uid}`
          : "@qr_url",
      []
    );

  /* =======================================================
     Load User
  ======================================================= */

  const loadMe =
    useCallback(
      async () => {
        const hasPhone =
          phone ||
          phone === "";

        const isAgent =
          role === "agent";

        if (
          userId &&
          hasPhone &&
          role &&
          (
            !isAgent ||
            agentCode
          )
        ) {
          return {
            id:
              userId,

            phone,

            role,

            agent_code:
              agentCode,
          };
        }

        try {
          const response =
            await api.get(
              "/users/me/"
            );

          const data =
            response?.data ||
            {};

          const loadedPhone =
            data?.phone ||
            data?.mobile ||
            null;

          const id =
            data?.id ??
            data?.pk ??
            null;

          const loadedRole =
            data?.role ||
            data?.user_role ||
            "user";

          const loadedAgentCode =
            data?.agent_code ||
            data?.agentCode ||
            null;

          setPhone(
            loadedPhone
          );

          setUserId(id);

          setRole(
            loadedRole
          );

          setAgentCode(
            loadedAgentCode
          );

          return {
            id,

            phone:
              loadedPhone,

            role:
              loadedRole,

            agent_code:
              loadedAgentCode,
          };
        } catch {
          return {
            id: null,

            phone: null,

            role: null,

            agent_code:
              null,
          };
        }
      },
      [
        agentCode,
        phone,
        role,
        userId,
      ]
    );

  /* =======================================================
     Parse QR data
  ======================================================= */

  const applyQrPayload =
    useCallback(
      (raw) => {
        if (!raw) {
          return;
        }

        try {
          const parsed =
            typeof raw ===
            "string"
              ? JSON.parse(raw)
              : raw;

          if (
            !parsed ||
            typeof parsed !==
              "object"
          ) {
            return;
          }

          setQrPayload(
            parsed
          );

          if (
            parsed?.agent_code
          ) {
            setAgentCode(
              parsed.agent_code
            );
          }

          if (
            !phone &&
            parsed?.phone
          ) {
            setPhone(
              parsed.phone
            );
          }

          if (
            !userId &&
            parsed?.user_id
          ) {
            setUserId(
              parsed.user_id
            );
          }
        } catch {
          // تجاهل البيانات غير الصالحة
        }
      },
      [
        phone,
        userId,
      ]
    );

  /* =======================================================
     Load QR
  ======================================================= */

  const loadQr =
    useCallback(
      async (
        uidMaybe,
        {
          force = false,
        } = {}
      ) => {
        setError("");

        try {
          const uid =
            uidMaybe ??
            userId;

          const now =
            Date.now();

          /* ===============================================
             Cache
          =============================================== */

          const cached =
            await AsyncStorage.getItem(
              storageKey(uid)
            );

          const needsAgentCode =
            role === "agent" &&
            !agentCode;

          const needsPayload =
            role === "agent" &&
            !qrPayload
              ?.agent_code;

          if (
            cached &&
            !force &&
            !needsAgentCode &&
            !needsPayload
          ) {
            if (!qrUrl) {
              setQrUrl(
                cached
              );
            }

            return;
          }

          if (
            cached &&
            !qrUrl
          ) {
            setQrUrl(
              cached
            );
          }

          /* ===============================================
             Prevent duplicate requests
          =============================================== */

          if (!force) {
            if (
              qrFetchInFlight
                .current
            ) {
              return;
            }

            if (
              now -
                qrLastFetchAt
                  .current <
              30000
            ) {
              return;
            }
          }

          qrFetchInFlight.current =
            true;

          /* ===============================================
             Server
          =============================================== */

          const response =
            await api.get(
              "/qr_code/my-qr/"
            );

          const baseUrl =
            response?.data
              ?.qr_code_url ||
            response?.data
              ?.url ||
            null;

          const qrDataRaw =
            response?.data
              ?.qr_data ||
            null;

          if (qrDataRaw) {
            applyQrPayload(
              qrDataRaw
            );
          }

          const absoluteUrl =
            makeAbsoluteUrl(
              baseUrl
            );

          if (
            absoluteUrl
          ) {
            setQrUrl(
              absoluteUrl
            );

            await AsyncStorage.setItem(
              storageKey(uid),
              absoluteUrl
            );

            qrLastFetchAt.current =
              now;
          } else if (
            !cached
          ) {
            setError(
              "لا يتوفر رمز الاستجابة السريعة حالياً."
            );
          }
        } catch {
          if (!qrUrl) {
            setError(
              "تعذر تحميل رمز الاستجابة السريعة. حاول مرة أخرى."
            );
          }
        } finally {
          qrFetchInFlight.current =
            false;
        }
      },
      [
        agentCode,
        applyQrPayload,
        qrPayload,
        qrUrl,
        role,
        storageKey,
        userId,
      ]
    );

  /* =======================================================
     Refresh
  ======================================================= */

  const onRefresh =
    useCallback(
      async () => {
        setRefreshing(
          true
        );

        try {
          const me =
            await loadMe();

          if (me?.id) {
            try {
              await AsyncStorage.removeItem(
                storageKey(
                  me.id
                )
              );
            } catch {}
          }

          await loadQr(
            me?.id,
            {
              force:
                true,
            }
          );
        } finally {
          setRefreshing(
            false
          );
        }
      },
      [
        loadMe,
        loadQr,
        storageKey,
      ]
    );

  /* =======================================================
     Regenerate
  ======================================================= */

  const onRegenerate =
    useCallback(
      async () => {
        setError("");

        const me =
          userId
            ? {
                id:
                  userId,
              }
            : await loadMe();

        const uid =
          me?.id ??
          userId;

        try {
          const response =
            await api.post(
              "/qr_code/generate/",
              {}
            );

          const baseUrl =
            response?.data
              ?.qr_code
              ?.qr_code_url ||
            response?.data
              ?.qr_code_url ||
            response?.data
              ?.url ||
            null;

          const qrDataRaw =
            response?.data
              ?.qr_code
              ?.qr_data ||
            response?.data
              ?.qr_data ||
            null;

          if (
            qrDataRaw
          ) {
            applyQrPayload(
              qrDataRaw
            );
          }

          const absoluteUrl =
            makeAbsoluteUrl(
              baseUrl
            );

          if (
            absoluteUrl
          ) {
            setQrUrl(
              absoluteUrl
            );

            if (uid) {
              await AsyncStorage.setItem(
                storageKey(
                  uid
                ),
                absoluteUrl
              );
            }

            qrLastFetchAt.current =
              Date.now();

            return;
          }
        } catch {
          // نجرب إعادة الجلب أدناه
        }

        await loadQr(
          uid,
          {
            force:
              true,
          }
        );
      },
      [
        applyQrPayload,
        loadMe,
        loadQr,
        storageKey,
        userId,
      ]
    );

  /* =======================================================
     Initial Load
  ======================================================= */

  useEffect(() => {
    let alive =
      true;

    (async () => {
      try {
        const me =
          await loadMe();

        await loadQr(
          me?.id
        );
      } finally {
        if (alive) {
          setLoading(
            false
          );
        }
      }
    })();

    return () => {
      alive =
        false;
    };
  }, [
    loadMe,
    loadQr,
  ]);

  /* =======================================================
     Android back
  ======================================================= */

  useFocusEffect(
    useCallback(() => {
      const onBackPress =
        () => {
          navigation.navigate(
            "Home"
          );

          return true;
        };

      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );

      return () =>
        subscription.remove();
    }, [navigation])
  );

  /* =======================================================
     Open
  ======================================================= */

  const openInBrowser =
    useCallback(() => {
      if (!qrUrl) {
        return;
      }

      Linking.openURL(
        qrUrl
      ).catch(() => {
        Alert.alert(
          "تعذر فتح الرابط",
          "لا يمكن فتح الرابط حالياً."
        );
      });
    }, [qrUrl]);

  /* =======================================================
     Share
  ======================================================= */

  const shareQr =
    useCallback(
      async () => {
        if (!qrUrl) {
          return;
        }

        try {
          await Share.share({
            title:
              "رمز الاستجابة السريعة الخاص بي",

            message:
              `رمز الاستجابة السريعة الخاص بي:\n${qrUrl}`,

            url:
              qrUrl,
          });
        } catch {
          Alert.alert(
            "تعذر المشاركة",
            "لم نتمكن من مشاركة الرمز حالياً."
          );
        }
      },
      [qrUrl]
    );

  /* =======================================================
     Values
  ======================================================= */

  const currentAgentCode =
    agentCode ||
    qrPayload?.agent_code ||
    "";

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="qr"
      withSideMenu
      showBottomNav
    >
      <View
        style={
          styles.page
        }
      >
        {/* =================================================
            Background
        ================================================= */}

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
              0.4
            }
          />
        </View>

        {/* =================================================
            Header
        ================================================= */}

        <AppHeader
          title="رمز الاستجابة السريعة"
        />

        {/* =================================================
            Content
        ================================================= */}

        <ScrollView
          style={
            styles.scroll
          }
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                onRefresh
              }
              tintColor={
                COLORS.primary
              }
              colors={[
                COLORS.primary,
              ]}
            />
          }
          contentContainerStyle={{
            paddingBottom:
              insets.bottom +
              sy(120),
          }}
        >
          <View
            style={[
              styles.content,

              {
                paddingHorizontal:
                  sx(14),

                paddingTop:
                  sy(12),
              },
            ]}
          >
            {/* =============================================
                Error
            ============================================= */}

            {!!error && (
              <View
                style={
                  styles.errorBox
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={
                    sx(19)
                  }
                  color={
                    COLORS.danger
                  }
                />

                <Text
                  style={
                    styles.errorText
                  }
                >
                  {error}
                </Text>
              </View>
            )}

            {/* =============================================
                Main card
            ============================================= */}

            <View
              style={
                styles.card
              }
            >
              {loading ? (
                /* =========================================
                   Loading
                ========================================= */

                <View
                  style={
                    styles.loading
                  }
                >
                  <ActivityIndicator
                    size="large"
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.loadingText
                    }
                  >
                    جاري تحميل الرمز...
                  </Text>
                </View>
              ) : qrUrl ? (
                <>
                  {/* =======================================
                      Agent Mode Switch
                  ======================================= */}

                  {role ===
                    "agent" && (
                    <View
                      style={
                        styles.modeSection
                      }
                    >
                      <Text
                        style={
                          styles.modeLabel
                        }
                      >
                        طريقة استخدام الرمز
                      </Text>

                      <View
                        style={
                          styles.modeSwitch
                        }
                      >
                        <Pressable
                          onPress={() =>
                            setAgentMode(
                              false
                            )
                          }
                          style={[
                            styles.modeButton,

                            !agentMode &&
                              styles.modeButtonActive,
                          ]}
                        >
                          <Ionicons
                            name="wallet-outline"
                            size={
                              sx(16)
                            }
                            color={
                              !agentMode
                                ? "#FFFFFF"
                                : COLORS
                                    .primary
                            }
                          />

                          <Text
                            style={[
                              styles.modeButtonText,

                              !agentMode &&
                                styles.modeButtonTextActive,
                            ]}
                          >
                            استقبال الأموال
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() =>
                            setAgentMode(
                              true
                            )
                          }
                          style={[
                            styles.modeButton,

                            agentMode &&
                              styles.modeButtonActive,
                          ]}
                        >
                          <Ionicons
                            name="people-outline"
                            size={
                              sx(16)
                            }
                            color={
                              agentMode
                                ? "#FFFFFF"
                                : COLORS
                                    .primary
                            }
                          />

                          <Text
                            style={[
                              styles.modeButtonText,

                              agentMode &&
                                styles.modeButtonTextActive,
                            ]}
                          >
                            الربط كوكيل
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* =======================================
                      Normal QR
                  ======================================= */}

                  {!agentMode ? (
                    <>
                      <View
                        style={
                          styles.qrSection
                        }
                      >
                        <View
                          style={
                            styles.qrFrame
                          }
                        >
                          <Image
                            source={{
                              uri:
                                qrUrl,
                            }}
                            style={
                              styles.qrImage
                            }
                            resizeMode="contain"
                          />
                        </View>

                        <Text
                          style={
                            styles.qrHint
                          }
                        >
                          شارك هذا الرمز ليستطيع الآخرون تحويل الأموال إليك بسهولة.
                        </Text>
                      </View>

                      {/* ===================================
                          Account info
                      =================================== */}

                      <View
                        style={
                          styles.infoCard
                        }
                      >
                        <View
                          style={
                            styles.infoRow
                          }
                        >
                          <View
                            style={
                              styles.infoLabelRow
                            }
                          >
                            <View
                              style={
                                styles.smallIcon
                              }
                            >
                              <Ionicons
                                name="call-outline"
                                size={
                                  sx(
                                    15
                                  )
                                }
                                color={
                                  COLORS.primary
                                }
                              />
                            </View>

                            <Text
                              style={
                                styles.infoLabel
                              }
                            >
                              رقم المحفظة / الهاتف
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.infoValueLtr
                            }
                          >
                            {phone
                              ? String(
                                  phone
                                )
                              : "غير متوفر"}
                          </Text>
                        </View>

                        {role ===
                          "agent" && (
                          <>
                            <View
                              style={
                                styles.divider
                              }
                            />

                            <View
                              style={
                                styles.infoRow
                              }
                            >
                              <View
                                style={
                                  styles.infoLabelRow
                                }
                              >
                                <View
                                  style={
                                    styles.smallIcon
                                  }
                                >
                                  <Ionicons
                                    name="key-outline"
                                    size={
                                      sx(
                                        15
                                      )
                                    }
                                    color={
                                      COLORS.primary
                                    }
                                  />
                                </View>

                                <Text
                                  style={
                                    styles.infoLabel
                                  }
                                >
                                  رمز الوكيل
                                </Text>
                              </View>

                              <Text
                                style={
                                  styles.agentCodeSmall
                                }
                              >
                                {currentAgentCode ||
                                  "غير متوفر"}
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </>
                  ) : (
                    /* =====================================
                       Agent Connect
                    ===================================== */

                    <>
                      <View
                        style={
                          styles.agentIntro
                        }
                      >
                        <View
                          style={
                            styles.agentIntroIcon
                          }
                        >
                          <Ionicons
                            name="people-outline"
                            size={
                              sx(23)
                            }
                            color={
                              COLORS.primary
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.agentIntroText
                          }
                        >
                          <Text
                            style={
                              styles.agentTitle
                            }
                          >
                            الربط معك كوكيل
                          </Text>

                          <Text
                            style={
                              styles.agentHint
                            }
                          >
                            شارك رمز الوكيل أو رمز الاستجابة السريعة ليتمكن المستخدم من الارتباط بك.
                          </Text>
                        </View>
                      </View>

                      {/* ===================================
                          Agent Code
                      =================================== */}

                      <View
                        style={
                          styles.agentBlock
                        }
                      >
                        <View
                          style={
                            styles.blockHeader
                          }
                        >
                          <View
                            style={
                              styles.blockIcon
                            }
                          >
                            <Ionicons
                              name="key-outline"
                              size={
                                sx(17)
                              }
                              color={
                                COLORS.primary
                              }
                            />
                          </View>

                          <Text
                            style={
                              styles.blockTitle
                            }
                          >
                            الربط عبر رمز الوكيل
                          </Text>
                        </View>

                        <View
                          style={
                            styles.agentCodeBox
                          }
                        >
                          <Text
                            selectable
                            style={
                              styles.agentCode
                            }
                          >
                            {currentAgentCode ||
                              "غير متوفر"}
                          </Text>
                        </View>

                        {!currentAgentCode && (
                          <Text
                            style={
                              styles.agentMissing
                            }
                          >
                            رمز الوكيل غير متوفر حالياً. اسحب الصفحة للأسفل للتحديث أو تواصل مع الدعم.
                          </Text>
                        )}
                      </View>

                      {/* ===================================
                          Agent QR
                      =================================== */}

                      <View
                        style={
                          styles.agentBlock
                        }
                      >
                        <View
                          style={
                            styles.blockHeader
                          }
                        >
                          <View
                            style={
                              styles.blockIcon
                            }
                          >
                            <Ionicons
                              name="qr-code-outline"
                              size={
                                sx(17)
                              }
                              color={
                                COLORS.primary
                              }
                            />
                          </View>

                          <Text
                            style={
                              styles.blockTitle
                            }
                          >
                            الربط عبر رمز الاستجابة السريعة
                          </Text>
                        </View>

                        <View
                          style={
                            styles.agentQrFrame
                          }
                        >
                          <Image
                            source={{
                              uri:
                                qrUrl,
                            }}
                            style={
                              styles.agentQrImage
                            }
                            resizeMode="contain"
                          />
                        </View>
                      </View>
                    </>
                  )}

                  {/* =======================================
                      Actions
                  ======================================= */}

                  <View
                    style={
                      styles.actions
                    }
                  >
                    <Pressable
                      onPress={
                        shareQr
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.primaryButton,

                        pressed && {
                          opacity:
                            0.86,
                        },
                      ]}
                    >
                      <Ionicons
                        name="share-social-outline"
                        size={
                          sx(17)
                        }
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.primaryButtonText
                        }
                      >
                        مشاركة
                      </Text>
                    </Pressable>

                    <View
                      style={
                        styles.secondaryActions
                      }
                    >
                      <Pressable
                        onPress={
                          onRefresh
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.secondaryButton,

                          pressed && {
                            opacity:
                              0.75,
                          },
                        ]}
                      >
                        <Ionicons
                          name="refresh-outline"
                          size={
                            sx(17)
                          }
                          color={
                            COLORS.primary
                          }
                        />

                        <Text
                          style={
                            styles.secondaryButtonText
                          }
                        >
                          تحديث
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={
                          onRegenerate
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.secondaryButton,

                          pressed && {
                            opacity:
                              0.75,
                          },
                        ]}
                      >
                        <Ionicons
                          name="qr-code-outline"
                          size={
                            sx(17)
                          }
                          color={
                            COLORS.primary
                          }
                        />

                        <Text
                          style={
                            styles.secondaryButtonText
                          }
                        >
                          إنشاء رمز جديد
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={
                          openInBrowser
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.secondaryButton,

                          pressed && {
                            opacity:
                              0.75,
                          },
                        ]}
                      >
                        <Ionicons
                          name="open-outline"
                          size={
                            sx(17)
                          }
                          color={
                            COLORS.primary
                          }
                        />

                        <Text
                          style={
                            styles.secondaryButtonText
                          }
                        >
                          فتح
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                /* =========================================
                   No QR
                ========================================= */

                <View
                  style={
                    styles.emptyState
                  }
                >
                  <View
                    style={
                      styles.emptyIcon
                    }
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={
                        sx(30)
                      }
                      color={
                        COLORS.primary
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    لا يوجد رمز حالياً
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    اسحب الصفحة للأسفل للتحديث أو حاول إنشاء رمز جديد.
                  </Text>

                  <Pressable
                    onPress={
                      onRegenerate
                    }
                    style={
                      styles.emptyButton
                    }
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={
                        sx(17)
                      }
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.emptyButtonText
                      }
                    >
                      إنشاء الرمز
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
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
       Page
    ===================================================== */

    page: {
      flex: 1,

      backgroundColor:
        COLORS.bg,

      direction:
        "ltr",
    },

    scroll: {
      flex: 1,

      backgroundColor:
        COLORS.bg,
    },

    content: {
      width: "100%",

      maxWidth:
        MAX_W,

      alignSelf:
        "center",
    },

    spinnerBg: {
      position:
        "absolute",

      top: 0,
      right: 0,
      left: 0,

      height: 0,
    },

    /* =====================================================
       Error
    ===================================================== */

    errorBox: {
      width:
        "100%",

      marginBottom:
        10,

      padding:
        11,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        7,

      backgroundColor:
        COLORS.dangerSoft,

      borderWidth:
        1,

      borderColor:
        "#FECACA",

      borderRadius:
        13,
    },

    errorText: {
      flex: 1,

      color:
        COLORS.danger,

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Main Card
    ===================================================== */

    card: {
      width:
        "100%",

      padding:
        14,

      backgroundColor:
        COLORS.card,

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        18,

      shadowColor:
        "#000",

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.03,

      shadowRadius:
        7,

      elevation:
        1,
    },

    /* =====================================================
       Loading
    ===================================================== */

    loading: {
      minHeight:
        300,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    loadingText: {
      marginTop:
        10,

      color:
        COLORS.muted,

      fontSize:
        12,

      fontWeight:
        "700",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       QR
    ===================================================== */

    qrSection: {
      width:
        "100%",

      alignItems:
        "center",
    },

    qrFrame: {
      width:
        278,

      height:
        278,

      padding:
        9,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        "#D7E6FF",

      borderRadius:
        22,

      shadowColor:
        "#0B63D8",

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity:
        0.06,

      shadowRadius:
        12,

      elevation:
        2,
    },

    qrImage: {
      width:
        255,

      height:
        255,
    },

    qrHint: {
      width:
        "100%",

      maxWidth:
        310,

      marginTop:
        13,

      color:
        COLORS.muted,

      fontSize:
        12.5,

      lineHeight:
        20,

      fontWeight:
        "600",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Info
    ===================================================== */

    infoCard: {
      width:
        "100%",

      marginTop:
        16,

      paddingHorizontal:
        12,

      backgroundColor:
        "#F8FAFD",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        15,
    },

    infoRow: {
      minHeight:
        57,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        10,
    },

    infoLabelRow: {
      flex:
        1,

      minWidth:
        0,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        7,
    },

    smallIcon: {
      width:
        30,

      height:
        30,

      borderRadius:
        9,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    infoLabel: {
      flex: 1,

      color:
        COLORS.muted,

      fontSize:
        11.5,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    infoValueLtr: {
      flexShrink:
        0,

      color:
        COLORS.text,

      fontSize:
        12,

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "ltr",
    },

    agentCodeSmall: {
      flexShrink:
        0,

      color:
        COLORS.primary,

      fontSize:
        13,

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "ltr",
    },

    divider: {
      width:
        "100%",

      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLORS.line,
    },

    /* =====================================================
       Agent Mode
    ===================================================== */

    modeSection: {
      width:
        "100%",

      marginBottom:
        15,
    },

    modeLabel: {
      width:
        "100%",

      marginBottom:
        7,

      color:
        COLORS.text,

      fontSize:
        12,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    modeSwitch: {
      width:
        "100%",

      padding:
        4,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        4,

      backgroundColor:
        COLORS.primarySoft,

      borderRadius:
        13,
    },

    modeButton: {
      flex: 1,

      minHeight:
        39,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        5,

      borderRadius:
        10,
    },

    modeButtonActive: {
      backgroundColor:
        COLORS.primary,
    },

    modeButtonText: {
      color:
        COLORS.primary,

      fontSize:
        11,

      fontWeight:
        "800",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    modeButtonTextActive: {
      color:
        "#FFFFFF",

      fontWeight:
        "900",
    },

    /* =====================================================
       Agent Intro
    ===================================================== */

    agentIntro: {
      width:
        "100%",

      padding:
        12,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        10,

      backgroundColor:
        COLORS.primarySoft,

      borderWidth:
        1,

      borderColor:
        "#D7E6FF",

      borderRadius:
        15,
    },

    agentIntroIcon: {
      width:
        44,

      height:
        44,

      flexShrink:
        0,

      borderRadius:
        13,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#FFFFFF",
    },

    agentIntroText: {
      flex:
        1,

      alignItems:
        "flex-end",
    },

    agentTitle: {
      width:
        "100%",

      color:
        COLORS.text,

      fontSize:
        14,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    agentHint: {
      width:
        "100%",

      marginTop:
        3,

      color:
        COLORS.muted,

      fontSize:
        11.5,

      lineHeight:
        18,

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Agent Blocks
    ===================================================== */

    agentBlock: {
      width:
        "100%",

      marginTop:
        12,

      padding:
        12,

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        15,
    },

    blockHeader: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        7,
    },

    blockIcon: {
      width:
        32,

      height:
        32,

      borderRadius:
        10,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    blockTitle: {
      flex: 1,

      color:
        COLORS.text,

      fontSize:
        12.5,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    agentCodeBox: {
      width:
        "100%",

      minHeight:
        55,

      marginTop:
        11,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#F8FAFD",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        12,
    },

    agentCode: {
      color:
        COLORS.primary,

      fontSize:
        20,

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "ltr",

      letterSpacing:
        1,
    },

    agentMissing: {
      width:
        "100%",

      marginTop:
        8,

      color:
        COLORS.danger,

      fontSize:
        11,

      lineHeight:
        17,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    agentQrFrame: {
      width:
        230,

      height:
        230,

      marginTop:
        12,

      alignSelf:
        "center",

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        "#D7E6FF",

      borderRadius:
        18,
    },

    agentQrImage: {
      width:
        215,

      height:
        215,
    },

    /* =====================================================
       Actions
    ===================================================== */

    actions: {
      width:
        "100%",

      marginTop:
        17,
    },

    primaryButton: {
      width:
        "100%",

      minHeight:
        46,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        6,

      backgroundColor:
        COLORS.primary,

      borderRadius:
        13,
    },

    primaryButtonText: {
      color:
        "#FFFFFF",

      fontSize:
        13,

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    secondaryActions: {
      width:
        "100%",

      marginTop:
        9,

      flexDirection:
        "row-reverse",

      flexWrap:
        "wrap",

      gap:
        8,
    },

    secondaryButton: {
      flexGrow:
        1,

      minWidth:
        "30%",

      minHeight:
        42,

      paddingHorizontal:
        10,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        5,

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        12,
    },

    secondaryButtonText: {
      color:
        COLORS.primary,

      fontSize:
        11,

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Empty
    ===================================================== */

    emptyState: {
      minHeight:
        320,

      paddingHorizontal:
        20,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    emptyIcon: {
      width:
        62,

      height:
        62,

      borderRadius:
        19,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    emptyTitle: {
      marginTop:
        12,

      color:
        COLORS.text,

      fontSize:
        15,

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    emptyText: {
      maxWidth:
        290,

      marginTop:
        5,

      color:
        COLORS.muted,

      fontSize:
        12,

      lineHeight:
        19,

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    emptyButton: {
      minHeight:
        42,

      marginTop:
        15,

      paddingHorizontal:
        17,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        6,

      backgroundColor:
        COLORS.primary,

      borderRadius:
        12,
    },

    emptyButtonText: {
      color:
        "#FFFFFF",

      fontSize:
        12,

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },
  });