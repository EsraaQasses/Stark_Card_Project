// src/screens/payments/GenericPayment.js
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createPurchaseTransaction } from "../../api/payment";
import { createProductQueryWaitV2, getUserProductById, getUserProductRequirements } from "../../api/store";
import { useCurrency } from "../../context/CurrencyProvider";
import PageLayout from "../../ui/PageLayout"; // ✅ الغلاف الموحّد (BottomNav + SideMenu)
import { resolveWalletId } from "../../utils/walletHelpers";
import PaymentForm from "./components/PaymentForm";
const colors = {};
const isRTL = I18nManager.isRTL !== false;

// helpers
const BASE_W = 390, BASE_H = 844;
function useScale() {
  const { width: W, height: H } = useWindowDimensions();
  const sx = (n) => (W / BASE_W) * n;
  const sy = (n) => (H / BASE_H) * n;
  return { sx, sy, W, H };
}
const shadow = { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 3 };

/* ================= Query Helpers ================= */
const unwrapQueryPayload = (payload) => {
  let data = payload?.data ?? payload;
  let guard = 0;
  while (data && typeof data === "object" && guard < 4) {
    if (data.query || data.local_id || data.status || data.message || data.new_quantity) {
      break;
    }
    if (data.data && typeof data.data === "object") {
      data = data.data;
      guard += 1;
      continue;
    }
    break;
  }
  return data;
};

const extractQueryStatus = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const data = unwrapQueryPayload(payload);
  if (!data || typeof data !== "object") return null;
  return (
    data.status ||
    data.state ||
    data.query?.status ||
    data.data?.status ||
    data.data?.query?.status ||
    null
  );
};

const isFinalQueryStatus = (status) => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  if (s.includes("قيد") || s.includes("انتظار") || s.includes("معالجة")) return false;
  if (["pending", "processing", "in_progress", "wait"].includes(s)) return false;
  return true;
};

const normalizeQueryDisplay = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const data = unwrapQueryPayload(payload);
  const query = data?.query || data;
  if (!query || typeof query !== "object") return null;

  return {
    status:
      query.status ||
      query.state ||
      data.status ||
      data.state ||
      null,
    message:
      query.message ||
      data.message ||
      null,
    new_quantity: query.new_quantity ?? data.new_quantity ?? null,
  };
};

