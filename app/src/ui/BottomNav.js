// src/ui/BottomNav.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AppState, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { usePathname, useRouter } from "expo-router";
import NavBar from "./NavBar";
import { getUserPaymentMethodsNormalized } from "../features/payments/api/paymentMethodsApi";
import { absolutizeUrl } from "../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getNotifications } from "../api/system";
import { useAuth } from "../context/AuthProvider";
import { BOTTOM_NAV_ROUTE_MAP as ROUTE_MAP, isSameRoutePath } from "../shared/navigation/routes";

function toKebab(name) {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

export default function BottomNav({
  navigation,
  active = "home",
  useDynamicPayments = true,
  staticItems,
  onOpenMenu,
  onOpenShippingList,

  // ✅ مهم: بالـ APK (Release) وقف polling افتراضياً
  pollMs = __DEV__ ? 60000 : 0,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // ===== Navigation Lock =====
  const navigationLockRef = useRef(false);

  // ===== Safe Navigate (لا يروح لمسار غلط ويعمل شاشة رمادية) =====
  const safeNavigate = useCallback(
    (name, params) => {
      if (__DEV__) console.log("[BottomNav] safeNavigate name=", JSON.stringify(name));

      // ✅ Navigation lock - prevent double navigation
      if (navigationLockRef.current) {
        console.warn("[BottomNav] Navigation locked, ignoring duplicate call");
        return;
      }

      // ✅ Guard: Route must exist in ROUTE_MAP
      const route = ROUTE_MAP[name];
      if (!route) {
        console.warn("[BottomNav] Route not found for name=", JSON.stringify(name));
        return;
      }

      const hasParams = params && Object.keys(params).length > 0;
      if (!hasParams && isSameRoutePath(pathname, route)) {
        if (__DEV__) console.log("[BottomNav] same route ignored", JSON.stringify(name), "route=", route);
        return;
      }

      if (__DEV__) console.log("[BottomNav] NAV ->", JSON.stringify(name), "route=", route, "params=", params);

      // ✅ Lock navigation
      navigationLockRef.current = true;

      try {
        router.push(params ? { pathname: route, params } : route);
      } finally {
        // ✅ Unlock after a short delay
        setTimeout(() => {
          navigationLockRef.current = false;
        }, 500);
      }
    },
    [pathname, router]
  );

  // ===== role/agent detection =====
  const role = String(
    user?.role ||
    user?.raw?.role ||
    user?.raw?.user?.role ||
    user?.raw?.profile?.role ||
    ""
  ).toLowerCase();

  const hasAgentProfile =
    Boolean(user?.agent_profile) ||
    Boolean(user?.raw?.agent_profile) ||
    Boolean(user?.raw?.profile?.agent_profile);

  const hasAgentCode =
    Boolean(user?.agent_code) ||
    Boolean(user?.raw?.agent_code) ||
    Boolean(user?.raw?.agentCode);

  const isAgent =
    role === "agent" ||
    user?.is_agent === true ||
    user?.raw?.is_agent === true ||
    hasAgentProfile ||
    hasAgentCode;

  const connectedAgent =
    user?.raw?.connected_agent ||
    user?.raw?.agent ||
    user?.connected_agent ||
    (typeof user?.agent === "object" ? user.agent : null) ||
    null;

  const hasAgent = !!(user?.agent_profile || user?.agent || user?.agent_id || connectedAgent);

  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [hasNew, setHasNew] = useState(false);

  const storedCountRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const pollRef = useRef(null);
  const notifRef = useRef(null);
  const aliveRef = useRef(true);
  const lastFetchAtRef = useRef(0);

  const COUNT_KEY = "@payment_methods_count";
  const NOTIF_KEY = "@last_notif_id";

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fallbackItems = useMemo(
    () => [
      {
        id: "cash",
        title: "كاش",
        img: require("../assets/icons/cash.png"),
        onPress: () => safeNavigate("PaymentMethodsList"),
      },
      {
        id: "usdt",
        title: "USDT TRC20",
        img: require("../assets/icons/money.png"),
        onPress: () => safeNavigate("PaymentMethodsList"),
      },
    ],
    [safeNavigate]
  );

  const agentAdminItem = useMemo(() => {
    if (!isAgent) return null;
    return {
      id: "agent-shipping-admin",
      title: "اشحن رصيدك عبر الإدارة",
      img: require("../assets/icons/money.png"),
      onPress: () =>
        safeNavigate("ShippingMethodInfo", {
          adminKey: "agent-shipping-admin",
          forceAdminShipping: true,
        }),
    };
  }, [isAgent, safeNavigate]);

  const mapDyn = useCallback(
    (all) => {
      const base = (all || []).slice(0, 6).map((pm, idx) => {
        const isAgentShipping = !!pm?.is_agent_shipping;
        const id = pm?.id ?? `pm-${idx}`;
        const title = pm?.title || pm?.name || "دفعة";
        const img = pm?.icon_url
          ? { uri: absolutizeUrl(pm.icon_url) }
          : require("../assets/icons/cash.png");

        const onPress = () => {
          // ✅ Agent shipping
          if (isAgentShipping) {
            if (!hasAgent) {
              safeNavigate("OurAgents", { public: true, mode: "assign" });
              return;
            }

            // ✅ هذا النوع id تبعه string مثل "agent-shipping" فـ لا تعتمد على methodId
            // ابعتي method كـ JSON string (عشان expo-router)
            safeNavigate("ShippingMethodInfo", {
              forceAgent: true,
              method: JSON.stringify(pm),
            });
            return;
          }


          // ✅ Normal shipping method
          const rawId = pm?.id;
          if (rawId === undefined || rawId === null || String(rawId).length === 0) {
            Alert.alert("خطأ", "طريقة الدفع غير صحيحة (methodId مفقود)");
            console.warn("[BottomNav] Missing methodId for normal shipping", pm?.id, pm);
            return;
          }

          safeNavigate("ShippingMethodInfo", { methodId: rawId });
        };

        return { id, title, img, onPress };
      });

      if (agentAdminItem) return [agentAdminItem, ...base];
      return base;
    },
    [agentAdminItem, hasAgent, safeNavigate]
  );


  const fetchPayments = useCallback(async () => {
    if (!useDynamicPayments) {
      if (aliveRef.current) setItems([]);
      return;
    }

    // ✅ منع spam fetch
    const now = Date.now();
    if (now - lastFetchAtRef.current < 2000) return;
    lastFetchAtRef.current = now;

    try {
      const result = await getUserPaymentMethodsNormalized();
      if (!result.ok) throw new Error(result.error.message);
      const all = result.data;
      if (!aliveRef.current) return;

      const dyn = mapDyn(all);

      const count = Array.isArray(all) ? all.length : 0;
      let storedCount = storedCountRef.current;
      if (storedCount == null) {
        const raw = await AsyncStorage.getItem(COUNT_KEY);
        storedCount = raw != null ? Number(raw) : null;
      }

      if (Number.isFinite(storedCount) && count > storedCount) {
        setHasNew(true);
        setTimeout(() => aliveRef.current && setHasNew(false), 7000);
      }

      storedCountRef.current = count;
      await AsyncStorage.setItem(COUNT_KEY, String(count));

      setItems(dyn);
    } catch (e) {
      if (__DEV__) console.log("[BottomNav] fetchPayments error", e?.message);
      if (aliveRef.current) setItems([]);
    }
  }, [mapDyn, useDynamicPayments]);

  useFocusEffect(
    useCallback(() => {
      fetchPayments();
    }, [fetchPayments])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const wasBg = appState.current.match(/inactive|background/);
      if (wasBg && nextState === "active") fetchPayments();
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [fetchPayments]);

  useEffect(() => {
    if (!useDynamicPayments || !pollMs) return;
    pollRef.current = setInterval(fetchPayments, pollMs);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [fetchPayments, useDynamicPayments, pollMs]);

  useEffect(() => {
    let alive = true;

    const pollNotifications = async () => {
      try {
        const res = await getNotifications();
        if (!alive) return;

        const list = res?.ok ? res.data : [];
        if (!Array.isArray(list) || !list.length) return;

        const latest = list[0];
        const lastId = await AsyncStorage.getItem(NOTIF_KEY);
        if (!alive) return;

        if (String(latest?.id) !== String(lastId)) {
          const title = String(latest?.title || "");
          if (title.toLowerCase().includes("transfer received")) {
            Alert.alert("تحويل وارد", latest?.message || title);
          }
          await AsyncStorage.setItem(NOTIF_KEY, String(latest?.id));
        }
      } catch (e) {
        if (__DEV__) console.log("[BottomNav] notif error", e?.message);
      }
    };

    pollNotifications();
    notifRef.current = setInterval(pollNotifications, 30000);

    return () => {
      alive = false;
      notifRef.current && clearInterval(notifRef.current);
    };
  }, []);

  const finalItems = useMemo(() => {
    if (items.length > 0) return items;
    if (Array.isArray(staticItems) && staticItems.length > 0) return staticItems;
    if (agentAdminItem) return [agentAdminItem, ...fallbackItems];
    return fallbackItems;
  }, [items, staticItems, fallbackItems, agentAdminItem]);

  return (
    <NavBar
      active={active}
      insetBottom={insets.bottom}
      onPressHome={() => safeNavigate("Home")}
      onPressQR={() => safeNavigate("MyQRCode")}
      onPressMenu={onOpenMenu || (() => { })}
      onPressShipping={onOpenShippingList || (() => safeNavigate("PaymentMethodsList"))}
      shippingItems={finalItems}
      shippingHasNew={hasNew}
      onSendStark={() => safeNavigate("NewTransfer")}
      onTakeMoney={() => safeNavigate("TakeMoney")}
    />
  );
}
