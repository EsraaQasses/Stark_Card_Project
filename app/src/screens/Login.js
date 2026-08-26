import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useState } from "react";

import {
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getMe,
  login,
} from "../api/auth";

import { useAuth } from "../context/AuthProvider";
import { normalizeApiError } from "../shared/api/errors/apiError";

import Button from "../ui/Button";
import Screen from "../ui/Screen";

import {
  colors as themeColors,
  typography,
} from "../ui/Theme";

import {
  sp,
  sx,
  sy,
} from "../ui/scale";

/* =========================================================
   Helpers
========================================================= */

export function normalizeApiErrors(
  data,
  status,
  fallbackMsg
) {
  const fields = {};
  const messages = [];

  if (!data) {
    if (status === 401) {
      messages.push(
        "اسم المستخدم أو كلمة المرور غير صحيحة."
      );
    } else if (status >= 500) {
      messages.push(
        "خطأ في الخادم. حاول مجدّدًا."
      );
    } else {
      messages.push(
        fallbackMsg ||
          "فشل تسجيل الدخول"
      );
    }

    return {
      fields,
      messages,
    };
  }

  if (
    typeof data.detail ===
    "string"
  ) {
    messages.push(
      data.detail
    );
  }

  if (
    Array.isArray(
      data.non_field_errors
    )
  ) {
    messages.push(
      ...data.non_field_errors.map(
        String
      )
    );
  }

  const addField = (
    key,
    value
  ) => {
    const arr =
      Array.isArray(value)
        ? value
        : [value];

    fields[key] =
      arr.map((x) =>
        String(x)
      );
  };

  for (
    const key of
    Object.keys(data)
  ) {
    if (
      [
        "detail",
        "non_field_errors",
      ].includes(key)
    ) {
      continue;
    }

    const value =
      data[key];

    if (
      value != null &&
      (
        typeof value ===
          "string" ||
        Array.isArray(value)
      )
    ) {
      addField(
        key,
        value
      );
    }
  }

  if (
    status === 401 &&
    messages.length === 0
  ) {
    messages.push(
      "اسم المستخدم أو كلمة المرور غير صحيحة."
    );
  }

  if (
    messages.length === 0 &&
    Object.keys(fields)
      .length === 0
  ) {
    messages.push(
      typeof data ===
        "object"
        ? JSON.stringify(
            data
          )
        : String(data)
    );
  }

  return {
    fields,
    messages,
  };
}

/* =========================================================
   Screen
========================================================= */

