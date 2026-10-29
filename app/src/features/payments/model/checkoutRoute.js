import { parseCheckoutObject } from "./paymentVerification";

export function internalProductId(value) {
  if (Array.isArray(value)) return value.length === 1 ? internalProductId(value[0]) : null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? String(Number(text)) : null;
}

export function checkoutProductId(params = {}) {
  const embedded = parseCheckoutObject(params.product);
  // store_product_id, favorite.id and external_product.id are different namespaces.
  for (const key of ["product_id","productId","id"]) {
    if (params[key] != null) return internalProductId(params[key]);
  }
  return internalProductId(embedded?.id);
}

export function favoriteProductId(record) {
  const product = record?.product;
  return internalProductId(product?.id) || internalProductId(record?.product_id)
    || internalProductId(typeof product === "object" ? null : product);
}

const reserved = /^(?:price|prices|base_price|final_price|unit_price_display|final_amount_submitted|wallet_balance.*|original_amount|fx_used|profit.*|product_id|store_product_id|external_product_id|product_name|display_currency|currency_submitted)$/;
function serializable(value, seen = new Set()) {
  if (value == null) return value;
  if (["string", "boolean"].includes(typeof value)) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "object" || seen.has(value)) return undefined;
  if (!Array.isArray(value) && Object.prototype.toString.call(value) !== "[object Object]") return undefined;
  seen.add(value);
  const result = Array.isArray(value) ? value.map(item => serializable(item, seen)).filter(item => item !== undefined)
    : Object.fromEntries(Object.entries(value).filter(([key]) => !reserved.test(key)).flatMap(([key, item]) => {
      const clean = serializable(item, seen); return clean === undefined ? [] : [[key, clean]];
    }));
  seen.delete(value);
  return result;
}

export function checkoutInitialization(params = {}) {
  const prefill = serializable(parseCheckoutObject(params.prefill) || parseCheckoutObject(params.user_inputs_prefill) || {}) || {};
  return {
    inputs: prefill.inputs && typeof prefill.inputs === "object" ? prefill.inputs : prefill,
    quantity: prefill.quantity ?? params.quantity ?? params.amount ?? null,
    selectedValue: prefill.selected_option ?? params.selected_option ?? null,
    selectedId: prefill.selected_id ?? params.selected_id ?? null,
  };
}

export function buildCheckoutParams(productOrId, prefill = {}) {
  const id = internalProductId(typeof productOrId === "object" ? productOrId?.id : productOrId);
  if (!id) throw new Error("يرجى فتح المنتج مجدداً من المتجر؛ معرّف المنتج غير متوفر.");
  const clean = serializable(prefill) || {};
  return { product_id: id, ...(Object.keys(clean).length ? { prefill: JSON.stringify(clean) } : {}) };
}
