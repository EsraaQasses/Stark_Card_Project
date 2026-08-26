// app/(app)/shipping-method-info.tsx

import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import ShippingMethodInfo from "../../src/screens/payments/ShippingMethodInfo";
import { useNavigationShim } from "../../src/utils/navigation";

/* =========================================================
   Helpers
========================================================= */

const first = (
  value: string | string[] | undefined | null
) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
};

const toBool = (
  value:
    | string
    | string[]
    | boolean
    | undefined
    | null
) => {
  if (value === true) {
    return true;
  }

  const normalized = String(
    first(value as any) ?? ""
  )
    .trim()
    .toLowerCase();

  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes"
  );
};

/* =========================================================
   Screen
========================================================= */

export default function ShippingMethodInfoScreen() {
  const navigation = useNavigationShim();
  const params = useLocalSearchParams();

  const normalizedParams = useMemo(() => {
    const method =
      first(params.method as any) ??
      undefined;

    const methodId =
      first(params.methodId as any) ??
      first(params.id as any) ??
      undefined;

    const adminKey =
      first(params.adminKey as any) ??
      undefined;

    const methodKey =
      first(params.methodKey as any) ??
      undefined;

    const methodName =
      first(params.methodName as any) ??
      undefined;

    const methodTitle =
      first(params.methodTitle as any) ??
      undefined;

    const requiresReceipt =
      first(params.requiresReceipt as any) ??
      undefined;

    const forceAgent = toBool(
      params.forceAgent as any
    );

    const forceAdminShipping = toBool(
      params.forceAdminShipping as any
    );

    return {
      method,
      methodId,

      adminKey,

      methodKey,
      methodName,
      methodTitle,

      requiresReceipt,

      forceAgent,
      forceAdminShipping,
    };
  }, [
    params.method,
    params.methodId,
    params.id,

    params.adminKey,

    params.methodKey,
    params.methodName,
    params.methodTitle,

    params.requiresReceipt,

    params.forceAgent,
    params.forceAdminShipping,
  ]);

  /*
   * مهم:
   * ما عاد في guard هون يشترط methodId.
   *
   * شحن الوكيل:
   * forceAgent = true
   *
   * شحن الإدارة:
   * forceAdminShipping = true
   *
   * الطرق العادية:
   * methodId
   *
   * والشاشة نفسها بتقرر شو المطلوب.
   */

  return (
    <ShippingMethodInfo
      navigation={navigation as any}
      route={
        {
          params: normalizedParams,
        } as any
      }
    />
  );
}