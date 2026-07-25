// src/ui/WalletBadge.js
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import api, { buildUrl } from "../api/client";
import { useAuth } from "../context/AuthProvider";
import { useCurrency } from "../context/CurrencyProvider";

function fmt(amount, currency, formatCurrency) {
  if (typeof amount !== "number") return "--";
  try {
    return formatCurrency(amount, currency || "USD");
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

export default function WalletBadge({ onPress }) {
  const { user } = useAuth() || {};
  const { formatCurrency, currency: appCurr } = useCurrency() || {};
  const [loading, setLoading] = useState(false);
  const [bal, setBal] = useState(null);
  const [curr, setCurr] = useState(null);

  useEffect(() => {
    let mounted = true;

    // 1) جرّب من user مباشرة (لو مخزّن)
    if (user?.wallet_balance != null) {
      setBal(Number(user.wallet_balance));
      setCurr(user?.wallet_currency || appCurr || "USD");
      return;
    }

    // 2) جرّب استدعاء Endpointات معروفة بدون تغيير باك
    (async () => {
      setLoading(true);
      const candidates = [
        buildUrl("me/"),          // /wallets/me/
        buildUrl("balance/"),     // /wallets/balance/
        buildUrl("me/"),            // /users/me/  (يمكن يحتوي wallet_balance)
      ];
      for (const url of candidates) {
        try {
          const { data } = await api.get(url);
          // احتمالات الأسماء الشائعة
          const amt = data?.balance ?? data?.wallet_balance ?? data?.wallet?.balance;
          const cur = data?.currency ?? data?.wallet_currency ?? data?.wallet?.currency ?? appCurr ?? "USD";
          if (amt != null && mounted) {
            setBal(Number(amt));
            setCurr(cur);
            break;
          }
        } catch {
          // تجاهل وجرب التالي
        }
      }
      if (mounted) setLoading(false);
    })();

    return () => { mounted = false; };
  }, [user, appCurr]);

  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
      backgroundColor: "#0B63D8", alignSelf: "flex-start"
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>Wallet</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: "white", fontWeight: "800" }}>
            {fmt(bal, curr, formatCurrency)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
