// src/screens/AgentRequests.js

import { Ionicons } from "@expo/vector-icons";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";
import { AppHeader } from "../shared/ui/layout";

import { useAuth } from "../context/AuthProvider";

import {
  listAgentShippings,
} from "../api/deposits";

import api from "../api/client";

/* =========================================================
   Constants
========================================================= */

const BASE_W = 390;
const BASE_H = 844;
const MAX_W = 480;

const COLOR = {
  bg: "#F7F9FC",

  card: "#FFFFFF",

  text: "#0E1B3B",

  muted: "#718198",

  line: "#E4ECF2",

  primary: "#0B63D8",
  primarySoft: "#EEF5FF",

  success: "#16A34A",
  successSoft: "#F0FDF4",

  warning: "#D97706",
  warningSoft: "#FFF7E8",

  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
};

/* =========================================================
   Helpers
========================================================= */

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getStatusMeta(status) {
  const value =
    normalizeStatus(status);

  if (
    value === "approved" ||
    value === "completed"
  ) {
    return {
      label: "مقبول",
      color: COLOR.success,
      background:
        COLOR.successSoft,
      icon: "checkmark-circle",
    };
  }

  if (
    value === "rejected" ||
    value === "cancelled" ||
    value === "canceled"
  ) {
    return {
      label: "مرفوض",
      color: COLOR.danger,
      background:
        COLOR.dangerSoft,
      icon: "close-circle",
    };
  }

  return {
    label: "قيد الانتظار",
    color: COLOR.warning,
    background:
      COLOR.warningSoft,
    icon: "time-outline",
  };
}

function getCurrencyLabel(value) {
  const currency =
    String(value || "")
      .trim()
      .toUpperCase();

  if (currency === "USD") {
    return "دولار";
  }

  if (
    currency === "SYP" ||
    currency === "LOCAL"
  ) {
    return "سوري";
  }

  return "";
}

