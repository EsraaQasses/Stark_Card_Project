// src/screens/Payment.js

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import { getApiErrorMessage } from "../shared/api/errors/apiError";
import { inquiryIsPayable, calculatorTotal } from "../features/payments/model/paymentVerification";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Screenn from "../ui/Screenn";
import appTheme from "../ui/Theme";

import { processCompletePayment } from "../api/payment";

import {
  addFavorite,
  createProductQueryWaitV2,
  getPriceCalculator,
  removeFavorite,
} from "../api/store";

import {
  getWallet,
  normalizeExchangeRates,
  normalizeWalletsResponse,
} from "../api/wallets";

import { useCurrency } from "../context/CurrencyProvider";
import { useAuth } from "../context/AuthProvider";

import {
  buildPaymentPayloadData,
  buildPaymentUserInputs,
} from "../features/payments/model/paymentPayload";

import { usePaymentPricing } from "../features/payments/hooks/usePaymentPricing";
import { usePaymentQueryState } from "../features/payments/hooks/usePaymentQueryState";
import { useCheckoutProduct } from "../features/payments/hooks/useCheckoutProduct";
import { checkoutProductId, checkoutInitialization } from "../features/payments/model/checkoutRoute";
import { getProductDisplayImage } from "../features/store/utils/productImages";

import { derivePricingFromProduct } from "../features/payments/model/paymentPricing";

import {
  buildRequirementPayload,
  findMissingRequiredRequirements,
} from "../features/payments/model/paymentRequirements";

import { extractQueryStatus } from "../features/payments/model/paymentQuery";

import { useScale } from "../ui/scale";

const { colors } = appTheme;

/* =========================================================
   Responsive Styles
========================================================= */

function makeStyles(sy, sp) {
  return StyleSheet.create({
    input: {
      marginTop: sy(6),
      backgroundColor: "#FFFFFF",
      borderWidth: 1.5,
      borderColor: "#E4ECF2",
      borderRadius: sy(12),

      paddingHorizontal: sy(14),

      height: sy(52),

      fontSize: sp(16),
      lineHeight: Platform.OS === "android" ? sp(20) : undefined,

      color: "#0E1B3B",

      // RTL افتراضياً للحقول النصية
      textAlign: "right",
      writingDirection: "rtl",
    },

    btn: {
      backgroundColor: "#1274F5",
      borderRadius: sy(14),

      paddingHorizontal: sy(16),
      paddingVertical: sy(12),

      alignItems: "center",
      justifyContent: "center",
    },

    btnText: {
      color: "#FFFFFF",
      fontWeight: "800",

      fontSize: sp(16),
      lineHeight: sp(20),

      textAlign: "center",
    },

    payBar: {
      backgroundColor: "#ABBBe2",

      borderRadius: sy(16),

      paddingVertical: sy(12),
      paddingHorizontal: sy(12),

      // زر الدفع يسار والمبلغ يمين
      flexDirection: "row-reverse",
      alignItems: "center",

      gap: sy(12),

      shadowColor: "#2B178E",
      shadowOpacity: 0.18,
      shadowRadius: 16,

      shadowOffset: {
        width: 0,
        height: 8,
      },

      elevation: 8,
    },

    payBtn: {
      backgroundColor: "#1274F5",

      paddingHorizontal: sy(20),

      height: sy(52),

      borderRadius: sy(14),

      alignItems: "center",
      justifyContent: "center",
    },

    payBtnText: {
      color: "#FFFFFF",

      fontWeight: "900",

      fontSize: sp(18),
      lineHeight: sp(24),

      textAlign: "center",
      writingDirection: "rtl",
    },
  });
}

/* =========================================================
   Local Favorites
========================================================= */

const GUEST_FAVS_KEY = "@guest_favs";

const favKey = (prod) =>
  String(
    prod?.id ??
      prod?.name ??
      ""
  );