export default function Login({
  navigation,
  onLoginSuccess,
  route,
}) {
  const {
    signIn,
  } = useAuth();

  const [
    userName,
    setUserName,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    show,
    setShow,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errBanner,
    setErrBanner,
  ] = useState([]);

  const [
    infoBanner,
    setInfoBanner,
  ] = useState([]);

  const [
    fieldErr,
    setFieldErr,
  ] = useState({});

  /* =======================================================
     Success message
  ======================================================= */

  React.useEffect(() => {
    const msg =
      route?.params
        ?.successMessage;

    if (msg) {
      setInfoBanner([
        msg,
      ]);
    }
  }, [
    route?.params
      ?.successMessage,
  ]);

  /* =======================================================
     Login
  ======================================================= */

  const canLogin =
    userName.trim()
      .length > 0 &&
    password.trim()
      .length > 0;

  const onLogin =
    async () => {
      if (
        loading ||
        !canLogin
      ) {
        return;
      }

      Keyboard.dismiss();

      setErrBanner([]);
      setInfoBanner([]);
      setFieldErr({});

      try {
        setLoading(true);

        const {
          access,
          refresh,
          user:
            userFromLogin,
        } = await login(
          userName.trim(),
          password
        );

        if (!access) {
          throw new Error(
            "استجابة غير صالحة من الخادم"
          );
        }

        let profile =
          userFromLogin ||
          null;

        if (!profile) {
          try {
            profile =
              await getMe();
          } catch {}
        }

        const signedUser =
          await signIn({
            access,
            refresh,
            profile,
          });

        if (
          onLoginSuccess
        ) {
          onLoginSuccess(
            signedUser
          );
        }
      } catch (error) {
        const isNetwork =
          String(
            error?.message ||
              ""
          )
            .toLowerCase()
            .includes(
              "network"
            );

        if (isNetwork) {
          setInfoBanner([
            "خطأ في الشبكة. تأكّد من اتصالك بالإنترنت ثم حاول مرة أخرى.",
          ]);
        } else {
          const normalized =
            normalizeApiError(
              error,
              "ar"
            );

          const status =
            normalized.status ??
            0;

          const fields =
            Object.fromEntries(
              Object.entries(
                normalized.fields ||
                  {}
              ).map(
                ([
                  key,
                  value,
                ]) => [
                  key,

                  (
                    Array.isArray(
                      value
                    )
                      ? value
                      : [value]
                  ).map(
                    String
                  ),
                ]
              )
            );

          const messages = [
            normalized.message,
          ].filter(
            Boolean
          );

          if (
            status === 400 ||
            status === 401 ||
            messages
              .join(" ")
              .toLowerCase()
              .includes(
                "password"
              )
          ) {
            fields.name =
              fields.name || [
                "تحقّق من اسم المستخدم.",
              ];

            fields.password =
              fields.password || [
                "تحقّق من كلمة المرور.",
              ];
          }

          setFieldErr(
            fields
          );

          setErrBanner(
            messages.length
              ? messages
              : [
                  "فشل تسجيل الدخول",
                ]
          );
        }
      } finally {
        setLoading(false);
      }
    };

  /* =======================================================
     Errors
  ======================================================= */

  const nameHasError =
    Boolean(
      fieldErr.name
        ?.length ||
        fieldErr.username
          ?.length
    );

  const passHasError =
    Boolean(
      fieldErr.password
        ?.length
    );

  /* =======================================================
     Render
  ======================================================= */

  return (
    <Screen>
      <View
        style={
          styles.page
        }
      >
        {/* =================================================
            Logo
        ================================================= */}

        <View
          style={
            styles.header
          }
        >
          <Image
            source={require("../assets/Logo.png")}
            style={
              styles.logo
            }
            resizeMode="contain"
          />
        </View>

        {/* =================================================
            Success banner
        ================================================= */}

        {infoBanner.length >
          0 && (
          <View
            style={
              styles.infoBanner
            }
          >
            {infoBanner.map(
              (
                message,
                index
              ) => (
                <Text
                  key={
                    index
                  }
                  style={
                    styles.infoBannerText
                  }
                >
                  {
                    message
                  }
                </Text>
              )
            )}
          </View>
        )}

        {/* =================================================
            Error banner
        ================================================= */}

        {errBanner.length >
          0 && (
          <View
            style={
              styles.errorBanner
            }
          >
            {errBanner.map(
              (
                message,
                index
              ) => (
                <Text
                  key={
                    index
                  }
                  style={
                    styles.errorBannerText
                  }
                >
                  {
                    message
                  }
                </Text>
              )
            )}
          </View>
        )}

        {/* =================================================
            Form
        ================================================= */}

        <View
          style={
            styles.form
          }
        >
          {/* Username */}

          <Text
            style={
              styles.label
            }
          >
            اسم المستخدم
          </Text>

          <TextInput
            style={[
              styles.input,

              nameHasError &&
                styles.inputError,
            ]}
            placeholder="اكتب اسم المستخدم"
            placeholderTextColor="rgba(0,0,0,0.45)"
            value={
              userName
            }
            onChangeText={
              setUserName
            }
            autoCapitalize="none"
            autoCorrect={
              false
            }
            returnKeyType="next"
            textAlign="right"
          />

          {nameHasError && (
            <Text
              style={
                styles.helpError
              }
            >
              {(
                fieldErr.name ||
                fieldErr.username ||
                []
              ).join(", ")}
            </Text>
          )}

          {/* Password */}

          <View
            style={
              styles.passwordBlock
            }
          >
            <Text
              style={
                styles.label
              }
            >
              كلمة المرور
            </Text>

            <View
              style={
                styles.passwordWrapper
              }
            >
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,

                  passHasError &&
                    styles.inputError,
                ]}
                placeholder="اكتب كلمة المرور"
                placeholderTextColor="rgba(0,0,0,0.45)"
                secureTextEntry={
                  !show
                }
                value={
                  password
                }
                onChangeText={
                  setPassword
                }
                returnKeyType="go"
                onSubmitEditing={
                  onLogin
                }
                textAlign="right"
                autoCapitalize="none"
              />

              {/* Eye on left */}

              <TouchableOpacity
                style={
                  styles.eye
                }
                onPress={() =>
                  setShow(
                    (current) =>
                      !current
                  )
                }
                hitSlop={{
                  top:
                    sy(8),

                  bottom:
                    sy(8),

                  left:
                    sx(8),

                  right:
                    sx(8),
                }}
                disabled={
                  loading
                }
              >
                <Ionicons
                  name={
                    show
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={
                    sp(18)
                  }
                  color="#0E1B3B"
                />
              </TouchableOpacity>
            </View>

            {passHasError && (
              <Text
                style={
                  styles.helpError
                }
              >
                {(
                  fieldErr.password ||
                  []
                ).join(", ")}
              </Text>
            )}

            {/* Forget password */}

            <TouchableOpacity
              style={
                styles.forgetPasswordContainer
              }
              onPress={() =>
                navigation.navigate(
                  "ForgetPassword"
                )
              }
              disabled={
                loading
              }
            >
              <Text
                style={
                  styles.forgetPasswordText
                }
              >
                نسيت كلمة المرور؟
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login */}

          <Button
            variant="auth"
            title="تسجيل الدخول"
            width={
              sx(226)
            }
            height={
              sy(52)
            }
            loading={
              loading
            }
            onPress={
              onLogin
            }
            disabled={
              !canLogin ||
              loading
            }
            contentStyle={
              styles.loginButtonContent
            }
            textStyle={
              styles.loginButtonText
            }
            style={{
              marginTop:
                sy(22),

              alignSelf:
                "center",

              opacity:
                canLogin &&
                !loading
                  ? 1
                  : 0.6,
            }}
          />
        </View>

        {/* =================================================
            OR
        ================================================= */}

        <View
          style={
            styles.orBlock
          }
        >
          <View
            style={
              styles.line
            }
          />

          <Text
            style={
              styles.orText
            }
          >
            أو
          </Text>

          <View
            style={
              styles.line
            }
          />
        </View>

        {/* =================================================
            Register
        ================================================= */}

        <Link
          href="/(auth)/signup"
          asChild
        >
          <TouchableOpacity
            disabled={
              loading
            }
          >
            <Text
              style={
                styles.register
              }
            >
              إنشاء حساب جديد
            </Text>
          </TouchableOpacity>
        </Link>

        {/* Footer */}

        <Text
          style={
            styles.footer
          }
        >
          ©2025 STARK-CARD
        </Text>
      </View>
    </Screen>
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

      width: "100%",

      direction:
        "rtl",
    },

    /* =====================================================
       Logo
    ===================================================== */

    header: {
      alignItems:
        "center",

      marginTop:
        sy(6),

      marginBottom:
        sy(2),
    },

    logo: {
      width:
        sx(370),

      height:
        sy(250),
    },

    /* =====================================================
       Info banner
    ===================================================== */

    infoBanner: {
      marginHorizontal:
        sx(16),

      marginTop:
        sy(6),

      paddingVertical:
        sy(10),

      paddingHorizontal:
        sx(12),

      backgroundColor:
        "#E8F2FF",

      /*
       * RTL:
       * العلامة على اليمين بدل اليسار.
       */

      borderRightWidth:
        4,

      borderRightColor:
        "#276EF1",

      borderRadius:
        sy(10),
    },

    infoBannerText: {
      color:
        "#0B3EA8",

      fontWeight:
        "700",

      fontSize:
        sp(12),

      marginBottom:
        sy(2),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Error banner
    ===================================================== */

    errorBanner: {
      marginHorizontal:
        sx(16),

      marginTop:
        sy(6),

      paddingVertical:
        sy(10),

      paddingHorizontal:
        sx(12),

      backgroundColor:
        "#FFE8E8",

      borderRightWidth:
        4,

      borderRightColor:
        "tomato",

      borderRadius:
        sy(10),
    },

    errorBannerText: {
      color:
        "#9B1C1C",

      fontWeight:
        "800",

      fontSize:
        sp(12),

      marginBottom:
        sy(2),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Form
    ===================================================== */

    form: {
      flex: 1,

      width: "100%",

      marginTop:
        sy(8),

      paddingHorizontal:
        sx(2),

      alignItems:
        "stretch",

      direction:
        "rtl",
    },

    label: {
      width:
        "100%",

      color:
        themeColors.textPrimary,

      opacity:
        0.9,

      marginBottom:
        sy(6),

      fontWeight:
        "700",

      fontSize:
        sp(14),

      paddingRight:
        sx(2),

      textAlign:
        "left",

      writingDirection:
        "rtl",
    },

    input: {
      width:
        "100%",

      height:
        sy(48),

      borderRadius:
        sy(18),

      paddingHorizontal:
        sx(16),

      color:
        "#000000",

      borderWidth:
        1,

      borderColor:
        "rgba(34,9,255,0.35)",

      backgroundColor:
        "rgba(255,255,255,0.8)",

      fontSize:
        sp(14),

      textAlign:
        "right",
    },

    inputError: {
      borderColor:
        "tomato",
    },

    helpError: {
      width:
        "100%",

      color:
        "tomato",

      marginTop:
        sy(4),

      paddingRight:
        sx(4),

      fontSize:
        sp(12),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Password
    ===================================================== */

    passwordBlock: {
      marginTop:
        sy(12),

      width:
        "100%",
    },

    passwordWrapper: {
      position:
        "relative",

      width:
        "100%",
    },

    /*
     * الأيقونة صارت عاليسار.
     * لذلك منترك مساحة من اليسار.
     */

    passwordInput: {
      paddingLeft:
        sx(50),

      paddingRight:
        sx(16),
    },

    eye: {
      position:
        "absolute",

      left:
        sx(6),

      top:
        sy(5),

      width:
        sy(38),

      height:
        sy(38),

      borderRadius:
        sy(19),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "rgba(11,99,216,0.08)",
    },

    /* =====================================================
       Forget password
    ===================================================== */

    forgetPasswordContainer: {
      alignSelf:
        "flex-end",

      marginTop:
        sy(8),

      marginRight:
        sx(4),
    },

    forgetPasswordText: {
      color:
        themeColors.textPrimary,

      fontWeight:
        "600",

      fontSize:
        sp(13),

      opacity:
        0.8,

      textDecorationLine:
        "underline",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Login Button
    ===================================================== */

    loginButtonContent: {
      borderRadius:
        sy(18),

      paddingHorizontal:
        sx(20),
    },

    loginButtonText: {
      fontSize:
        sp(16),

      lineHeight:
        sy(22),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       OR Divider
    ===================================================== */

    orBlock: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(8),

      width:
        "100%",

      marginBottom:
        sy(12),

      borderBottomWidth:
        0,
    },

    line: {
      flex: 1,

      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        "rgba(255,255,255,0.5)",
    },

    orText: {
      color:
        themeColors.textPrimary,

      fontWeight:
        "800",

      fontSize:
        sp(13),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Register
    ===================================================== */

    register: {
      color:
        themeColors.textPrimary,

      fontWeight:
        "800",

      textAlign:
        "center",

      writingDirection:
        "rtl",

      marginTop:
        sy(4),

      marginBottom:
        sy(15),

      fontSize:
        sp(14),
    },

    /* =====================================================
       Footer
    ===================================================== */

    footer: {
      textAlign:
        "center",

      color:
        themeColors.textPrimary,

      opacity:
        0.8,

      fontSize:
        typography.footer
          .fontSize,
    },
  });