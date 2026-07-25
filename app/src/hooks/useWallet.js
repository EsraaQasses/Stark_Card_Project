// src/hooks/useWallet.js
import { useEffect, useState, useCallback } from "react";
import { getWalletSummaryNormalized } from "../features/wallet/api/walletApi";
import * as Haptics from "expo-haptics";

export default function useWallet() {
  const [data, setData] = useState(null);     // { list, byCurrency, totals, preferred_currency, exchange_rates }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getWalletSummaryNormalized();
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // هزة خفيفة عند تغيّر الأرصدة (تحسين UX)
  useEffect(() => { if (!loading) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, [loading]);

  return { wallet: data, loading, error, refresh };
}
