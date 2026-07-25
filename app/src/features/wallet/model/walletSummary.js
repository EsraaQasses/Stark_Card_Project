export function summarizeWalletDeposits(deposits) {
  const depositList = Array.isArray(deposits) ? deposits : [];

  return depositList.reduce(
    (acc, deposit) => {
      const rawStatus = String(deposit?.status || "pending").toLowerCase();
      let status = rawStatus;

      if (status === "completed" || status === "done" || status === "success") {
        status = "approved";
      }

      acc.total_count++;
      acc[`${status}_count`] = (acc[`${status}_count`] || 0) + 1;
      return acc;
    },
    {
      total_count: 0,
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0,
    }
  );
}

export function getPreferredWalletCurrency(wallet) {
  return wallet?.currency_preference ?? wallet?.preferred_currency ?? "USD";
}

export function selectCurrencyWallets(wallet, normalizedWallets) {
  const walletList = Array.isArray(normalizedWallets) ? normalizedWallets : [];
  const usd = walletList.find((item) => item.currency === "USD") || null;
  const syp = walletList.find((item) => item.currency === "SYP") || null;

  return {
    walletUSDObj: usd?.raw || wallet?.USD || null,
    walletSYPObj: syp?.raw || wallet?.SYP || null,
  };
}
