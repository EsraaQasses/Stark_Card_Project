import { useEffect, useMemo } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import ShippingMethodInfo from "../../src/screens/payments/ShippingMethodInfo";
import { useNavigationShim } from "../../src/utils/navigation";

// helpers لتطبيع string | string[]
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const toBool = (v: string | string[] | undefined) => {
  const s = String(first(v) ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "yes";
};

export default function ShippingMethodInfoScreen() {
  const navigation = useNavigationShim();
  const router = useRouter();
  const params = useLocalSearchParams();

  const normalizedParams = useMemo(() => {
    const methodId = first(params.methodId as any); // string | undefined
    const adminKey = first(params.adminKey as any);
    const forceAgent = toBool(params.forceAgent as any);
    const forceAdminShipping = toBool(params.forceAdminShipping as any);

    // مهم: خلّي methodId string (شاشتك بتعمل Number(methodIdParam) جواتها)
    return {
      ...params,
      methodId,
      adminKey,
      forceAgent,
      forceAdminShipping,
    } as any;
  }, [params]);

  // ✅ guard: إذا مو admin وما في methodId، رجّعي Back
  useEffect(() => {
    const isAdmin = normalizedParams?.forceAdminShipping === true;
    const hasId =
      normalizedParams?.methodId !== undefined &&
      normalizedParams?.methodId !== null &&
      String(normalizedParams?.methodId).length > 0;

    if (!isAdmin && !hasId) {
      Alert.alert("خطأ", "بيانات الشحن ناقصة");
      router.back();
    }
  }, [normalizedParams, router]);

  return (
    <ShippingMethodInfo
      navigation={navigation as any}
      route={{ params: normalizedParams } as any}
    />
  );
}