function formatAmount(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return number.toFixed(2);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  try {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date.toLocaleString(
      "ar-SY",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return "—";
  }
}

/* =========================================================
   Screen
========================================================= */

export default function AgentRequests({
  navigation,
}) {
  const { user } =
    useAuth();

  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } =
    useWindowDimensions();

  const sx =
    useCallback(
      (number) =>
        (W / BASE_W) *
        number,
      [W]
    );

  const sy =
    useCallback(
      (number) =>
        (H / BASE_H) *
        number,
      [H]
    );

  const sp =
    useCallback(
      (number) =>
        number *
        Math.min(
          W / BASE_W,
          H / BASE_H
        ),
      [W, H]
    );

  const styles =
    useMemo(
      () =>
        makeStyles({
          sx,
          sy,
          sp,
        }),
      [sx, sy, sp]
    );

  /* =======================================================
     Agent
  ======================================================= */

  const role =
    String(
      user?.role ||
        user?.raw?.role ||
        ""
    ).toLowerCase();

  const isAgent =
    role === "agent" ||
    user?.is_agent === true ||
    user?.raw?.is_agent ===
      true;

  /* =======================================================
     State
  ======================================================= */

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    items,
    setItems,
  ] =
    useState([]);

  const [
    filterStatus,
    setFilterStatus,
  ] =
    useState("all");

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState({});

  /* =======================================================
     Load
  ======================================================= */

  const load =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        if (showLoading) {
          setLoading(true);
        }

        setError("");

        try {
          const response =
            await listAgentShippings();

          if (!response?.ok) {
            throw new Error();
          }

          const list =
            Array.isArray(
              response?.data
            )
              ? response.data
              : [];

          const shippingItems =
            list.map(
              (item) => ({
                key:
                  `ship-${item.id}`,

                type:
                  "shipping",

                id:
                  item.id,

                status:
                  item.status,

                amount:
                  item.amount,

                currency:
                  item.currency,

                created_at:
                  item.created_at,

                user_name:
                  item.user_name,

                user_phone:
                  item
                    ?.user_input_data
                    ?.user_phone ||
                  "",

                note:
                  item
                    ?.user_input_data
                    ?.note ||
                  "",

                raw:
                  item,
              })
            );

          shippingItems.sort(
            (a, b) => {
              const first =
                new Date(
                  a.created_at ||
                    0
                ).getTime();

              const second =
                new Date(
                  b.created_at ||
                    0
                ).getTime();

              return (
                second -
                first
              );
            }
          );

          setItems(
            shippingItems
          );
        } catch {
          setError(
            "تعذر تحميل طلبات العملاء. حاول مرة أخرى."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  /* =======================================================
     Initial Load
  ======================================================= */

  useEffect(() => {
    if (!isAgent) {
      setLoading(false);
      setItems([]);

      return;
    }

    load({
      showLoading: true,
    });
  }, [
    isAgent,
    load,
  ]);

  /* =======================================================
     Refresh
  ======================================================= */

  const onRefresh =
    useCallback(() => {
      setRefreshing(true);

      load();
    }, [load]);

  /* =======================================================
     Stats
  ======================================================= */

  const stats =
    useMemo(() => {
      let pending = 0;
      let approved = 0;
      let rejected = 0;

      for (const item of items) {
        const status =
          normalizeStatus(
            item?.status
          );

        if (
          status ===
          "approved" ||
          status ===
          "completed"
        ) {
          approved += 1;
        } else if (
          status ===
            "rejected" ||
          status ===
            "cancelled" ||
          status ===
            "canceled"
        ) {
          rejected += 1;
        } else {
          pending += 1;
        }
      }

      return {
        total:
          items.length,

        pending,

        approved,

        rejected,
      };
    }, [items]);

  /* =======================================================
     Filter
  ======================================================= */

  const filtered =
    useMemo(() => {
      if (
        filterStatus ===
        "all"
      ) {
        return items;
      }

      return items.filter(
        (item) => {
          const status =
            normalizeStatus(
              item.status
            );

          if (
            filterStatus ===
            "pending"
          ) {
            return ![
              "approved",
              "completed",
              "rejected",
              "cancelled",
              "canceled",
            ].includes(
              status
            );
          }

          if (
            filterStatus ===
            "approved"
          ) {
            return [
              "approved",
              "completed",
            ].includes(
              status
            );
          }

          if (
            filterStatus ===
            "rejected"
          ) {
            return [
              "rejected",
              "cancelled",
              "canceled",
            ].includes(
              status
            );
          }

          return true;
        }
      );
    }, [
      items,
      filterStatus,
    ]);

  /* =======================================================
     Approve
  ======================================================= */

  const handleApproveShipping =
    useCallback(
      async (item) => {
        if (!item) {
          return;
        }

        if (
          normalizeStatus(
            item.status
          ) !== "pending"
        ) {
          return;
        }

        if (
          actionLoading[
            item.id
          ]
        ) {
          return;
        }

        const confirmed =
          await new Promise(
            (resolve) =>
              Alert.alert(
                "تأكيد الموافقة",
                "هل استلمت المبلغ وتريد الموافقة على طلب الشحن؟",
                [
                  {
                    text:
                      "إلغاء",

                    style:
                      "cancel",

                    onPress:
                      () =>
                        resolve(
                          false
                        ),
                  },

                  {
                    text:
                      "موافقة",

                    onPress:
                      () =>
                        resolve(
                          true
                        ),
                  },
                ],
                {
                  cancelable:
                    true,

                  onDismiss:
                    () =>
                      resolve(
                        false
                      ),
                }
              )
          );

        if (!confirmed) {
          return;
        }

        try {
          setActionLoading(
            (previous) => ({
              ...previous,

              [item.id]:
                true,
            })
          );

          await api.post(
            `shipping/via-agent/${item.id}/update_status/`,
            {
              status:
                "approved",

              agent_notes:
                "Approved by agent",
            }
          );

          setItems(
            (previous) =>
              previous.map(
                (current) =>
                  current.id ===
                  item.id
                    ? {
                        ...current,

                        status:
                          "approved",
                      }
                    : current
              )
          );

          await load();
        } catch (
          approveError
        ) {
          const message =
            String(
              approveError
                ?.response
                ?.data
                ?.error ||
                approveError
                  ?.message ||
                ""
            ).toLowerCase();

          if (
            message.includes(
              "already approved"
            )
          ) {
            setItems(
              (previous) =>
                previous.map(
                  (
                    current
                  ) =>
                    current.id ===
                    item.id
                      ? {
                          ...current,

                          status:
                            "approved",
                        }
                      : current
                )
            );

            await load();
          } else {
            Alert.alert(
              "تعذر قبول الطلب",
              "حدث خطأ أثناء الموافقة على الطلب."
            );
          }
        } finally {
          setActionLoading(
            (previous) => ({
              ...previous,

              [item.id]:
                false,
            })
          );
        }
      },
      [
        actionLoading,
        load,
      ]
    );

  /* =======================================================
     Reject
  ======================================================= */

  const handleRejectShipping =
    useCallback(
      async (item) => {
        if (!item) {
          return;
        }

        if (
          normalizeStatus(
            item.status
          ) !== "pending"
        ) {
          return;
        }

        if (
          actionLoading[
            item.id
          ]
        ) {
          return;
        }

        const confirmed =
          await new Promise(
            (resolve) =>
              Alert.alert(
                "تأكيد الرفض",
                "هل تريد رفض طلب الشحن؟",
                [
                  {
                    text:
                      "إلغاء",

                    style:
                      "cancel",

                    onPress:
                      () =>
                        resolve(
                          false
                        ),
                  },

                  {
                    text:
                      "رفض",

                    style:
                      "destructive",

                    onPress:
                      () =>
                        resolve(
                          true
                        ),
                  },
                ],
                {
                  cancelable:
                    true,

                  onDismiss:
                    () =>
                      resolve(
                        false
                      ),
                }
              )
          );

        if (!confirmed) {
          return;
        }

        try {
          setActionLoading(
            (previous) => ({
              ...previous,

              [item.id]:
                true,
            })
          );

          await api.post(
            `shipping/via-agent/${item.id}/update_status/`,
            {
              status:
                "rejected",

              agent_notes:
                "Rejected by agent",
            }
          );

          setItems(
            (previous) =>
              previous.map(
                (current) =>
                  current.id ===
                  item.id
                    ? {
                        ...current,

                        status:
                          "rejected",
                      }
                    : current
              )
          );

          await load();
        } catch (
          rejectError
        ) {
          const message =
            String(
              rejectError
                ?.response
                ?.data
                ?.error ||
                rejectError
                  ?.message ||
                ""
            ).toLowerCase();

          if (
            message.includes(
              "already approved"
            )
          ) {
            setItems(
              (previous) =>
                previous.map(
                  (
                    current
                  ) =>
                    current.id ===
                    item.id
                      ? {
                          ...current,

                          status:
                            "approved",
                        }
                      : current
                )
            );

            await load();
          } else {
            Alert.alert(
              "تعذر رفض الطلب",
              "حدث خطأ أثناء رفض الطلب."
            );
          }
        } finally {
          setActionLoading(
            (previous) => ({
              ...previous,

              [item.id]:
                false,
            })
          );
        }
      },
      [
        actionLoading,
        load,
      ]
    );

  /* =======================================================
     Bottom padding
  ======================================================= */

  const bottomPadding =
    insets.bottom +
    sy(100);

  /* =======================================================
     Not Agent
  ======================================================= */

  if (!isAgent) {
    return (
      <PageLayout
        navigation={
          navigation
        }
        active="menu"
        withSideMenu
      >
        <View
          style={
            styles.page
          }
        >
          <AppHeader
            title="طلبات الوكيل"
          />

          <View
            style={
              styles.centerState
            }
          >
            <View
              style={[
                styles.stateIcon,

                {
                  backgroundColor:
                    COLOR.dangerSoft,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={
                  sp(28)
                }
                color={
                  COLOR.danger
                }
              />
            </View>

            <Text
              style={
                styles.stateTitle
              }
            >
              غير مصرح
            </Text>

            <Text
              style={
                styles.stateText
              }
            >
              هذه الصفحة متاحة للوكلاء فقط.
            </Text>
          </View>
        </View>
      </PageLayout>
    );
  }

  /* =======================================================
     Header
  ======================================================= */

  const ListHeader =
    () => (
      <>
        {/* =================================================
            Title
        ================================================= */}

        <View
          style={
            styles.sectionHeading
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            طلبات شحن العملاء
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            راجع طلبات الشحن وقم بالموافقة عليها أو رفضها
          </Text>
        </View>

        {/* =================================================
            Summary
        ================================================= */}

        <View
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="إجمالي الطلبات"
            value={
              stats.total
            }
            icon="documents-outline"
            color={
              COLOR.primary
            }
            background={
              COLOR.primarySoft
            }
            styles={
              styles
            }
            sp={sp}
          />

          <SummaryCard
            label="قيد الانتظار"
            value={
              stats.pending
            }
            icon="time-outline"
            color={
              COLOR.warning
            }
            background={
              COLOR.warningSoft
            }
            styles={
              styles
            }
            sp={sp}
          />
        </View>

        {/* =================================================
            Filters
        ================================================= */}

        <View
          style={
            styles.filters
          }
        >
          <FilterPill
            label="الكل"
            count={
              stats.total
            }
            active={
              filterStatus ===
              "all"
            }
            onPress={() =>
              setFilterStatus(
                "all"
              )
            }
            styles={
              styles
            }
          />

          <FilterPill
            label="قيد الانتظار"
            count={
              stats.pending
            }
            active={
              filterStatus ===
              "pending"
            }
            onPress={() =>
              setFilterStatus(
                "pending"
              )
            }
            styles={
              styles
            }
          />

          <FilterPill
            label="مقبول"
            count={
              stats.approved
            }
            active={
              filterStatus ===
              "approved"
            }
            onPress={() =>
              setFilterStatus(
                "approved"
              )
            }
            styles={
              styles
            }
          />

          <FilterPill
            label="مرفوض"
            count={
              stats.rejected
            }
            active={
              filterStatus ===
              "rejected"
            }
            onPress={() =>
              setFilterStatus(
                "rejected"
              )
            }
            styles={
              styles
            }
          />
        </View>
      </>
    );

  /* =======================================================
     Render Item
  ======================================================= */

  const renderItem = ({
    item,
  }) => {
    const status =
      getStatusMeta(
        item.status
      );

    const currency =
      getCurrencyLabel(
        item.currency
      );

    const pending =
      normalizeStatus(
        item.status
      ) === "pending";

    const busy =
      Boolean(
        actionLoading[
          item.id
        ]
      );

    return (
      <View
        style={
          styles.requestCard
        }
      >
        {/* =================================================
            Top
        ================================================= */}

        <View
          style={
            styles.cardTop
          }
        >
          <View
            style={
              styles.customerIcon
            }
          >
            <Ionicons
              name="person-outline"
              size={
                sp(21)
              }
              color={
                COLOR.primary
              }
            />
          </View>

          <View
            style={
              styles.customerInfo
            }
          >
            <Text
              style={
                styles.customerLabel
              }
            >
              العميل
            </Text>

            <Text
              numberOfLines={
                1
              }
              style={
                styles.customerName
              }
            >
              {item.user_name ||
                "مستخدم"}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,

              {
                backgroundColor:
                  status.background,
              },
            ]}
          >
            <Ionicons
              name={
                status.icon
              }
              size={
                sp(13)
              }
              color={
                status.color
              }
            />

            <Text
              style={[
                styles.statusText,

                {
                  color:
                    status.color,
                },
              ]}
            >
              {status.label}
            </Text>
          </View>
        </View>

        {/* =================================================
            Phone
        ================================================= */}

        {!!item.user_phone && (
          <View
            style={
              styles.infoRow
            }
          >
            <Ionicons
              name="call-outline"
              size={
                sp(14)
              }
              color={
                COLOR.muted
              }
            />

            <Text
              style={
                styles.phoneText
              }
            >
              {
                item.user_phone
              }
            </Text>
          </View>
        )}

        {/* =================================================
            Divider
        ================================================= */}

        <View
          style={
            styles.divider
          }
        />

        {/* =================================================
            Amount
        ================================================= */}

        <View
          style={
            styles.detailRow
          }
        >
          <Text
            style={
              styles.detailLabel
            }
          >
            مبلغ الشحن
          </Text>

          <View
            style={
              styles.amountRow
            }
          >
            <Text
              style={
                styles.amountValue
              }
            >
              {formatAmount(
                item.amount
              )}
            </Text>

            {!!currency && (
              <Text
                style={
                  styles.currencyText
                }
              >
                {currency}
              </Text>
            )}
          </View>
        </View>

        {/* =================================================
            Date
        ================================================= */}

        <View
          style={
            styles.detailRow
          }
        >
          <Text
            style={
              styles.detailLabel
            }
          >
            تاريخ الطلب
          </Text>

          <Text
            style={
              styles.detailValue
            }
          >
            {formatDate(
              item.created_at
            )}
          </Text>
        </View>

        {/* =================================================
            Note
        ================================================= */}

        {!!item.note && (
          <View
            style={
              styles.noteBox
            }
          >
            <View
              style={
                styles.noteTitleRow
              }
            >
              <Ionicons
                name="document-text-outline"
                size={
                  sp(14)
                }
                color={
                  COLOR.primary
                }
              />

              <Text
                style={
                  styles.noteLabel
                }
              >
                ملاحظة العميل
              </Text>
            </View>

            <Text
              style={
                styles.noteText
              }
            >
              {item.note}
            </Text>
          </View>
        )}

        {/* =================================================
            Actions
        ================================================= */}

        {pending && (
          <View
            style={
              styles.actionsRow
            }
          >
            <Pressable
              disabled={
                busy
              }
              onPress={() =>
                handleApproveShipping(
                  item
                )
              }
              style={({
                pressed,
              }) => [
                styles.actionButton,

                styles.approveButton,

                busy && {
                  opacity:
                    0.55,
                },

                pressed &&
                  !busy && {
                    opacity:
                      0.85,
                  },
              ]}
            >
              {busy ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-outline"
                    size={
                      sp(17)
                    }
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.actionText
                    }
                  >
                    موافقة
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              disabled={
                busy
              }
              onPress={() =>
                handleRejectShipping(
                  item
                )
              }
              style={({
                pressed,
              }) => [
                styles.actionButton,

                styles.rejectButton,

                busy && {
                  opacity:
                    0.55,
                },

                pressed &&
                  !busy && {
                    opacity:
                      0.85,
                  },
              ]}
            >
              <Ionicons
                name="close-outline"
                size={
                  sp(18)
                }
                color={
                  COLOR.danger
                }
              />

              <Text
                style={
                  styles.rejectText
                }
              >
                رفض
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  /* =======================================================
     Empty
  ======================================================= */

  const EmptyState =
    () => (
      <View
        style={
          styles.centerState
        }
      >
        <View
          style={
            styles.stateIcon
          }
        >
          <Ionicons
            name={
              filterStatus ===
              "pending"
                ? "checkmark-done-outline"
                : "archive-outline"
            }
            size={
              sp(28)
            }
            color={
              COLOR.primary
            }
          />
        </View>

        <Text
          style={
            styles.stateTitle
          }
        >
          لا توجد طلبات
        </Text>

        <Text
          style={
            styles.stateText
          }
        >
          {filterStatus ===
          "pending"
            ? "لا توجد طلبات بانتظار المراجعة حالياً."
            : "لا توجد طلبات مطابقة لهذا التصنيف."}
        </Text>
      </View>
    );

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="menu"
      withSideMenu
    >
      <View
        style={
          styles.page
        }
      >
        {/* Background */}

        <View
          pointerEvents="none"
          style={
            styles.spinnerBg
          }
        >
          <CornerSpinner
            size={
              sx(800)
            }
            image={require("../assets/home-corner.png")}
            speedMs={
              16000
            }
            opacity={
              0.4
            }
          />
        </View>

        {/* Header */}

        <AppHeader
          title="طلبات الوكيل"
        />

        {/* Loading */}

        {loading ? (
          <View
            style={
              styles.loading
            }
          >
            <ActivityIndicator
              size="large"
              color={
                COLOR.primary
              }
            />

            <Text
              style={
                styles.loadingText
              }
            >
              جاري تحميل الطلبات...
            </Text>
          </View>
        ) : error ? (
          <View
            style={[
              styles.content,
              {
                paddingHorizontal:
                  sx(14),

                paddingTop:
                  sy(16),
              },
            ]}
          >
            <View
              style={
                styles.centerState
              }
            >
              <View
                style={[
                  styles.stateIcon,

                  {
                    backgroundColor:
                      COLOR.dangerSoft,
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={
                    sp(28)
                  }
                  color={
                    COLOR.danger
                  }
                />
              </View>

              <Text
                style={
                  styles.stateTitle
                }
              >
                تعذر تحميل الطلبات
              </Text>

              <Text
                style={
                  styles.stateText
                }
              >
                {error}
              </Text>

              <Pressable
                onPress={() =>
                  load({
                    showLoading:
                      true,
                  })
                }
                style={
                  styles.retryButton
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={
                    sp(16)
                  }
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.retryText
                  }
                >
                  إعادة المحاولة
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <FlatList
            data={
              filtered
            }
            keyExtractor={(
              item
            ) =>
              String(
                item.key
              )
            }
            renderItem={
              renderItem
            }
            ListHeaderComponent={
              ListHeader
            }
            ListEmptyComponent={
              EmptyState
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height:
                    sy(11),
                }}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  onRefresh
                }
                tintColor={
                  COLOR.primary
                }
                colors={[
                  COLOR.primary,
                ]}
              />
            }
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={{
              width: "100%",

              maxWidth:
                MAX_W,

              alignSelf:
                "center",

              paddingHorizontal:
                sx(14),

              paddingTop:
                sy(12),

              paddingBottom:
                bottomPadding,

              flexGrow:
                filtered.length ===
                0
                  ? 1
                  : undefined,
            }}
          />
        )}
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Summary Card
========================================================= */

function SummaryCard({
  label,
  value,
  icon,
  color,
  background,
  styles,
  sp,
}) {
  return (
    <View
      style={
        styles.summaryCard
      }
    >
      <View
        style={[
          styles.summaryIcon,

          {
            backgroundColor:
              background,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={sp(20)}
          color={color}
        />
      </View>

      <View
        style={
          styles.summaryInfo
        }
      >
        <Text
          style={
            styles.summaryLabel
          }
        >
          {label}
        </Text>

        <Text
          style={[
            styles.summaryValue,

            {
              color,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   Filter
========================================================= */

function FilterPill({
  label,
  count,
  active,
  onPress,
  styles,
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={[
        styles.filterButton,

        active &&
          styles.filterButtonActive,
      ]}
    >
      <Text
        style={[
          styles.filterText,

          active &&
            styles.filterTextActive,
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.filterCount,

          active &&
            styles.filterCountActive,
        ]}
      >
        <Text
          style={[
            styles.filterCountText,

            active &&
              styles.filterCountTextActive,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

/* =========================================================
   Styles
========================================================= */

function makeStyles({
  sx,
  sy,
  sp,
}) {
  return StyleSheet.create({
    page: {
      flex: 1,

      backgroundColor:
        COLOR.bg,

      direction:
        "ltr",
    },

    content: {
      width: "100%",

      maxWidth:
        MAX_W,

      alignSelf:
        "center",
    },

    spinnerBg: {
      position:
        "absolute",

      top: 0,
      right: 0,
      left: 0,

      height: 0,
    },

    /* =====================================================
       Section
    ===================================================== */

    sectionHeading: {
      width: "100%",

      alignItems:
        "flex-end",

      marginBottom:
        sy(12),
    },

    sectionTitle: {
      width: "100%",

      color:
        COLOR.text,

      fontSize:
        sp(22),

      lineHeight:
        sp(30),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    sectionSubtitle: {
      width: "100%",

      marginTop:
        sy(3),

      color:
        COLOR.muted,

      fontSize:
        sp(12),

      lineHeight:
        sp(19),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Summary
    ===================================================== */

    summaryGrid: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      gap:
        sx(9),

      marginBottom:
        sy(14),
    },

    summaryCard: {
      flex: 1,

      minHeight:
        sy(82),

      padding:
        sx(11),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(9),

      backgroundColor:
        COLOR.card,

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        sx(17),

      shadowColor:
        "#000",

      shadowOpacity:
        0.025,

      shadowRadius:
        6,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation:
        1,
    },

    summaryIcon: {
      width:
        sx(39),

      height:
        sx(39),

      borderRadius:
        sx(12),

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    summaryInfo: {
      flex: 1,

      minWidth: 0,

      alignItems:
        "flex-end",
    },

    summaryLabel: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontSize:
        sp(10.5),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    summaryValue: {
      width:
        "100%",

      marginTop:
        sy(2),

      fontSize:
        sp(20),

      fontWeight:
        "900",

      textAlign:
        "right",
    },

    /* =====================================================
       Filters
    ===================================================== */

    filters: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      flexWrap:
        "wrap",

      gap:
        sx(7),

      marginBottom:
        sy(14),
    },

    filterButton: {
      minHeight:
        sy(38),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(5),

      paddingHorizontal:
        sx(10),

      borderRadius:
        sx(12),

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      backgroundColor:
        COLOR.card,
    },

    filterButtonActive: {
      backgroundColor:
        COLOR.primarySoft,

      borderColor:
        "#CFE1FF",
    },

    filterText: {
      color:
        COLOR.muted,

      fontSize:
        sp(11.5),

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    filterTextActive: {
      color:
        COLOR.primary,

      fontWeight:
        "900",
    },

    filterCount: {
      minWidth:
        sx(21),

      height:
        sx(21),

      paddingHorizontal:
        sx(4),

      borderRadius:
        sx(11),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#EEF1F5",
    },

    filterCountActive: {
      backgroundColor:
        COLOR.primary,
    },

    filterCountText: {
      color:
        COLOR.muted,

      fontSize:
        sp(9.5),

      fontWeight:
        "900",
    },

    filterCountTextActive: {
      color:
        "#FFFFFF",
    },

    /* =====================================================
       Request card
    ===================================================== */

    requestCard: {
      width:
        "100%",

      padding:
        sx(14),

      backgroundColor:
        COLOR.card,

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        sx(18),

      shadowColor:
        "#000",

      shadowOpacity:
        0.03,

      shadowRadius:
        7,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation:
        1,
    },

    cardTop: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(10),
    },

    customerIcon: {
      width:
        sx(44),

      height:
        sx(44),

      borderRadius:
        sx(13),

      flexShrink:
        0,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    customerInfo: {
      flex:
        1,

      minWidth: 0,

      alignItems:
        "flex-end",
    },

    customerLabel: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontSize:
        sp(10),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    customerName: {
      width:
        "100%",

      marginTop:
        sy(2),

      color:
        COLOR.text,

      fontSize:
        sp(15.5),

      lineHeight:
        sp(22),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Status
    ===================================================== */

    statusBadge: {
      flexShrink:
        0,

      minHeight:
        sy(29),

      paddingHorizontal:
        sx(8),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(4),

      borderRadius:
        sx(10),
    },

    statusText: {
      fontSize:
        sp(10),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Phone
    ===================================================== */

    infoRow: {
      width:
        "100%",

      marginTop:
        sy(8),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(5),
    },

    phoneText: {
      color:
        COLOR.muted,

      fontSize:
        sp(11),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "ltr",
    },

    /* =====================================================
       Divider
    ===================================================== */

    divider: {
      width:
        "100%",

      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLOR.line,

      marginVertical:
        sy(12),
    },

    /* =====================================================
       Details
    ===================================================== */

    detailRow: {
      width:
        "100%",

      minHeight:
        sy(34),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        sx(10),
    },

    detailLabel: {
      color:
        COLOR.muted,

      fontSize:
        sp(11),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    detailValue: {
      flex:
        1,

      color:
        COLOR.text,

      fontSize:
        sp(11),

      fontWeight:
        "800",

      textAlign:
        "left",

      writingDirection:
        "rtl",
    },

    amountRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(5),
    },

    amountValue: {
      color:
        COLOR.text,

      fontSize:
        sp(16),

      fontWeight:
        "900",
    },

    currencyText: {
      color:
        COLOR.primary,

      fontSize:
        sp(11),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Note
    ===================================================== */

    noteBox: {
      width:
        "100%",

      marginTop:
        sy(9),

      padding:
        sx(10),

      backgroundColor:
        "#F8FAFD",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        sx(12),
    },

    noteTitleRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(5),
    },

    noteLabel: {
      color:
        COLOR.primary,

      fontSize:
        sp(10.5),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    noteText: {
      width:
        "100%",

      marginTop:
        sy(5),

      color:
        COLOR.text,

      fontSize:
        sp(11.5),

      lineHeight:
        sp(18),

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Actions
    ===================================================== */

    actionsRow: {
      width:
        "100%",

      marginTop:
        sy(14),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(8),
    },

    actionButton: {
      flex: 1,

      minHeight:
        sy(43),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(5),

      borderRadius:
        sx(12),
    },

    approveButton: {
      backgroundColor:
        COLOR.success,
    },

    rejectButton: {
      backgroundColor:
        COLOR.dangerSoft,

      borderWidth:
        1,

      borderColor:
        "#FECACA",
    },

    actionText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(12),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    rejectText: {
      color:
        COLOR.danger,

      fontSize:
        sp(12),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       States
    ===================================================== */

    centerState: {
      width:
        "100%",

      marginTop:
        sy(8),

      paddingVertical:
        sy(36),

      paddingHorizontal:
        sx(18),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.card,

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        sx(18),
    },

    stateIcon: {
      width:
        sx(58),

      height:
        sx(58),

      borderRadius:
        sx(18),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    stateTitle: {
      marginTop:
        sy(11),

      color:
        COLOR.text,

      fontSize:
        sp(15),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    stateText: {
      marginTop:
        sy(5),

      color:
        COLOR.muted,

      fontSize:
        sp(12),

      lineHeight:
        sp(19),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    retryButton: {
      minHeight:
        sy(40),

      marginTop:
        sy(14),

      paddingHorizontal:
        sx(15),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(5),

      backgroundColor:
        COLOR.primary,

      borderRadius:
        sx(12),
    },

    retryText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(12),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Loading
    ===================================================== */

    loading: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingBottom:
        sy(70),
    },

    loadingText: {
      marginTop:
        sy(9),

      color:
        COLOR.muted,

      fontSize:
        sp(12),

      fontWeight:
        "700",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },
  });
}