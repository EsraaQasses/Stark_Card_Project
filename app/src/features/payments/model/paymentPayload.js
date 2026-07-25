// Pure payment payload helpers extracted from Payment.js.
// Preserves the existing user_inputs and processCompletePayment payload shapes.
export function buildPaymentUserInputs({
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
  now = Date.now(),
}) {
  return {
    ...(product?.requiresGamerId ? { gamer_id: gamerId.trim() } : {}),
    ...requirementPayload.values,
    ...(Object.keys(requirementPayload._labels || {}).length > 0 && { _labels: requirementPayload._labels }),

    ...(isPackages && selected
      ? {
        selected_option: String(selected.value),
        ...(selected?.id ? { selected_option_id: selected.id } : {}),
        quantity: 1,
      }
      : isRange
        ? { quantity: safeQty, amount: String(safeQty) }
        : { quantity: safeQty }),

    ...(preUserInputs || {}),
    ...(isAgentFlow ? { sender_role: "agent" } : {}),

    mode: isPackages ? "packages" : isRange ? "range" : "simple",
    client_ref: `app_${now}`,
    product_name: product?.name ?? "",
    product_id: product?.id ?? null,
    display_currency: walletCurrency,
    original_amount: total,
  };
}

export function buildPaymentPayloadData({
  userInputs,
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
}) {
  const payloadData = {
    user_inputs: {
      ...userInputs,
      fx_used: fx || null,
      base_currency: baseCurrency,
      unit_price_display: unitPrice,
      wallet_balance_before: available,
    },
    amount: isRange ? String(safeQty) : null,
    selected_option: isPackages ? String(selected.value) : null,
    wallet_currency: walletCurrency,
  };

  if (product?.store_product_id) payloadData.store_product_id = Number(product.store_product_id);
  else payloadData.product_id = Number(product?.id || productId);

  return payloadData;
}
