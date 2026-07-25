// Pure pricing helpers extracted from Payment.js.
// Preserves the existing admin CSV/backend customization/range derivation behavior.
export const num = (value, defaultValue = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
};

export function buildOptionsFromAdminCSV(product, appCurrency) {
  const optStr =
    product?.customization_options ??
    product?.custom_options ??
    product?.options_csv ??
    product?.options ??
    "";

  const priceStr =
    product?.customization_prices ??
    product?.custom_prices ??
    product?.prices_csv ??
    product?.prices ??
    "";

  let values = [];
  if (Array.isArray(optStr)) {
    values = optStr.map((item) =>
      typeof item === "object" ? item.value || item.label || item : String(item)
    );
  } else {
    values = String(optStr).split(",").map((item) => item.trim()).filter(Boolean);
  }

  const priceTokens = Array.isArray(priceStr)
    ? priceStr
    : String(priceStr).split(",").map((item) => item.trim()).filter(Boolean);

  if (!values.length) return null;

  const currency = product?.currency || appCurrency || "USD";

  const options = values
    .map((label, index) => {
      const priceStrTok = priceTokens[index];
      let amount = null;
      if (priceStrTok != null && priceStrTok !== "") amount = num(priceStrTok, null);
      return { id: index + 1, label: String(label), value: String(label), amount, currency };
    })
    .filter((option) => Number.isFinite(option.amount) && option.amount >= 0);

  return options.length ? { options, currency } : null;
}

export function normalizeCustomizationItem(item, index, product, appCurrency) {
  const value = item?.value ?? item?.option ?? item?.label ?? item?.name ?? null;
  if (value == null) return null;

  const label = String(value);
  const units = Number.isFinite(+item?.units)
    ? +item.units
    : Number.isFinite(+value)
      ? +value
      : 1;

  const unit_price = Number.isFinite(+item?.unit_price)
    ? +item.unit_price
    : Number.isFinite(+item?.price_per_unit)
      ? +item.price_per_unit
      : num(product?.base_price ?? product?.price ?? 0);

  const price = num(item?.price ?? null);
  const user_final_price = num(item?.user_final_price ?? null);

  const amount =
    Number.isFinite(user_final_price) && user_final_price > 0
      ? user_final_price
      : (Number.isFinite(price) && price > 0 ? price : units * unit_price);

  if (!Number.isFinite(amount) || amount < 0) return null;

  const currency = product?.currency || appCurrency || "USD";

  return {
    id: item?.id ?? index + 1,
    label,
    value: String(value),
    amount,
    currency,
    description: item?.description ?? item?.name ?? null,
  };
}

export function buildOptionsFromBackendCustomization(product, appCurrency) {
  const customizationArray =
    product?.price_info?.customization_options ??
    product?.customization_data ??
    product?.customization_options ??
    null;

  if (!Array.isArray(customizationArray) || !customizationArray.length) return null;

  const options = customizationArray
    .map((item, index) => normalizeCustomizationItem(item, index, product, appCurrency))
    .filter(Boolean);

  return options.length ? { options, currency: options[0].currency } : null;
}

export function derivePricingFromProduct(product, appCurrency) {
  const csv = buildOptionsFromAdminCSV(product, appCurrency);
  if (csv?.options?.length) {
    return { mode: "packages", options: csv.options, range: null, currency: csv.currency };
  }

  const backend = buildOptionsFromBackendCustomization(product, appCurrency);
  if (backend?.options?.length) {
    return { mode: "packages", options: backend.options, range: null, currency: backend.currency };
  }

  const min = num(product?.min_amount, product?.amount_based?.min ?? product?.qty?.min ?? 1);
  const max = num(product?.max_amount, product?.amount_based?.max ?? product?.qty?.max ?? 999999);
  const step = num(product?.step, product?.amount_based?.step ?? product?.qty?.step ?? 1);

  const unit_price = num(product?.calculated_price ?? product?.base_price ?? product?.price, 0);
  const currency = product?.currency || product?.amount_based?.currency || appCurrency || "USD";

  if (unit_price > 0 && (min != null || max != null)) {
    return { mode: "range", options: [], range: { min, max, step, unit_price, currency }, currency };
  }

  return { mode: null, options: [], range: null, currency: product?.currency || appCurrency || "USD" };
}
