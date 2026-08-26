// src/screens/transactions/TransactionDetail.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PageLayout from "../../ui/PageLayout";
import CornerSpinner from "../../ui/CornerSpinner";
import { AppHeader } from "../../shared/ui/layout";

import {
  getTransactionById,
  approveTransaction,
} from "../../api/transactions";

import { useAuth } from "../../context/AuthProvider";

/* =========================================================
   Colors
========================================================= */

const COLORS = {
  bg: "#F7F9FC",
  card: "#FFFFFF",

  text: "#0E1B3B",
  muted: "#6B7B90",

  line: "#E4ECF2",

  primary: "#0B63D8",
  primarySoft: "#EEF5FF",

  success: "#16A34A",
  successSoft: "#F0FDF4",

  warning: "#CA8A04",
  warningSoft: "#FFFBEB",

  danger: "#DC2626",
  dangerSoft: "#FEF2F2",

  info: "#2563EB",
};

const BASE_W = 390;
const BASE_H = 844;
const MAX_W = 480;

/* =========================================================
   Helpers
========================================================= */

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

function getArabicError(
  error,
  fallback
) {
  const data =
    error?.response?.data ??
    error?.data ??
    error;

  if (
    data &&
    typeof data === "object"
  ) {
    const arabic =
      data?.message?.ar ||
      data?.error?.ar ||
      data?.detail?.ar ||
      data?.message_ar ||
      data?.error_ar;

    if (arabic) {
      return String(arabic);
    }

    const normal =
      data?.detail ||
      data?.error ||
      data?.message;

    if (
      typeof normal ===
        "string" &&
      containsArabic(normal)
    ) {
      return normal;
    }
  }

  if (
    typeof data ===
      "string" &&
    containsArabic(data)
  ) {
    return data;
  }

  return fallback;
}

/* =========================================================
   Recipient from technical note
========================================================= */

function extractRecipientFromNote(
  note = ""
) {
  const match =
    String(note).match(
      /RECIPIENT_WALLET:(\d+)/
    );

  return match
    ? match[1]
    : null;
}

/* =========================================================
   Type
========================================================= */

function getTypeMeta(type) {
  const raw =
    String(
      type || ""
    ).toLowerCase();

  switch (raw) {
    case "deposit":
      return {
        label: "إيداع",
        icon:
          "arrow-down-outline",
        color:
          COLORS.success,
        bg:
          COLORS.successSoft,
      };

    case "transfer":
      return {
        label: "تحويل",
        icon:
          "swap-horizontal-outline",
        color:
          COLORS.info,
        bg:
          "#EFF6FF",
      };

    case "purchase":
      return {
        label: "شراء",
        icon:
          "cart-outline",
        color:
          COLORS.primary,
        bg:
          COLORS.primarySoft,
      };

    case "cashout":
      return {
        label: "سحب",
        icon:
          "cash-outline",
        color:
          COLORS.warning,
        bg:
          COLORS.warningSoft,
      };

    default:
      return {
        label: "معاملة",
        icon:
          "receipt-outline",
        color:
          COLORS.muted,
        bg:
          "#F1F5F9",
      };
  }
}

/* =========================================================
   Status
========================================================= */

function getStatusMeta(status) {
  const raw =
    String(
      status || ""
    ).toLowerCase();

  if (
    [
      "approved",
      "success",
      "successful",
      "completed",
      "done",
    ].includes(raw)
  ) {
    return {
      label: "مكتملة",

      color:
        COLORS.success,

      bg:
        COLORS.successSoft,

      icon:
        "checkmark-circle-outline",
    };
  }

  if (
    [
      "rejected",
      "declined",
    ].includes(raw)
  ) {
    return {
      label: "مرفوضة",

      color:
        COLORS.danger,

      bg:
        COLORS.dangerSoft,

      icon:
        "close-circle-outline",
    };
  }

  if (
    [
      "failed",
      "error",
    ].includes(raw)
  ) {
    return {
      label: "فشلت",

      color:
        COLORS.danger,

      bg:
        COLORS.dangerSoft,

      icon:
        "alert-circle-outline",
    };
  }

  if (
    [
      "cancelled",
      "canceled",
    ].includes(raw)
  ) {
    return {
      label: "ملغاة",

      color:
        COLORS.muted,

      bg:
        "#F1F5F9",

      icon:
        "ban-outline",
    };
  }

  return {
    label:
      "قيد الانتظار",

    color:
      COLORS.warning,

    bg:
      COLORS.warningSoft,

    icon:
      "time-outline",
  };
}

/* =========================================================
   Formatters
========================================================= */

