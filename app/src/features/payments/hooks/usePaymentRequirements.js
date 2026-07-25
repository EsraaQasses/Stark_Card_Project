import { useMemo } from "react";
import { normalizeProductRequirements } from "../model/paymentRequirements";

// Derived requirements only. Keeps Payment.js side effects and API fallback unchanged.
export function usePaymentRequirements(product) {
  return useMemo(() => normalizeProductRequirements(product), [product]);
}
