// src/screens/Profile.js

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";

import { AppHeader, } from "../shared/ui/layout";
import { AppCard } from "../shared/ui/primitives";

import {
  colors as themeColors,
  fontFamilies,
  radius,
  shadows,
  spacing,
  typography,
} from "../shared/theme";

import api from "../api/client";
import { disconnectFromAgent } from "../api/agent";

import { useAuth } from "../context/AuthProvider";
import { getAccessToken } from "../shared/storage/authStorage";

/* =========================================================
   Colors
========================================================= */

const COLOR = {
  primary: themeColors.brand.primary,
  primaryDark: themeColors.brand.primaryDark,

  text: themeColors.text.primary,
  muted: themeColors.text.muted,

  line: themeColors.border.default,

  white: "#FFFFFF",
  page: "#F7F9FC",
  soft: "#F4F7FB",
  input: "#F8FAFC",

  danger: themeColors.status.danger,
  success: themeColors.status.success,
};

/* =========================================================
   Responsive
========================================================= */

const BASE_W = 390;
const BASE_H = 844;

/* =========================================================
   Screen
========================================================= */

export default function Profile({ navigation }) {
  const { signOut } = useAuth();

  const insets = useSafeAreaInsets();

  const { t } = useTranslation();

  const { width: W, height: H } = useWindowDimensions();

  const sx = useCallback(
    (n) => (W / BASE_W) * n,
    [W]
  );

  const sy = useCallback(
    (n) => (H / BASE_H) * n,
    [H]
  );

  const NAV_HEIGHT = sy(64);

  const contentPadBottom =
    NAV_HEIGHT +
    insets.bottom +
    sy(28);

  /* =======================================================
     UI state
  ======================================================= */

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [editMode, setEditMode] =
    useState(false);

  const [dirty, setDirty] =
    useState(false);

  /* =======================================================
     Server data
  ======================================================= */

  const [raw, setRaw] =
    useState(null);

  /* =======================================================
     Profile fields
  ======================================================= */

  const [first, setFirst] =
    useState("");

  const [last, setLast] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [userName, setUserName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [country, setCountry] =
    useState("");

  const [
    optionalPhone,
    setOptionalPhone,
  ] = useState("");

  /* =======================================================
     Password fields
  ======================================================= */

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    changingPassword,
    setChangingPassword,
  ] = useState(false);

  const [
    deletingAccount,
    setDeletingAccount,
  ] = useState(false);

  /* =======================================================
     Sizes
  ======================================================= */

  const GAP = sy(12);
  const R = sx(18);

  /* =======================================================
     User assignment
  ======================================================= */

  const assignFromUser = useCallback((u) => {
    const full =
      u?.full_name || "";

    const parts =
      full.trim().split(" ");

    setFirst(
      parts[0] || ""
    );

    setLast(
      parts.length > 1
        ? parts
            .slice(1)
            .join(" ")
        : ""
    );

    setEmail(
      u?.email || ""
    );

    setUserName(
      u?.name || ""
    );

    setPhone(
      u?.phone || ""
    );

    setCountry(
      u?.country || ""
    );

    setOptionalPhone(
      u?.optional_phone || ""
    );
  }, []);

  /* =======================================================
     Load Profile
  ======================================================= */

  const fetchProfile =
    useCallback(async () => {
      try {
        setError("");

        const token =
          await getAccessToken();

        if (!token) {
          throw new Error(
            "NO_TOKEN"
          );
        }

        const res =
          await api.get(
            "/users/me/",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const user =
          res.data || {};

        setRaw(user);

        assignFromUser(
          user
        );
      } catch (e) {
        if (
          e?.message ===
            "NO_TOKEN" ||
          e?.response?.status ===
            401
        ) {
          await signOut();

          Alert.alert(
            t(
              "common.system",
              "النظام"
            ),
            t(
              "menu.logoutBody",
              "يرجى تسجيل الدخول من جديد."
            )
          );

          navigation.reset({
            index: 0,
            routes: [
              {
                name: "Login",
              },
            ],
          });

          return;
        }

        setError(
          e?.response?.data
            ?.error ||
            t(
              "wallet.errors.load",
              "تعذر تحميل بيانات الحساب."
            )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, [
      assignFromUser,
      navigation,
      signOut,
      t,
    ]);

  useEffect(() => {
    setLoading(true);

    fetchProfile();
  }, [fetchProfile]);

  /* =======================================================
     Field changes
  ======================================================= */

  const onField =
    (setter) =>
    (value) => {
      setter(value);
      setDirty(true);
    };

  /* =======================================================
     Refresh
  ======================================================= */

  const onRefresh =
    async () => {
      setRefreshing(true);

      await fetchProfile();

      setDirty(false);
    };

  /* =======================================================
     Edit mode
  ======================================================= */

  const toggleEditMode =
    () => {
      if (editMode) {
        // عند الإلغاء نرجع البيانات الأصلية
        if (raw) {
          assignFromUser(
            raw
          );
        }

        setDirty(false);
        setEditMode(false);

        return;
      }

      setEditMode(true);
    };

  /* =======================================================
     Validators
  ======================================================= */

  const isEmailValid = (v) =>
    !v ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      v
    );

  const isPhoneValid = (v) =>
    !v ||
    /^[0-9+\-()\s]{6,}$/.test(
      v
    );

  /* =======================================================
     Save Profile
  ======================================================= */

  const onSave = async () => {
    if (
      !isEmailValid(email)
    ) {
      Alert.alert(
        t(
          "common.system",
          "تنبيه"
        ),
        t(
          "profile.invalidEmail",
          "يرجى إدخال بريد إلكتروني صحيح."
        )
      );

      return;
    }

    if (
      !isPhoneValid(phone)
    ) {
      Alert.alert(
        t(
          "common.system",
          "تنبيه"
        ),
        t(
          "profile.invalidPhone",
          "يرجى إدخال رقم هاتف صحيح."
        )
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        full_name: [
          first.trim(),
          last.trim(),
        ]
          .filter(Boolean)
          .join(" "),

        name:
          userName.trim(),

        email:
          email.trim(),

        phone:
          phone.trim(),

        country:
          country.trim(),

        optional_phone:
          optionalPhone.trim(),
      };

      const { data } =
        await api.patch(
          "/users/me/",
          payload
        );

      setRaw(data);

      assignFromUser(
        data
      );

      setDirty(false);
      setEditMode(false);

      Alert.alert(
        t(
          "common.ok",
          "تم"
        ),
        t(
          "profile.saved",
          "تم تحديث بيانات الحساب بنجاح."
        )
      );
    } catch (e) {
      const responseData =
        e?.response?.data;

      const message =
        responseData?.detail ||
        responseData?.error ||
        Object.values(
          responseData || {}
        )
          .flat()
          .join(", ") ||
        t(
          "profile.saveFailed",
          "تعذر تحديث بيانات الحساب."
        );

      Alert.alert(
        t(
          "common.error",
          "خطأ"
        ),
        String(message)
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     Disconnect Agent
  ======================================================= */

  const onDisconnectAgent =
    async () => {
      Alert.alert(
        t(
          "agents.disconnectTitle",
          "فصل الوكيل؟"
        ),

        t(
          "agents.disconnectBody",
          "سيتم إلغاء ربط حسابك بالوكيل الحالي."
        ),

        [
          {
            text: t(
              "common.cancel",
              "إلغاء"
            ),

            style: "cancel",
          },

          {
            text: t(
              "agents.disconnectCta",
              "فصل الوكيل"
            ),

            style:
              "destructive",

            onPress:
              async () => {
                try {
                  await disconnectFromAgent();

                  await fetchProfile();

                  Alert.alert(
                    t(
                      "common.ok",
                      "تم"
                    ),
                    t(
                      "agents.disconnected",
                      "تم فصل الوكيل بنجاح."
                    )
                  );
                } catch (e) {
                  const msg =
                    e?.response
                      ?.data
                      ?.error ||
                    e?.message ||
                    "تعذر فصل الوكيل.";

                  Alert.alert(
                    t(
                      "common.error",
                      "خطأ"
                    ),
                    String(msg)
                  );
                }
              },
          },
        ]
      );
    };

  /* =======================================================
     Change Password

     قواعد كلمة المرور نفسها من الـBackend.
     هنا فقط نتأكد أن الحقول ليست فارغة.
  ======================================================= */

  const onChangePassword =
    async () => {
      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        Alert.alert(
          t(
            "common.error",
            "تنبيه"
          ),
          t(
            "profile.passwordValidation",
            "يرجى تعبئة جميع حقول كلمة المرور."
          )
        );

        return;
      }

      try {
        setChangingPassword(
          true
        );

        await api.post(
          "/users/password-change/",
          {
            current_password:
              currentPassword,

            new_password:
              newPassword,

            confirm_password:
              confirmPassword,
          }
        );

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        Alert.alert(
          t(
            "common.ok",
            "تم"
          ),
          t(
            "profile.passwordChanged",
            "تم تغيير كلمة المرور. يرجى تسجيل الدخول من جديد."
          ),
          [
            {
              text: t(
                "auth.login",
                "تسجيل الدخول"
              ),

              onPress:
                async () => {
                  await signOut();

                  navigation.reset(
                    {
                      index: 0,
                      routes: [
                        {
                          name:
                            "Login",
                        },
                      ],
                    }
                  );
                },
            },
          ]
        );
      } catch (e) {
        const data =
          e?.response?.data;

        const message =
          data?.message?.ar ||
          data?.message?.en ||
          data?.detail ||
          data?.error ||
          t(
            "profile.passwordChangeFailed",
            "تعذر تغيير كلمة المرور."
          );

        Alert.alert(
          t(
            "common.error",
            "خطأ"
          ),
          String(message)
        );
      } finally {
        setChangingPassword(
          false
        );
      }
    };

  /* =======================================================
     Delete Account
  ======================================================= */

  const onDeleteAccount =
    async () => {
      if (
        deletingAccount
      ) {
        return;
      }

      Alert.alert(
        t(
          "profile.deleteTitle",
          "حذف الحساب؟"
        ),

        t(
          "profile.deleteBody",
          "هذا الإجراء نهائي وسيؤدي إلى حذف حسابك."
        ),

        [
          {
            text: t(
              "common.cancel",
              "إلغاء"
            ),

            style: "cancel",
          },

          {
            text: t(
              "profile.deleteCta",
              "حذف الحساب"
            ),

            style:
              "destructive",

            onPress:
              async () => {
                if (
                  deletingAccount
                ) {
                  return;
                }

                setDeletingAccount(
                  true
                );

                try {
                  const token =
                    await getAccessToken();

                  await api.delete(
                    "/users/me/delete/",
                    {
                      headers: {
                        Authorization:
                          `Bearer ${token}`,
                      },
                    }
                  );

                  await signOut();

                  navigation.reset(
                    {
                      index: 0,

                      routes: [
                        {
                          name:
                            "Login",
                        },
                      ],
                    }
                  );
                } catch (e) {
                  const msg =
                    e?.response
                      ?.data
                      ?.error ||
                    e?.message ||
                    "تعذر حذف الحساب.";

                  Alert.alert(
                    t(
                      "common.error",
                      "خطأ"
                    ),
                    String(msg)
                  );
                } finally {
                  setDeletingAccount(
                    false
                  );
                }
              },
          },
        ]
      );
    };

  /* =======================================================
     Profile header data
  ======================================================= */

  const displayName =
    raw?.full_name ||
    userName ||
    t(
      "menu.userName",
      "المستخدم"
    );

  const displaySubtitle =
    email ||
    phone ||
    userName ||
    "";

  /* =======================================================
     Agent Card
  ======================================================= */

  const AgentCard = () => {
    const agent =
      raw?.connected_agent;

    if (!agent) {
      return null;
    }

    const copy =
      async () => {
        if (
          agent.agent_code
        ) {
          await Clipboard.setStringAsync(
            agent.agent_code
          );

          Alert.alert(
            t(
              "common.ok",
              "تم"
            ),
            t(
              "profile.copied",
              "تم نسخ رمز الوكيل."
            )
          );
        }
      };

    return (
      <AppCard
        soft
        style={[
          styles.card,
          {
            borderRadius: R,
            marginBottom: GAP,
          },
        ]}
      >
        <SectionTitle
          icon="people-outline"
          title={t(
            "profile.connectedAgent",
            "الوكيل المرتبط"
          )}
          sx={sx}
        />

        <InfoRow
          label={t(
            "profile.agentName",
            "اسم الوكيل"
          )}
          value={
            agent.full_name ||
            agent.name ||
            "—"
          }
        />

        <View
          style={
            styles.divider
          }
        />

        <View
          style={
            styles.agentCodeRow
          }
        >
          <View
            style={{
              flex: 1,
              alignItems:
                "flex-end",
            }}
          >
            <Text
              style={
                styles.smallLabel
              }
            >
              {t(
                "profile.agentCode",
                "رمز الوكيل"
              )}
            </Text>

            <Text
              style={
                styles.codeText
              }
            >
              {agent.agent_code ||
                "—"}
            </Text>
          </View>

          {!!agent.agent_code && (
            <Pressable
              onPress={copy}
              style={
                styles.copyButton
              }
            >
              <Ionicons
                name="copy-outline"
                size={18}
                color={
                  COLOR.primary
                }
              />

              <Text
                style={
                  styles.copyButtonText
                }
              >
                {t(
                  "profile.copy",
                  "نسخ"
                )}
              </Text>
            </Pressable>
          )}
        </View>
      </AppCard>
    );
  };

  /* =======================================================
     Wallet Card
  ======================================================= */

  const WalletCard = () => {
    const balances =
      raw?.balances || {};

    const entries =
      Object.entries(
        balances
      );

    if (!entries.length) {
      return null;
    }

    return (
      <AppCard
        soft
        style={[
          styles.card,
          {
            borderRadius: R,
            marginBottom: GAP,
          },
        ]}
      >
        <SectionTitle
          icon="wallet-outline"
          title={t(
            "profile.walletBalances",
            "رصيد المحفظة"
          )}
          sx={sx}
        />

        <View
          style={{
            gap: sy(8),
          }}
        >
          {entries.map(
            ([cur, val]) => (
              <View
                key={cur}
                style={
                  styles.balanceRow
                }
              >
                <Text
                  style={
                    styles.balanceCurrency
                  }
                >
                  {cur}
                </Text>

                <Text
                  style={
                    styles.balanceValue
                  }
                >
                  {Number(
                    val
                  ).toFixed(2)}{" "}
                  {cur}
                </Text>
              </View>
            )
          )}
        </View>
      </AppCard>
    );
  };

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="menu"
      withSideMenu
    >
      {/* Decorative background */}

      <View
        pointerEvents="none"
        style={
          styles.spinnerBg
        }
      >
        <CornerSpinner
          size={sx(800)}
          image={require("../assets/home-corner.png")}
          speedMs={16000}
          opacity={0.55}
        />
      </View>

      <KeyboardAvoidingView
        behavior={
          Platform.OS ===
          "ios"
            ? "padding"
            : undefined
        }
        style={{
          flex: 1,
          backgroundColor:
            COLOR.page,
        }}
      >
        <AppHeader
          title={t(
            "profile.title",
            "الملف الشخصي"
          )}
        />

        {loading ? (
          <View
            style={[
              styles.loadingContainer,
              {
                paddingBottom:
                  contentPadBottom,
              },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={
                COLOR.primary
              }
            />

            <Text
              style={[
                styles.loadingText,
                {
                  marginTop:
                    sy(10),
                },
              ]}
            >
              {t(
                "common.loading",
                "جاري التحميل..."
              )}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{
              flex: 1,
            }}
            contentContainerStyle={{
              paddingHorizontal:
                sx(16),

              paddingTop:
                sy(14),

              paddingBottom:
                contentPadBottom,
            }}
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  onRefresh
                }
                tintColor={
                  COLOR.primary
                }
              />
            }
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
          >
            {/* ===============================================
                Profile Summary
            =============================================== */}

            <View
              style={[
                styles.profileHero,
                {
                  borderRadius:
                    sx(22),

                  padding:
                    sx(16),
                },
              ]}
            >
              <View
                style={[
                  styles.avatarContainer,
                  {
                    width:
                      sx(72),

                    height:
                      sx(72),

                    borderRadius:
                      sx(36),
                  },
                ]}
              >
                <Image
                  source={require("../assets/icons/user.png")}
                  resizeMode="contain"
                  style={{
                    width:
                      sx(38),

                    height:
                      sx(38),

                    tintColor:
                      COLOR.primary,
                  }}
                />
              </View>

              <View
                style={
                  styles.profileHeroInfo
                }
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.profileName,
                    {
                      fontSize:
                        sx(19),
                    },
                  ]}
                >
                  {displayName}
                </Text>

                {!!displaySubtitle && (
                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.profileSubtitle,
                      {
                        fontSize:
                          sx(13),
                      },
                    ]}
                  >
                    {
                      displaySubtitle
                    }
                  </Text>
                )}
              </View>

              <Pressable
                onPress={
                  toggleEditMode
                }
                style={[
                  styles.editButton,
                  editMode &&
                    styles.editButtonCancel,
                ]}
              >
                <Ionicons
                  name={
                    editMode
                      ? "close-outline"
                      : "create-outline"
                  }
                  size={20}
                  color={
                    editMode
                      ? "#B54708"
                      : COLOR.primary
                  }
                />
              </Pressable>
            </View>

            {/* ===============================================
                Error
            =============================================== */}

            {!!error && (
              <View
                style={
                  styles.errorCard
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={
                    COLOR.danger
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

            {/* ===============================================
                Wallet + Agent
            =============================================== */}

            <WalletCard />

            <AgentCard />

            {/* ===============================================
                Personal Information
            =============================================== */}

            <AppCard
              style={[
                styles.card,
                {
                  borderRadius:
                    R,
                },
              ]}
            >
              <SectionTitle
                icon="person-outline"
                title={t(
                  "profile.personalInfo",
                  "المعلومات الشخصية"
                )}
                sx={sx}
              />

              <Field
                label={t(
                  "profile.firstName",
                  "الاسم"
                )}
                value={first}
                onChangeText={onField(
                  setFirst
                )}
                placeholder={t(
                  "profile.firstName",
                  "الاسم"
                )}
                icon="person-outline"
                sx={sx}
                sy={sy}
                editable={
                  editMode
                }
              />

              <Field
                label={t(
                  "profile.lastName",
                  "الكنية"
                )}
                value={last}
                onChangeText={onField(
                  setLast
                )}
                placeholder={t(
                  "profile.lastName",
                  "الكنية"
                )}
                icon="person-outline"
                sx={sx}
                sy={sy}
                editable={
                  editMode
                }
              />

              <Field
                label={t(
                  "profile.email",
                  "البريد الإلكتروني"
                )}
                value={email}
                onChangeText={onField(
                  setEmail
                )}
                placeholder="name@gmail.com"
                keyboardType="email-address"
                icon="mail-outline"
                sx={sx}
                sy={sy}
                editable={
                  editMode
                }
                ltr
                invalid={
                  !isEmailValid(
                    email
                  )
                }
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Field
                label={t(
                  "profile.userName",
                  "اسم المستخدم"
                )}
                value={userName}
                onChangeText={() => {}}
                placeholder={t(
                  "profile.userName",
                  "اسم المستخدم"
                )}
                icon="at-outline"
                sx={sx}
                sy={sy}
                editable={false}
                ltr
              />

              <Field
                label={t(
                  "profile.phone",
                  "رقم الهاتف"
                )}
                value={phone}
                onChangeText={onField(
                  setPhone
                )}
                placeholder="+963..."
                keyboardType="phone-pad"
                icon="call-outline"
                sx={sx}
                sy={sy}
                editable={
                  editMode
                }
                ltr
                invalid={
                  !isPhoneValid(
                    phone
                  )
                }
              />

              <Field
                label={t(
                  "profile.country",
                  "الدولة"
                )}
                value={country}
                onChangeText={onField(
                  setCountry
                )}
                placeholder={t(
                  "profile.country",
                  "الدولة"
                )}
                icon="location-outline"
                sx={sx}
                sy={sy}
                editable={
                  editMode
                }
              />

              <Field
                label={t(
                  "profile.optionalPhone",
                  "رقم هاتف إضافي"
                )}
                value={
                  optionalPhone
                }
                onChangeText={onField(
                  setOptionalPhone
                )}
                placeholder="+963..."
                keyboardType="phone-pad"
                icon="phone-portrait-outline"
                sx={sx}
                sy={sy}
                editable={
                  editMode
                }
                ltr
              />

              {editMode && (
                <View
                  style={
                    styles.editActions
                  }
                >
                  <Pressable
                    onPress={
                      onSave
                    }
                    disabled={
                      !dirty ||
                      saving
                    }
                    style={[
                      styles.primaryButton,
                      {
                        opacity:
                          !dirty ||
                          saving
                            ? 0.5
                            : 1,
                      },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <Ionicons
                        name="checkmark-outline"
                        size={21}
                        color="#FFFFFF"
                      />
                    )}

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      {saving
                        ? t(
                            "profile.saving",
                            "جاري الحفظ..."
                          )
                        : t(
                            "profile.save",
                            "حفظ التغييرات"
                          )}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={
                      toggleEditMode
                    }
                    disabled={
                      saving
                    }
                    style={
                      styles.secondaryButton
                    }
                  >
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      {t(
                        "common.cancel",
                        "إلغاء"
                      )}
                    </Text>
                  </Pressable>
                </View>
              )}
            </AppCard>

            {/* ===============================================
                Password
            =============================================== */}

            <AppCard
              style={[
                styles.card,
                {
                  borderRadius:
                    R,
                },
              ]}
            >
              <SectionTitle
                icon="lock-closed-outline"
                title={t(
                  "profile.changePassword",
                  "تغيير كلمة المرور"
                )}
                sx={sx}
              />

              <Text
                style={
                  styles.sectionDescription
                }
              >
                {t(
                  "profile.passwordDescription",
                  "يمكنك تغيير كلمة المرور الخاصة بحسابك."
                )}
              </Text>

              <Field
                label={t(
                  "profile.currentPassword",
                  "كلمة المرور الحالية"
                )}
                value={
                  currentPassword
                }
                onChangeText={
                  setCurrentPassword
                }
                placeholder="••••••••"
                icon="lock-closed-outline"
                sx={sx}
                sy={sy}
                secureTextEntry
                editable
              />

              <Field
                label={t(
                  "profile.newPassword",
                  "كلمة المرور الجديدة"
                )}
                value={
                  newPassword
                }
                onChangeText={
                  setNewPassword
                }
                placeholder="••••••••"
                icon="key-outline"
                sx={sx}
                sy={sy}
                secureTextEntry
                editable
              />

              <Field
                label={t(
                  "profile.confirmPassword",
                  "تأكيد كلمة المرور"
                )}
                value={
                  confirmPassword
                }
                onChangeText={
                  setConfirmPassword
                }
                placeholder="••••••••"
                icon="checkmark-circle-outline"
                sx={sx}
                sy={sy}
                secureTextEntry
                editable
              />

              <Pressable
                onPress={
                  onChangePassword
                }
                disabled={
                  changingPassword
                }
                style={[
                  styles.primaryButton,
                  {
                    marginTop:
                      sy(8),

                    opacity:
                      changingPassword
                        ? 0.6
                        : 1,
                  },
                ]}
              >
                {changingPassword ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                )}

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  {changingPassword
                    ? t(
                        "profile.saving",
                        "جاري الحفظ..."
                      )
                    : t(
                        "profile.changePassword",
                        "تغيير كلمة المرور"
                      )}
                </Text>
              </Pressable>
            </AppCard>

            {/* ===============================================
                Connected Agent Action
            =============================================== */}

            {!!raw?.connected_agent && (
              <Pressable
                onPress={
                  onDisconnectAgent
                }
                style={
                  styles.warningButton
                }
              >
                <Ionicons
                  name="unlink-outline"
                  size={20}
                  color="#B54708"
                />

                <Text
                  style={
                    styles.warningButtonText
                  }
                >
                  {t(
                    "agents.disconnectCta",
                    "فصل الوكيل"
                  )}
                </Text>
              </Pressable>
            )}

            {/* ===============================================
                Danger Zone
            =============================================== */}

            <View
              style={[
                styles.dangerZone,
                {
                  borderRadius:
                    R,
                },
              ]}
            >
              <View
                style={
                  styles.dangerHeader
                }
              >
                <Ionicons
                  name="warning-outline"
                  size={21}
                  color={
                    COLOR.danger
                  }
                />

                <Text
                  style={
                    styles.dangerTitle
                  }
                >
                  {t(
                    "profile.accountActions",
                    "إدارة الحساب"
                  )}
                </Text>
              </View>

              <Text
                style={
                  styles.dangerDescription
                }
              >
                {t(
                  "profile.deleteDescription",
                  "حذف الحساب إجراء نهائي ولا يمكن التراجع عنه."
                )}
              </Text>

              <Pressable
                onPress={
                  onDeleteAccount
                }
                disabled={
                  deletingAccount
                }
                style={[
                  styles.deleteButton,
                  {
                    opacity:
                      deletingAccount
                        ? 0.6
                        : 1,
                  },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={
                    COLOR.danger
                  }
                />

                <Text
                  style={
                    styles.deleteButtonText
                  }
                >
                  {deletingAccount
                    ? t(
                        "common.loading",
                        "جاري الحذف..."
                      )
                    : t(
                        "profile.delete",
                        "حذف الحساب"
                      )}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </PageLayout>
  );
}

/* =========================================================
   Section Title
========================================================= */

function SectionTitle({
  title,
  icon,
  sx,
}) {
  return (
    <View
      style={
        styles.sectionTitleRow
      }
    >
      <View
        style={[
          styles.sectionIcon,
          {
            width:
              sx(36),

            height:
              sx(36),

            borderRadius:
              sx(11),
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={sx(19)}
          color={
            COLOR.primary
          }
        />
      </View>

      <Text
        style={[
          styles.sectionTitle,
          {
            fontSize:
              sx(17),
          },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

/* =========================================================
   Field
========================================================= */

function Field({
  label,
  value,
  onChangeText,
  placeholder,

  keyboardType = "default",

  icon = "create-outline",

  sx,
  sy,

  editable = true,

  secureTextEntry = false,

  ltr = false,

  invalid = false,

  autoCapitalize = "sentences",
  autoCorrect = true,
}) {
  return (
    <View
      style={{
        width: "100%",

        marginBottom:
          sy(12),
      }}
    >
      <Text
        style={[
          styles.fieldLabel,
          {
            fontSize:
              sx(13),

            marginBottom:
              sy(6),
          },
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.fieldPill,
          {
            height:
              sy(50),

            borderRadius:
              sx(15),

            paddingHorizontal:
              sx(13),

            borderColor:
              invalid
                ? "#FFB3B3"
                : COLOR.line,

            opacity:
              editable
                ? 1
                : 0.72,
          },
        ]}
      >
        {/* Icon is on the right */}

        <Ionicons
          name={icon}
          size={sx(19)}
          color={
            editable
              ? COLOR.primary
              : COLOR.muted
          }
        />

        <TextInput
          value={value}
          onChangeText={
            onChangeText
          }
          placeholder={
            placeholder
          }
          placeholderTextColor="#95A2B5"
          keyboardType={
            keyboardType
          }
          secureTextEntry={
            secureTextEntry
          }
          editable={
            editable
          }
          autoCapitalize={
            autoCapitalize
          }
          autoCorrect={
            autoCorrect
          }
          style={[
            styles.fieldInput,
            {
              fontSize:
                sx(15),

              marginRight:
                sx(10),

              /*
               * مكان الحقل دائماً من اليمين.
               *
               * لكن email / phone تبقى LTR
               * حتى ما تنقلب الأحرف والأرقام.
               */
              textAlign:
                "right",

              writingDirection:
                ltr
                  ? "ltr"
                  : "rtl",
            },
          ]}
        />
      </View>

      {invalid && (
        <Text
          style={[
            styles.invalidText,
            {
              marginTop:
                sy(4),
            },
          ]}
        >
          يرجى التحقق من القيمة المدخلة
        </Text>
      )}
    </View>
  );
}

/* =========================================================
   Info Row
========================================================= */

function InfoRow({
  label,
  value,
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <Text
        style={
          styles.infoLabel
        }
      >
        {label}
      </Text>

      <Text
        numberOfLines={1}
        style={
          styles.infoValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   Styles
========================================================= */

const styles =
  StyleSheet.create({
    /* =====================================================
       Loading
    ===================================================== */

    loadingContainer: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    loadingText: {
      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        typography.body.fontSize,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Hero
    ===================================================== */

    profileHero: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      marginBottom:
        14,

      ...shadows.soft,
    },

    avatarContainer: {
      backgroundColor:
        "#EEF4FF",

      borderWidth:
        1,

      borderColor:
        "#D8E6FA",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    profileHeroInfo: {
      flex:
        1,

      marginHorizontal:
        13,

      alignItems:
        "flex-end",
    },

    profileName: {
      width:
        "100%",

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    profileSubtitle: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      marginTop:
        4,

      textAlign:
        "right",
    },

    editButton: {
      width:
        42,

      height:
        42,

      borderRadius:
        13,

      backgroundColor:
        "#EEF4FF",

      alignItems:
        "center",

      justifyContent:
        "center",

      borderWidth:
        1,

      borderColor:
        "#D8E6FA",
    },

    editButtonCancel: {
      backgroundColor:
        "#FFF7ED",

      borderColor:
        "#FED7AA",
    },

    /* =====================================================
       Error
    ===================================================== */

    errorCard: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        8,

      backgroundColor:
        "#FFF3F3",

      borderWidth:
        1,

      borderColor:
        "#FFD6D6",

      padding:
        12,

      borderRadius:
        14,

      marginBottom:
        12,
    },

    errorText: {
      flex:
        1,

      color:
        COLOR.danger,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Cards
    ===================================================== */

    card: {
      padding:
        spacing.md,

      marginBottom:
        spacing.md,

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      ...shadows.soft,
    },

    /* =====================================================
       Section titles
    ===================================================== */

    sectionTitleRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      marginBottom:
        16,
    },

    sectionIcon: {
      backgroundColor:
        "#EEF4FF",

      alignItems:
        "center",

      justifyContent:
        "center",

      marginLeft:
        10,
    },

    sectionTitle: {
      flex:
        1,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    sectionDescription: {
      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        13,

      lineHeight:
        20,

      marginTop:
        -6,

      marginBottom:
        14,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Fields
    ===================================================== */

    fieldLabel: {
      width:
        "100%",

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    fieldPill: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      backgroundColor:
        COLOR.input,

      borderWidth:
        1,

      ...shadows.soft,
    },

    fieldInput: {
      flex:
        1,

      height:
        "100%",

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "600",

      paddingVertical:
        0,
    },

    invalidText: {
      color:
        COLOR.danger,

      fontSize:
        11,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Buttons
    ===================================================== */

    editActions: {
      marginTop:
        4,

      gap:
        9,
    },

    primaryButton: {
      minHeight:
        48,

      flexDirection:
        "row-reverse",

      gap:
        8,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primary,

      borderRadius:
        15,

      paddingHorizontal:
        18,

      ...shadows.soft,
    },

    primaryButtonText: {
      color:
        "#FFFFFF",

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "800",

      fontSize:
        15,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    secondaryButton: {
      minHeight:
        44,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#F3F6FA",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        15,
    },

    secondaryButtonText: {
      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    warningButton: {
      minHeight:
        48,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        8,

      backgroundColor:
        "#FFF7ED",

      borderWidth:
        1,

      borderColor:
        "#FED7AA",

      borderRadius:
        16,

      marginBottom:
        14,

      paddingHorizontal:
        16,
    },

    warningButtonText: {
      color:
        "#B54708",

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Agent
    ===================================================== */

    infoRow: {
      flexDirection:
        "row-reverse",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      gap:
        10,
    },

    infoLabel: {
      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    infoValue: {
      flex:
        1,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "800",

      textAlign:
        "left",
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLOR.line,

      marginVertical:
        12,
    },

    agentCodeRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        12,
    },

    smallLabel: {
      color:
        COLOR.muted,

      fontSize:
        12,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    codeText: {
      color:
        COLOR.text,

      fontWeight:
        "800",

      marginTop:
        3,

      textAlign:
        "right",

      writingDirection:
        "ltr",
    },

    copyButton: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        5,

      paddingHorizontal:
        11,

      paddingVertical:
        8,

      backgroundColor:
        "#EEF4FF",

      borderWidth:
        1,

      borderColor:
        "#D8E6FA",

      borderRadius:
        11,
    },

    copyButtonText: {
      color:
        COLOR.primary,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "700",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Wallet
    ===================================================== */

    balanceRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      backgroundColor:
        COLOR.soft,

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        13,

      paddingHorizontal:
        13,

      paddingVertical:
        11,
    },

    balanceCurrency: {
      color:
        COLOR.text,

      fontWeight:
        "800",

      writingDirection:
        "ltr",
    },

    balanceValue: {
      color:
        COLOR.primary,

      fontWeight:
        "900",

      writingDirection:
        "ltr",

      textAlign:
        "left",
    },

    /* =====================================================
       Danger Zone
    ===================================================== */

    dangerZone: {
      backgroundColor:
        "#FFF8F8",

      borderWidth:
        1,

      borderColor:
        "#FFDADA",

      padding:
        16,

      marginTop:
        4,

      marginBottom:
        12,
    },

    dangerHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        8,
    },

    dangerTitle: {
      flex:
        1,

      color:
        COLOR.danger,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        16,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    dangerDescription: {
      color:
        COLOR.muted,

      fontSize:
        13,

      lineHeight:
        20,

      marginTop:
        8,

      marginBottom:
        12,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    deleteButton: {
      minHeight:
        45,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        7,

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        "#FFCCCC",

      borderRadius:
        14,
    },

    deleteButtonText: {
      color:
        COLOR.danger,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Spinner
    ===================================================== */

    spinnerBg: {
      position:
        "absolute",

      top:
        0,

      left:
        0,

      right:
        0,

      height:
        0,
    },
  });