function formatAmount(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0.00";
  }

  return Math.abs(
    number
  ).toFixed(2);
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
        year:
          "numeric",

        month:
          "long",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        timeZone:
          "Asia/Damascus",
      }
    );
  } catch {
    return "—";
  }
}

function displayWallet(value) {
  if (
    value == null ||
    value === ""
  ) {
    return "";
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    return String(value);
  }

  if (
    typeof value ===
    "object"
  ) {
    return String(
      value?.currency ||
        value?.wallet_currency ||
        value?.name ||
        value?.id ||
        ""
    );
  }

  return "";
}

/* =========================================================
   Screen
========================================================= */

export default function TransactionDetail({
  route,
  navigation,
}) {
  const id =
    route?.params?.id;

  const { user } =
    useAuth() || {};

  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } =
    useWindowDimensions();

  const sx = useCallback(
    (n) =>
      (W / BASE_W) *
      n,
    [W]
  );

  const sy = useCallback(
    (n) =>
      (H / BASE_H) *
      n,
    [H]
  );

  const sp = useCallback(
    (n) =>
      n *
      Math.min(
        W / BASE_W,
        H / BASE_H
      ),
    [W, H]
  );

  const [
    item,
    setItem,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  /* =======================================================
     Load
  ======================================================= */

  const load =
    useCallback(async () => {
      try {
        setLoading(
          true
        );

        setError("");

        const response =
          await getTransactionById(
            id
          );

        if (
          !response?.ok
        ) {
          throw response;
        }

        setItem(
          response?.data ||
            null
        );
      } catch (
        loadError
      ) {
        setItem(null);

        setError(
          getArabicError(
            loadError,

            "تعذر تحميل تفاصيل المعاملة."
          )
        );
      } finally {
        setLoading(false);
      }
    }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /* =======================================================
     Moderation
  ======================================================= */

  const canModerate =
    String(
      user?.role ||
        user?.raw?.role ||
        ""
    ).toLowerCase() ===
      "admin" &&
    String(
      item?.status ||
        ""
    ).toLowerCase() ===
      "pending";

  /* =======================================================
     Technical Recipient
  ======================================================= */

  const proposedRecipient =
    useMemo(
      () =>
        !item?.recipient_wallet
          ? extractRecipientFromNote(
              item?.note
            )
          : null,
      [item]
    );

  /* =======================================================
     Approve / Reject
  ======================================================= */

  const act =
    useCallback(
      async (
        action
      ) => {
        if (
          !item?.id ||
          sending
        ) {
          return;
        }

        try {
          setSending(
            true
          );

          const result =
            await approveTransaction(
              item.id,
              action
            );

          if (
            !result?.ok
          ) {
            throw result;
          }

          await load();

          Alert.alert(
            "تم",

            action ===
              "approve"
              ? "تمت الموافقة على المعاملة."
              : "تم رفض المعاملة."
          );
        } catch (
          actionError
        ) {
          Alert.alert(
            "تعذر تنفيذ العملية",

            getArabicError(
              actionError,

              "تعذر تحديث حالة المعاملة. يرجى المحاولة مرة أخرى."
            )
          );
        } finally {
          setSending(
            false
          );
        }
      },
      [
        item,
        load,
        sending,
      ]
    );

  /* =======================================================
     Data
  ======================================================= */

  const typeMeta =
    getTypeMeta(
      item?.transaction_type
    );

  const statusMeta =
    getStatusMeta(
      item?.status
    );

  const currency =
    String(
      item?.currency ||
        item?.wallet_currency ||
        ""
    ).toUpperCase();

  const amount =
    formatAmount(
      item?.amount
    );

  const senderWallet =
    displayWallet(
      item?.wallet
    );

  const recipientWallet =
    displayWallet(
      item?.recipient_wallet
    ) ||
    (
      proposedRecipient
        ? String(
            proposedRecipient
          )
        : ""
    );

  const date =
    formatDate(
      item?.created_at
    );

  /*
   * إذا note عربية فقط منعرضها.
   * أي note إنكليزية أو تقنية ما منعرضها.
   */
  const note =
    item?.note &&
    containsArabic(
      item.note
    )
      ? String(
          item.note
        )
      : "";

  /* =======================================================
     Responsive Styles
  ======================================================= */

  const S =
    useMemo(
      () =>
        stylesFactory({
          sx,
          sy,
          sp,
        }),
      [
        sx,
        sy,
        sp,
      ]
    );

  /* =======================================================
     Loading
  ======================================================= */

  if (loading) {
    return (
      <PageLayout
        navigation={
          navigation
        }
        active="wallet"
        withSideMenu={
          true
        }
      >
        <View
          style={
            styles.page
          }
        >
          <AppHeader
            title="تفاصيل المعاملة"
          />

          <View
            style={
              S.center
            }
          >
            <ActivityIndicator
              size="large"
              color={
                COLORS.primary
              }
            />

            <Text
              style={
                S.loadingText
              }
            >
              جاري تحميل تفاصيل المعاملة...
            </Text>
          </View>
        </View>
      </PageLayout>
    );
  }

  /* =======================================================
     Error
  ======================================================= */

  if (!item) {
    return (
      <PageLayout
        navigation={
          navigation
        }
        active="wallet"
        withSideMenu={
          true
        }
      >
        <View
          style={
            styles.page
          }
        >
          <AppHeader
            title="تفاصيل المعاملة"
          />

          <View
            style={
              S.center
            }
          >
            <View
              style={
                S.errorIcon
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={
                  sx(30)
                }
                color={
                  COLORS.danger
                }
              />
            </View>

            <Text
              style={
                S.errorTitle
              }
            >
              تعذر عرض المعاملة
            </Text>

            <Text
              style={
                S.errorText
              }
            >
              {error ||
                "المعاملة غير موجودة."}
            </Text>

            <Pressable
              onPress={
                load
              }
              disabled={
                loading
              }
              style={
                S.retryButton
              }
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  S.retryText
                }
              >
                إعادة المحاولة
              </Text>
            </Pressable>
          </View>
        </View>
      </PageLayout>
    );
  }

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="wallet"
      withSideMenu={
        true
      }
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
            image={require("../../assets/home-corner.png")}
            speedMs={
              16000
            }
            opacity={
              0.45
            }
          />
        </View>

        {/* Header */}

        <AppHeader
          title="تفاصيل المعاملة"
        />

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={{
            paddingHorizontal:
              sx(14),

            paddingTop:
              sy(12),

            paddingBottom:
              sy(100) +
              insets.bottom,
          }}
        >
          <View
            style={
              S.content
            }
          >
            {/* =================================================
                Main Card
            ================================================= */}

            <View
              style={
                S.heroCard
              }
            >
              <View
                style={
                  S.heroTop
                }
              >
                <View
                  style={
                    S.heroIdentity
                  }
                >
                  <View
                    style={[
                      S.heroIcon,
                      {
                        backgroundColor:
                          typeMeta.bg,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        typeMeta.icon
                      }
                      size={
                        sx(23)
                      }
                      color={
                        typeMeta.color
                      }
                    />
                  </View>

                  <View
                    style={
                      S.heroText
                    }
                  >
                    <Text
                      style={
                        S.heroTitle
                      }
                    >
                      {typeMeta.label}
                    </Text>

                    <Text
                      style={
                        S.heroDate
                      }
                    >
                      {date}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    S.statusPill,
                    {
                      backgroundColor:
                        statusMeta.bg,

                      borderColor:
                        statusMeta.color,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      statusMeta.icon
                    }
                    size={13}
                    color={
                      statusMeta.color
                    }
                  />

                  <Text
                    style={[
                      S.statusText,
                      {
                        color:
                          statusMeta.color,
                      },
                    ]}
                  >
                    {statusMeta.label}
                  </Text>
                </View>
              </View>

              {/* Amount */}

              <View
                style={
                  S.amountSection
                }
              >
                <Text
                  style={
                    S.amountLabel
                  }
                >
                  قيمة المعاملة
                </Text>

                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={
                    S.amountValue
                  }
                >
                  {amount}{" "}
                  {currency}
                </Text>
              </View>
            </View>

            {/* =================================================
                Info Title
            ================================================= */}

            <View
              style={
                S.sectionTitleWrap
              }
            >
              <Text
                style={
                  S.sectionTitle
                }
              >
                معلومات المعاملة
              </Text>
            </View>

            {/* =================================================
                Information
            ================================================= */}

            <View
              style={
                S.infoCard
              }
            >
              <InfoRow
                icon="receipt-outline"
                label="نوع المعاملة"
                value={
                  typeMeta.label
                }
                sx={sx}
                sy={sy}
                sp={sp}
              />

              <Divider />

              <InfoRow
                icon={
                  statusMeta.icon
                }
                label="حالة المعاملة"
                value={
                  statusMeta.label
                }
                valueColor={
                  statusMeta.color
                }
                sx={sx}
                sy={sy}
                sp={sp}
              />

              <Divider />

              <InfoRow
                icon="cash-outline"
                label="المبلغ"
                value={`${amount} ${currency}`}
                ltr
                valueColor={
                  COLORS.primary
                }
                sx={sx}
                sy={sy}
                sp={sp}
              />

              {!!senderWallet && (
                <>
                  <Divider />

                  <InfoRow
                    icon="wallet-outline"
                    label="محفظة المرسل"
                    value={
                      senderWallet
                    }
                    ltr
                    sx={sx}
                    sy={sy}
                    sp={sp}
                  />
                </>
              )}

              {!!recipientWallet && (
                <>
                  <Divider />

                  <InfoRow
                    icon="person-outline"
                    label="محفظة المستلم"
                    value={
                      recipientWallet
                    }
                    ltr
                    sx={sx}
                    sy={sy}
                    sp={sp}
                  />
                </>
              )}

              <Divider />

              <InfoRow
                icon="calendar-outline"
                label="تاريخ المعاملة"
                value={
                  date
                }
                sx={sx}
                sy={sy}
                sp={sp}
              />
            </View>


            {/* =================================================
                Admin Actions
            ================================================= */}

            {canModerate && (
              <View
                style={
                  S.adminCard
                }
              >
                <View
                  style={
                    S.adminHeader
                  }
                >
                  <View
                    style={
                      S.adminIcon
                    }
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={
                        COLORS.primary
                      }
                    />
                  </View>

                  <View
                    style={
                      S.adminHeaderText
                    }
                  >
                    <Text
                      style={
                        S.adminTitle
                      }
                    >
                      مراجعة المعاملة
                    </Text>

                    <Text
                      style={
                        S.adminSubtitle
                      }
                    >
                      اختر الإجراء المناسب لهذه المعاملة
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    S.adminActions
                  }
                >
                  <Pressable
                    onPress={() =>
                      act(
                        "approve"
                      )
                    }
                    disabled={
                      sending
                    }
                    style={[
                      S.approveButton,
                      sending && {
                        opacity:
                          0.6,
                      },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={19}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        S.actionButtonText
                      }
                    >
                      موافقة
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      act(
                        "reject"
                      )
                    }
                    disabled={
                      sending
                    }
                    style={[
                      S.rejectButton,
                      sending && {
                        opacity:
                          0.6,
                      },
                    ]}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={19}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        S.actionButtonText
                      }
                    >
                      رفض
                    </Text>
                  </Pressable>
                </View>

                {sending && (
                  <View
                    style={
                      S.sendingRow
                    }
                  >
                    <ActivityIndicator
                      size="small"
                      color={
                        COLORS.primary
                      }
                    />

                    <Text
                      style={
                        S.sendingText
                      }
                    >
                      جاري تحديث المعاملة...
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Info Row
========================================================= */

function InfoRow({
  icon,
  label,
  value,
  valueColor,
  ltr = false,
  sx,
  sy,
  sp,
}) {
  return (
    <View
      style={{
        flexDirection:
          "row-reverse",

        alignItems:
          "center",

        justifyContent:
          "space-between",

        gap:
          sx(10),

        paddingVertical:
          sy(10),
      }}
    >
      <View
        style={{
          flex: 1,

          flexDirection:
            "row-reverse",

          alignItems:
            "center",

          gap:
            sx(8),
        }}
      >
        <View
          style={{
            width:
              sx(31),

            height:
              sx(31),

            borderRadius:
              sx(9),

            alignItems:
              "center",

            justifyContent:
              "center",

            backgroundColor:
              COLORS.primarySoft,
          }}
        >
          <Ionicons
            name={icon}
            size={16}
            color={
              COLORS.primary
            }
          />
        </View>

        <Text
          style={{
            flex: 1,

            color:
              COLORS.muted,

            fontSize:
              sp(12.5),

            fontWeight:
              "700",

            textAlign:
              "right",

            writingDirection:
              "rtl",
          }}
        >
          {label}
        </Text>
      </View>

      <Text
        numberOfLines={2}
        style={{
          flex: 1,

          color:
            valueColor ||
            COLORS.text,

          fontSize:
            sp(13),

          fontWeight:
            "900",

          textAlign:
            "left",

          writingDirection:
            ltr
              ? "ltr"
              : "rtl",
        }}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

/* =========================================================
   Divider
========================================================= */

function Divider() {
  return (
    <View
      style={
        styles.divider
      }
    />
  );
}

/* =========================================================
   Responsive Styles
========================================================= */

function stylesFactory({
  sx,
  sy,
  sp,
}) {
  return StyleSheet.create({
    content: {
      width: "100%",

      maxWidth:
        MAX_W,

      alignSelf:
        "center",
    },

    /* Loading */

    center: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        sx(25),

      paddingBottom:
        sy(60),
    },

    loadingText: {
      marginTop:
        sy(11),

      color:
        COLORS.muted,

      fontSize:
        sp(13),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* Error */

    errorIcon: {
      width:
        sx(64),

      height:
        sx(64),

      borderRadius:
        sx(32),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.dangerSoft,
    },

    errorTitle: {
      marginTop:
        sy(13),

      color:
        COLORS.text,

      fontSize:
        sp(18),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    errorText: {
      marginTop:
        sy(6),

      maxWidth:
        sx(290),

      color:
        COLORS.muted,

      fontSize:
        sp(13),

      lineHeight:
        sp(20),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    retryButton: {
      minWidth:
        sx(150),

      minHeight:
        sy(44),

      marginTop:
        sy(16),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(6),

      backgroundColor:
        COLORS.primary,

      borderRadius:
        sx(13),
    },

    retryText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(13),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* Main Card */

    heroCard: {
      backgroundColor:
        COLORS.card,

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(18),

      padding:
        sx(15),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.04,

      shadowRadius:
        8,

      shadowOffset: {
        width: 0,
        height: 3,
      },

      elevation: 1,
    },

    heroTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      justifyContent:
        "space-between",

      gap:
        sx(9),
    },

    heroIdentity: {
      flex: 1,

      minWidth: 0,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(10),
    },

    heroIcon: {
      width:
        sx(46),

      height:
        sx(46),

      borderRadius:
        sx(14),

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    heroText: {
      flex: 1,

      alignItems:
        "flex-end",
    },

    heroTitle: {
      width:
        "100%",

      color:
        COLORS.text,

      fontSize:
        sp(17),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    heroDate: {
      width:
        "100%",

      marginTop:
        sy(4),

      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    statusPill: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(4),

      paddingHorizontal:
        sx(8),

      paddingVertical:
        sy(5),

      borderRadius:
        999,

      borderWidth: 1,
    },

    statusText: {
      fontSize:
        sp(10.5),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    amountSection: {
      marginTop:
        sy(14),

      paddingTop:
        sy(13),

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        COLORS.line,
    },

    amountLabel: {
      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    amountValue: {
      marginTop:
        sy(4),

      color:
        COLORS.primary,

      fontSize:
        sp(25),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "ltr",
    },

    /* Sections */

    sectionTitleWrap: {
      marginTop:
        sy(18),

      marginBottom:
        sy(8),

      alignItems:
        "flex-end",
    },

    sectionTitle: {
      color:
        COLORS.text,

      fontSize:
        sp(16),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    infoCard: {
      backgroundColor:
        COLORS.card,

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(17),

      paddingHorizontal:
        sx(13),

      paddingVertical:
        sy(2),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.03,

      shadowRadius:
        7,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 1,
    },

    /* Note */

    noteCard: {
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      gap:
        sx(9),

      backgroundColor:
        COLORS.primarySoft,

      borderWidth:
        1,

      borderColor:
        "#D7E6FF",

      borderRadius:
        sx(14),

      padding:
        sx(12),
    },

    noteText: {
      flex: 1,

      color:
        COLORS.text,

      fontSize:
        sp(12.5),

      lineHeight:
        sp(19),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* Admin */

    adminCard: {
      marginTop:
        sy(18),

      padding:
        sx(14),

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(17),
    },

    adminHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(9),

      marginBottom:
        sy(13),
    },

    adminIcon: {
      width:
        sx(38),

      height:
        sx(38),

      borderRadius:
        sx(12),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    adminHeaderText: {
      flex: 1,

      alignItems:
        "flex-end",
    },

    adminTitle: {
      width:
        "100%",

      color:
        COLORS.text,

      fontSize:
        sp(15),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    adminSubtitle: {
      width:
        "100%",

      marginTop:
        sy(2),

      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    adminActions: {
      flexDirection:
        "row-reverse",

      gap:
        sx(8),
    },

    approveButton: {
      flex: 1,

      minHeight:
        sy(46),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(6),

      backgroundColor:
        COLORS.success,

      borderRadius:
        sx(12),
    },

    rejectButton: {
      flex: 1,

      minHeight:
        sy(46),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(6),

      backgroundColor:
        COLORS.danger,

      borderRadius:
        sx(12),
    },

    actionButtonText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(13),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    sendingRow: {
      marginTop:
        sy(10),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(6),
    },

    sendingText: {
      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      writingDirection:
        "rtl",
    },
  });
}

/* =========================================================
   Static Styles
========================================================= */

const styles =
  StyleSheet.create({
    page: {
      flex: 1,

      backgroundColor:
        COLORS.bg,
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLORS.line,
    },

    spinnerBg: {
      position:
        "absolute",

      top: 0,
      left: 0,
      right: 0,

      height: 0,
    },
  });