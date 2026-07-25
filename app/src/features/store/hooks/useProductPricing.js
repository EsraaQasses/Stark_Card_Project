import { useEffect, useState } from "react";

import { displayPrice } from "../../../api/store";

// Preserves Products.js synchronous display pricing behavior for product lists.
export function useProductPricing({ products, currency, mode }) {
  const [priceById, setPriceById] = useState({});
  const [pricingBusy, setPricingBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    if (mode !== "products") {
      setPriceById({});
      return () => {};
    }

    (async () => {
      try {
        setPricingBusy(true);
        const ui = (currency || "USD").toUpperCase();

        const tasks = (products || []).map(async (product) => {
          try {
            const res = displayPrice(product, ui);
            return [product.id, res];
          } catch {
            return [product.id, { amount: null, currency: ui }];
          }
        });

        const entries = await Promise.all(tasks);
        if (!alive) return;

        const next = {};
        for (const [productId, res] of entries) next[productId] = res;
        setPriceById(next);
      } finally {
        if (alive) setPricingBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [products, currency, mode]);

  return { priceById, pricingBusy };
}
