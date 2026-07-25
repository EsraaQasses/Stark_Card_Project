export function toWalletNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;

  const cleaned = String(value).replace(/[^\d.\-]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatWalletInteger(value) {
  const parsed = toWalletNumber(value);
  return parsed === null ? "--" : Math.round(parsed).toLocaleString();
}

export function formatWalletDecimal(value) {
  const parsed = toWalletNumber(value);

  return parsed === null
    ? "--"
    : parsed.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}

export function pickWalletAmount(walletLike) {
  if (!walletLike) return 0;

  return (
    walletLike.total ??
    walletLike.available ??
    walletLike.available_balance ??
    walletLike.balance ??
    walletLike.amount ??
    0
  );
}
