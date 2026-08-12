// src/screens/Payment.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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

import { processCompletePayment } from "../api/payment"; // ✅ دفع حقيقي
import {
  addFavorite,
  createProductQueryWaitV2,
  getPriceCalculator,
  getUserProductById,
  getUserProductRequirements,
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
import { usePaymentRequirements } from "../features/payments/hooks/usePaymentRequirements";
import { derivePricingFromProduct } from "../features/payments/model/paymentPricing";
import {
  buildRequirementPayload,
  findMissingRequiredRequirements,
} from "../features/payments/model/paymentRequirements";
import {
  extractQueryStatus,
} from "../features/payments/model/paymentQuery";
import { useScale } from "../ui/scale";

const { colors } = appTheme;
/* ============== Responsive Styles Factory ============== */
function makeStyles(sy, sp) {
  return StyleSheet.create({
    input: {
      marginTop: sy(6),
      backgroundColor: "#FFFFFF",
      borderWidth: 1.5,
      borderColor: "#E4ECF2",
      borderRadius: sy(12),
      paddingHorizontal: sy(12),
      height: sy(52),
      fontSize: sp(16),
      lineHeight: Platform.OS === "android" ? sp(20) : undefined,
      color: "#0E1B3B",
    },
    btn: {
      backgroundColor: "#1274f5ff",
      borderRadius: sy(14),
      paddingHorizontal: sy(16),
      paddingVertical: sy(12),
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: sp(16),
      lineHeight: sp(20),
    },
    payBar: {
      backgroundColor: "#abbbe2ff",
      borderRadius: sy(16),
      paddingVertical: sy(12),
      paddingHorizontal: sy(12),
      flexDirection: "row",
      alignItems: "center",
      gap: sy(12),
      shadowColor: "#2b178eff",
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    payBtn: {
      backgroundColor: "#1274f5ff",
      paddingHorizontal: sy(20),
      height: sy(52),
      borderRadius: sy(14),
      alignItems: "center",
      justifyContent: "center",
    },
    payBtnText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: sp(18),
      lineHeight: sp(24),
    },
  });
}

/* ================= Local Favorites ================= */
const GUEST_FAVS_KEY = "@guest_favs";
const favKey = (prod) => String(prod?.id ?? prod?.store_product_id ?? prod?.name ?? "");

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
    const idx = list.findIndex((it) => favKey(it.product) === k);
    const entry = { product: prod, saved_at: Date.now() };
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    await AsyncStorage.setItem(GUEST_FAVS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch { }
}
async function removeGuestFavLocal(prod) {
  try {
    const k = favKey(prod);
    const list = await readGuestFavs();
    const next = list.filter((it) => favKey(it.product) !== k);
    await AsyncStorage.setItem(GUEST_FAVS_KEY, JSON.stringify(next));
  } catch { }
}

/** ✅ رسائل خطأ واضحة من ردّ السيرفر */
function extractServerMessage(raw) {
  try {
    if (!raw) return "";
    const data = raw?.response?.data ?? raw?.data ?? raw;
    if (typeof data === "string") return data;
    if (Array.isArray(data)) return data.map(String).join("\n");
    if (typeof data === "object") {
      if (data.detail) return String(data.detail);
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        const v = data[firstKey];
        if (Array.isArray(v)) return v.map(String).join("\n");
        return `${firstKey}: ${String(v)}`;
      }
    }
    return "";
  } catch {
    return "";
  }
}

/** ✅ بناء رسالة خطأ شاملة بناءً على مرحلة الفشل */
function buildErrorMessage(res, t) {
  const step = res?.step;
  const error = res?.error;

  const stepMessages = {
    validation: "بيانات غير صحيحة: " + error,
    balance_check: error || "لا يوجد رصيد في محفظتك",
    auth: error || "جلستك انتهت، يرجى تسجيل الدخول",
    product_not_found: error || "المنتج غير موجود",
    payment_processing: error || "فشلت عملية الدفع",
    api_error: error || "خطأ في الاتصال بالسيرفر",
  };

  return stepMessages[step] || error || (t?.("common.networkError") || "حدث خطأ ما");
}