export default function GenericPayment({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { sx, sy } = useScale();

  const methodInit = route?.params?.method || null;          // قد يجي من PaymentMethodsList
  const recipient = route?.params?.recipient || null;       // في حال وكيل يدفع لمستخدم
  const productId = route?.params?.store_product_id || null;
  const selectedWalletId = route?.params?.wallet_id ?? null;

  const { displayCurrency, getExchangeRate } = useCurrency();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(!!productId);
  const [selectedMethod, setSelected] = useState(methodInit);
  const [requirements, setRequirements] = useState([]);
  const [queryInputs, setQueryInputs] = useState({});
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState("");
  const [queryStatus, setQueryStatus] = useState(null);
  const [queryLocalId, setQueryLocalId] = useState(null);

  // ارتفاع تقريبي للـ BottomNav + هامش إضافي بسيط
  const BOTTOM_PAD = insets.bottom + sy(64) + sy(12);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await getUserProductById(productId);
      setProduct(res || null);
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    let alive = true;
    const loadRequirements = async () => {
      if (!product?.id || !product?.query_enabled) {
        if (alive) setRequirements([]);
        return;
      }
      try {
        const reqs = await getUserProductRequirements(product.id);
        if (alive) setRequirements(Array.isArray(reqs) ? reqs : []);
      } catch {
        if (alive) setRequirements([]);
      }
    };
    loadRequirements();
    return () => {
      alive = false;
    };
  }, [product?.id, product?.query_enabled]);

  useEffect(() => {
    setQueryInputs({});
    setQueryResult(null);
    setQueryError("");
    setQueryLocalId(null);
  }, [product?.id]);

  const openPickMethod = () => {
    navigation.navigate("PaymentMethodsList", {
      currency: (displayCurrency || "USD").toLowerCase(),
      onPick: (m) => setSelected(m),
    });
  };

  // الدفع الحقيقي
  const handleSubmit = async ({ quantity, selected_options, method_fields }) => {
    try {
      if (!product?.id) {
        Alert.alert("الدفع", "المنتج غير معروف.");
        return;
      }
      if (!selectedMethod?.id) {
        Alert.alert("الدفع", "اختر وسيلة دفع أولاً.");
        return;
      }
      // حل الـ wallet_id: route.params.wallet_id أو من AsyncStorage
      const walletId = selectedWalletId ?? (await resolveWalletId());
      const user_inputs = {
        quantity: Number(quantity || 1),
        selected_options: selected_options || {},
        payment_method_id: selectedMethod.id,
        payment_method_name: selectedMethod.name,
        payment_method_fields: method_fields || {},
        ...(recipient ? { target_user_id: recipient.user_id, target_user_name: recipient.name, flow: "agent_to_user" } : {}),
      };

      const { ok, error } = await createPurchaseTransaction({
        store_product_id: product.id,
        user_inputs,
        wallet_id: walletId,
      });

      if (!ok) {
        Alert.alert("فشل الدفع", error || "تعذّر إرسال الطلب.");
        return;
      }

      Alert.alert("نجاح", "تم إرسال طلب الدفع ✅");
      navigation.navigate("MyPayments");
    } catch (_e) {
      Alert.alert("خطأ", "تعذّر إتمام العملية الآن. حاول لاحقاً.");
    }
  };



  const handleQuery = async () => {
    if (!product?.id) return;
    const isPendingNow = queryLoading || (!!queryStatus && !isFinalQueryStatus(queryStatus));
    if (queryLoading || isPendingNow) return;

    const required = (requirements || []).filter((r) => r?.is_required);
    const missing = required.filter((r) => {
      const key = r?.payload_key || r?.field_name;
      const v = queryInputs?.[key];
      return v == null || String(v).trim() === "";
    });

    if (missing.length) {
      Alert.alert("الاستعلام", `يرجى تعبئة الحقول المطلوبة: ${missing.map((m) => m.field_name).join(", ")}`);
      return;
    }

    setQueryLoading(true);
    setQueryError("");
    setQueryResult(null);
    setQueryStatus("pending");

    const res = await createProductQueryWaitV2(product.id, queryInputs);
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

  // ---- UI subcomponents (pure RN) ----
  const Header = () => (
    <View style={{ paddingHorizontal: sx(14), paddingTop: insets.top + sy(10), paddingBottom: sy(10) }}>
      <Text
        style={{
          fontSize: sx(28),
          fontWeight: "900",
          color: colors.text || "#0E1B3B",
          textAlign: isRTL ? "right" : "left",
        }}
      >
        الدفع
      </Text>
      <Text
        style={{
          marginTop: sy(4),
          opacity: 0.7,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        اختر وسيلة الدفع وأكمل تفاصيل الطلب.
      </Text>
    </View>
  );

  const InfoBadge = ({ label }) => (
    <View
      style={{
        backgroundColor: "rgba(18, 116, 245, 0.08)",
        paddingHorizontal: sx(10),
        height: sy(26),
        borderRadius: sx(10),
        justifyContent: "center",
        alignSelf: isRTL ? "flex-start" : "flex-start",
      }}
    >
      <Text style={{ fontSize: sx(12), fontWeight: "800", color: "#1274F5" }}>{label}</Text>
    </View>
  );

  const ProductCard = () => {
    if (!productId) return null;

    return (
      <View
        style={{
          marginHorizontal: sx(14),
          marginBottom: sy(12),
          backgroundColor: "#fff",
          borderRadius: sx(16),
          borderWidth: 1.5,
          borderColor: "#E4ECF2",
          padding: sx(14),
          ...shadow,
        }}
      >
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center" }}>
          <View
            style={{
              width: sx(50),
              height: sx(50),
              borderRadius: sx(12),
              backgroundColor: "rgba(58,134,255,0.08)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: isRTL ? 0 : sx(10),
              marginLeft: isRTL ? sx(10) : 0,
              overflow: "hidden",
            }}
          >
            {/* رمز توضيحي؛ يمكنك لاحقاً استبداله بصورة المنتج إن توفرت */}
            <Image
              source={{ uri: "https://cdn-icons-png.flaticon.com/512/679/679720.png" }}
              style={{ width: "70%", height: "70%" }}
              resizeMode="contain"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: sx(16),
                fontWeight: "800",
                color: "#0E1B3B",
                textAlign: isRTL ? "right" : "left",
              }}
              numberOfLines={1}
            >
              {product?.title || product?.name || "منتج"}
            </Text>

            {!!product?.description && (
              <Text
                style={{
                  marginTop: sy(4),
                  color: "#5F708C",
                  fontSize: sx(12.5),
                  textAlign: isRTL ? "right" : "left",
                }}
                numberOfLines={2}
              >
                {product.description}
              </Text>
            )}

            <View style={{ marginTop: sy(8), flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center" }}>
              <InfoBadge label={(displayCurrency || "USD").toUpperCase()} />
              {!!recipient?.name && (
                <View style={{ marginHorizontal: sx(8) }}>
                  <InfoBadge label={`المستفيد: ${recipient.name}`} />
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const MethodCard = () => (
    <View
      style={{
        marginHorizontal: sx(14),
        marginBottom: sy(12),
        backgroundColor: "#fff",
        borderRadius: sx(16),
        borderWidth: 1.5,
        borderColor: "#E4ECF2",
        padding: sx(14),
        ...shadow,
      }}
    >
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginBottom: sy(8) }}>
        <Text
          style={{
            flex: 1,
            fontSize: sx(16),
            fontWeight: "900",
            color: "#0E1B3B",
            textAlign: isRTL ? "right" : "left",
          }}
        >
          وسيلة الدفع
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={openPickMethod}
          style={{
            backgroundColor: "#1274F5",
            paddingHorizontal: sx(12),
            height: sy(38),
            borderRadius: sx(12),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {selectedMethod ? "تغيير" : "اختيار"}
          </Text>
        </Pressable>
      </View>

      {/* تفاصيل الوسيلة المختارة */}
      {selectedMethod ? (
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row" }}>
          <View
            style={{
              width: sx(46),
              height: sx(46),
              borderRadius: sx(12),
              backgroundColor: "rgba(58,134,255,0.08)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: isRTL ? 0 : sx(10),
              marginLeft: isRTL ? sx(10) : 0,
              overflow: "hidden",
            }}
          >
            {selectedMethod?.icon_url ? (
              <Image
                source={{ uri: selectedMethod.icon_url }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ fontSize: sx(22) }}>💳</Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: sx(16),
                fontWeight: "800",
                color: "#0E1B3B",
                textAlign: isRTL ? "right" : "left",
              }}
              numberOfLines={1}
            >
              {selectedMethod?.title || selectedMethod?.name}
            </Text>

            <View style={{ marginTop: sy(8) }} />
          </View>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: "rgba(0,0,0,0.03)",
            borderRadius: sx(12),
            padding: sx(12),
          }}
        >
          <Text
            style={{
              color: "#5F708C",
              textAlign: isRTL ? "right" : "left",
            }}
          >
            لم يتم اختيار وسيلة بعد. اضغط “اختيار” لاختيار الوسيلة المناسبة.
          </Text>
        </View>
      )}
    </View>
  );

  const QueryField = ({ req }) => {
    const key = req?.payload_key || req?.field_name;
    const val = queryInputs?.[key] ?? "";
    const type = (req?.field_type || "text").toLowerCase();
    const options = Array.isArray(req?.options) ? req.options : [];

    let keyboardType = "default";
    if (type === "number" || type === "phone" || type === "id") keyboardType = "numeric";
    else if (type === "email") keyboardType = "email-address";

    return (
      <View style={{ marginTop: sy(8) }}>
        <Text style={{ fontWeight: "800", color: "#0E1B3B", textAlign: isRTL ? "right" : "left" }}>
          {req?.field_name}
          {req?.is_required ? " *" : ""}
        </Text>

        {options.length > 0 ? (
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", flexWrap: "wrap", gap: sx(8), marginTop: sy(6) }}>
            {options.map((opt) => {
              const active = String(val) === String(opt);
              return (
                <Pressable
                  key={String(opt)}
                  onPress={() => setQueryInputs((prev) => ({ ...prev, [key]: String(opt) }))}
                  style={{
                    paddingHorizontal: sx(12),
                    height: sy(34),
                    borderRadius: sx(10),
                    borderWidth: 1.5,
                    borderColor: active ? "#1274F5" : "#E4ECF2",
                    backgroundColor: active ? "rgba(18,116,245,0.10)" : "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontWeight: "800", color: "#0E1B3B" }}>{String(opt)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <TextInput
            value={String(val)}
            onChangeText={(v) => setQueryInputs((prev) => ({ ...prev, [key]: v }))}
            placeholder={req?.placeholder || `أدخل ${req?.field_name || ""}`}
            keyboardType={keyboardType}
            style={{
              marginTop: sy(6),
              backgroundColor: "#FFFFFF",
              borderWidth: 1.5,
              borderColor: "#E4ECF2",
              borderRadius: sx(12),
              paddingHorizontal: sx(12),
              height: sy(46),
              textAlign: isRTL ? "right" : "left",
            }}
            placeholderTextColor="#8AA0B5"
          />
        )}
      </View>
    );
  };

  const QueryCard = () => {
    if (!product?.query_enabled) return null;

    const isPending = queryLoading || (!!queryStatus && !isFinalQueryStatus(queryStatus));
    const queryDisplay = !isPending ? normalizeQueryDisplay(queryResult) : null;

    return (
      <View
        style={{
          marginHorizontal: sx(14),
          marginBottom: sy(12),
          backgroundColor: "#fff",
          borderRadius: sx(16),
          borderWidth: 1.5,
          borderColor: "#E4ECF2",
          padding: sx(14),
          ...shadow,
        }}
      >
        <Text style={{ fontSize: sx(16), fontWeight: "900", color: "#0E1B3B", textAlign: isRTL ? "right" : "left" }}>
          استعلام المنتج
        </Text>
        <Text style={{ marginTop: sy(4), color: "#5F708C", textAlign: isRTL ? "right" : "left" }}>
          سيتم إظهار نتيجة الاستعلام بعد تحديث الحالة.
        </Text>

        {requirements?.length ? (
          <View style={{ marginTop: sy(6) }}>
            {requirements.map((req) => (
              <QueryField key={req?.id || req?.field_name} req={req} />
            ))}
          </View>
        ) : (
          <Text style={{ marginTop: sy(6), color: "#5F708C", textAlign: isRTL ? "right" : "left" }}>
            لا توجد حقول مطلوبة لهذا الاستعلام.
          </Text>
        )}

        <Pressable
          onPress={handleQuery}
          disabled={queryLoading || isPending}
          style={{
            marginTop: sy(12),
            height: sy(44),
            borderRadius: sx(12),
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1274F5",
            opacity: queryLoading || isPending ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {queryLoading ? "جاري الاستعلام..." : "تنفيذ الاستعلام"}
          </Text>
        </Pressable>

        {isPending && (
          <View
            style={{
              marginTop: sy(10),
              alignSelf: "flex-start",
              paddingHorizontal: sx(12),
              height: sy(28),
              borderRadius: sx(14),
              backgroundColor: "rgba(18,116,245,0.12)",
              borderWidth: 1,
              borderColor: "rgba(18,116,245,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#0B63D8", fontWeight: "800" }}>جاري التحقق من النتيجة...</Text>
          </View>
        )}

        {!!queryError && (
          <View
            style={{
              marginTop: sy(10),
              backgroundColor: "rgba(224,89,89,0.08)",
              borderRadius: sx(12),
              padding: sx(10),
            }}
          >
            <Text style={{ color: "#B42318", fontWeight: "800", textAlign: isRTL ? "right" : "left" }}>
              {queryError}
            </Text>
          </View>
        )}

        {!!queryDisplay && !isPending && (
          <View
            style={{
              marginTop: sy(10),
              backgroundColor: "rgba(18,116,245,0.06)",
              borderRadius: sx(12),
              padding: sx(10),
            }}
          >
            <Text style={{ fontWeight: "900", color: "#0E1B3B", textAlign: isRTL ? "right" : "left" }}>
              {String(queryDisplay.message || queryDisplay.status || "")}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <PageLayout navigation={navigation} active="shipping" withSideMenu={true}>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#F6F9FC" }}
        contentContainerStyle={{ paddingBottom: BOTTOM_PAD }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header />

        {/* لو المنتج مطلوب ولم يُحمّل بعد */}
        {productId && loading ? (
          <View style={{ alignItems: "center", paddingVertical: sy(25) }}>
            <ActivityIndicator size="large" />
            <Text
              style={{
                marginTop: sy(8),
                color: colors.text || "#0E1B3B",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              جارِ تحميل المنتج…
            </Text>
          </View>
        ) : (
          <>
            <ProductCard />
            <MethodCard />

            {/* نموذج الدفع */}
            <View
              style={{
                marginHorizontal: sx(14),
                marginBottom: sy(12),
                backgroundColor: "#fff",
                borderRadius: sx(16),
                borderWidth: 1.5,
                borderColor: "#E4ECF2",
                padding: sx(10),
                ...shadow,
              }}
            >
              <PaymentForm
                navigation={navigation}
                product={product}
                currency={(displayCurrency || "USD").toUpperCase()}
                getExchangeRate={getExchangeRate}
                method={selectedMethod}
                setMethod={setSelected}
                onPickMethod={openPickMethod}
                onSubmit={handleSubmit}
              />
            </View>

            <QueryCard />

            {/* تلميح أمان صغير */}
            <View style={{ paddingHorizontal: sx(14), marginTop: sy(8) }}>
              <Text
                style={{
                  fontSize: sx(12),
                  color: "#5F708C",
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                ⚠️ تأكد من صحة البيانات قبل الإرسال. قد يلزم التحقق اليدوي لبعض وسائل الدفع.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </PageLayout>
  );
}
