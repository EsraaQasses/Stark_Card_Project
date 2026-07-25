import { useMemo } from "react";

// Derived pricing state only. Preserves Payment.js quantity/package/range calculations.
export function usePaymentPricing({ pricing, product, qtyStr }) {
  const options = useMemo(() => pricing.options || [], [pricing.options]);
  const mode = pricing.mode;
  const range = pricing.range;

  const isPackages = mode === "packages" && options.length > 0;
  const isRange = mode === "range" || (!!range && (range?.min != null || range?.max != null));

  const minQ = Number(isRange ? range?.min ?? 1 : product?.qty?.min ?? 1);
  const maxQ = Number(isRange ? range?.max ?? 999999 : product?.qty?.max ?? 999999);
  const step = Number(isRange ? range?.step ?? 1 : product?.qty?.step ?? 1);

  const rawQty = Number(String(qtyStr || "").replace(/[^\d]/g, "")) || 0;
  const safeQty = rawQty === 0 ? minQ : Math.max(minQ, Math.min(rawQty, maxQ));

  return {
    mode,
    options,
    range,
    isPackages,
    isRange,
    minQ,
    maxQ,
    step,
    rawQty,
    safeQty,
  };
}
