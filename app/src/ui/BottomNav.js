// src/ui/BottomNav.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AppState,
  Alert,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  usePathname,
  useRouter,
} from "expo-router";

import NavBar from "./NavBar";

import {
  getUserPaymentMethodsNormalized,
} from "../features/payments/api/paymentMethodsApi";

import { absolutizeUrl } from "../api/client";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getNotifications } from "../api/system";
import { useAuth } from "../context/AuthProvider";

import {
  BOTTOM_NAV_ROUTE_MAP as ROUTE_MAP,
  isSameRoutePath,
} from "../shared/navigation/routes";

/* =========================================================
   Helpers
========================================================= */

function normalizeBool(value) {
  return (
    value === true ||
    String(value || "")
      .toLowerCase() ===
      "true"
  );
}

/* =========================================================
   Bottom Nav
========================================================= */

export default function BottomNav({
  navigation,
  active = "home",
  useDynamicPayments = true,
  staticItems,
  onOpenMenu,
  onOpenShippingList,

  pollMs = __DEV__
    ? 60000
    : 0,
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const { user } =
    useAuth() || {};

  const insets =
    useSafeAreaInsets();

  /* =======================================================
     Navigation Lock
  ======================================================= */

  const navigationLockRef =
    useRef(false);

  const safeNavigate =
    useCallback(
      (
        name,
        params
      ) => {
        const route =
          ROUTE_MAP[name];

        if (!route) {
          if (__DEV__) {
            console.warn(
              "[BottomNav] Route not found:",
              name
            );
          }

          return;
        }

        if (
          navigationLockRef.current
        ) {
          return;
        }

        const hasParams =
          params &&
          Object.keys(params)
            .length > 0;

        if (
          !hasParams &&
          isSameRoutePath(
            pathname,
            route
          )
        ) {
          return;
        }

        navigationLockRef.current =
          true;

        try {
          if (hasParams) {
            router.push({
              pathname:
                route,

              params,
            });
          } else {
            router.push(
              route
            );
          }
        } finally {
          setTimeout(
            () => {
              navigationLockRef.current =
                false;
            },
            500
          );
        }
      },
      [
        pathname,
        router,
      ]
    );

  /* =======================================================
     Role / Agent
  ======================================================= */

  const role =
    String(
      user?.role ||
        user?.raw?.role ||
        user?.raw?.user
          ?.role ||
        user?.raw?.profile
          ?.role ||
        ""
    ).toLowerCase();

  const hasAgentProfile =
    Boolean(
      user?.agent_profile
    ) ||
    Boolean(
      user?.raw
        ?.agent_profile
    ) ||
    Boolean(
      user?.raw?.profile
        ?.agent_profile
    );

  const hasAgentCode =
    Boolean(
      user?.agent_code
    ) ||
    Boolean(
      user?.raw
        ?.agent_code
    ) ||
    Boolean(
      user?.raw
        ?.agentCode
    );

  const isAgent =
    role === "agent" ||
    user?.is_agent ===
      true ||
    user?.raw
      ?.is_agent ===
      true ||
    hasAgentProfile ||
    hasAgentCode;

  const connectedAgent =
    user?.raw
      ?.connected_agent ||
    user?.raw?.agent ||
    user?.connected_agent ||
    (
      typeof user?.agent ===
      "object"
        ? user.agent
        : null
    ) ||
    null;

  const hasAgent =
    Boolean(
      user?.agent_profile ||
        user?.raw
          ?.agent_profile ||
        user?.agent_id ||
        user?.raw
          ?.agent_id ||
        connectedAgent ||
        (
          typeof user?.agent ===
          "object" &&
          user.agent
        )
    );

  /* =======================================================
     State
  ======================================================= */

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    hasNew,
    setHasNew,
  ] = useState(false);

  const storedCountRef =
    useRef(null);

  const appState =
    useRef(
      AppState.currentState
    );

  const pollRef =
    useRef(null);

  const notifRef =
    useRef(null);

  const aliveRef =
    useRef(true);

  const lastFetchAtRef =
    useRef(0);

  const COUNT_KEY =
    "@payment_methods_count";

  const NOTIF_KEY =
    "@last_notif_id";

  /* =======================================================
     Mounted
  ======================================================= */

  useEffect(() => {
    aliveRef.current =
      true;

    return () => {
      aliveRef.current =
        false;
    };
  }, []);

  /* =======================================================
     Fallback Items
  ======================================================= */

  const fallbackItems =
    useMemo(
      () => [
        {
          id: "cash",

          title:
            "كاش",

          img: require("../assets/icons/cash.png"),

          onPress: () =>
            safeNavigate(
              "PaymentMethodsList"
            ),
        },

        {
          id: "usdt",

          title:
            "USDT TRC20",

          img: require("../assets/icons/money.png"),

          onPress: () =>
            safeNavigate(
              "PaymentMethodsList"
            ),
        },
      ],
      [safeNavigate]
    );

  /* =======================================================
     Agent -> Admin
  ======================================================= */

  const agentAdminItem =
    useMemo(() => {
      if (!isAgent) {
        return null;
      }

      return {
        id:
          "agent-shipping-admin",

        title:
          "اشحن رصيدك عبر الإدارة",

        img: require("../assets/icons/money.png"),

        onPress: () =>
          safeNavigate(
            "ShippingMethodInfo",
            {
              adminKey:
                "agent-shipping-admin",

              forceAdminShipping:
                "true",

              methodKey:
                "agent-shipping-admin",

              methodName:
                "agent_shipping_admin",

              methodTitle:
                "شحن عبر الإدارة",
            }
          ),
      };
    }, [
      isAgent,
      safeNavigate,
    ]);

  /* =======================================================
     Dynamic Payment Methods
  ======================================================= */

  const mapDyn =
    useCallback(
      (all) => {
        const source =
          Array.isArray(all)
            ? all
            : [];

        const base =
          source
            .slice(0, 6)
            .map(
              (
                pm,
                index
              ) => {
                const isAgentShipping =
                  normalizeBool(
                    pm?.is_agent_shipping
                  );

                const id =
                  pm?.id ??
                  `pm-${index}`;

                const title =
                  pm?.title ||
                  pm?.name ||
                  "دفعة";

                const img =
                  pm?.icon_url
                    ? {
                        uri:
                          absolutizeUrl(
                            pm.icon_url
                          ),
                      }
                    : require("../assets/icons/cash.png");

                const onPress =
                  () => {
                    /* =====================================
                       Agent Shipping
                    ===================================== */

                    if (
                      isAgentShipping
                    ) {
                      if (
                        !hasAgent
                      ) {
                        safeNavigate(
                          "OurAgents",
                          {
                            public:
                              "true",

                            mode:
                              "assign",
                          }
                        );

                        return;
                      }

                      /*
                       * مهم:
                       * ما عاد نبعت كامل pm كـ JSON.
                       *
                       * نبعت بس قيم primitive صغيرة.
                       * ShippingMethodInfo بتبني method الوكيل
                       * بنفسها، وبالتالي ما عاد تضيع المعلومات.
                       */
                      safeNavigate(
                        "ShippingMethodInfo",
                        {
                          forceAgent:
                            "true",

                          methodKey:
                            String(
                              pm?.id ||
                                "agent-shipping"
                            ),

                          methodName:
                            String(
                              pm?.name ||
                                "agent_shipping"
                            ),

                          methodTitle:
                            String(
                              pm?.title ||
                                "شحن عبر الوكيل"
                            ),

                          requiresReceipt:
                            "false",
                        }
                      );

                      return;
                    }

                    /* =====================================
                       Normal Shipping
                    ===================================== */

                    const rawId =
                      pm?.id;

                    if (
                      rawId ===
                        undefined ||
                      rawId ===
                        null ||
                      String(
                        rawId
                      ).trim()
                        .length ===
                        0
                    ) {
                      Alert.alert(
                        "تعذر فتح طريقة الشحن",
                        "طريقة الشحن غير مكتملة."
                      );

                      return;
                    }

                    /*
                     * الطرق العادية:
                     * نبعث methodId فقط
                     * والصفحة بتجيب أحدث معلومات من API.
                     */
                    safeNavigate(
                      "ShippingMethodInfo",
                      {
                        methodId:
                          String(
                            rawId
                          ),
                      }
                    );
                  };

                return {
                  id,
                  title,
                  img,
                  onPress,
                };
              }
            );

        if (
          agentAdminItem
        ) {
          return [
            agentAdminItem,
            ...base,
          ];
        }

        return base;
      },
      [
        agentAdminItem,
        hasAgent,
        safeNavigate,
      ]
    );

  /* =======================================================
     Fetch Payments
  ======================================================= */

  const fetchPayments =
    useCallback(async () => {
      if (
        !useDynamicPayments
      ) {
        if (
          aliveRef.current
        ) {
          setItems([]);
        }

        return;
      }

      const now =
        Date.now();

      if (
        now -
          lastFetchAtRef
            .current <
        2000
      ) {
        return;
      }

      lastFetchAtRef.current =
        now;

      try {
        const result =
          await getUserPaymentMethodsNormalized();

        if (
          !result?.ok
        ) {
          throw new Error(
            result?.error
              ?.message ||
              "Failed"
          );
        }

        const all =
          Array.isArray(
            result?.data
          )
            ? result.data
            : [];

        if (
          !aliveRef.current
        ) {
          return;
        }

        const dyn =
          mapDyn(all);

        const count =
          all.length;

        let storedCount =
          storedCountRef.current;

        if (
          storedCount ==
          null
        ) {
          const raw =
            await AsyncStorage.getItem(
              COUNT_KEY
            );

          storedCount =
            raw != null
              ? Number(
                  raw
                )
              : null;
        }

        if (
          Number.isFinite(
            storedCount
          ) &&
          count >
            storedCount
        ) {
          setHasNew(true);

          setTimeout(
            () => {
              if (
                aliveRef.current
              ) {
                setHasNew(
                  false
                );
              }
            },
            7000
          );
        }

        storedCountRef.current =
          count;

        await AsyncStorage.setItem(
          COUNT_KEY,
          String(count)
        );

        if (
          aliveRef.current
        ) {
          setItems(dyn);
        }
      } catch (error) {
        if (__DEV__) {
          console.log(
            "[BottomNav] fetchPayments error",
            error?.message
          );
        }

        if (
          aliveRef.current
        ) {
          setItems([]);
        }
      }
    }, [
      mapDyn,
      useDynamicPayments,
    ]);

  /* =======================================================
     Focus
  ======================================================= */

  useFocusEffect(
    useCallback(() => {
      fetchPayments();
    }, [fetchPayments])
  );

  /* =======================================================
     App State
  ======================================================= */

  useEffect(() => {
    const subscription =
      AppState.addEventListener(
        "change",
        (
          nextState
        ) => {
          const wasBg =
            appState.current.match(
              /inactive|background/
            );

          if (
            wasBg &&
            nextState ===
              "active"
          ) {
            fetchPayments();
          }

          appState.current =
            nextState;
        }
      );

    return () =>
      subscription.remove();
  }, [fetchPayments]);

  /* =======================================================
     Payment Polling
  ======================================================= */

  useEffect(() => {
    if (
      !useDynamicPayments ||
      !pollMs
    ) {
      return;
    }

    pollRef.current =
      setInterval(
        fetchPayments,
        pollMs
      );

    return () => {
      if (
        pollRef.current
      ) {
        clearInterval(
          pollRef.current
        );
      }
    };
  }, [
    fetchPayments,
    useDynamicPayments,
    pollMs,
  ]);

  /* =======================================================
     Notifications
  ======================================================= */

  useEffect(() => {
    let alive =
      true;

    const pollNotifications =
      async () => {
        try {
          const response =
            await getNotifications();

          if (!alive) {
            return;
          }

          const list =
            response?.ok
              ? response.data
              : [];

          if (
            !Array.isArray(
              list
            ) ||
            list.length ===
              0
          ) {
            return;
          }

          const latest =
            list[0];

          const lastId =
            await AsyncStorage.getItem(
              NOTIF_KEY
            );

          if (!alive) {
            return;
          }

          if (
            String(
              latest?.id
            ) !==
            String(lastId)
          ) {
            const title =
              String(
                latest?.title ||
                  ""
              );

            if (
              title
                .toLowerCase()
                .includes(
                  "transfer received"
                )
            ) {
              Alert.alert(
                "تحويل وارد",

                latest?.message ||
                  "لديك تحويل وارد جديد."
              );
            }

            await AsyncStorage.setItem(
              NOTIF_KEY,
              String(
                latest?.id
              )
            );
          }
        } catch (error) {
          if (__DEV__) {
            console.log(
              "[BottomNav] notif error",
              error?.message
            );
          }
        }
      };

    pollNotifications();

    notifRef.current =
      setInterval(
        pollNotifications,
        30000
      );

    return () => {
      alive = false;

      if (
        notifRef.current
      ) {
        clearInterval(
          notifRef.current
        );
      }
    };
  }, []);

  /* =======================================================
     Final Items
  ======================================================= */

  const finalItems =
    useMemo(() => {
      if (
        items.length >
        0
      ) {
        return items;
      }

      if (
        Array.isArray(
          staticItems
        ) &&
        staticItems.length >
          0
      ) {
        return staticItems;
      }

      if (
        agentAdminItem
      ) {
        return [
          agentAdminItem,
          ...fallbackItems,
        ];
      }

      return fallbackItems;
    }, [
      items,
      staticItems,
      fallbackItems,
      agentAdminItem,
    ]);

  /* =======================================================
     Render
  ======================================================= */

  return (
    <NavBar
      active={
        active
      }
      insetBottom={
        insets.bottom
      }
      onPressHome={() =>
        safeNavigate(
          "Home"
        )
      }
      onPressQR={() =>
        safeNavigate(
          "MyQRCode"
        )
      }
      onPressMenu={
        onOpenMenu ||
        (() => {})
      }
      onPressShipping={
        onOpenShippingList ||
        (() =>
          safeNavigate(
            "PaymentMethodsList"
          ))
      }
      shippingItems={
        finalItems
      }
      shippingHasNew={
        hasNew
      }
      onSendStark={() =>
        safeNavigate(
          "NewTransfer"
        )
      }
      onTakeMoney={() =>
        safeNavigate(
          "TakeMoney"
        )
      }
    />
  );
}