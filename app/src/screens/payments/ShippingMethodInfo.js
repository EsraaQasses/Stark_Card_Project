// src/screens/payments/ShippingMethodInfo.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import PageLayout from "../../ui/PageLayout";
import CornerSpinner from "../../ui/CornerSpinner";
import { AppHeader } from "../../shared/ui/layout";

import {
  createDepositRequest,
  createAgentShippingRequest,
  createAgentAdminShippingRequest,
} from "../../api/deposits";

import { getWallet } from "../../api/wallets";
import { useAuth } from "../../context/AuthProvider";

import {
  listUserPaymentMethods,
} from "../../api/paymentMethods";

import {
  getCache,
  setCache,
  cacheKey,
} from "../../utils/cache";

/* =========================================================
   Constants
========================================================= */

const BASE_W = 390;
const BASE_H = 844;
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

function normalizeBool(value) {
  return (
    value === true ||
    String(value || "")
      .trim()
      .toLowerCase() === "true" ||
    String(value || "").trim() === "1"
  );
}

function normalizeCurrency(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getCurrencyLabel(currency) {
  const value =
    normalizeCurrency(currency);

  if (value === "USD") {
    return "دولار";
  }

  if (value === "SYP") {
    return "سوري";
  }

  return value || "—";
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

function getArabicError(
  error,
  fallback
) {
  const data =
    error?.response?.data ??
    error?.data ??
    error;

  if (
    data &&
    typeof data === "object"
  ) {
    const arabic =
      data?.message?.ar ||
      data?.error?.ar ||
      data?.detail?.ar ||
      data?.message_ar ||
      data?.error_ar ||
      data?.detail_ar;

    if (arabic) {
      return String(arabic);
    }

    const normal =
      data?.detail ||
      data?.error ||
      data?.message;

    if (
      typeof normal === "string" &&
      containsArabic(normal)
    ) {
      return normal;
    }
  }

  if (
    typeof data === "string" &&
    containsArabic(data)
  ) {
    return data;
  }

  return fallback;
}

function parseMethodParam(value) {
  if (!value) {
    return null;
  }

  /*
   * React Navigation ممكن يمرره object
   */
  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  /*
   * Expo Router بيمرره غالباً JSON string
   */
  if (typeof value === "string") {
    const text = value.trim();

    if (
      !text ||
      text === "[object Object]"
    ) {
      return null;
    }

    try {
      const parsed =
        JSON.parse(text);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function formatAmount(
  value,
  currency
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return normalizeCurrency(currency) ===
      "SYP"
      ? "0"
      : "0.00";
  }

  if (
    normalizeCurrency(currency) ===
    "SYP"
  ) {
    return Math.round(number)
      .toLocaleString("en-US");
  }

  return number.toFixed(2);
}

function formatInfoValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        formatInfoValue(item)
      )
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value === "object") {
    return Object.values(value)
      .map((item) =>
        formatInfoValue(item)
      )
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

/* =========================================================
   Screen
========================================================= */

export default function ShippingMethodInfo({
  navigation,
  route,
}) {
  const router = useRouter();

  const rawParams =
    route?.params || {};

  const { user } =
    useAuth() || {};

  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } = useWindowDimensions();

  const sx = useCallback(
    (n) =>
      (W / BASE_W) * n,
    [W]
  );

  const sy = useCallback(
    (n) =>
      (H / BASE_H) * n,
    [H]
  );

  const sp = useCallback(
    (n) =>
      n *
      Math.min(
        W / BASE_W,
        H / BASE_H
      ),
    [W, H]
  );

  /* =======================================================
     Route Params
  ======================================================= */

  const adminKey =
    rawParams?.adminKey ||
    null;

  const methodIdParam =
    rawParams?.methodId ??
    rawParams?.id ??
    null;

  const methodKey =
    String(
      rawParams?.methodKey ||
        ""
    ).trim();

  const methodNameParam =
    String(
      rawParams?.methodName ||
        ""
    ).trim();

  const methodTitleParam =
    String(
      rawParams?.methodTitle ||
        ""
    ).trim();

  const forceAgent =
    normalizeBool(
      rawParams?.forceAgent
    );

  const forceAdmin =
    normalizeBool(
      rawParams?.forceAdminShipping
    );

  const parsedMethod =
    useMemo(
      () =>
        parseMethodParam(
          rawParams?.method
        ),
      [rawParams?.method]
    );

  /* =======================================================
     Agent Method
  ======================================================= */

  const AGENT_METHOD =
    useMemo(
      () => ({
        id:
          parsedMethod?.id ||
          methodKey ||
          "agent-shipping",

        title:
          parsedMethod?.title ||
          methodTitleParam ||
          "شحن عبر الوكيل",

        name:
          parsedMethod?.name ||
          methodNameParam ||
          "agent_shipping",

        is_agent_shipping:
          true,

        requires_receipt:
          false,

        fields:
          Array.isArray(
            parsedMethod?.fields
          )
            ? parsedMethod.fields
            : [],

        instructions:
          parsedMethod?.instructions ||
          "",

        account_details:
          parsedMethod?.account_details ||
          "",

        note:
          parsedMethod?.note ||
          "",
      }),
      [
        methodKey,
        methodNameParam,
        methodTitleParam,
        parsedMethod,
      ]
    );

  /* =======================================================
     Admin Method
  ======================================================= */

  const ADMIN_METHOD =
    useMemo(
      () => ({
        id:
          "agent-shipping-admin",

        title:
          "شحن عبر الإدارة",

        name:
          "agent_shipping_admin",

        is_agent_admin_shipping:
          true,

        requires_receipt:
          false,

        fields: [
          {
            field_key:
              "agent_number",

            field_name:
              "رقم التحويل",

            is_required:
              true,

            input_type:
              "text",

            placeholder:
              "أدخل رقم التحويل",
          },
        ],

        instructions:
          "أدخل رقم التحويل والمبلغ ثم أرسل الطلب إلى الإدارة.",
      }),
      []
    );

  /* =======================================================
     Initial Method
  ======================================================= */

  const initialMethod =
    forceAdmin ||
    adminKey ===
      "agent-shipping-admin"
      ? ADMIN_METHOD
      : forceAgent
        ? AGENT_METHOD
        : parsedMethod;

  const [
    method,
    setMethod,
  ] = useState(
    initialMethod ||
      null
  );

  const [
    methodLoading,
    setMethodLoading,
  ] = useState(
    !initialMethod
  );

  const [
    methodError,
    setMethodError,
  ] = useState("");

  /* =======================================================
     Form State
  ======================================================= */

  const [
    currency,
    setCurrency,
  ] = useState("USD");

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    fieldValues,
    setFieldValues,
  ] = useState({});

  const [
    note,
    setNote,
  ] = useState("");

  const [
    receipt,
    setReceipt,
  ] = useState(null);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const submitLockRef =
    useRef(false);

  /* =======================================================
     Sync Agent / Admin
  ======================================================= */

  useEffect(() => {
    if (
      forceAdmin ||
      adminKey ===
        "agent-shipping-admin"
    ) {
      setMethod(
        ADMIN_METHOD
      );

      setMethodLoading(
        false
      );

      setMethodError("");

      return;
    }

    if (forceAgent) {
      setMethod(
        AGENT_METHOD
      );

      setMethodLoading(
        false
      );

      setMethodError("");

      return;
    }

    if (parsedMethod) {
      setMethod(
        parsedMethod
      );

      setMethodLoading(
        false
      );

      setMethodError("");
    }
  }, [
    ADMIN_METHOD,
    AGENT_METHOD,
    adminKey,
    forceAdmin,
    forceAgent,
    parsedMethod,
  ]);

  /* =======================================================
     Load Normal Method By ID
  ======================================================= */

  useEffect(() => {
    let alive = true;

    if (
      forceAgent ||
      forceAdmin ||
      parsedMethod ||
      adminKey ===
        "agent-shipping-admin"
    ) {
      return () => {
        alive = false;
      };
    }

    const numericId =
      Number(
        methodIdParam
      );

    if (
      !Number.isFinite(
        numericId
      ) ||
      numericId <= 0
    ) {
      setMethodLoading(
        false
      );

      setMethodError(
        "تعذر تحديد طريقة الشحن."
      );

      return () => {
        alive = false;
      };
    }

    const loadMethod =
      async () => {
        let cachedMethod =
          null;

        try {
          setMethodLoading(
            true
          );

          setMethodError("");

          /*
           * أول شي الكاش
           */
          const cached =
            await getCache(
              cacheKey(
                "paymentMethods",
                "list"
              )
            );

          if (
            Array.isArray(
              cached
            )
          ) {
            cachedMethod =
              cached.find(
                (item) =>
                  String(
                    item?.id
                  ) ===
                  String(
                    numericId
                  )
              ) ||
              null;

            if (
              alive &&
              cachedMethod
            ) {
              setMethod(
                cachedMethod
              );
            }
          }

          /*
           * بعدين API
           */
          const list =
            await listUserPaymentMethods();

          if (!alive) {
            return;
          }

          const found =
            Array.isArray(list)
              ? list.find(
                  (item) =>
                    String(
                      item?.id
                    ) ===
                    String(
                      numericId
                    )
                )
              : null;

          if (found) {
            setMethod(found);
            setMethodError("");

            await setCache(
              cacheKey(
                "paymentMethods",
                "list"
              ),
              list
            );
          } else if (
            !cachedMethod
          ) {
            setMethodError(
              "لم يتم العثور على طريقة الشحن المطلوبة."
            );
          }
        } catch {
          if (
            alive &&
            !cachedMethod
          ) {
            setMethodError(
              "تعذر تحميل معلومات طريقة الشحن."
            );
          }
        } finally {
          if (alive) {
            setMethodLoading(
              false
            );
          }
        }
      };

    loadMethod();

    return () => {
      alive = false;
    };
  }, [
    adminKey,
    forceAdmin,
    forceAgent,
    methodIdParam,
    parsedMethod,
  ]);

  /* =======================================================
     Shipping Mode
  ======================================================= */

  const isAgentShipping =
    forceAgent ||
    Boolean(
      method?.is_agent_shipping
    );

  const isAdminShipping =
    forceAdmin ||
    Boolean(
      method?.is_agent_admin_shipping
    );

  /* =======================================================
     Connected Agent
  ======================================================= */

  const connectedAgent =
    user?.raw
      ?.connected_agent ||
    user?.raw?.user
      ?.connected_agent ||
    user?.raw?.agent ||
    user?.connected_agent ||
    (
      typeof user?.agent ===
      "object"
        ? user.agent
        : null
    ) ||
    null;

  const hasAgent =
    Boolean(
      user?.agent_profile ||
        user?.raw
          ?.agent_profile ||
        user?.agent_id ||
        user?.raw
          ?.agent_id ||
        connectedAgent
    );

  const agentName =
    connectedAgent
      ?.full_name ||
    connectedAgent?.name ||
    connectedAgent
      ?.username ||
    user?.agent_profile
      ?.full_name ||
    user?.agent_profile
      ?.name ||
    "";

  /* =======================================================
     Fields
  ======================================================= */

  const methodFields =
    useMemo(() => {
      const fields =
        Array.isArray(
          method?.fields
        )
          ? method.fields
          : [];

      return fields.filter(
        (field) =>
          field?.input_type !==
          "file"
      );
    }, [method]);

  const requiresReceipt =
    Boolean(method) &&
    method?.requires_receipt !==
      false &&
    !isAgentShipping &&
    !isAdminShipping;

  const updateField =
    useCallback(
      (key, value) => {
        if (!key) {
          return;
        }

        setFieldValues(
          (previous) => ({
            ...previous,
            [key]: value,
          })
        );
      },
      []
    );

  /* =======================================================
     Amount
  ======================================================= */

  const parsedAmount =
    useMemo(() => {
      const cleaned =
        String(amount || "")
          .replace(",", ".")
          .replace(
            /[^0-9.]/g,
            ""
          );

      const value =
        Number(cleaned);

      return Number.isFinite(
        value
      )
        ? value
        : 0;
    }, [amount]);

  const changeAmount =
    useCallback((text) => {
      let cleaned =
        String(text || "")
          .replace(",", ".")
          .replace(
            /[^0-9.]/g,
            ""
          );

      const dot =
        cleaned.indexOf(".");

      if (dot !== -1) {
        cleaned =
          cleaned.slice(
            0,
            dot + 1
          ) +
          cleaned
            .slice(
              dot + 1
            )
            .replace(
              /\./g,
              ""
            );
      }

      setAmount(cleaned);
    }, []);

  /* =======================================================
     Receipt
  ======================================================= */

  const pickReceipt =
    useCallback(async () => {
      try {
        const permission =
          await ImagePicker
            .requestMediaLibraryPermissionsAsync();

        if (
          !permission.granted
        ) {
          Alert.alert(
            "صلاحيات الصور",
            "يرجى السماح بالوصول إلى الصور لرفع الإيصال."
          );

          return;
        }

        const result =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes:
                ImagePicker
                  .MediaTypeOptions
                  .Images,

              quality: 0.85,

              allowsEditing:
                false,
            });

        if (
          result.canceled ||
          !result
            ?.assets?.[0]
        ) {
          return;
        }

        const asset =
          result.assets[0];

        setReceipt({
          uri:
            asset.uri,

          name:
            asset.fileName ||
            `receipt-${Date.now()}.jpg`,

          type:
            asset.mimeType ||
            "image/jpeg",
        });
      } catch {
        Alert.alert(
          "تعذر اختيار الصورة",
          "حدث خطأ أثناء اختيار صورة الإيصال."
        );
      }
    }, []);

  /* =======================================================
     Validation
  ======================================================= */

  const validate =
    useCallback(() => {
      if (
        methodLoading
      ) {
        Alert.alert(
          "يرجى الانتظار",
          "جاري تحميل معلومات الشحن."
        );

        return false;
      }

      if (!method) {
        Alert.alert(
          "تعذر تحديد طريقة الشحن",
          "ارجع واختر طريقة الشحن مرة أخرى."
        );

        return false;
      }

      if (
        isAgentShipping &&
        !hasAgent
      ) {
        Alert.alert(
          "يجب ربط وكيل",
          "يرجى ربط حسابك بوكيل قبل استخدام الشحن عبر الوكيل."
        );

        return false;
      }

      if (
        parsedAmount <= 0
      ) {
        Alert.alert(
          "المبلغ غير صحيح",
          "يرجى إدخال مبلغ شحن صحيح."
        );

        return false;
      }

      for (
        const field of
        methodFields
      ) {
        const key =
          field?.field_key;

        const value =
          String(
            fieldValues[key] ||
              ""
          ).trim();

        if (
          field?.is_required &&
          !value
        ) {
          Alert.alert(
            "معلومات مطلوبة",
            `يرجى تعبئة: ${
              field?.field_name ||
              "الحقل المطلوب"
            }`
          );

          return false;
        }
      }

      if (
        requiresReceipt &&
        !receipt
      ) {
        Alert.alert(
          "الإيصال مطلوب",
          "يرجى رفع صورة واضحة للإيصال."
        );

        return false;
      }

      return true;
    }, [
      fieldValues,
      hasAgent,
      isAgentShipping,
      method,
      methodFields,
      methodLoading,
      parsedAmount,
      receipt,
      requiresReceipt,
    ]);

  /* =======================================================
     Submit
  ======================================================= */

  const submit =
    useCallback(async () => {
      if (
        submitting ||
        submitLockRef.current
      ) {
        return;
      }

      if (!validate()) {
        return;
      }

      submitLockRef.current =
        true;

      try {
        setSubmitting(
          true
        );

        const walletData =
          await getWallet()
            .catch(
              () => null
            );

        const walletCurrency =
          normalizeCurrency(
            currency ||
              walletData
                ?.preferred_currency ||
              walletData
                ?.currency_preference ||
              "USD"
          ) ||
          "USD";

        /*
         * الطرق العادية فقط غالباً ID رقمي.
         * agent-shipping ID تبعه string،
         * لذلك ما منجبره يكون payment_method.
         */
        const numericMethodId =
          Number.isFinite(
            Number(method?.id)
          )
            ? Number(
                method.id
              )
            : undefined;

        const extra = {
          ...fieldValues,

          shipping_channel:
            isAgentShipping
              ? "agent"
              : isAdminShipping
                ? "admin"
                : "deposit",

          wallet_currency:
            walletCurrency,

          user_phone:
            user?.phone ||
            user?.raw?.phone ||
            user?.raw?.user
              ?.phone ||
            "",
        };

        let response;

        /* =========================
           عبر الإدارة
        ========================= */

        if (
          isAdminShipping
        ) {
          response =
            await createAgentAdminShippingRequest(
              {
                amount:
                  parsedAmount,

                currency:
                  walletCurrency,

                wallet_currency:
                  walletCurrency,

                note:
                  note.trim(),

                extra,
              }
            );
        }

        /* =========================
           عبر الوكيل
        ========================= */

        else if (
          isAgentShipping
        ) {
          response =
            await createAgentShippingRequest(
              {
                amount:
                  parsedAmount,

                currency:
                  walletCurrency,

                wallet_currency:
                  walletCurrency,

                note:
                  note.trim(),

                ...(numericMethodId
                  ? {
                      payment_method:
                        numericMethodId,
                    }
                  : {}),

                extra,

                /*
                 * شحن الوكيل ما بده إيصال
                 */
                receipt: null,
              }
            );
        }

        /* =========================
           طريقة شحن عادية
        ========================= */

        else {
          response =
            await createDepositRequest(
              {
                amount:
                  parsedAmount,

                currency:
                  walletCurrency,

                method:
                  method?.name ||
                  method?.title ||
                  "manual",

                note:
                  note.trim(),

                ...(numericMethodId
                  ? {
                      payment_method:
                        numericMethodId,
                    }
                  : {}),

                receipt,

                extra,
              }
            );
        }

        if (
          !response ||
          response?.ok ===
            false
        ) {
          throw response;
        }

        /*
         * مهم:
         * ما عاد navigation.navigate("MyShippings")
         *
         * لأن المشروع Expo Router.
         */
        Alert.alert(
          "تم إرسال الطلب",
          "تم تسجيل طلب الشحن بنجاح.",
          [
            {
              text: "حسناً",

              onPress: () => {
                router.replace(
                  "/my-shippings"
                );
              },
            },
          ],
          {
            cancelable:
              false,
          }
        );
      } catch (error) {
        Alert.alert(
          "تعذر إرسال الطلب",

          getArabicError(
            error,
            "تعذر إرسال طلب الشحن. يرجى المحاولة مرة أخرى."
          )
        );
      } finally {
        setSubmitting(
          false
        );

        submitLockRef.current =
          false;
      }
    }, [
      currency,
      fieldValues,
      isAdminShipping,
      isAgentShipping,
      method,
      note,
      parsedAmount,
      receipt,
      router,
      submitting,
      user,
      validate,
    ]);

  /* =======================================================
     Page Title
  ======================================================= */

  const pageTitle =
    isAgentShipping
      ? "شحن عبر الوكيل"
      : isAdminShipping
        ? "شحن عبر الإدارة"
        : method?.title ||
          method?.name ||
          "شحن الرصيد";

  /* =======================================================
     Styles
  ======================================================= */

  const S =
    useMemo(
      () =>
        createStyles({
          sx,
          sy,
          sp,
        }),
      [
        sx,
        sy,
        sp,
      ]
    );

  /* =======================================================
     Loading
  ======================================================= */

  if (
    methodLoading &&
    !method
  ) {
    return (
      <PageLayout
        navigation={
          navigation
        }
        active="shipping"
        withSideMenu
      >
        <View
          style={
            styles.page
          }
        >
          <AppHeader
            title="شحن الرصيد"
          />

          <View
            style={
              S.center
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
                S.centerText
              }
            >
              جاري تحميل معلومات الشحن...
            </Text>
          </View>
        </View>
      </PageLayout>
    );
  }

  /* =======================================================
     Method Error
  ======================================================= */

  if (
    !method &&
    methodError
  ) {
    return (
      <PageLayout
        navigation={
          navigation
        }
        active="shipping"
        withSideMenu
      >
        <View
          style={
            styles.page
          }
        >
          <AppHeader
            title="شحن الرصيد"
          />

          <View
            style={
              S.center
            }
          >
            <View
              style={
                S.errorIcon
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={31}
                color={
                  COLORS.danger
                }
              />
            </View>

            <Text
              style={
                S.errorTitle
              }
            >
              تعذر فتح طريقة الشحن
            </Text>

            <Text
              style={
                S.centerText
              }
            >
              {methodError}
            </Text>

            <Pressable
              onPress={() =>
                router.back()
              }
              style={
                S.backButton
              }
            >
              <Text
                style={
                  S.backButtonText
                }
              >
                رجوع
              </Text>
            </Pressable>
          </View>
        </View>
      </PageLayout>
    );
  }

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="shipping"
      withSideMenu
    >
      <View
        style={
          styles.page
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
            image={require("../../assets/home-corner.png")}
            speedMs={
              16000
            }
            opacity={
              0.35
            }
          />
        </View>

        {/* =================================================
            اسم الطريقة يظهر هون مرة وحدة فقط
            Central Bank ما بيتكرر تحت
        ================================================= */}

        <AppHeader
          title={
            pageTitle
          }
        />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={{
            paddingHorizontal:
              sx(14),

            paddingTop:
              sy(14),

            paddingBottom:
              sy(100) +
              insets.bottom,
          }}
        >
          <View
            style={
              S.content
            }
          >
            {/* =================================================
                Agent / Admin Hint
                بدون إعادة عنوان الصفحة
            ================================================= */}

            {(isAgentShipping ||
              isAdminShipping) && (
              <View
                style={
                  S.modeHint
                }
              >
                <View
                  style={
                    S.modeHintIcon
                  }
                >
                  <Ionicons
                    name={
                      isAgentShipping
                        ? "people-outline"
                        : "shield-checkmark-outline"
                    }
                    size={20}
                    color={
                      COLORS.primary
                    }
                  />
                </View>

                <View
                  style={
                    S.modeHintTextWrap
                  }
                >
                  <Text
                    style={
                      S.modeHintText
                    }
                  >
                    {isAgentShipping
                      ? "سيتم إرسال الطلب إلى وكيلك المرتبط للمراجعة."
                      : "سيتم إرسال الطلب إلى الإدارة للمراجعة."}
                  </Text>

                  {isAgentShipping &&
                    agentName ? (
                    <Text
                      style={
                        S.agentName
                      }
                    >
                      الوكيل:{" "}
                      {agentName}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* =================================================
                Method Information
            ================================================= */}

            {Boolean(
              method
                ?.account_details ||
                method
                  ?.instructions ||
                method?.note
            ) && (
              <>
                <SectionTitle
                  title="معلومات الشحن"
                  S={S}
                />

                <View
                  style={
                    S.infoCard
                  }
                >
                  {!!method
                    ?.account_details && (
                    <InfoBlock
                      icon="card-outline"
                      title="بيانات الحساب"
                      text={formatInfoValue(
                        method
                          .account_details
                      )}
                      S={S}
                    />
                  )}

                  {!!method
                    ?.instructions && (
                    <InfoBlock
                      icon="information-circle-outline"
                      title="التعليمات"
                      text={formatInfoValue(
                        method
                          .instructions
                      )}
                      S={S}
                    />
                  )}

                  {!!method
                    ?.note && (
                    <InfoBlock
                      icon="document-text-outline"
                      title="ملاحظات"
                      text={formatInfoValue(
                        method.note
                      )}
                      S={S}
                    />
                  )}
                </View>
              </>
            )}

            {/* =================================================
                Currency
            ================================================= */}

            <SectionTitle
              title="اختر العملة"
              S={S}
            />

            <View
              style={
                S.currencyRow
              }
            >
              {[
                "USD",
                "SYP",
              ].map(
                (cur) => {
                  const active =
                    currency ===
                    cur;

                  return (
                    <Pressable
                      key={cur}
                      onPress={() =>
                        setCurrency(
                          cur
                        )
                      }
                      style={[
                        S.currencyBox,

                        active &&
                          S.currencyBoxActive,
                      ]}
                    >
                      {active && (
                        <View
                          style={
                            S.check
                          }
                        >
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color="#FFFFFF"
                          />
                        </View>
                      )}

                      <View
                        style={[
                          S.currencyIcon,

                          active &&
                            S.currencyIconActive,
                        ]}
                      >
                        <Ionicons
                          name={
                            cur ===
                            "USD"
                              ? "logo-usd"
                              : "cash-outline"
                          }
                          size={24}
                          color={
                            active
                              ? COLORS.primary
                              : COLORS.muted
                          }
                        />
                      </View>

                      <Text
                        style={[
                          S.currencyName,

                          active &&
                            S.currencyNameActive,
                        ]}
                      >
                        {getCurrencyLabel(
                          cur
                        )}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>

            {/* =================================================
                Amount
            ================================================= */}

            <SectionTitle
              title="مبلغ الشحن"
              S={S}
            />

            <View
              style={
                S.amountCard
              }
            >
              <View
                style={
                  S.amountRow
                }
              >
                <TextInput
                  value={
                    amount
                  }
                  onChangeText={
                    changeAmount
                  }
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#A0AEC0"
                  style={
                    S.amountInput
                  }
                />

                <View
                  style={
                    S.currencyBadge
                  }
                >
                  <Text
                    style={
                      S.currencyBadgeText
                    }
                  >
                    {getCurrencyLabel(
                      currency
                    )}
                  </Text>
                </View>
              </View>
            </View>

            {/* =================================================
                Dynamic Required Fields
            ================================================= */}

            {methodFields.length >
              0 && (
              <>
                <SectionTitle
                  title="البيانات المطلوبة"
                  S={S}
                />

                <View
                  style={
                    S.fieldsCard
                  }
                >
                  {methodFields.map(
                    (
                      field,
                      index
                    ) => {
                      const key =
                        field
                          ?.field_key ||
                        `field-${index}`;

                      const inputType =
                        String(
                          field
                            ?.input_type ||
                            ""
                        ).toLowerCase();

                      const ltr =
                        [
                          "number",
                          "phone",
                          "email",
                        ].includes(
                          inputType
                        );

                      return (
                        <View
                          key={key}
                          style={
                            index >
                            0
                              ? S.fieldGap
                              : null
                          }
                        >
                          <Text
                            style={
                              S.fieldLabel
                            }
                          >
                            {field
                              ?.field_name ||
                              "الحقل"}

                            {field
                              ?.is_required
                              ? " *"
                              : ""}
                          </Text>

                          <TextInput
                            value={
                              fieldValues[
                                key
                              ] ||
                              ""
                            }
                            onChangeText={(
                              value
                            ) =>
                              updateField(
                                key,
                                value
                              )
                            }
                            placeholder={
                              field
                                ?.placeholder ||
                              ""
                            }
                            placeholderTextColor="#98A5B7"
                            keyboardType={
                              inputType ===
                              "number"
                                ? "numeric"
                                : inputType ===
                                    "phone"
                                  ? "phone-pad"
                                  : inputType ===
                                      "email"
                                    ? "email-address"
                                    : "default"
                            }
                            autoCapitalize={
                              inputType ===
                              "email"
                                ? "none"
                                : "sentences"
                            }
                            style={[
                              S.input,

                              ltr &&
                                S.inputLtr,
                            ]}
                          />
                        </View>
                      );
                    }
                  )}
                </View>
              </>
            )}

            {/* =================================================
                Receipt
            ================================================= */}

            {requiresReceipt && (
              <>
                <SectionTitle
                  title="إيصال الدفع"
                  S={S}
                />

                <View
                  style={
                    S.receiptCard
                  }
                >
                  {receipt ? (
                    <>
                      <Image
                        source={{
                          uri:
                            receipt.uri,
                        }}
                        style={
                          S.receiptImage
                        }
                        resizeMode="cover"
                      />

                      <View
                        style={
                          S.receiptFooter
                        }
                      >
                        <View
                          style={
                            S.receiptSuccess
                          }
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color={
                              COLORS.success
                            }
                          />

                          <Text
                            style={
                              S.receiptSuccessText
                            }
                          >
                            تم اختيار الإيصال
                          </Text>
                        </View>

                        <Pressable
                          onPress={() =>
                            setReceipt(
                              null
                            )
                          }
                          style={
                            S.removeReceipt
                          }
                        >
                          <Ionicons
                            name="trash-outline"
                            size={17}
                            color={
                              COLORS.danger
                            }
                          />

                          <Text
                            style={
                              S.removeReceiptText
                            }
                          >
                            إزالة
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Pressable
                      onPress={
                        pickReceipt
                      }
                      style={
                        S.uploadBox
                      }
                    >
                      <View
                        style={
                          S.uploadIcon
                        }
                      >
                        <Ionicons
                          name="image-outline"
                          size={28}
                          color={
                            COLORS.primary
                          }
                        />
                      </View>

                      <Text
                        style={
                          S.uploadTitle
                        }
                      >
                        رفع صورة الإيصال
                      </Text>

                      <Text
                        style={
                          S.uploadText
                        }
                      >
                        اختر صورة واضحة ومقروءة للإيصال
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {/* =================================================
                Note
            ================================================= */}

            <View
              style={
                S.noteHeading
              }
            >
              <Text
                style={
                  S.sectionTitle
                }
              >
                ملاحظة
              </Text>

              <Text
                style={
                  S.optional
                }
              >
                اختياري
              </Text>
            </View>

            <View
              style={
                S.noteCard
              }
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color={
                  COLORS.primary
                }
                style={{
                  marginTop:
                    sy(3),
                }}
              />

              <TextInput
                value={
                  note
                }
                onChangeText={
                  setNote
                }
                placeholder="أضف أي تفاصيل إضافية إن وجدت"
                placeholderTextColor="#98A5B7"
                multiline
                maxLength={300}
                style={
                  S.noteInput
                }
              />
            </View>

            {/* =================================================
                Summary
            ================================================= */}

            <SectionTitle
              title="ملخص الطلب"
              S={S}
            />

            <View
              style={
                S.summaryCard
              }
            >
              <SummaryRow
                label="العملة"
                value={
                  getCurrencyLabel(
                    currency
                  )
                }
              />

              <View
                style={
                  styles.divider
                }
              />

              <SummaryRow
                label="المبلغ"
                value={`${formatAmount(
                  parsedAmount,
                  currency
                )} ${getCurrencyLabel(
                  currency
                )}`}
                primary
              />

              <View
                style={
                  styles.divider
                }
              />

              <SummaryRow
                label="طريقة الشحن"
                value={
                  isAgentShipping
                    ? "عبر الوكيل"
                    : isAdminShipping
                      ? "عبر الإدارة"
                      : "شحن مباشر"
                }
              />
            </View>

            {/* =================================================
                Submit
            ================================================= */}

            <Pressable
              onPress={
                submit
              }
              disabled={
                submitting
              }
              style={[
                S.submitButton,

                submitting && {
                  opacity:
                    0.6,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Ionicons
                  name="paper-plane-outline"
                  size={20}
                  color="#FFFFFF"
                />
              )}

              <Text
                style={
                  S.submitText
                }
              >
                {submitting
                  ? "جاري إرسال الطلب..."
                  : "إرسال طلب الشحن"}
              </Text>
            </Pressable>

            <Text
              style={
                S.submitHint
              }
            >
              تحقق من البيانات قبل إرسال الطلب.
            </Text>
          </View>
        </ScrollView>
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Section Title
========================================================= */

function SectionTitle({
  title,
  S,
}) {
  return (
    <View
      style={
        S.sectionHeading
      }
    >
      <Text
        style={
          S.sectionTitle
        }
      >
        {title}
      </Text>
    </View>
  );
}

/* =========================================================
   Information
========================================================= */

function InfoBlock({
  icon,
  title,
  text,
  S,
}) {
  if (!text) {
    return null;
  }

  return (
    <View
      style={
        S.infoBlock
      }
    >
      <View
        style={
          S.infoIcon
        }
      >
        <Ionicons
          name={icon}
          size={18}
          color={
            COLORS.primary
          }
        />
      </View>

      <View
        style={
          S.infoTextWrap
        }
      >
        <Text
          style={
            S.infoTitle
          }
        >
          {title}
        </Text>

        <Text
          selectable
          style={
            S.infoText
          }
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   Summary
========================================================= */

function SummaryRow({
  label,
  value,
  primary = false,
}) {
  return (
    <View
      style={
        styles.summaryRow
      }
    >
      <Text
        style={
          styles.summaryLabel
        }
      >
        {label}
      </Text>

      <Text
        numberOfLines={2}
        style={[
          styles.summaryValue,

          primary &&
            styles.summaryPrimary,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   Responsive Styles
========================================================= */

function createStyles({
  sx,
  sy,
  sp,
}) {
  return StyleSheet.create({
    content: {
      width: "100%",
      maxWidth: MAX_W,
      alignSelf: "center",
    },

    /* =====================================================
       Center / Error
    ===================================================== */

    center: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal:
        sx(25),

      paddingBottom:
        sy(50),
    },

    centerText: {
      maxWidth:
        sx(290),

      marginTop:
        sy(9),

      color:
        COLORS.muted,

      fontSize:
        sp(13),

      lineHeight:
        sp(20),

      textAlign: "center",
      writingDirection: "rtl",
    },

    errorIcon: {
      width:
        sx(64),

      height:
        sx(64),

      borderRadius:
        sx(32),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.dangerSoft,
    },

    errorTitle: {
      marginTop:
        sy(12),

      color:
        COLORS.text,

      fontSize:
        sp(18),

      fontWeight: "900",

      textAlign: "center",
      writingDirection: "rtl",
    },

    backButton: {
      minWidth:
        sx(135),

      minHeight:
        sy(44),

      marginTop:
        sy(15),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.primary,

      borderRadius:
        sx(12),
    },

    backButtonText: {
      color: "#FFFFFF",

      fontSize:
        sp(13),

      fontWeight: "900",

      writingDirection: "rtl",
    },

    /* =====================================================
       Section Titles = 20
    ===================================================== */

    sectionHeading: {
      width: "100%",

      marginTop:
        sy(3),

      marginBottom:
        sy(9),

      alignItems: "flex-end",
    },

    sectionTitle: {
      width: "100%",

      color:
        COLORS.text,

      fontSize:
        sp(20),

      lineHeight:
        sp(28),

      fontWeight: "900",

      textAlign: "right",
      writingDirection: "rtl",
    },

    /* =====================================================
       Agent / Admin Hint
    ===================================================== */

    modeHint: {
      flexDirection:
        "row-reverse",

      alignItems: "center",

      gap:
        sx(9),

      padding:
        sx(12),

      marginBottom:
        sy(20),

      backgroundColor:
        COLORS.primarySoft,

      borderWidth: 1,

      borderColor:
        "#D7E6FF",

      borderRadius:
        sx(15),
    },

    modeHintIcon: {
      width:
        sx(40),

      height:
        sx(40),

      borderRadius:
        sx(12),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        "#FFFFFF",
    },

    modeHintTextWrap: {
      flex: 1,
      alignItems: "flex-end",
    },

    modeHintText: {
      width: "100%",

      color:
        COLORS.text,

      fontSize:
        sp(12.5),

      lineHeight:
        sp(19),

      fontWeight: "700",

      textAlign: "right",
      writingDirection: "rtl",
    },

    agentName: {
      width: "100%",

      marginTop:
        sy(3),

      color:
        COLORS.primary,

      fontSize:
        sp(12),

      fontWeight: "900",

      textAlign: "right",
      writingDirection: "rtl",
    },

    /* =====================================================
       Information
    ===================================================== */

    infoCard: {
      paddingHorizontal:
        sx(12),

      paddingVertical:
        sy(2),

      marginBottom:
        sy(20),

      backgroundColor:
        COLORS.card,

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    infoBlock: {
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      gap:
        sx(9),

      paddingVertical:
        sy(11),
    },

    infoIcon: {
      width:
        sx(34),

      height:
        sx(34),

      borderRadius:
        sx(10),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    infoTextWrap: {
      flex: 1,
      alignItems: "flex-end",
    },

    infoTitle: {
      width: "100%",

      color:
        COLORS.text,

      fontSize:
        sp(13),

      fontWeight: "900",

      textAlign: "right",
      writingDirection: "rtl",
    },

    infoText: {
      width: "100%",

      marginTop:
        sy(4),

      color:
        COLORS.muted,

      fontSize:
        sp(12.5),

      lineHeight:
        sp(20),

      textAlign: "right",
      writingDirection: "rtl",
    },

    /* =====================================================
       Currency
    ===================================================== */

    currencyRow: {
      flexDirection:
        "row-reverse",

      gap:
        sx(10),

      marginBottom:
        sy(20),
    },

    currencyBox: {
      flex: 1,

      minHeight:
        sy(115),

      position:
        "relative",

      alignItems: "center",
      justifyContent: "center",

      padding:
        sx(12),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    currencyBoxActive: {
      borderColor:
        COLORS.primary,

      borderWidth: 1.5,

      backgroundColor:
        "#F7FAFF",
    },

    check: {
      position: "absolute",

      top:
        sx(8),

      left:
        sx(8),

      width:
        sx(23),

      height:
        sx(23),

      borderRadius:
        sx(12),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.primary,
    },

    currencyIcon: {
      width:
        sx(44),

      height:
        sx(44),

      borderRadius:
        sx(14),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        "#F2F4F7",
    },

    currencyIconActive: {
      backgroundColor:
        COLORS.primarySoft,
    },

    currencyName: {
      marginTop:
        sy(8),

      color:
        COLORS.text,

      fontSize:
        sp(17),

      fontWeight: "900",

      textAlign: "center",
      writingDirection: "rtl",
    },

    currencyNameActive: {
      color:
        COLORS.primary,
    },

    /* =====================================================
       Amount
    ===================================================== */

    amountCard: {
      padding:
        sx(12),

      marginBottom:
        sy(20),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    amountRow: {
      flexDirection:
        "row-reverse",

      alignItems: "center",

      gap:
        sx(8),
    },

    amountInput: {
      flex: 1,

      minHeight:
        sy(55),

      paddingHorizontal:
        sx(13),

      color:
        COLORS.text,

      fontSize:
        sp(21),

      fontWeight: "900",

      textAlign: "left",
      writingDirection: "ltr",

      backgroundColor:
        "#F8FAFC",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(13),
    },

    currencyBadge: {
      minWidth:
        sx(74),

      minHeight:
        sy(55),

      paddingHorizontal:
        sx(8),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.primary,

      borderRadius:
        sx(13),
    },

    currencyBadgeText: {
      color: "#FFFFFF",

      fontSize:
        sp(13.5),

      fontWeight: "900",

      textAlign: "center",
      writingDirection: "rtl",
    },

    /* =====================================================
       Dynamic Fields
    ===================================================== */

    fieldsCard: {
      padding:
        sx(12),

      marginBottom:
        sy(20),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    fieldGap: {
      marginTop:
        sy(13),
    },

    fieldLabel: {
      width: "100%",

      marginBottom:
        sy(7),

      color:
        COLORS.text,

      fontSize:
        sp(13),

      fontWeight: "900",

      textAlign: "right",
      writingDirection: "rtl",
    },

    input: {
      minHeight:
        sy(50),

      paddingHorizontal:
        sx(12),

      color:
        COLORS.text,

      fontSize:
        sp(13),

      fontWeight: "700",

      textAlign: "right",
      writingDirection: "rtl",

      backgroundColor:
        "#F8FAFC",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(12),
    },

    inputLtr: {
      textAlign: "right",
      writingDirection: "ltr",
    },

    /* =====================================================
       Receipt
    ===================================================== */

    receiptCard: {
      padding:
        sx(12),

      marginBottom:
        sy(20),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    uploadBox: {
      paddingVertical:
        sy(22),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        "#F8FBFF",

      borderWidth: 1,

      borderStyle:
        "dashed",

      borderColor:
        "#BCD4F6",

      borderRadius:
        sx(13),
    },

    uploadIcon: {
      width:
        sx(54),

      height:
        sx(54),

      borderRadius:
        sx(17),

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    uploadTitle: {
      marginTop:
        sy(9),

      color:
        COLORS.text,

      fontSize:
        sp(14),

      fontWeight: "900",

      textAlign: "center",
      writingDirection: "rtl",
    },

    uploadText: {
      marginTop:
        sy(3),

      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      textAlign: "center",
      writingDirection: "rtl",
    },

    receiptImage: {
      width: "100%",

      height:
        sy(175),

      borderRadius:
        sx(12),

      backgroundColor:
        "#F1F5F9",
    },

    receiptFooter: {
      marginTop:
        sy(10),

      flexDirection:
        "row-reverse",

      alignItems: "center",
      justifyContent:
        "space-between",

      gap:
        sx(10),
    },

    receiptSuccess: {
      flex: 1,

      flexDirection:
        "row-reverse",

      alignItems: "center",

      gap:
        sx(5),
    },

    receiptSuccessText: {
      color:
        COLORS.success,

      fontSize:
        sp(12),

      fontWeight: "900",

      textAlign: "right",
      writingDirection: "rtl",
    },

    removeReceipt: {
      flexDirection:
        "row-reverse",

      alignItems: "center",

      gap:
        sx(5),

      paddingHorizontal:
        sx(10),

      paddingVertical:
        sy(7),

      backgroundColor:
        COLORS.dangerSoft,

      borderRadius:
        sx(9),
    },

    removeReceiptText: {
      color:
        COLORS.danger,

      fontSize:
        sp(12),

      fontWeight: "900",

      writingDirection: "rtl",
    },

    /* =====================================================
       Note
    ===================================================== */

    noteHeading: {
      width: "100%",

      marginBottom:
        sy(9),

      alignItems: "flex-end",
    },

    optional: {
      marginTop:
        sy(-2),

      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      fontWeight: "700",

      textAlign: "right",
      writingDirection: "rtl",
    },

    noteCard: {
      minHeight:
        sy(95),

      marginBottom:
        sy(20),

      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      gap:
        sx(8),

      padding:
        sx(12),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    noteInput: {
      flex: 1,

      minHeight:
        sy(80),

      paddingTop: 0,

      color:
        COLORS.text,

      fontSize:
        sp(13),

      lineHeight:
        sp(20),

      textAlign: "right",
      writingDirection: "rtl",

      textAlignVertical:
        "top",
    },

    /* =====================================================
       Summary
    ===================================================== */

    summaryCard: {
      paddingHorizontal:
        sx(13),

      marginBottom:
        sy(18),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    /* =====================================================
       Submit
    ===================================================== */

    submitButton: {
      minHeight:
        sy(52),

      flexDirection:
        "row-reverse",

      alignItems: "center",
      justifyContent: "center",

      gap:
        sx(7),

      backgroundColor:
        COLORS.primary,

      borderRadius:
        sx(14),
    },

    submitText: {
      color: "#FFFFFF",

      fontSize:
        sp(14),

      fontWeight: "900",

      writingDirection: "rtl",
    },

    submitHint: {
      marginTop:
        sy(8),

      paddingHorizontal:
        sx(10),

      color:
        COLORS.muted,

      fontSize:
        sp(11),

      lineHeight:
        sp(17),

      textAlign: "center",
      writingDirection: "rtl",
    },
  });
}

/* =========================================================
   Static Styles
========================================================= */

const styles =
  StyleSheet.create({
    page: {
      flex: 1,

      backgroundColor:
        COLORS.bg,
    },

    summaryRow: {
      minHeight: 52,

      flexDirection:
        "row-reverse",

      alignItems: "center",

      justifyContent:
        "space-between",

      gap: 12,
    },

    summaryLabel: {
      color:
        COLORS.muted,

      fontSize: 12.5,

      fontWeight: "700",

      textAlign: "right",
      writingDirection: "rtl",
    },

    summaryValue: {
      flex: 1,

      color:
        COLORS.text,

      fontSize: 13,

      fontWeight: "900",

      textAlign: "left",
      writingDirection: "rtl",
    },

    summaryPrimary: {
      color:
        COLORS.primary,

      fontSize: 14,
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLORS.line,
    },

    spinnerBg: {
      position: "absolute",

      top: 0,
      right: 0,
      left: 0,

      height: 0,
    },
  });