async function readGuestFavs() {
  try {
    const raw = await AsyncStorage.getItem(GUEST_FAVS_KEY);

    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function isGuestFavLocal(prod) {
  const k = favKey(prod);
  const list = await readGuestFavs();

  return list.some((it) => favKey(it.product) === k);
}

async function addGuestFavLocal(prod) {
  try {
    const k = favKey(prod);

    if (!k) return;

    const list = await readGuestFavs();

    const idx = list.findIndex(
      (it) => favKey(it.product) === k
    );

    const entry = {
      product: prod,
      saved_at: Date.now(),
    };

    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
    }

    await AsyncStorage.setItem(
      GUEST_FAVS_KEY,
      JSON.stringify(list.slice(0, 100))
    );
  } catch {}
}

async function removeGuestFavLocal(prod) {
  try {
    const k = favKey(prod);

    const list = await readGuestFavs();

    const next = list.filter(
      (it) => favKey(it.product) !== k
    );

    await AsyncStorage.setItem(
      GUEST_FAVS_KEY,
      JSON.stringify(next)
    );
  } catch {}
}

/* =========================================================
   Server Errors
========================================================= */

function extractServerMessage(error) { return getApiErrorMessage(error); }
function buildErrorMessage(result) { return getApiErrorMessage(result); }

/* =========================================================
   Component
========================================================= */

export default function Payment({ route, navigation }) {
  const { t } = useTranslation();

  const { user } = useAuth();

  const isAuthenticated = Boolean(
    user?.id ||
      user?.raw?.id ||
      user?.username ||
      user?.email ||
      user?.phone
  );

  const insets = useSafeAreaInsets();

  const { width: W } = useWindowDimensions();

  const currencyCtx = useCurrency?.();

  const {
    currency: appCurrency = "USD",
    setCurrency,
  } = currencyCtx || {};

  const { sx, sy, sp } = useScale();

  const S = useMemo(
    () => makeStyles(sy, sp),
    [sy, sp]
  );

  /* =======================================================
     Sizes
  ======================================================= */

  const G = {
    xxs: sy(6),
    xs: sy(8),
    sm: sy(12),
    md: sy(16),
    lg: sy(20),
    xl: sy(28),
  };

  const R = {
    sm: sp(10),
    md: sp(14),
    lg: sp(18),
    xl: sp(22),
    xxl: sp(28),
  };

  /* =======================================================
     Typography
  ======================================================= */

  const rtlText = {
    textAlign: "right",
    writingDirection: "rtl",
  };

  const T = {
    caption: {
      fontSize: sp(14),
      lineHeight: sp(20),
      color: "#5F708C",

      ...rtlText,
    },

    body: {
      fontSize: sp(16),
      lineHeight: sp(22),
      color: "#0E1B3B",

      ...rtlText,
    },

    bodyB: {
      fontSize: sp(16),
      lineHeight: sp(22),
      color: "#0E1B3B",

      fontWeight: "800",

      ...rtlText,
    },

    title: {
      fontSize: sp(19),
      lineHeight: sp(26),

      color: "#0E1B3B",

      fontWeight: "900",

      ...rtlText,
    },

    heroXL: {
      fontSize: sp(24),
      lineHeight: sp(32),

      color: "#FFFFFF",

      fontWeight: "900",

      textAlign: "right",
      writingDirection: "rtl",

      textShadowColor: "rgba(0,0,0,0.20)",
      textShadowOffset: {
        width: 0,
        height: 2,
      },
      textShadowRadius: 6,
    },

    total: {
      fontSize: sp(24),
      lineHeight: sp(30),

      color: "#0E1B3B",

      fontWeight: "900",

      // أسعار وأرقام
      textAlign: "left",
      writingDirection: "ltr",
    },
  };

  /* =======================================================
     Route Params
  ======================================================= */

  const params = useMemo(
    () => route?.params ?? {},
    [route?.params]
  );

  const productId = checkoutProductId(params);
  const initializationKey = JSON.stringify({prefill:params.prefill,user_inputs_prefill:params.user_inputs_prefill,quantity:params.quantity,amount:params.amount,selected_option:params.selected_option,selected_id:params.selected_id});
  const initialization = useMemo(() => checkoutInitialization(JSON.parse(initializationKey)), [initializationKey]);
  const preUserInputs = initialization.inputs;
  const isAgentFlow = params?.is_agent === true || params?.is_agent === "true" || params?.flow === "agent" || !!preUserInputs?.target_user_id;
  const preSelectedId = initialization.selectedId;

  /* =======================================================
     Product / Pricing State
  ======================================================= */

  const [paymentFields,setPaymentFields] = useState({});
  const latestInquiryInputRef = useRef("");
  const [pricingRevision,setPricingRevision] = useState(0);
  const uncertainPaymentRef = useRef(false);
  const checkoutAliveRef = useRef(true);
  useEffect(() => {checkoutAliveRef.current=true;return()=>{checkoutAliveRef.current=false;};},[]);
  const inquiryInputRef = useRef(null);
  const queryLockRef = useRef(false);
  useFocusEffect(useCallback(() => { setPricingRevision(previous=>previous+1); }, []));
  const checkout = useCheckoutProduct(productId);
  const product = checkout.product;
  const pricingBoot = checkout.loading;
  const pricing = useMemo(() => derivePricingFromProduct(product, appCurrency), [product, appCurrency]);

  const [fx, setFx] =
    useState(null);

  const [
    walletBalances,
    setWalletBalances,
  ] = useState(null);

  const walletCurrency =
    (
      appCurrency ||
      "USD"
    ).toUpperCase();

  const [priceState, setPriceState] = useState({key:null,data:null,error:"",loading:false});
  const [priceAttempt,setPriceAttempt] = useState(0);

  const requirements = checkout.requirements;

  const [
    requirementValues,
    setRequirementValues,
  ] = useState(() => preUserInputs || {});

  /* =======================================================
     Query
  ======================================================= */

  const [
    queryLoading,
    setQueryLoading,
  ] = useState(false);

  const [
    queryResult,
    setQueryResult,
  ] = useState(null);

  const [
    queryError,
    setQueryError,
  ] = useState("");

  const [
    queryStatus,
    setQueryStatus,
  ] = useState(null);

  const {
    isQueryPending,
    queryDisplay,
  } = usePaymentQueryState({
    queryLoading,
    queryStatus,
    queryResult,
  });

  /* =======================================================
     Wallet
  ======================================================= */

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const walletData =
          await getWallet();

        if (!alive) return;

        setWalletBalances(
          walletData
        );

        const rates =
          normalizeExchangeRates(
            walletData
          );

        const usdToSyp =
          rates?.usd_to_syp != null
            ? Number(
                rates.usd_to_syp
              )
            : null;

        const sypToUsd =
          rates?.syp_to_usd != null
            ? Number(
                rates.syp_to_usd
              )
            : null;

        if (
          usdToSyp ||
          sypToUsd
        ) {
          setFx({
            usd_to_syp:
              usdToSyp,

            syp_to_usd:
              sypToUsd,
          });
        } else {
          setFx(null);
        }
      } catch {
        if (alive) {
          setWalletBalances(
            null
          );

          setFx(null);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* =======================================================
     Quantity / Packages
  ======================================================= */

  const [
    qtyStr,
    setQtyStr,
  ] = useState(
    String(
      initialization.quantity ??
      product?.qty
        ?.defaultValue ??
        Number(
          pricing.mode ===
            "range" ||
            (
              !!pricing.range &&
              (
                pricing.range
                  ?.min !=
                  null ||
                pricing.range
                  ?.max !=
                  null
              )
            )
            ? pricing.range
                ?.min ??
                1
            : product?.qty
                ?.min ??
                1
        )
    )
  );

  const {
    options,
    range,
    isPackages,
    isRange,
    minQ,
    maxQ,
    step,
    rawQty,
    safeQty,
  } = usePaymentPricing({
    pricing,
    product,
    qtyStr,
  });

  const [
    selected,
    setSelected,
  ] = useState(
    isPackages
      ? options.find(
          (o) =>
            String(o?.id) === String(preSelectedId) || String(o?.value) === String(initialization.selectedValue)
        ) ||
          options[0]
      : null
  );

  useEffect(() => {
    if (
      isPackages &&
      options.length > 0
    ) {
      const sel =
        options.find(
          (o) =>
            String(o?.id) === String(preSelectedId) || String(o?.value) === String(initialization.selectedValue)
        ) ||
        options[0];

      setSelected(sel);
    } else {
      setSelected(null);
    }
  }, [
    isPackages,
    options,
    preSelectedId,
    initialization.selectedValue,
  ]);

  useEffect(() => {
    setQtyStr(
      String(
        initialization.quantity ?? product?.qty
          ?.defaultValue ??
          minQ
      )
    );
  }, [
    product?.qty
      ?.defaultValue,
    minQ,
    initialization.quantity,
  ]);

  const bump = (dir) => {
    if (isPackages) {
      return;
    }

    const next =
      dir === 1
        ? rawQty + step
        : rawQty - step;

    const clamped =
      Math.max(
        minQ,
        Math.min(
          next,
          maxQ
        )
      );

    setQtyStr(
      String(clamped)
    );
  };

  /* =======================================================
     Pricing
  ======================================================= */

  const baseCurrency =
    (
      isPackages
        ? selected?.currency ||
          options[0]?.currency
        : range?.currency
    ) ||
    product?.currency ||
    "USD";

  const priceKey = JSON.stringify([productId, product?.id, checkout.status, isPackages ? selected?.value : safeQty, walletCurrency]);
  const priceCalculatorData = priceState.key === priceKey && checkout.status === "ready" ? priceState.data : null;
  const priceLoading = checkout.status === "ready" && (priceState.key !== priceKey || priceState.loading);
  const priceError = priceState.key === priceKey ? priceState.error : "";
  const setPriceCalculatorData = data => setPriceState({key:priceKey,data,error:"",loading:false});
  useEffect(() => {
    let alive = true;
    if (checkout.status !== "ready" || isPackages && !selected) return;
    setPriceState({key:priceKey,data:null,error:"",loading:true});
    const calculatorParams = {wallet_currency:walletCurrency};
    if (isPackages) calculatorParams.selected_option = String(selected.value);
    else calculatorParams.amount = String(safeQty);
    getPriceCalculator(productId,calculatorParams).then(result => {
      if (!alive) return;
      if (!result.ok || calculatorTotal(result.data,walletCurrency) == null) throw new Error(result.error || t("checkout.priceUnavailable"));
      setPriceState({key:priceKey,data:result.data,error:"",loading:false});
    }).catch(error => {
      if (alive) setPriceState({key:priceKey,data:null,error:getApiErrorMessage(error),loading:false});
    });
    return () => {alive=false;};
  }, [checkout.status, productId, isPackages, selected, safeQty, walletCurrency, priceKey, pricingRevision, priceAttempt, t]);

  const total = calculatorTotal(priceCalculatorData,walletCurrency);
  const currency = walletCurrency;

  const unitPrice =
    total > 0
      ? isRange &&
        safeQty > 0
        ? +(
            total /
            safeQty
          ).toFixed(12)
        : total
      : 0;

  /* =======================================================
     Other State
  ======================================================= */

  const [
    gamerId,
    setGamerId,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const paymentLockRef =
    useRef(false);

  const [
    fav,
    setFav,
  ] = useState(
    Boolean(
      product?.is_favorite
    )
  );

  const [
    favBusy,
    setFavBusy,
  ] = useState(false);

  const favoriteLockRef =
    useRef(false);

  const appliedInitialization = useRef(initializationKey);
  useEffect(() => {
    if (checkout.status !== "ready") return;
    const changed = appliedInitialization.current !== initializationKey;
    appliedInitialization.current = initializationKey;
    setRequirementValues(previous => Object.fromEntries(requirements.map(field => {
      const key = field.payload_key || field.field_name;
      const value = changed ? preUserInputs?.[key] ?? "" : previous[key] ?? preUserInputs?.[key] ?? "";
      const allowed = Array.isArray(field.options) ? field.options : [];
      return [key, allowed.length && !allowed.some(option => String(option?.value ?? option) === String(value)) ? "" : String(value ?? "")];
    })));
  }, [requirements, preUserInputs, checkout.status, initializationKey]);

  /* =======================================================
     Favorite
  ======================================================= */

  useEffect(() => {
    let alive = true;

    (async () => {
      if (
        isAuthenticated
      ) {
        if (alive) {
          setFav(
            Boolean(
              product?.is_favorite
            )
          );
        }

        return;
      }

      const liked =
        await isGuestFavLocal(
          product
        );

      if (alive) {
        setFav(liked);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    isAuthenticated,
    product,
  ]);

  const toggleFav =
    async () => {
      if (
        favoriteLockRef.current
      ) {
        return;
      }

      favoriteLockRef.current =
        true;

      try {
        setFavBusy(true);

        const next = !fav;

        if (
          isAuthenticated
        ) {
          const id =
            Number(
              product?.id
            );

          if (
            !Number.isFinite(id)
          ) {
            throw new Error(
              "معرّف المنتج غير متوفر."
            );
          }

          if (next) {
            await addFavorite(
              id
            );
          } else {
            await removeFavorite(
              id
            );
          }
        } else {
          if (next) {
            await addGuestFavLocal(
              product
            );
          } else {
            await removeGuestFavLocal(
              product
            );
          }
        }

        setFav(next);
      } catch (
        favoriteError
      ) {
        const message =
          favoriteError
            ?.response?.data
            ?.detail ||
          favoriteError
            ?.response?.data
            ?.error ||
          favoriteError
            ?.message ||
          t(
            "payment.updateFavFailed"
          );

        Alert.alert(
          t(
            "common.networkError"
          ),
          String(message)
        );
      } finally {
        setFavBusy(false);

        favoriteLockRef.current =
          false;
      }
    };

  /* =======================================================
     Recipient
  ======================================================= */

  const hasRecipient =
    preUserInputs &&
    (
      preUserInputs.user_id ||
      preUserInputs.target_user_id ||
      preUserInputs.name ||
      preUserInputs.target_user_name
    );

  const recipientLine =
    useMemo(() => {
      const uid =
        preUserInputs?.user_id ??
        preUserInputs?.target_user_id ??
        null;

      const name =
        preUserInputs?.name ??
        preUserInputs?.target_user_name ??
        null;

      if (
        !uid &&
        !name
      ) {
        return "";
      }

      if (
        uid &&
        name
      ) {
        return `${name} (#${uid})`;
      }

      if (uid) {
        return `#${uid}`;
      }

      return name || "";
    }, [preUserInputs]);

  /* =======================================================
     Wallet Info
  ======================================================= */

  const walletInfo =
    useMemo(() => {
      if (
        !walletBalances
      ) {
        return null;
      }

      try {
        const list =
          normalizeWalletsResponse(
            walletBalances
          );

        const usd =
          list.find(
            (w) =>
              w.currency ===
              "USD"
          );

        const syp =
          list.find(
            (w) =>
              w.currency ===
              "SYP"
          );

        return {
          usd: usd
            ? Number(
                usd.available ||
                  0
              )
            : null,

          syp: syp
            ? Number(
                syp.available ||
                  0
              )
            : null,
        };
      } catch {
        return null;
      }
    }, [walletBalances]);

  const selectedWalletBalance =
    walletCurrency === "USD"
      ? walletInfo?.usd
      : walletInfo?.syp;

  /* =======================================================
     Query
  ======================================================= */

  const inquiryInputKey = JSON.stringify(buildRequirementPayload(requirements,requirementValues).values);
  latestInquiryInputRef.current = inquiryInputKey;
  useEffect(() => { setQueryResult(null); setQueryStatus(null); setQueryError(""); }, [inquiryInputKey, product?.id]);
  const handleQuery =
    async () => {
      if (
        !product?.id ||
        !product?.query_enabled
      ) {
        return;
      }

      if (
        queryLockRef.current ||
        queryLoading ||
        isQueryPending
      ) {
        return;
      }

      if (
        requirements?.length
      ) {
        const missing =
          findMissingRequiredRequirements(
            requirements,
            requirementValues
          );

        if (
          missing.length
        ) {
          Alert.alert(
            t(
              "payment.title"
            ),
            `الحقول التالية مطلوبة:\n${missing
              .map(
                (r) =>
                  r.field_name
              )
              .join(" ، ")}`
          );

          return;
        }
      }

      queryLockRef.current = true;
      setQueryLoading(true);
      setQueryError("");
      setQueryResult(null);

      setQueryStatus(
        "pending"
      );

      const res =
        await createProductQueryWaitV2(
          product.id,
          buildRequirementPayload(
            requirements,
            requirementValues
          ).values
        );

      queryLockRef.current = false;
      if (latestInquiryInputRef.current !== inquiryInputKey) { setQueryLoading(false); return; }
      inquiryInputRef.current = JSON.stringify(buildRequirementPayload(requirements, requirementValues).values);
      setQueryLoading(false);

      if (!res?.ok) {
        setQueryError(
          res?.error ||
            "تعذر تنفيذ الاستعلام."
        );

        setQueryStatus(
          null
        );

        return;
      }

      if (
        res?.data?.timeout
      ) {
        setQueryError(
          "الاستعلام ما زال قيد المعالجة، حاول مجدداً."
        );

        setQueryStatus(
          null
        );

        return;
      }

      const status =
        extractQueryStatus(
          res?.data
        );

      if (status) {
        setQueryStatus(
          status
        );
      }

      setQueryResult(
        res?.data ||
          null
      );
    };

  /* =======================================================
     Pay
  ======================================================= */

  const onPay =
    async () => {
      if (
        checkout.status !== "ready" ||
        priceLoading ||
        loading ||
        paymentLockRef.current
      ) {
        return;
      }

      if (uncertainPaymentRef.current) {
        Alert.alert(t("payment.title"), "تعذر التأكد من نتيجة العملية. يرجى مراجعة سجل عملياتك قبل إعادة المحاولة.",
          [{text:"سجل المدفوعات",onPress:()=>navigation.navigate("MyPayments")}]);
        return;
      }
      if (product?.query_enabled && !inquiryIsPayable(queryResult,inquiryInputRef.current,inquiryInputKey)) {
        Alert.alert(t("payment.title"), "يلزم استعلام ناجح مرتبط ببيانات الحساب وصلاحية مؤكدة من الخدمة قبل الدفع. أعد الاستعلام؛ إذا لم تتوفر الصلاحية يرجى التواصل مع الدعم.");
        return;
      }
      if (
        !priceCalculatorData ||
        !Number.isFinite(
          total
        ) ||
        total <= 0
      ) {
        Alert.alert(
          t(
            "payment.title"
          ),
          "السعر غير جاهز بعد، حاول بعد لحظات."
        );

        return;
      }

      if (
        requirements?.length
      ) {
        const missing =
          findMissingRequiredRequirements(
            requirements,
            requirementValues
          );

        if (
          missing.length
        ) {
          Alert.alert(
            t(
              "payment.title"
            ),
            `الحقول التالية مطلوبة:\n${missing
              .map(
                (r) =>
                  r.field_name
              )
              .join(" ، ")}`
          );

          return;
        }
      }

      if (
        product?.requiresGamerId &&
        !gamerId.trim()
      ) {
        Alert.alert(
          t(
            "payment.gamerId"
          ),
          t(
            "payment.enterYourId"
          )
        );

        return;
      }

      const spid =
        product?.store_product_id ??
        product?.id;

      if (
        spid == null ||
        spid === "dev"
      ) {
        Alert.alert(
          t(
            "payment.missingProductTitle"
          ),
          t(
            "payment.missingProductBody"
          )
        );

        return;
      }

      if (
        isPackages &&
        !selected
      ) {
        Alert.alert(
          t(
            "payment.pickPack"
          ),
          t(
            "payment.pickPackBody"
          )
        );

        return;
      }

      if (
        !walletBalances
      ) {
        Alert.alert(
          t(
            "payment.title"
          ),
          "تعذر قراءة رصيد المحفظة حالياً."
        );

        return;
      }

      setPaymentFields({});
      const amountToCharge =
        total;

      let available = 0;

      try {
        const normalized =
          normalizeWalletsResponse(
            walletBalances ||
              {}
          );

        const wallet =
          normalized.find(
            (w) =>
              w.currency ===
              walletCurrency
          );

        if (!wallet) {
          Alert.alert(
            t(
              "payment.title"
            ),
            `لا توجد محفظة ${walletCurrency}.`
          );

          return;
        }

        available =
          Number(
            wallet.raw
              ?.available_balance ??
              wallet.available ??
              0
          );

      } catch {
        Alert.alert(
          t(
            "payment.title"
          ),
          "تعذر قراءة رصيد المحفظة، حاول لاحقاً."
        );

        return;
      }

      paymentLockRef.current =
        true;

      const verifyCurrentPrice = async () => {
      try {
        const params={wallet_currency:walletCurrency};
        if (isPackages && selected?.value != null) params.selected_option=String(selected.value);
        else params.amount=String(safeQty);
        const latest=await getPriceCalculator(Number(productId),params);
        if (!checkoutAliveRef.current) return false;
        const latestTotal=latest?.ok ? calculatorTotal(latest.data,walletCurrency) : null;
        if (latestTotal == null) {
          paymentLockRef.current=false;
          Alert.alert(t("payment.title"), latest?.error || "تعذر التحقق من السعر الحالي. أعد المحاولة.");
          return false;
        }
        setPriceCalculatorData(latest.data);
        if (latestTotal !== amountToCharge) {
          paymentLockRef.current=false;
          Alert.alert(t("payment.title"), "تغير السعر. راجع السعر الجديد ثم أكد الشراء مجدداً.");
          return false;
        }
        return true;
      } catch(error) {
        paymentLockRef.current=false;
        Alert.alert(t("payment.title"),getApiErrorMessage(error));
        return false;
      }
      };
      if (!await verifyCurrentPrice()) return;
      const confirmed =
        await new Promise(
          (resolve) => {
            Alert.alert(
              t(
                "payment.title"
              ),
              `تأكيد شراء ${
                product?.name ||
                "المنتج"
              } مقابل ${amountToCharge} ${walletCurrency}؟`,
              [
                {
                  text: t(
                    "common.cancel",
                    "إلغاء"
                  ),
                  style:
                    "cancel",
                  onPress:
                    () =>
                      resolve(
                        false
                      ),
                },

                {
                  text: t(
                    "common.ok",
                    "تأكيد"
                  ),
                  onPress:
                    () =>
                      resolve(
                        true
                      ),
                },
              ],
              {
                cancelable:
                  true,

                onDismiss:
                  () =>
                    resolve(
                      false
                    ),
              }
            );
          }
        );

      if (!checkoutAliveRef.current || !confirmed) {
        paymentLockRef.current =
          false;

        return;
      }

      if (!await verifyCurrentPrice()) return;

      if (product?.query_enabled && !inquiryIsPayable(queryResult,inquiryInputRef.current,inquiryInputKey)) {
        paymentLockRef.current=false;
        Alert.alert(t("payment.title"), "انتهت صلاحية الاستعلام. يرجى الاستعلام مجدداً.");
        return;
      }
      const requirementPayload =
        buildRequirementPayload(
          requirements,
          requirementValues
        );

      const user_inputs =
        buildPaymentUserInputs({
          product,
          gamerId,
          requirementPayload,

          isPackages,
          selected,

          isRange,
          safeQty,

          preUserInputs,
          isAgentFlow,

          total,
          walletCurrency,
        });

      try {
        setLoading(true);

        const payloadData =
          buildPaymentPayloadData({
            userInputs:
              user_inputs,

            fx,

            baseCurrency,
            unitPrice,

            available,

            isRange,
            safeQty,

            isPackages,
            selected,

            walletCurrency,

            product,
            productId,
          });

        const res =
          await processCompletePayment(
            {
              idempotencyKey: Crypto.randomUUID(),
              store_product_id:
                payloadData.store_product_id,

              product_id:
                payloadData.product_id,

              user_inputs:
                payloadData.user_inputs,

              walletBalance:
                available,

              finalAmount:
                amountToCharge,

              currency:
                walletCurrency,

              amount:
                payloadData.amount,

              selected_option:
                payloadData.selected_option,

              wallet_currency:
                payloadData.wallet_currency,
            }
          );

        if (!res?.ok) {
          setPaymentFields(res?.fields || {});
          if (res?.outcomeUnknown) uncertainPaymentRef.current = true;
          Alert.alert(
            t(
              "payment.title"
            ),
            buildErrorMessage(
              res,
              t
            )
          );

          return;
        }

        const successMessage =
          res?.data
            ?.message ||
          t(
            "payment.successBody"
          );

        Alert.alert(
          res.step === "payment_pending" ? "العملية قيد المعالجة" : t(
            "payment.successTitle"
          ),
          successMessage,
          [
            {
              text: t(
                "common.ok"
              ),

              onPress:
                () =>
                  navigation.navigate(
                    "MyPayments"
                  ),
            },
          ]
        );
      } catch (err) {
        if (err?.outcomeUnknown) uncertainPaymentRef.current = true;
        const msg =
          extractServerMessage(
            err
          );

        Alert.alert(
          t(
            "payment.title"
          ),
          msg ||
            t(
              "common.networkError"
            )
        );
      } finally {
        setLoading(false);

        paymentLockRef.current =
          false;
      }
    };

  /* =======================================================
     Screen Info
  ======================================================= */

  const NAV_H =
    sy(90);

  const titleText =
    product?.name ||
    t(
      "payment.productFallback"
    );

  const disablePay =
    loading ||
    pricingBoot ||
    checkout.status !== "ready" ||
    priceLoading ||
    (
      isPackages &&
      !selected
    ) ||
    !priceCalculatorData ||
    !Number.isFinite(
      total
    ) ||
    total <= 0;

  /* =======================================================
     Render
  ======================================================= */

  return (
    <Screenn
      bgColor={colors.bg}
      style={{
        paddingTop: 0,
        paddingBottom:
          insets.bottom +
          NAV_H,
      }}
    >
      {/* ================= HERO ================= */}

      <LinearGradient
        colors={[
          "#0B63D8",
          "#2A6DCA",
        ]}
        start={{
          x: 0,
          y: 0,
        }}
        end={{
          x: 1,
          y: 1,
        }}
        style={{
          paddingTop:
            insets.top +
            G.md,

          paddingBottom:
            G.lg,

          paddingHorizontal:
            sx(20),

          borderBottomLeftRadius:
            R.xl,

          borderBottomRightRadius:
            R.xl,
        }}
      >
        <View
          style={{
            flexDirection:
              "row-reverse",

            alignItems:
              "center",

            gap: sx(10),
          }}
        >
          <View
            style={{
              flex: 1,

              paddingVertical:
                G.sm,

              paddingHorizontal:
                sx(14),

              borderRadius:
                R.xxl,

              backgroundColor:
                "rgba(255,255,255,0.12)",

              borderWidth: 1,

              borderColor:
                "rgba(255,255,255,0.28)",
            }}
          >
            <Text
              numberOfLines={2}
              style={[
                T.heroXL,
                {
                  includeFontPadding:
                    false,

                  width:
                    "100%",
                },
              ]}
            >
              {titleText}
            </Text>
          </View>

          <FavButton
            fav={fav}
            favBusy={
              favBusy
            }
            toggleFav={
              toggleFav
            }
            sx={sx}
            sy={sy}
            sp={sp}
          />
        </View>
      </LinearGradient>

      {/* ================= CONTENT ================= */}

      <KeyboardAvoidingView
        behavior={
          Platform.OS ===
          "ios"
            ? "padding"
            : undefined
        }
        style={{
          flex: 1,
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal:
              sx(18),

            paddingTop:
              G.md,

            paddingBottom:
              sy(250),

            flexGrow: 1,
          }}
        >
          <View
            style={{
              flexGrow: 1,
              justifyContent:
                "center",
            }}
          >
            {checkout.loading && <View accessibilityLabel={t("checkout.loading")} style={{padding:24,alignItems:"center"}}><ActivityIndicator color={colors.primary}/><Text style={T.body}>{t("checkout.loading")}</Text></View>}
            {!!checkout.error && <Card R={R} pad={G.md}><Text style={{color:"#B42318",textAlign:"right"}}>{checkout.error}</Text><Pressable style={{minHeight:44,justifyContent:"center"}} onPress={checkout.retry}><Text style={T.bodyB}>{t("common.tryAgain")}</Text></Pressable></Card>}
            {checkout.status === "ready" && <>
              <Card R={R} pad={G.md}>
                {!!getProductDisplayImage(product) && <Image source={{uri:getProductDisplayImage(product)}} resizeMode="contain" style={{width:"100%",height:160}}/>}
                {!!product.description && <Text style={T.body}>{product.description}</Text>}
                {!!product.section_name && <Text style={T.caption}>{t("checkout.section")}: {product.section_name}</Text>}
                <Text style={T.caption}>{t("checkout.available")}</Text>
              </Card>
              {priceLoading && <Text style={T.caption}>{t("checkout.loadingPrice")}</Text>}
              {!!priceError && <Card R={R} pad={G.md}><Text style={{color:"#B42318",textAlign:"right"}}>{priceError}</Text><Pressable onPress={()=>setPriceAttempt(value=>value+1)} style={{minHeight:44,justifyContent:"center"}}><Text>{t("common.tryAgain")}</Text></Pressable></Card>}
            {/* ================= Recipient ================= */}

            {hasRecipient && (
              <Card
                R={R}
                pad={G.md}
              >
                <Text
                  style={
                    T.caption
                  }
                >
                  المستلم
                </Text>

                <Text
                  style={[
                    T.bodyB,
                    {
                      marginTop:
                        G.xs,

                      fontSize:
                        sp(18),
                    },
                  ]}
                >
                  {
                    recipientLine
                  }
                </Text>
              </Card>
            )}

            {/* ================= Requirements ================= */}

            {requirements?.length >
              0 && (
              <Card
                R={R}
                pad={G.lg}
              >
                <Text
                  style={
                    T.title
                  }
                >
                  بيانات المنتج
                </Text>

                {requirements.map(
                  (req) => {
                    const key =
                      req.payload_key ||
                      req.field_name;

                    const val =
                      requirementValues[
                        key
                      ] ?? "";

                    const type =
                      (
                        req.field_type ||
                        "text"
                      ).toLowerCase();

                    let keyboardType =
                      "default";

                    if (
                      type ===
                        "number" ||
                      type ===
                        "phone" ||
                      type ===
                        "id"
                    ) {
                      keyboardType =
                        "numeric";
                    } else if (
                      type ===
                      "email"
                    ) {
                      keyboardType =
                        "email-address";
                    }

                    const isLTRInput =
                      type ===
                        "number" ||
                      type ===
                        "phone" ||
                      type ===
                        "id" ||
                      type ===
                        "email";

                    return (
                      <View
                        key={
                          req.id ||
                          key
                        }
                        style={{
                          marginTop:
                            G.sm,
                        }}
                      >
                        <Text
                          style={
                            T.caption
                          }
                        >
                          {
                            req.field_name
                          }

                          {req.is_required ? (
                            <Text
                              style={{
                                color:
                                  "#E05959",

                                fontWeight:
                                  "900",
                              }}
                            >
                              {" "}
                              *
                            </Text>
                          ) : null}
                        </Text>

                        {req.options?.length ? <View style={{flexDirection:"row-reverse",flexWrap:"wrap",gap:8}}>
                          {req.options.map(option => {
                            const optionValue=String(option?.value ?? option);
                            return <Pressable key={optionValue} accessibilityRole="button" accessibilityState={{selected:String(val)===optionValue}}
                              disabled={loading} onPress={()=>setRequirementValues(previous=>({...previous,[key]:optionValue}))}
                              style={{minHeight:44,padding:10,borderRadius:10,borderWidth:1,borderColor:String(val)===optionValue ? "#1274F5" : "#E4ECF2"}}><Text>{String(option?.label ?? option?.value ?? option)}</Text></Pressable>;
                          })}
                        </View> : (
                        <TextInput
                          style={[
                            S.input,

                            isLTRInput && {
                              textAlign:
                                "left",

                              writingDirection:
                                "ltr",
                            },
                          ]}
                          value={
                            val
                          }
                          onChangeText={(
                            txt
                          ) =>
                            setRequirementValues(
                              (
                                prev
                              ) => ({
                                ...prev,

                                [key]:
                                  txt,
                              })
                            )
                          }
                          placeholder={
                            req.placeholder ||
                            `أدخل ${req.field_name}`
                          }
                          placeholderTextColor="#8AA0B5"
                          keyboardType={
                            keyboardType
                          }
                          editable={
                            !loading
                          }
                          autoCapitalize={
                            type ===
                            "email"
                              ? "none"
                              : "sentences"
                          }
                          autoCorrect={
                            type ===
                            "email"
                              ? false
                              : true
                          }
                        />
                        )}

                        {!!(paymentFields[key] || paymentFields[`user_inputs.${key}`]) && <Text style={{color:"#B42318",textAlign:"right"}}>{getApiErrorMessage(paymentFields[key] || paymentFields[`user_inputs.${key}`])}</Text>}
                        {req.is_required &&
                          !val.trim() && (
                            <Text
                              style={[
                                T.caption,
                                {
                                  color:
                                    "#E05959",

                                  marginTop:
                                    G.xs,

                                  fontSize:
                                    sp(12),
                                },
                              ]}
                            >
                              هذا الحقل
                              إجباري
                            </Text>
                          )}
                      </View>
                    );
                  }
                )}
              </Card>
            )}

            {/* ================= Product Query ================= */}

            {product?.query_enabled && (
              <Card
                R={R}
                pad={G.lg}
              >
                <Text
                  style={
                    T.title
                  }
                >
                  التحقق من
                  الحساب
                </Text>

                <Text
                  style={[
                    T.caption,
                    {
                      marginTop:
                        G.xs,
                    },
                  ]}
                >
                  تحقق من البيانات
                  قبل إتمام عملية
                  الشراء.
                </Text>

                <Pressable
                  onPress={
                    handleQuery
                  }
                  disabled={
                    queryLoading ||
                    loading ||
                    isQueryPending
                  }
                  android_ripple={{
                    color:
                      "#E5E7EB",
                  }}
                  style={[
                    S.btn,
                    {
                      marginTop:
                        G.md,

                      opacity:
                        queryLoading ||
                        loading ||
                        isQueryPending
                          ? 0.7
                          : 1,
                    },
                  ]}
                >
                  <Text
                    style={
                      S.btnText
                    }
                  >
                    {queryLoading
                      ? "جاري التحقق..."
                      : "تحقق الآن"}
                  </Text>
                </Pressable>

                {isQueryPending && (
                  <View
                    style={{
                      marginTop:
                        G.sm,

                      alignSelf:
                        "flex-end",

                      paddingHorizontal:
                        G.md,

                      paddingVertical:
                        G.xs,

                      borderRadius:
                        R.lg,

                      backgroundColor:
                        "#E7F0FF",

                      borderWidth:
                        1,

                      borderColor:
                        "#BFD7FF",
                    }}
                  >
                    <Text
                      style={[
                        T.caption,
                        {
                          color:
                            "#0B63D8",

                          fontWeight:
                            "800",
                        },
                      ]}
                    >
                      جاري التحقق...
                    </Text>
                  </View>
                )}

                {!!queryError && (
                  <Text
                    style={[
                      T.caption,
                      {
                        marginTop:
                          G.sm,

                        color:
                          "#B42318",

                        fontWeight:
                          "800",
                      },
                    ]}
                  >
                    {
                      queryError
                    }
                  </Text>
                )}

                {!!queryResult && (() => {
                  const bill = queryResult.invoice || queryResult.data?.invoice || queryResult.query?.invoice;
                  if (!bill || typeof bill !== "object") return null;
                  return <View style={{gap:6,marginTop:G.sm}}>
                    {[["قيمة الفاتورة",bill.amount != null && bill.currency ? `${bill.amount} ${bill.currency}` : null],
                      ["حالة الفاتورة",bill.status],["الفترة",bill.period],["المرجع",bill.reference]].map(([label,value]) =>
                        value != null && <Text key={label} style={{textAlign:"right"}}>{label}: {String(value)}</Text>)}
                  </View>;
                })()}
                {!!queryDisplay &&
                  !isQueryPending && (
                    <View
                      style={{
                        marginTop:
                          G.sm,
                      }}
                    >
                      <Text
                        style={[
                          T.caption,
                          {
                            color:
                              "#0F172A",

                            fontWeight:
                              "700",
                          },
                        ]}
                      >
                        {String(
                          queryDisplay.message ||
                            queryDisplay.status ||
                            ""
                        )}
                      </Text>
                    </View>
                  )}
              </Card>
            )}

            {/* ================= Pricing ================= */}

            <Card
              R={R}
              pad={G.lg}
            >
              {pricingBoot ? (
                <Text
                  style={[
                    T.caption,
                    {
                      textAlign:
                        "center",
                    },
                  ]}
                >
                  {t(
                    "common.loading"
                  )}
                </Text>
              ) : isPackages ? (
                <PackagesDropdown
                  T={T}
                  G={G}
                  R={R}
                  sx={sx}
                  sy={sy}
                  options={
                    options
                  }
                  selected={
                    selected
                  }
                  setSelected={
                    setSelected
                  }
                  disabled={
                    loading
                  }
                />
              ) : (
                <View>
                  <Text
                    style={[
                      T.caption,
                      {
                        marginBottom:
                          G.xs,
                      },
                    ]}
                  >
                    {String(
                      t(
                        "products.chooseQty",
                        "اختر الكمية (من {{min}} إلى {{max}})"
                      )
                    )
                      .replace(
                        "{{min}}",
                        String(
                          minQ
                        )
                      )
                      .replace(
                        "{{max}}",
                        String(
                          maxQ
                        )
                      )}
                  </Text>

                  <QtyChooser
                    G={G}
                    R={R}
                    sx={sx}
                    sy={sy}
                    sp={sp}
                    T={T}
                    value={
                      qtyStr
                    }
                    onChangeText={
                      setQtyStr
                    }
                    rawQty={
                      rawQty
                    }
                    minQ={minQ}
                    maxQ={maxQ}
                    step={step}
                    bump={bump}
                    loading={
                      loading
                    }
                    onBlur={() => {
                      const valid =
                        Math.max(
                          minQ,
                          Math.min(
                            rawQty,
                            maxQ
                          )
                        );

                      setQtyStr(
                        String(
                          valid
                        )
                      );
                    }}
                  />
                </View>
              )}

              {!pricingBoot && (
                <View
                  style={{
                    marginTop:
                      G.md,

                    gap:
                      G.sm,
                  }}
                >
                  {/* السعر فقط بدل سعر الوحدة + الإجمالي */}

                  <Row
                    label="السعر"
                    value={total == null ? t("checkout.priceUnavailable") : `${total} ${currency}`}
                    T={T}
                    big
                  />

                  {/* عملة الدفع */}

                  {!!setCurrency && (
                    <View
                      style={{
                        marginTop:
                          G.xs,

                        alignItems:
                          "flex-end",
                      }}
                    >
                      <Text
                        style={
                          T.caption
                        }
                      >
                        عملة الدفع
                      </Text>

                      <View
                        style={{
                          marginTop:
                            G.xs,

                          flexDirection:
                            "row-reverse",

                          backgroundColor:
                            "#F3F7FB",

                          borderWidth:
                            1,

                          borderColor:
                            "#E4ECF2",

                          borderRadius:
                            R.md,

                          padding: 3,
                        }}
                      >
                        {[
                          "USD",
                          "SYP",
                        ].map(
                          (
                            cur
                          ) => {
                            const active =
                              walletCurrency ===
                              cur;

                            return (
                              <Pressable
                                key={
                                  cur
                                }
                                onPress={() =>
                                  setCurrency(
                                    cur
                                  )
                                }
                                style={[
                                  {
                                    paddingVertical:
                                      G.xs,

                                    paddingHorizontal:
                                      G.md,

                                    borderRadius:
                                      R.sm,
                                  },

                                  active && {
                                    backgroundColor:
                                      "#FFFFFF",

                                    borderWidth:
                                      1,

                                    borderColor:
                                      "#E4ECF2",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    T.caption,

                                    {
                                      textAlign:
                                        "center",

                                      writingDirection:
                                        "ltr",
                                    },

                                    active && {
                                      color:
                                        "#0B63D8",

                                      fontWeight:
                                        "800",
                                    },
                                  ]}
                                >
                                  {
                                    cur
                                  }
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </View>
                    </View>
                  )}

                  {/* رصيد المحفظة المختارة فقط */}

                  {walletInfo && (
                    <View
                      style={{
                        marginTop:
                          G.sm,

                        paddingTop:
                          G.sm,

                        borderTopWidth:
                          1,

                        borderTopColor:
                          "#EEF2F6",
                      }}
                    >
                      <Row
                        label="الرصيد المتاح"
                        value={selectedWalletBalance == null ? t("checkout.walletUnavailable") : `${selectedWalletBalance} ${walletCurrency}`}
                        T={T}
                      />
                    </View>
                  )}
                </View>
              )}
            </Card>

            {/* ================= Gamer ID ================= */}

            {product?.requiresGamerId && (
              <Card
                R={R}
                pad={G.lg}
              >
                <Text
                  style={
                    T.caption
                  }
                >
                  {t(
                    "payment.gamerId"
                  )}
                </Text>

                <View
                  style={{
                    marginTop:
                      G.sm,

                    flexDirection:
                      "row-reverse",

                    alignItems:
                      "center",

                    backgroundColor:
                      "#FFFFFF",

                    borderWidth:
                      1.5,

                    borderColor:
                      "#E4ECF2",

                    borderRadius:
                      R.lg,

                    paddingHorizontal:
                      sx(12),

                    height:
                      sy(52),
                  }}
                >
                  <Text
                    style={{
                      fontSize:
                        sp(20),

                      marginLeft:
                        sx(8),
                    }}
                  >
                    🎮
                  </Text>

                  <TextInput
                    placeholder={t(
                      "payment.enterYourId"
                    )}
                    placeholderTextColor="#8AA0B5"
                    value={
                      gamerId
                    }
                    onChangeText={
                      setGamerId
                    }
                    editable={
                      !loading
                    }
                    style={[
                      {
                        flex: 1,
                      },
                      T.body,
                      {
                        textAlign:
                          "right",

                        writingDirection:
                          "rtl",
                      },
                    ]}
                  />
                </View>
              </Card>
            )}
            </>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ================= PAY BAR ================= */}

      <PayBar
        insets={insets}
        sy={sy}
        sx={sx}
        T={T}
        S={S}
        W={W}
        total={total}
        currency={
          currency
        }
        onPay={onPay}
        disabled={
          disablePay
        }
        loading={
          loading ||
          pricingBoot || priceLoading
        }
      />

      <View
        pointerEvents="none"
        style={{
          position:
            "absolute",

          left: 0,
          right: 0,
          bottom: 0,

          height:
            insets.bottom +
            sy(64) +
            sy(6),

          backgroundColor:
            "#FFFFFF",

          zIndex: 5,
        }}
      />
    </Screenn>
  );
}

/* =========================================================
   Card
========================================================= */

function Card({
  children,
  R,
  pad,
}) {
  return (
    <View
      style={{
        backgroundColor:
          "#FFFFFF",

        borderWidth: 1.5,

        borderColor:
          "#E4ECF2",

        borderRadius:
          R.lg,

        paddingVertical:
          pad,

        paddingHorizontal:
          pad,

        marginBottom:
          pad,

        shadowColor:
          "#000000",

        shadowOpacity:
          0.06,

        shadowRadius:
          10,

        shadowOffset: {
          width: 0,
          height: 4,
        },

        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

/* =========================================================
   Row
========================================================= */

function Row({
  label,
  value,
  T,
  big,
}) {
  return (
    <View
      style={{
        flexDirection:
          "row-reverse",

        alignItems:
          "center",

        justifyContent:
          "space-between",

        gap: 12,
      }}
    >
      <Text
        style={[
          T.caption,
          {
            flex: 1,

            textAlign:
              "right",

            writingDirection:
              "rtl",
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          big
            ? T.total
            : T.bodyB,

          {
            textAlign:
              "left",

            writingDirection:
              "ltr",
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   Round Button
========================================================= */

function RoundBtn({
  label,
  onPress,
  disabled,
  size,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{
        color:
          "#E5E7EB",

        radius:
          size / 2,
      }}
      style={{
        width: size,
        height: size,

        borderRadius:
          size / 2,

        backgroundColor:
          "#FFFFFF",

        borderWidth: 1.5,

        borderColor:
          "#E4ECF2",

        alignItems:
          "center",

        justifyContent:
          "center",

        opacity:
          disabled
            ? 0.5
            : 1,
      }}
    >
      <Text
        style={{
          fontSize:
            size *
            0.48,

          lineHeight:
            size *
            0.48,

          fontWeight:
            "900",

          color:
            "#0E1B3B",

          textAlign:
            "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* =========================================================
   Packages Dropdown
========================================================= */

function PackagesDropdown({
  T,
  G,
  R,
  sx,
  sy,
  options,
  selected,
  setSelected,
  disabled,
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const Current = () => (
    <Pressable
      onPress={() => {
        if (!disabled) {
          setOpen(
            (v) => !v
          );
        }
      }}
      android_ripple={{
        color:
          "#E5E7EB",
      }}
      style={{
        borderWidth: 1.5,

        borderColor:
          "#D7E2EC",

        borderRadius:
          R.xl,

        backgroundColor:
          "#FFFFFF",

        paddingVertical:
          G.xs,

        paddingHorizontal:
          sx(14),

        minHeight:
          sy(50),

        flexDirection:
          "row-reverse",

        alignItems:
          "center",

        justifyContent:
          "space-between",

        gap:
          sx(10),
      }}
    >
      <Text
        numberOfLines={2}
        style={[
          T.bodyB,
          {
            flex: 1,

            textAlign:
              "right",

            writingDirection:
              "rtl",
          },
        ]}
      >
        {selected?.label ??
          "اختر الباقة"}
      </Text>

      <Text
        style={{
          fontSize: 18,
          opacity: 0.7,
        }}
      >
        ▾
      </Text>
    </Pressable>
  );

  const Item = ({
    opt,
  }) => {
    const active =
      selected?.id ===
      opt.id;

    return (
      <Pressable
        onPress={() => {
          setSelected(opt);
          setOpen(false);
        }}
        android_ripple={{
          color:
            "#EEF2FF",
        }}
        style={{
          paddingVertical:
            G.sm,

          paddingHorizontal:
            sx(14),

          backgroundColor:
            active
              ? "#F1F6FF"
              : "#FFFFFF",

          borderBottomWidth:
            1,

          borderBottomColor:
            "#EEF2F6",
        }}
      >
        <Text
          style={[
            T.bodyB,
            {
              textAlign:
                "right",

              writingDirection:
                "rtl",

              color:
                active
                  ? "#0B63D8"
                  : "#0E1B3B",
            },
          ]}
        >
          {opt.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View>
      <Text
        style={[
          T.caption,
          {
            marginBottom:
              G.xs,
          },
        ]}
      >
        اختر الباقة
      </Text>

      <Current />

      {open && (
        <View
          style={{
            marginTop:
              G.xs,

            borderWidth:
              1.5,

            borderColor:
              "#D7E2EC",

            borderRadius:
              R.lg,

            backgroundColor:
              "#FFFFFF",

            overflow:
              "hidden",

            maxHeight:
              sy(240),
          }}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {options.map(
              (opt) => (
                <Item
                  key={String(
                    opt.id
                  )}
                  opt={opt}
                />
              )
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* =========================================================
   Quantity Chooser
========================================================= */

function QtyChooser({
  G,
  R,
  sx,
  sy,
  sp,
  T,
  value,
  onChangeText,
  onBlur,
  rawQty,
  minQ,
  maxQ,
  step,
  bump,
  loading,
}) {
  return (
    <View
      style={{
        flexDirection:
          "row",

        alignItems:
          "center",

        backgroundColor:
          "#FFFFFF",

        borderWidth:
          1.5,

        borderColor:
          "#E4ECF2",

        borderRadius:
          R.xl,

        padding:
          G.xs,

        opacity:
          loading
            ? 0.6
            : 1,
      }}
    >
      <RoundBtn
        label="–"
        onPress={() =>
          bump(-1)
        }
        disabled={
          rawQty <=
            minQ ||
          loading
        }
        size={sy(48)}
      />

      <TextInput
        value={value}
        onChangeText={(
          v
        ) => {
          const clean =
            v.replace(
              /[^\d]/g,
              ""
            );

          onChangeText(
            clean
          );
        }}
        onBlur={onBlur}
        keyboardType="numeric"
        editable={
          !loading
        }
        style={{
          flex: 1,

          height:
            sy(48),

          textAlign:
            "center",

          writingDirection:
            "ltr",

          fontSize:
            sp(20),

          fontWeight:
            "800",

          color:
            "#0E1B3B",
        }}
      />

      <RoundBtn
        label="+"
        onPress={() =>
          bump(1)
        }
        disabled={
          rawQty >=
            maxQ ||
          loading
        }
        size={sy(48)}
      />
    </View>
  );
}

/* =========================================================
   Pay Bar
========================================================= */

function PayBar({
  insets,
  sy,
  sx,
  T,
  S,
  W,
  total,
  currency,
  onPay,
  disabled,
  loading,
}) {
  return (
    <View
      style={{
        position:
          "absolute",

        left: 0,
        right: 0,

        bottom:
          insets.bottom +
          sy(50) +
          sy(16),

        paddingHorizontal:
          sx(18),

        paddingVertical:
          sy(12),
      }}
    >
      <View
        style={
          S.payBar
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
            style={{
              ...T.caption,

              color:
                "rgba(255,255,255,0.85)",

              textAlign:
                "right",

              writingDirection:
                "rtl",
            }}
          >
            الإجمالي
          </Text>

          <Text
            style={{
              ...T.total,

              color:
                "#FFFFFF",

              textAlign:
                "right",

              writingDirection:
                "ltr",
            }}
          >
            {total == null ? "—" : `${total} ${currency}`}
          </Text>
        </View>

        <Pressable
          onPress={onPay}
          disabled={
            disabled
          }
          android_ripple={{
            color:
              "rgba(255,255,255,0.2)",
          }}
          style={[
            S.payBtn,
            {
              minWidth:
                Math.max(
                  sx(140),
                  Math.min(
                    sx(220),
                    W * 0.5
                  )
                ),

              opacity:
                disabled
                  ? 0.7
                  : 1,
            },
          ]}
        >
          <Text
            style={
              S.payBtnText
            }
          >
            {loading
              ? "جارٍ الدفع..."
              : "إتمام الدفع"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* =========================================================
   Favorite Button
========================================================= */

function FavButton({
  fav,
  favBusy,
  toggleFav,
  sx,
  sy,
  sp,
}) {
  return (
    <Pressable
      onPress={
        toggleFav
      }
      disabled={
        favBusy
      }
      hitSlop={{
        top: 8,
        bottom: 8,
        left: 8,
        right: 8,
      }}
      android_ripple={{
        color:
          "rgba(255,255,255,0.2)",

        radius:
          sy(26),
      }}
      style={{
        width:
          sy(48),

        height:
          sy(48),

        borderRadius:
          sy(24),

        alignItems:
          "center",

        justifyContent:
          "center",

        backgroundColor:
          "rgba(255,255,255,0.16)",

        borderWidth:
          1,

        borderColor:
          "rgba(255,255,255,0.28)",

        opacity:
          favBusy
            ? 0.7
            : 1,
      }}
    >
      <Text
        style={{
          fontSize:
            sp(24),

          lineHeight:
            sp(24),
        }}
      >
        {fav
          ? "❤️"
          : "🤍"}
      </Text>
    </Pressable>
  );
}