/* ================= Component ================= */
export default function Payment({ route, navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user?.id || user?.raw?.id || user?.username || user?.email || user?.phone);
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const currencyCtx = useCurrency?.();
  const { currency: appCurrency = "USD", setCurrency } = currencyCtx || {};
  const { sx, sy, sp } = useScale();

  const S = useMemo(() => makeStyles(sy, sp), [sy, sp]);

  const G = { xxs: sy(6), xs: sy(8), sm: sy(12), md: sy(16), lg: sy(20), xl: sy(28) };
  const R = { sm: sp(10), md: sp(14), lg: sp(18), xl: sp(22), xxl: sp(28) };
  const T = {
    caption: { fontSize: sp(14), lineHeight: sp(20), color: "#5F708C", letterSpacing: 0.2 },
    body: { fontSize: sp(16), lineHeight: sp(22), color: "#0E1B3B" },
    bodyB: { fontSize: sp(16), lineHeight: sp(22), color: "#0E1B3B", fontWeight: "800" },
    title: { fontSize: sp(20), lineHeight: sp(26), color: "#0E1B3B", fontWeight: "900" },
    heroXL: {
      fontSize: sp(28),
      lineHeight: sp(34),
      color: "#fff",
      fontWeight: "900",
      letterSpacing: 0.2,
      textShadowColor: "rgba(0,0,0,0.25)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
    },
    total: { fontSize: sp(24), lineHeight: sp(30), color: "#0E1B3B", fontWeight: "900" },
  };

  const params = useMemo(() => route?.params ?? {}, [route?.params]);
  const p0 = useMemo(
    () =>
      params.product ?? {
        id: "dev",
        store_product_id: null,
        name: t("payment.productFallback", "المنتج"),
        currency: "USD",
        price: 0,
        requiresGamerId: false,
        qty: { min: 1, max: 999999, step: 1, defaultValue: 1 },
        is_favorite: false,
      },
    [params, t]
  );

  const productId = params?.product_id ?? params?.id ?? p0?.id ?? null;

  const preUserInputs = params?.user_inputs_prefill || null;
  const isAgentFlow = params?.is_agent === true || params?.flow === "agent" || !!preUserInputs?.target_user_id;

  const preMode = params?.mode ?? null;
  const preOptions = Array.isArray(params?.options) ? params.options : null;
  const preRange = params?.range ?? null;
  const preSelectedId = params?.selected_id ?? null;

  const preDispCurr = (params?.display_currency || params?.currency || "").toString().toUpperCase() || null;
  

  const [product, setProduct] = useState(p0);
  const [pricing, setPricing] = useState({
    mode: preMode ?? params.mode ?? null,
    options: preOptions ?? (Array.isArray(params.options) ? params.options : []),
    range: preRange ?? params.range ?? null,
    currency: p0?.currency || preDispCurr || "USD",
  });
  const [pricingBoot, setPricingBoot] = useState(true);

  // ✅ FX من Wallet response (fallback فقط)
  const [fx, setFx] = useState(null);

  const [walletBalances, setWalletBalances] = useState(null);
  const walletCurrency = (appCurrency || "USD").toUpperCase();

  const [priceCalculatorData, setPriceCalculatorData] = useState(null); // ✅ مصدر الأسعار

  const [requirements, setRequirements] = useState([]);
  const [requirementValues, setRequirementValues] = useState({});

  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState("");
  const [queryStatus, setQueryStatus] = useState(null);

  const { isQueryPending, queryDisplay } = usePaymentQueryState({
    queryLoading,
    queryStatus,
    queryResult,
  });

  // ✅ تحميل المحافظ + FX (مرة واحدة)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const w = await getWallet();
        if (!alive) return;

        setWalletBalances(w);

        const rates = normalizeExchangeRates(w);
        const usdToSyp = rates?.usd_to_syp != null ? Number(rates.usd_to_syp) : null;
        const sypToUsd = rates?.syp_to_usd != null ? Number(rates.syp_to_usd) : null;

        if (usdToSyp || sypToUsd) setFx({ usd_to_syp: usdToSyp, syp_to_usd: sypToUsd });
        else setFx(null);
      } catch {
        if (alive) {
          setWalletBalances(null);
          setFx(null);
        }
      }
    })();

    return () => { alive = false; };
  }, []);

  // ✅ تحميل المنتج + التسعير
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const hasPrePricing =
          (preMode === "packages" && preOptions?.length) ||
          (preMode === "range" && preRange);

        if (hasPrePricing) {
          const next = {
            mode: preMode ?? null,
            options: preOptions ?? [],
            range: preRange ?? null,
            currency: preDispCurr || p0?.currency || "USD",
          };
          if (alive) {
            setPricing(next);
            setPricingBoot(false);
          }
          return;
        }

        let prod = p0;
        if (productId && productId !== "dev") {
          const full = await getUserProductById(Number(productId)).catch(() => null);
          if (alive && full) {
            prod = full;
            setProduct(full);
          }
        }

        const d = derivePricingFromProduct(prod, (appCurrency || "USD").toUpperCase());
        if (alive) setPricing(d);
      } finally {
        if (alive) setPricingBoot(false);
      }
    })();

    return () => { alive = false; };
  }, [productId, appCurrency, preMode, preRange, preDispCurr, preOptions, p0]);

  // ======= تعريف mode/options/range/isPackages/isRange/qty قبل أي useEffect يعتمد عليهم =======
  const [qtyStr, setQtyStr] = useState(
    String(
      product?.qty?.defaultValue ??
      Number(
        (pricing.mode === "range" || (!!pricing.range && (pricing.range?.min != null || pricing.range?.max != null)))
          ? pricing.range?.min ?? 1
          : product?.qty?.min ?? 1
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
  } = usePaymentPricing({ pricing, product, qtyStr });

  const [selected, setSelected] = useState(
    isPackages ? options.find((o) => o?.id === preSelectedId) || options[0] : null
  );

  useEffect(() => {
    if (isPackages && options.length > 0) {
      const sel = options.find((o) => o?.id === preSelectedId) || options[0];
      setSelected(sel);
    } else {
      setSelected(null);
    }
  }, [isPackages, options, preSelectedId]);

  useEffect(() => {
    setQtyStr(String(product?.qty?.defaultValue ?? minQ));
  }, [product?.qty?.defaultValue, minQ]);

  const bump = (dir) => {
    if (isPackages) return;
    const next = dir === 1 ? rawQty + step : rawQty - step;
    const clamped = Math.max(minQ, Math.min(next, maxQ));
    setQtyStr(String(clamped));
  };

  const baseCurrency =
    (isPackages ? selected?.currency || options[0]?.currency : range?.currency) ||
    product?.currency ||
    "USD";

  const outCurrency = (walletCurrency || preDispCurr || baseCurrency).toUpperCase();

  // ✅ استدعاء price_calculator عند تغيير الاختيارات/الكمية/عملة المحفظة
  useEffect(() => {
    let alive = true;

    (async () => {
      if (pricingBoot || !productId || productId === "dev") return;

      const params = { wallet_currency: walletCurrency };

      if (isPackages && selected?.value) {
        params.selected_option = String(selected.value);
      } else if (isRange && safeQty > 0) {
        params.amount = String(safeQty);
      }

      try {
        const res = await getPriceCalculator(Number(productId), params);
        if (alive && res.ok) setPriceCalculatorData(res.data);
        else if (alive) setPriceCalculatorData(null);
      } catch {
        if (alive) setPriceCalculatorData(null);
      }
    })();

    return () => { alive = false; };
  }, [pricingBoot, productId, isPackages, selected?.value, isRange, safeQty, walletCurrency]);

  // ======= الأسعار المعروضة = الباك (price_calculator هو مصدر الحقيقة) =======
  const calcWalletCurrency = priceCalculatorData?.wallet_currency
    ? String(priceCalculatorData.wallet_currency).toUpperCase()
    : null;

  const hasWalletCalc =
    priceCalculatorData?.wallet_user_final_price != null &&
    calcWalletCurrency === walletCurrency;

  const backendTotalRaw = hasWalletCalc
    ? priceCalculatorData?.wallet_user_final_price
    : priceCalculatorData?.user_final_price;

  const total = Number.isFinite(+backendTotalRaw) ? +(+backendTotalRaw).toFixed(4) : 0;

  const currency = hasWalletCalc
    ? walletCurrency
    : String(priceCalculatorData?.currency || outCurrency || baseCurrency || "USD").toUpperCase();

  // سعر الوحدة للعرض:
  // - range: total / qty
  // - packages: total (لأن qty=1)
  const unitPrice = total > 0
    ? (isRange && safeQty > 0 ? +(total / safeQty).toFixed(4) : total)
      : 0;

  // سطر "سعر الوحدة" عندك كان يبدأ من minQ، خليه نفس منطقك:
  const displayUnitPrice = isRange ? +(unitPrice * minQ).toFixed(4) : unitPrice;

  // ======= باقي الشغل =======
  const [gamerId, setGamerId] = useState("");
  const [loading, setLoading] = useState(false);
  const paymentLockRef = useRef(false);

  const [fav, setFav] = useState(Boolean(product?.is_favorite));
  const [favBusy, setFavBusy] = useState(false);
  const favoriteLockRef = useRef(false);
  const normalizedProductRequirements = usePaymentRequirements(product);

  // تحميل متطلبات المنتج (نفس منطق Payment.js السابق)
  useEffect(() => {
    setRequirements(normalizedProductRequirements);
  }, [normalizedProductRequirements]);

  useEffect(() => {
    setQueryResult(null);
    setQueryError("");
    setQueryStatus(null);
  }, [product?.id]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!product?.id) return;
      if (requirements?.length) return;
      try {
        const reqs = await getUserProductRequirements(product.id);
        if (alive && Array.isArray(reqs) && reqs.length) setRequirements(reqs);
      } catch { }
    })();

    return () => { alive = false; };
  }, [product?.id, requirements?.length]);

  useEffect(() => {
    if (!requirements?.length) return;
    setRequirementValues((prev) => {
      const next = { ...prev };
      requirements.forEach((r) => {
        const key = r.payload_key || r.field_name;
        if (key && next[key] == null) next[key] = "";
      });
      return next;
    });
  }, [requirements]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isAuthenticated) {
        if (alive) setFav(Boolean(product?.is_favorite));
        return;
      }
      const liked = await isGuestFavLocal(product);
      if (alive) setFav(liked);
    })();
    return () => { alive = false; };
  }, [isAuthenticated, product]);

  const toggleFav = async () => {
    if (favoriteLockRef.current) return;
    favoriteLockRef.current = true;
    try {
      setFavBusy(true);
      const next = !fav;
      if (isAuthenticated) {
        const productId = Number(product?.id);
        if (!Number.isFinite(productId)) throw new Error("معرّف المنتج غير متوفر.");
        if (next) await addFavorite(productId);
        else await removeFavorite(productId);
      } else {
        if (next) await addGuestFavLocal(product);
        else await removeGuestFavLocal(product);
      }
      setFav(next);
    } catch (favoriteError) {
      const message = favoriteError?.response?.data?.detail || favoriteError?.response?.data?.error || favoriteError?.message || t("payment.updateFavFailed");
      Alert.alert(t("common.networkError"), String(message));
    } finally {
      setFavBusy(false);
      favoriteLockRef.current = false;
    }
  };

  const hasRecipient =
    preUserInputs &&
    (preUserInputs.user_id ||
      preUserInputs.target_user_id ||
      preUserInputs.name ||
      preUserInputs.target_user_name);

  const recipientLine = useMemo(() => {
    const uid = preUserInputs?.user_id ?? preUserInputs?.target_user_id ?? null;
    const nm = preUserInputs?.name ?? preUserInputs?.target_user_name ?? null;
    if (!uid && !nm) return "";
    if (uid && nm) return `${nm} (#${uid})`;
    if (uid) return `#${uid}`;
    return nm || "";
  }, [preUserInputs]);

  const walletInfo = useMemo(() => {
    if (!walletBalances) return null;
    try {
      const list = normalizeWalletsResponse(walletBalances);
      const usd = list.find((w) => w.currency === "USD");
      const syp = list.find((w) => w.currency === "SYP");
      return {
        usd: usd ? Number(usd.available || 0) : null,
        syp: syp ? Number(syp.available || 0) : null,
      };
    } catch {
      return null;
    }
  }, [walletBalances]);

  const handleQuery = async () => {
    if (!product?.id || !product?.query_enabled) return;
    if (queryLoading || isQueryPending) return;

    if (requirements?.length) {
      const missing = findMissingRequiredRequirements(requirements, requirementValues);
      if (missing.length) {
        Alert.alert(
          t("payment.title"),
          `الحقول التالية مطلوبة للاستعلام:\n${missing.map((r) => r.field_name).join(" ، ")}`
        );
        return;
      }
    }

    setQueryLoading(true);
    setQueryError("");
    setQueryResult(null);
    setQueryStatus("pending");

    const res = await createProductQueryWaitV2(product.id, buildRequirementPayload(requirements, requirementValues));
    setQueryLoading(false);

    if (!res?.ok) {
      setQueryError(res?.error || "تعذر تنفيذ الاستعلام.");
      setQueryStatus(null);
      return;
    }

    if (res?.data?.timeout) {
      setQueryError("الاستعلام مازال قيد المعالجة، حاول مجددًا.");
      setQueryStatus(null);
      return;
    }

    const status = extractQueryStatus(res?.data);
    if (status) setQueryStatus(status);
    setQueryResult(res?.data || null);
  };

  const onPay = async () => {
    if (loading || paymentLockRef.current) return;
    // ✅ لازم يكون عندنا سعر من الباك
    if (!priceCalculatorData || !Number.isFinite(total) || total <= 0) {
      Alert.alert(t("payment.title"), "السعر غير جاهز بعد. حاول بعد لحظات.");
      return;
    }

    if (requirements?.length) {
      const missing = findMissingRequiredRequirements(requirements, requirementValues);
      if (missing.length) {
        Alert.alert(
          t("payment.title"),
          `الحقول التالية مطلوبة:\n${missing.map((r) => r.field_name).join(" ، ")}`
        );
        return;
      }
    }

    if (product?.requiresGamerId && !gamerId.trim()) {
      Alert.alert(t("payment.gamerId"), t("payment.enterYourId"));
      return;
    }

    const spid = product?.store_product_id ?? product?.id;
    if (spid == null || spid === "dev") {
      Alert.alert(t("payment.missingProductTitle"), t("payment.missingProductBody"));
      return;
    }

    if (isPackages && !selected) {
      Alert.alert(t("payment.pickPack"), t("payment.pickPackBody"));
      return;
    }

    if (!walletBalances) {
      Alert.alert(
        t("payment.title"),
        "لا يمكن قراءة رصيد المحفظة حالياً، افتح صفحة المحفظة لتحديث الرصيد ثم حاول مجدداً."
      );
      return;
    }

    // ✅ نفس السعر المعروض بالواجهة = نفس اللي بينخصم
    const amountToCharge = total;

    // تحقق رصيد المحفظة
    let available = 0;
    try {
      const normalized = normalizeWalletsResponse(walletBalances || {});
      const wallet = normalized.find((w) => w.currency === walletCurrency);

      if (!wallet) {
        Alert.alert(t("payment.title"), `لا توجد محفظة ${walletCurrency}. يرجى التأكد من إعدادات المحفظة.`);
        return;
      }

      available = Number(
        wallet.raw?.balance ??
        wallet.raw?.available_balance ??
        wallet.available ??
        0
      );

      if (available < amountToCharge) {
        Alert.alert(
          t("payment.title"),
          `الرصيد غير كافٍ. المطلوب: ${amountToCharge} ${walletCurrency}، المتاح: ${available} ${walletCurrency}.`
        );
        return;
      }
    } catch {
      Alert.alert(t("payment.title"), "حدث خطأ في قراءة رصيد المحفظة، يرجى المحاولة لاحقاً.");
      return;
    }

    paymentLockRef.current = true;
    const confirmed = await new Promise((resolve) => {
      Alert.alert(
        t("payment.title"),
        `تأكيد شراء ${product?.name || "المنتج"} مقابل ${amountToCharge} ${walletCurrency}؟`,
        [
          { text: t("common.cancel", "إلغاء"), style: "cancel", onPress: () => resolve(false) },
          { text: t("common.ok", "تأكيد"), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
    if (!confirmed) {
      paymentLockRef.current = false;
      return;
    }

      const requirementPayload = buildRequirementPayload(requirements, requirementValues);
      const user_inputs = buildPaymentUserInputs({
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

      const payloadData = buildPaymentPayloadData({
        userInputs: user_inputs,
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

      const res = await processCompletePayment({
        store_product_id: payloadData.store_product_id,
        product_id: payloadData.product_id,
        user_inputs: payloadData.user_inputs,
        walletBalance: available,
        finalAmount: amountToCharge,
        currency: walletCurrency,
        amount: payloadData.amount,
        selected_option: payloadData.selected_option,
        wallet_currency: payloadData.wallet_currency,
      });

      if (!res?.ok) {
        Alert.alert(t("payment.title"), buildErrorMessage(res, t));
        return;
      }

      const successMessage = res?.data?.message || t("payment.successBody");
      Alert.alert(t("payment.successTitle"), successMessage, [
        { text: t("common.ok"), onPress: () => navigation.navigate("MyPayments") },
      ]);
    } catch (err) {
      const msg = extractServerMessage(err);
      Alert.alert(t("payment.title"), msg || t("common.networkError"));
    } finally {
      setLoading(false);
      paymentLockRef.current = false;
    }
  };

  const NAV_H = sy(90);
  const titleText = params.productDisplayName || params.product_name || product?.name || t("payment.productFallback");

  const disablePay =
    loading ||
    pricingBoot ||
    (isPackages && !selected) ||
    !priceCalculatorData ||
    !Number.isFinite(total) ||
    total <= 0;

  return (
    <Screenn bgColor={colors.bg} style={{ paddingTop: 0, paddingBottom: insets.bottom + NAV_H }}>
      {/* HERO */}
      <LinearGradient
        colors={["#0B63D8", "#2a6dca"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + G.md,
          paddingBottom: G.lg,
          paddingHorizontal: sx(20),
          borderBottomLeftRadius: R.xl,
          borderBottomRightRadius: R.xl,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              flex: 1,
              paddingVertical: G.xs,
              paddingHorizontal: sx(14),
              borderRadius: R.xxl,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.28)",
              paddingTop: G.sm,
            }}
          >
            <Text numberOfLines={2} style={[T.heroXL, { includeFontPadding: false }]}>
              {titleText}
            </Text>
          </View>

          <FavButton fav={fav} favBusy={favBusy} toggleFav={toggleFav} sx={sx} sy={sy} sp={sp} />
        </View>

        {!!currency && (
          <Text style={[T.caption, { color: "rgba(255,255,255,0.95)", marginTop: G.xs }]}>
            {t("payment.currency")}: {currency}
          </Text>
        )}
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: sx(18), paddingBottom: sy(250), flexGrow: 1 }}
        >
          <View style={{ flexGrow: 1, justifyContent: "center" }}>
            {hasRecipient && (
              <Card R={R} pad={G.lg}>
                <Text style={T.title}>المستلم</Text>
                <Text style={[T.bodyB, { marginTop: G.xs }]}>{recipientLine}</Text>
                {isAgentFlow && (
                  <Text style={[T.caption, { marginTop: G.xs }]}>
                    هذه عملية عبر الوكيل — سيتم تضمين بيانات المستلم ضمن{" "}
                    <Text style={{ fontWeight: "900" }}>user_inputs</Text>.
                  </Text>
                )}
              </Card>
            )}

            {requirements?.length > 0 && (
              <Card R={R} pad={G.lg}>
                <Text style={T.title}>معلومات مطلوبة</Text>
                {requirements.map((req) => {
                  const key = req.payload_key || req.field_name;
                  const val = requirementValues[key] ?? "";
                  const type = (req.field_type || "text").toLowerCase();

                  let keyboardType = "default";
                  if (type === "number" || type === "phone" || type === "id") keyboardType = "numeric";
                  else if (type === "email") keyboardType = "email-address";

                  return (
                    <View key={req.id || key} style={{ marginTop: G.sm }}>
                      <Text style={T.caption}>
                        {req.field_name}
                        {req.is_required ? <Text style={{ color: "#E05959", fontWeight: "900" }}> *</Text> : null}
                      </Text>

                      <TextInput
                        style={S.input}
                        value={val}
                        onChangeText={(txt) =>
                          setRequirementValues((prev) => ({
                            ...prev,
                            [key]: txt,
                          }))
                        }
                        placeholder={req.placeholder || `أدخل ${req.field_name}`}
                        placeholderTextColor="#8AA0B5"
                        keyboardType={keyboardType}
                        editable={!loading}
                        autoCapitalize={type === "email" ? "none" : "sentences"}
                        autoCorrect={type === "email" ? false : true}
                      />

                      {req.is_required && !val.trim() && (
                        <Text style={[T.caption, { color: "#E05959", marginTop: G.xs, fontSize: sp(12) }]}>
                          هذا الحقل إجباري
                        </Text>
                      )}
                    </View>
                  );
                })}
              </Card>
            )}

            {product?.query_enabled && (
              <Card R={R} pad={G.lg}>
                <Text style={T.title}>استعلام المنتج</Text>
                <Text style={[T.caption, { marginTop: G.xs }]}>
                  يمكنك تنفيذ استعلام لهذا المنتج قبل الشراء.
                </Text>
                <Text style={[T.caption, { marginTop: G.xs }]}>
                  سيتم إظهار نتيجة الاستعلام بعد تحديث الحالة.
                </Text>

                <Pressable
                  onPress={handleQuery}
                  disabled={queryLoading || loading || isQueryPending}
                  android_ripple={{ color: "#e5e7eb" }}
                  style={[
                    S.btn,
                    {
                      marginTop: G.md,
                      opacity: queryLoading || loading || isQueryPending ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={S.btnText}>{queryLoading ? "جاري الاستعلام..." : "تنفيذ الاستعلام"}</Text>
                </Pressable>

                {isQueryPending && (
                  <View
                    style={{
                      marginTop: G.sm,
                      alignSelf: "flex-start",
                      paddingHorizontal: G.md,
                      paddingVertical: G.xs,
                      borderRadius: R.lg,
                      backgroundColor: "#E7F0FF",
                      borderWidth: 1,
                      borderColor: "#BFD7FF",
                    }}
                  >
                    <Text style={[T.caption, { color: "#0B63D8", fontWeight: "800" }]}>
                      جاري التحقق من النتيجة...
                    </Text>
                  </View>
                )}

                {!!queryError && (
                  <Text style={[T.caption, { marginTop: G.sm, color: "#B42318", fontWeight: "800" }]}>
                    {queryError}
                  </Text>
                )}

                {!!queryDisplay && !isQueryPending && (
                  <View style={{ marginTop: G.sm }}>
                    <Text style={[T.caption, { color: "#0F172A", fontWeight: "700" }]}>
                      {String(queryDisplay.message || queryDisplay.status || "")}
                    </Text>
                  </View>
                )}
              </Card>
            )}

            <Card R={R} pad={G.lg}>
              {pricingBoot ? (
                <Text style={[T.caption, { textAlign: "center" }]}>{t("common.loading")}</Text>
              ) : isPackages ? (
                <PackagesDropdown
                  T={T}
                  G={G}
                  R={R}
                  sx={sx}
                  sy={sy}
                  options={options}
                  selected={selected}
                  setSelected={setSelected}
                  disabled={loading}
                />
              ) : (
                <View>
                  <Text style={[T.caption, { marginBottom: G.xs }]}>
                    {String(t("products.chooseQty", "اختر الكمية (من {{min}} إلى {{max}})"))
                      .replace("{{min}}", String(minQ))
                      .replace("{{max}}", String(maxQ))}
                  </Text>

                  <QtyChooser
                    G={G}
                    R={R}
                    sx={sx}
                    sy={sy}
                    sp={sp}
                    T={T}
                    value={qtyStr}
                    onChangeText={setQtyStr}
                    rawQty={rawQty}
                    minQ={minQ}
                    maxQ={maxQ}
                    step={step}
                    bump={bump}
                    loading={loading}
                    onBlur={() => {
                      const valid = Math.max(minQ, Math.min(rawQty, maxQ));
                      setQtyStr(String(valid));
                    }}
                  />
                </View>
              )}

              {!pricingBoot && (
                <View style={{ marginTop: G.md, gap: G.xs }}>
                  <Row label={t("payment.unit")} value={`${displayUnitPrice} ${currency}`} T={T} />
                  <Row label={t("payment.total")} value={`${total} ${currency}`} T={T} big />

                  {!!setCurrency && (
                    <View style={{ marginTop: G.sm, gap: G.xs }}>
                      <Text style={T.caption}>Wallet currency</Text>
                      <View
                        style={{
                          flexDirection: "row",
                          backgroundColor: "#F3F7FB",
                          borderWidth: 1,
                          borderColor: "#E4ECF2",
                          borderRadius: R.md,
                          alignSelf: "flex-start",
                          padding: 3,
                        }}
                      >
                        {["USD", "SYP"].map((cur) => {
                          const active = walletCurrency === cur;
                          return (
                            <Pressable
                              key={cur}
                              onPress={() => setCurrency(cur)}
                              style={[
                                {
                                  paddingVertical: G.xs,
                                  paddingHorizontal: G.md,
                                  borderRadius: R.sm,
                                },
                                active && {
                                  backgroundColor: "#fff",
                                  borderWidth: 1,
                                  borderColor: "#E4ECF2",
                                },
                              ]}
                            >
                              <Text style={[T.caption, active && { color: "#0B63D8", fontWeight: "800" }]}>
                                {cur}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {walletInfo && (
                    <View style={{ marginTop: G.sm }}>
                      <Text style={T.caption}>رصيدك المتاح في المحافظ:</Text>
                      {walletInfo.usd != null && (
                        <Text style={[T.caption, walletCurrency === "USD" ? { fontWeight: "800", color: "#0B63D8" } : {}]}>
                          USD: {walletInfo.usd} {walletCurrency === "USD" ? "(سيتم الخصم من هذه المحفظة)" : ""}
                        </Text>
                      )}
                      {walletInfo.syp != null && (
                        <Text style={[T.caption, walletCurrency === "SYP" ? { fontWeight: "800", color: "#0B63D8" } : {}]}>
                          SYP: {walletInfo.syp} {walletCurrency === "SYP" ? "(سيتم الخصم من هذه المحفظة)" : ""}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </Card>

            {product?.requiresGamerId && (
              <Card R={R} pad={G.lg}>
                <Text style={[T.caption]}>{t("payment.gamerId")}</Text>
                <View
                  style={{
                    marginTop: G.sm,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1.5,
                    borderColor: "#E4ECF2",
                    borderRadius: R.lg,
                    paddingHorizontal: sx(12),
                    height: sy(52),
                  }}
                >
                  <Text style={{ fontSize: sp(20), marginRight: sx(8) }}>🎮</Text>
                  <TextInput
                    placeholder={t("payment.enterYourId")}
                    placeholderTextColor="#8AA0B5"
                    value={gamerId}
                    onChangeText={setGamerId}
                    editable={!loading}
                    style={{ flex: 1, ...T.body }}
                  />
                </View>
              </Card>
            )}

            <Text style={[T.caption, { textAlign: "center", marginTop: G.sm }]}>
              {t("payment.finalPriceNote")}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PayBar
        insets={insets}
        sy={sy}
        sx={sx}
        T={T}
        S={S}
        W={W}
        total={total}
        currency={currency}
        onPay={onPay}
        disabled={disablePay}
        loading={loading || pricingBoot}
      />

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: insets.bottom + sy(64) + sy(6),
          backgroundColor: "#FFFFFF",
          zIndex: 5,
        }}
      />
    </Screenn>
  );
}

/* ---------- Subcomponents ---------- */
function Card({ children, R, pad }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: "#E4ECF2",
        borderRadius: R.lg,
        paddingVertical: pad,
        paddingHorizontal: pad,
        marginBottom: pad,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

function Row({ label, value, T, big }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={T.caption}>{label}</Text>
      <Text style={big ? T.total : T.bodyB}>{value}</Text>
    </View>
  );
}

function RoundBtn({ label, onPress, disabled, size }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: "#e5e7eb", radius: size / 2 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: "#E4ECF2",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.48, fontWeight: "900", color: "#0E1B3B" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function PackagesDropdown({ T, G, R, sx, sy, options, selected, setSelected, disabled }) {
  const [open, setOpen] = useState(false);

  const Current = () => (
    <Pressable
      onPress={() => { !disabled && setOpen((v) => !v); }}
      android_ripple={{ color: "#e5e7eb" }}
      style={{
        borderWidth: 1.5,
        borderColor: "#D7E2EC",
        borderRadius: R.xl,
        backgroundColor: "#fff",
        paddingVertical: G.xs,
        paddingHorizontal: sx(14),
        minHeight: sy(50),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text style={T.bodyB}>فئة: {selected?.label ?? ""}</Text>
      <Text style={{ fontSize: 18, opacity: 0.7 }}>▾</Text>
    </Pressable>
  );

  const Item = ({ opt }) => {
    const active = selected?.id === opt.id;
    return (
      <Pressable
        onPress={() => {
          setSelected(opt);
          setOpen(false);
        }}
        android_ripple={{ color: "#eef2ff" }}
        style={{
          paddingVertical: G.xs,
          paddingHorizontal: sx(14),
          backgroundColor: active ? "#F1F6FF" : "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#EEF2F6",
        }}
      >
        <Text style={T.bodyB}>فئة: {opt.label}</Text>
      </Pressable>
    );
  };

  return (
    <View>
      <Text style={[T.caption, { marginBottom: G.xs }]}>اختر الباقة</Text>
      <Current />
      {open && (
        <View
          style={{
            marginTop: G.xs,
            borderWidth: 1.5,
            borderColor: "#D7E2EC",
            borderRadius: R.lg,
            backgroundColor: "#fff",
            overflow: "hidden",
            maxHeight: sy(240),
          }}
        >
          <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
            {options.map((opt) => (
              <Item key={String(opt.id)} opt={opt} />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function QtyChooser({ G, R, sx, sy, sp, T, value, onChangeText, onBlur, rawQty, minQ, maxQ, step, bump, loading }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#E4ECF2",
        borderRadius: R.xl,
        padding: G.xs,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <RoundBtn
        label="–"
        onPress={() => bump(-1)}
        disabled={rawQty <= minQ || loading}
        size={sy(48)}
      />
      <TextInput
        value={value}
        onChangeText={(v) => {
          const clean = v.replace(/[^\d]/g, "");
          onChangeText(clean);
        }}
        onBlur={onBlur}
        keyboardType="numeric"
        editable={!loading}
        style={{
          flex: 1,
          height: sy(48),
          textAlign: "center",
          fontSize: sp(20),
          fontWeight: "800",
          color: "#0E1B3B",
        }}
      />
      <RoundBtn
        label="+"
        onPress={() => bump(1)}
        disabled={rawQty >= maxQ || loading}
        size={sy(48)}
      />
    </View>
  );
}

function PayBar({ insets, sy, sx, T, S, W, total, currency, onPay, disabled, loading }) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + sy(50) + sy(16),
        paddingHorizontal: sx(18),
        paddingVertical: sy(12),
      }}
    >
      <View style={S.payBar}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...T.caption, color: "rgba(255, 255, 255, 0.85)" }}>الإجمالي</Text>
          <Text style={{ ...T.total, color: "#ffffffff" }}>
            {total} {currency}
          </Text>
        </View>

        <Pressable
          onPress={onPay}
          disabled={disabled}
          android_ripple={{ color: "rgba(255,255,255,0.2)" }}
          style={[
            S.payBtn,
            {
              minWidth: Math.max(sx(140), Math.min(sx(220), W * 0.5)),
              opacity: disabled ? 0.7 : 1,
            },
          ]}
        >
          <Text style={S.payBtnText}>{loading ? "جارٍ الدفع..." : "إتمام الدفع"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FavButton({ fav, favBusy, toggleFav, sx, sy, sp }) {
  return (
    <Pressable
      onPress={toggleFav}
      disabled={favBusy}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      android_ripple={{ color: "rgba(255,255,255,0.2)", radius: sy(26) }}
      style={{
        marginLeft: sx(10),
        width: sy(48),
        height: sy(48),
        borderRadius: sy(24),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.16)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.28)",
        opacity: favBusy ? 0.7 : 1,
      }}
    >
      <Text style={{ fontSize: sp(24), lineHeight: sp(24) }}>{fav ? "❤️" : "🤍"}</Text>
    </Pressable>
  );
}
