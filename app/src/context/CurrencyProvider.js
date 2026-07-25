// src/context/CurrencyProvider.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CurrencyCtx = createContext({
  currency: "USD",           // "USD" | "SYP"
  setCurrency: (_c) => {},   // setter
});

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState("USD");

  // حمّل القيمة المحفوظة مرة عند الإقلاع
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("currency");
        if (!alive) return;
        if (saved === "SYP" || saved === "USD") {
          setCurrencyState(saved);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // غيّر العملة + احفظها
  const setCurrency = async (next) => {
    if (next !== "USD" && next !== "SYP") return;
    setCurrencyState(next); // يسبب re-render لكل التطبيق
    try { await AsyncStorage.setItem("currency", next); } catch {}
  };

  const value = useMemo(() => ({ currency, setCurrency }), [currency]);

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export const useCurrency = () => useContext(CurrencyCtx);
