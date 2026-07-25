import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { listDepositRequests } from "../../../api/deposits";
import { getWallet } from "../../../api/wallets";
import { summarizeWalletDeposits } from "../model/walletSummary";

export function useWalletData({ loadErrorMessage }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState(null);
  const [depositSummary, setDepositSummary] = useState(null);

  const reloadWalletData = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem("@wallets_cache");
      if (cached) {
        try {
          setWallet(JSON.parse(cached));
        } catch {}
      }

      const [walletResponse, depositsRes] = await Promise.all([
        getWallet(),
        listDepositRequests({ page: 1, page_size: 5 }),
      ]);

      setWallet(walletResponse);

      const depList = Array.isArray(depositsRes?.data) ? depositsRes.data : [];
      const counts = summarizeWalletDeposits(depList);
      setDepositSummary(counts);

      setError(null);
    } catch (error) {
      console.error(error);
      setError(loadErrorMessage);
    }
  }, [loadErrorMessage]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await reloadWalletData();
      setLoading(false);
    })();
  }, [reloadWalletData]);

  const refreshWalletData = useCallback(async () => {
    setRefreshing(true);
    await reloadWalletData();
    setRefreshing(false);
  }, [reloadWalletData]);

  return {
    depositSummary,
    error,
    loading,
    refreshWalletData,
    refreshing,
    reloadWalletData,
    setWallet,
    wallet,
  };
}
