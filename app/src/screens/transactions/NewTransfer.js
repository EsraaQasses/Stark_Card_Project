// src/screens/transactions/NewTransfer.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PageLayout from "../../ui/PageLayout";
import CornerSpinner from "../../ui/CornerSpinner";
import { AppHeader } from "../../shared/ui/layout";

import {
  getWallet,
  normalizeWalletsResponse,
} from "../../api/wallets";

import {
  createTransfer,
  lookupRecipientByWallet,
} from "../../api/transactions";

/* =========================================================
   Constants
========================================================= */

const BASE_W = 390;
const BASE_H = 844;
const MAX_W = 480;

const COLORS = {
  bg: "#F7F9FC",
  card: "#FFFFFF",

  text: "#0E1B3B",
  muted: "#718198",

  line: "#E4ECF2",

  primary: "#0B63D8",
  primarySoft: "#EEF5FF",

  success: "#16A34A",
  successSoft: "#F0FDF4",

  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
};

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
      typeof normal === "string" &&
      containsArabic(normal)
    ) {
      return normal;
    }
  }

  if (
    typeof data === "string" &&
    containsArabic(data)
  ) {
    return data;
  }

  return fallback;
}

function normalizeCurrency(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getCurrencyLabel(currency) {
  const value =
    normalizeCurrency(currency);

  if (value === "USD") {
    return "دولار";
  }

  if (value === "SYP") {
    return "سوري";
  }

  return value || "—";
}

function getCurrencyIcon(currency) {
  const value =
    normalizeCurrency(currency);

  if (value === "USD") {
    return "logo-usd";
  }

  return "cash-outline";
}

function getWalletBalance(wallet) {
  const value =
    wallet?.available ??
    wallet?.balance ??
    wallet?.amount ??
    0;

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatAmount(
  value,
  currency
) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return normalizeCurrency(currency) ===
      "SYP"
      ? "0"
      : "0.00";
  }

  if (
    normalizeCurrency(currency) ===
    "SYP"
  ) {
    return Math.round(
      number
    ).toLocaleString("en-US");
  }

  return number.toFixed(2);
}

/* =========================================================
   Screen
========================================================= */

export default function NewTransfer({
  navigation,
  route,
}) {
  const insets =
    useSafeAreaInsets();

  const {
    width: W,
    height: H,
  } = useWindowDimensions();

  const sx = useCallback(
    (n) =>
      (W / BASE_W) * n,
    [W]
  );

  const sy = useCallback(
    (n) =>
      (H / BASE_H) * n,
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

  const params =
    useMemo(
      () =>
        route?.params ??
        {},
      [route?.params]
    );

  /* =======================================================
     Recipient
  ======================================================= */

  const [
    recipientId,
    setRecipientId,
  ] = useState(
    params.recipient_id ||
      null
  );

  const [
    recipient,
    setRecipient,
  ] = useState(
    params.recipient_name ||
      params.recipient_phone
      ? {
          id:
            params.recipient_id ||
            null,

          name:
            params.recipient_name ||
            "",

          phone:
            params.recipient_phone ||
            "",
        }
      : null
  );

  const recipientWalletId =
    useMemo(
      () =>
        params.recipient_wallet_id ||
        params.toWallet ||
        null,
      [
        params.recipient_wallet_id,
        params.toWallet,
      ]
    );

  /* =======================================================
     Transfer State
  ======================================================= */

  const [
    wallets,
    setWallets,
  ] = useState([]);

  const [
    selectedWalletId,
    setSelectedWalletId,
  ] = useState("");

  const [
    walletLoading,
    setWalletLoading,
  ] = useState(true);

  const [
    walletError,
    setWalletError,
  ] = useState("");

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const submitLockRef =
    useRef(false);

  /* =======================================================
     Sync Recipient From Route
  ======================================================= */

  useEffect(() => {
    const nextId =
      params.recipient_id ||
      null;

    const nextName =
      params.recipient_name ||
      "";

    const nextPhone =
      params.recipient_phone ||
      "";

    if (nextId) {
      setRecipientId(
        nextId
      );
    }

    if (
      nextName ||
      nextPhone
    ) {
      setRecipient({
        id: nextId,
        name: nextName,
        phone: nextPhone,
      });
    }
  }, [
    params.recipient_id,
    params.recipient_name,
    params.recipient_phone,
  ]);

  /* =======================================================
     Recipient From ID
  ======================================================= */

  useEffect(() => {
    if (
      recipientId &&
      !recipient
    ) {
      setRecipient({
        id:
          recipientId,

        name:
          params.recipient_name ||
          "",

        phone:
          params.recipient_phone ||
          "",
      });
    }
  }, [
    params.recipient_name,
    params.recipient_phone,
    recipient,
    recipientId,
  ]);

  /* =======================================================
     Recipient From Wallet
  ======================================================= */

  useEffect(() => {
    if (
      !recipientWalletId ||
      recipient
    ) {
      return;
    }

    let mounted = true;

    const lookup =
      async () => {
        try {
          const response =
            await lookupRecipientByWallet(
              recipientWalletId
            );

          if (
            mounted &&
            response?.ok &&
            response?.data
          ) {
            const found =
              response.data;

            setRecipient({
              id:
                found.id,

              name:
                found.name ||
                "",

              phone:
                found.phone ||
                "",
            });

            setRecipientId(
              found.id
            );
          }
        } catch {
          // لا نعرض خطأ تقني للمستخدم هنا.
        }
      };

    lookup();

    return () => {
      mounted = false;
    };
  }, [
    recipient,
    recipientWalletId,
  ]);

  /* =======================================================
     Load Wallets
  ======================================================= */

  const loadWallets =
  useCallback(async () => {
    try {
      setWalletLoading(true);
      setWalletError("");

      const data =
        await getWallet();

      const normalized =
        normalizeWalletsResponse(
          data
        );

      const rawList =
        Array.isArray(normalized)
          ? normalized
          : [];

      // فقط الدولار والسوري
      const allowedList =
        rawList.filter(
          (wallet) => {
            const currency =
              normalizeCurrency(
                wallet?.currency
              );

            return (
              currency === "USD" ||
              currency === "SYP"
            );
          }
        );

      // منع تكرار نفس العملة
      const byCurrency =
        new Map();

      for (const wallet of allowedList) {
        const currency =
          normalizeCurrency(
            wallet?.currency
          );

        if (
          !byCurrency.has(
            currency
          )
        ) {
          byCurrency.set(
            currency,
            wallet
          );
        }
      }

      // ترتيب ثابت: دولار ثم سوري
      const list = [
        byCurrency.get("USD"),
        byCurrency.get("SYP"),
      ].filter(Boolean);

      setWallets(list);

      const preferred =
        normalizeCurrency(
          data?.preferred_currency ||
            data?.currency_preference
        );

      const preferredWallet =
        list.find(
          (wallet) =>
            normalizeCurrency(
              wallet?.currency
            ) === preferred
        );

      setSelectedWalletId(
        (previous) => {
          // إذا العملة المختارة سابقاً ما زالت موجودة
          const previousWallet =
            list.find(
              (wallet) =>
                String(
                  wallet?.id
                ) ===
                String(
                  previous
                )
            );

          if (previousWallet) {
            return String(
              previousWallet.id
            );
          }

          return String(
            preferredWallet?.id ||
              list?.[0]?.id ||
              ""
          );
        }
      );
    } catch (error) {
      setWallets([]);
      setSelectedWalletId("");

      setWalletError(
        getArabicError(
          error,
          "تعذر تحميل العملات. يرجى المحاولة مرة أخرى."
        )
      );
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  /* =======================================================
     Selected Wallet
  ======================================================= */

  const selectedWallet =
    useMemo(
      () =>
        wallets.find(
          (wallet) =>
            String(
              wallet?.id
            ) ===
            String(
              selectedWalletId
            )
        ) || null,
      [
        wallets,
        selectedWalletId,
      ]
    );

  const selectedCurrency =
    normalizeCurrency(
      selectedWallet?.currency
    );

  const selectedBalance =
    useMemo(
      () =>
        getWalletBalance(
          selectedWallet
        ),
      [selectedWallet]
    );

  /* =======================================================
     Amount
  ======================================================= */

  const parsedAmount =
    useMemo(() => {
      const cleaned =
        String(amount || "")
          .replace(",", ".")
          .replace(
            /[^0-9.]/g,
            ""
          );

      const number =
        Number(cleaned);

      return Number.isFinite(
        number
      )
        ? number
        : 0;
    }, [amount]);

  const handleAmountChange =
    useCallback((text) => {
      let cleaned =
        String(text || "")
          .replace(",", ".")
          .replace(
            /[^0-9.]/g,
            ""
          );

      const firstDot =
        cleaned.indexOf(".");

      if (firstDot !== -1) {
        cleaned =
          cleaned.slice(
            0,
            firstDot + 1
          ) +
          cleaned
            .slice(
              firstDot + 1
            )
            .replace(
              /\./g,
              ""
            );
      }

      setAmount(cleaned);
    }, []);

  /* =======================================================
     Can Submit
  ======================================================= */

  const canSubmit =
    !submitting &&
    !walletLoading &&
    Boolean(
      selectedWalletId
    ) &&
    Boolean(
      recipient ||
        recipientId
    ) &&
    parsedAmount > 0;

  /* =======================================================
     Submit
  ======================================================= */

  const submit =
    useCallback(async () => {
      if (
        submitting ||
        submitLockRef.current
      ) {
        return;
      }

      const amt =
        Number(
          parsedAmount
        );

      const walletId =
        Number(
          selectedWalletId
        );

      if (!walletId) {
        Alert.alert(
          "اختر العملة",
          "يرجى اختيار العملة أولاً."
        );

        return;
      }

      if (
        !recipient &&
        !recipientId
      ) {
        Alert.alert(
          "اختر المستلم",
          "يرجى مسح رمز QR لاختيار المستلم."
        );

        return;
      }

      if (
        !amt ||
        amt <= 0
      ) {
        Alert.alert(
          "المبلغ غير صحيح",
          "يجب أن يكون مبلغ التحويل أكبر من صفر."
        );

        return;
      }

      submitLockRef.current =
        true;

      const recipientName =
        recipient?.name?.trim() ||
        "المستلم";

      const confirmed =
        await new Promise(
          (resolve) => {
            Alert.alert(
              "تأكيد التحويل",

              `هل تريد تحويل ${formatAmount(
                amt,
                selectedCurrency
              )} ${getCurrencyLabel(
                selectedCurrency
              )} إلى ${recipientName}؟`,

              [
                {
                  text: "تراجع",
                  style: "cancel",

                  onPress:
                    () =>
                      resolve(
                        false
                      ),
                },

                {
                  text: "تحويل",

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
            );
          }
        );

      if (!confirmed) {
        submitLockRef.current =
          false;

        return;
      }

      try {
        setSubmitting(true);

        const payload = {
          wallet_id:
            walletId,

          amount:
            amt,

          note:
            note?.trim() ||
            "",
        };

        if (recipientId) {
          payload.recipient_id =
            recipientId;
        } else if (
          recipient?.phone
        ) {
          payload.recipient_phone =
            recipient.phone;
        }

        const response =
          await createTransfer(
            payload
          );

        if (
          !response?.ok
        ) {
          throw response;
        }

        setAmount("");
        setNote("");

        Alert.alert(
          "تم التحويل",
          "تم تحويل المبلغ بنجاح."
        );

        navigation.navigate(
          "TransactionsList"
        );
      } catch (error) {
        Alert.alert(
          "تعذر التحويل",

          getArabicError(
            error,
            "تعذر تنفيذ التحويل. يرجى المحاولة مرة أخرى."
          )
        );
      } finally {
        setSubmitting(false);

        submitLockRef.current =
          false;
      }
    }, [
      navigation,
      note,
      parsedAmount,
      recipient,
      recipientId,
      selectedCurrency,
      selectedWalletId,
      submitting,
    ]);

  /* =======================================================
     Styles
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
              0.4
            }
          />
        </View>

        {/* Header */}

        <AppHeader
          title="تحويل الأموال"
        />

        <KeyboardAvoidingView
          behavior={
            Platform.OS ===
            "ios"
              ? "padding"
              : undefined
          }
          style={
            styles.flex
          }
        >
          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
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
                  Recipient
              ================================================= */}

              <SectionTitle
                title="المستلم"
                S={S}
              />

              {recipient ? (
                <View
                  style={
                    S.recipientCard
                  }
                >
                  <View
                    style={
                      S.recipientTop
                    }
                  >
                    <View
                      style={
                        S.recipientAvatar
                      }
                    >
                      <Ionicons
                        name="person-outline"
                        size={22}
                        color={
                          COLORS.primary
                        }
                      />
                    </View>

                    <View
                      style={
                        S.recipientInfo
                      }
                    >
                      <Text
                        style={
                          S.recipientSmallLabel
                        }
                      >
                        المستلم المحدد
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }
                        style={
                          S.recipientName
                        }
                      >
                        {recipient.name?.trim() ||
                          "مستخدم"}
                      </Text>

                      {!!recipient.phone && (
                        <Text
                          numberOfLines={
                            1
                          }
                          style={
                            S.recipientPhone
                          }
                        >
                          {
                            recipient.phone
                          }
                        </Text>
                      )}
                    </View>

                    <View
                      style={
                        S.recipientCheck
                      }
                    >
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color="#FFFFFF"
                      />
                    </View>
                  </View>

                  <Pressable
                    onPress={() =>
                      navigation.navigate(
                        "QRScanner"
                      )
                    }
                    style={
                      S.changeRecipientButton
                    }
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={18}
                      color={
                        COLORS.primary
                      }
                    />

                    <Text
                      style={
                        S.changeRecipientText
                      }
                    >
                      تغيير المستلم
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() =>
                    navigation.navigate(
                      "QRScanner"
                    )
                  }
                  style={
                    S.scanCard
                  }
                >
                  <View
                    style={
                      S.scanIcon
                    }
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={31}
                      color={
                        COLORS.primary
                      }
                    />
                  </View>

                  <Text
                    style={
                      S.scanTitle
                    }
                  >
                    اختيار المستلم
                  </Text>

                  <Text
                    style={
                      S.scanSubtitle
                    }
                  >
                    امسح رمز QR الخاص بالمستلم للمتابعة
                  </Text>

                  <View
                    style={
                      S.scanButton
                    }
                  >
                    <Ionicons
                      name="scan-outline"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        S.scanButtonText
                      }
                    >
                      مسح رمز QR
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* =================================================
                  Currency
              ================================================= */}

              <SectionTitle
                title="اختر العملة"
                S={S}
              />

              {walletLoading ? (
                <View
                  style={
                    S.loadingBox
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
                    جاري تحميل العملات...
                  </Text>
                </View>
              ) : walletError ? (
                <View
                  style={
                    S.errorCard
                  }
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={23}
                    color={
                      COLORS.danger
                    }
                  />

                  <Text
                    style={
                      S.errorText
                    }
                  >
                    {
                      walletError
                    }
                  </Text>

                  <Pressable
                    onPress={
                      loadWallets
                    }
                    style={
                      S.retryButton
                    }
                  >
                    <Text
                      style={
                        S.retryText
                      }
                    >
                      إعادة المحاولة
                    </Text>
                  </Pressable>
                </View>
              ) : wallets.length ===
                0 ? (
                <View
                  style={
                    S.emptyWallets
                  }
                >
                  <View
                    style={
                      S.emptyWalletIcon
                    }
                  >
                    <Ionicons
                      name="wallet-outline"
                      size={26}
                      color={
                        COLORS.primary
                      }
                    />
                  </View>

                  <Text
                    style={
                      S.emptyWalletTitle
                    }
                  >
                    لا توجد عملات متاحة
                  </Text>

                  <Text
                    style={
                      S.emptyWalletText
                    }
                  >
                    لا يوجد رصيد متاح للتحويل حالياً.
                  </Text>
                </View>
              ) : (
                <View
                  style={
                    S.currencyChoices
                  }
                >
                  {wallets.map(
                    (wallet) => {
                      const currency =
                        normalizeCurrency(
                          wallet?.currency
                        );

                      const active =
                        String(
                          wallet?.id
                        ) ===
                        String(
                          selectedWalletId
                        );

                      return (
                        <Pressable
                          key={String(
                            wallet?.id
                          )}
                          onPress={() =>
                            setSelectedWalletId(
                              String(
                                wallet.id
                              )
                            )
                          }
                          style={[
                            S.currencyChoice,

                            active &&
                              S.currencyChoiceActive,
                          ]}
                        >
                          {active && (
                            <View
                              style={
                                S.selectedCheck
                              }
                            >
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="#FFFFFF"
                              />
                            </View>
                          )}

                          <View
                            style={[
                              S.currencyIcon,

                              active &&
                                S.currencyIconActive,
                            ]}
                          >
                            <Ionicons
                              name={getCurrencyIcon(
                                currency
                              )}
                              size={24}
                              color={
                                active
                                  ? COLORS.primary
                                  : COLORS.muted
                              }
                            />
                          </View>

                          <Text
                            style={[
                              S.currencyTitle,

                              active &&
                                S.currencyTitleActive,
                            ]}
                          >
                            {getCurrencyLabel(
                              currency
                            )}
                          </Text>

                          <Text
                            numberOfLines={
                              1
                            }
                            adjustsFontSizeToFit
                            style={
                              S.currencyBalance
                            }
                          >
                            {formatAmount(
                              getWalletBalance(
                                wallet
                              ),
                              currency
                            )}
                          </Text>

                          <Text
                            style={
                              S.availableLabel
                            }
                          >
                            الرصيد المتاح
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>
              )}

              {/* =================================================
                  Amount
              ================================================= */}

              <SectionTitle
                title="مبلغ التحويل"
                S={S}
              />

              <View
                style={
                  S.amountCard
                }
              >
                <View
                  style={
                    S.amountRow
                  }
                >
                  <TextInput
                    value={
                      amount
                    }
                    onChangeText={
                      handleAmountChange
                    }
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#A0AEC0"
                    style={
                      S.amountInput
                    }
                  />

                  <View
                    style={
                      S.currencyBadge
                    }
                  >
                    <Text
                      style={
                        S.currencyBadgeText
                      }
                    >
                      {selectedCurrency
                        ? getCurrencyLabel(
                            selectedCurrency
                          )
                        : "—"}
                    </Text>
                  </View>
                </View>

                {!!selectedWallet && (
                  <View
                    style={
                      S.balanceRow
                    }
                  >
                    <Text
                      style={
                        S.balanceLabel
                      }
                    >
                      الرصيد المتاح
                    </Text>

                    <Text
                      numberOfLines={
                        1
                      }
                      style={
                        S.balanceValue
                      }
                    >
                      {formatAmount(
                        selectedBalance,
                        selectedCurrency
                      )}{" "}
                      {getCurrencyLabel(
                        selectedCurrency
                      )}
                    </Text>
                  </View>
                )}
              </View>

              {/* =================================================
                  Note
              ================================================= */}

              <View
                style={
                  S.noteHeading
                }
              >
                <Text
                  style={
                    S.sectionTitle
                  }
                >
                  ملاحظة
                </Text>

                <Text
                  style={
                    S.optionalText
                  }
                >
                  اختياري
                </Text>
              </View>

              <View
                style={
                  S.noteCard
                }
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={
                    COLORS.primary
                  }
                  style={{
                    marginTop:
                      sy(12),
                  }}
                />

                <TextInput
                  value={
                    note
                  }
                  onChangeText={
                    setNote
                  }
                  placeholder="أضف ملاحظة قصيرة إن وجدت"
                  placeholderTextColor="#98A5B7"
                  multiline
                  maxLength={300}
                  style={
                    S.noteInput
                  }
                />
              </View>

              {/* =================================================
                  Summary
              ================================================= */}

              <SectionTitle
                title="ملخص التحويل"
                S={S}
              />

              <View
                style={
                  S.summaryCard
                }
              >
                <SummaryRow
                  icon="person-outline"
                  label="المستلم"
                  value={
                    recipient?.name?.trim() ||
                    recipient?.phone ||
                    "غير محدد"
                  }
                />

                <View
                  style={
                    styles.divider
                  }
                />

                <SummaryRow
                  icon="cash-outline"
                  label="العملة"
                  value={
                    selectedCurrency
                      ? getCurrencyLabel(
                          selectedCurrency
                        )
                      : "غير محددة"
                  }
                />

                <View
                  style={
                    styles.divider
                  }
                />

                <SummaryRow
                  icon="calculator-outline"
                  label="المبلغ"
                  value={
                    selectedCurrency
                      ? `${formatAmount(
                          parsedAmount,
                          selectedCurrency
                        )} ${getCurrencyLabel(
                          selectedCurrency
                        )}`
                      : "—"
                  }
                  highlight
                />
              </View>

              {/* =================================================
                  Submit
              ================================================= */}

              <Pressable
                onPress={
                  submit
                }
                disabled={
                  !canSubmit
                }
                style={[
                  S.submitButton,

                  !canSubmit &&
                    S.submitButtonDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="paper-plane-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                )}

                <Text
                  style={
                    S.submitText
                  }
                >
                  {submitting
                    ? "جاري التحويل..."
                    : "إرسال التحويل"}
                </Text>
              </Pressable>

              <Text
                style={
                  S.submitHint
                }
              >
                تحقق من المستلم والمبلغ قبل تأكيد عملية التحويل.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Section Title
========================================================= */

function SectionTitle({
  title,
  S,
}) {
  return (
    <View
      style={
        S.sectionHeading
      }
    >
      <Text
        style={
          S.sectionTitle
        }
      >
        {title}
      </Text>
    </View>
  );
}

/* =========================================================
   Summary Row
========================================================= */

function SummaryRow({
  icon,
  label,
  value,
  highlight = false,
}) {
  return (
    <View
      style={
        styles.summaryRow
      }
    >
      <View
        style={
          styles.summaryLabelWrap
        }
      >
        <View
          style={
            styles.summaryIcon
          }
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
          style={
            styles.summaryLabel
          }
        >
          {label}
        </Text>
      </View>

      <Text
        numberOfLines={2}
        style={[
          styles.summaryValue,

          highlight &&
            styles.summaryValueHighlight,
        ]}
      >
        {value}
      </Text>
    </View>
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

    /* =====================================================
       Section Titles
    ===================================================== */

    sectionHeading: {
      width: "100%",

      marginTop:
        sy(3),

      marginBottom:
        sy(10),

      alignItems:
        "flex-end",
    },

    sectionTitle: {
      width: "100%",

      color:
        COLORS.text,

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

    /* =====================================================
       Recipient
    ===================================================== */

    recipientCard: {
      padding:
        sx(13),

      marginBottom:
        sy(23),

      backgroundColor:
        COLORS.card,

      borderWidth: 1,

      borderColor:
        "#CFE1FF",

      borderRadius:
        sx(18),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.03,

      shadowRadius: 7,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 1,
    },

    recipientTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(10),
    },

    recipientAvatar: {
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

      backgroundColor:
        COLORS.primarySoft,
    },

    recipientInfo: {
      flex: 1,

      minWidth: 0,

      alignItems:
        "flex-end",
    },

    recipientSmallLabel: {
      width: "100%",

      color:
        COLORS.muted,

      fontSize:
        sp(11),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    recipientName: {
      width: "100%",

      marginTop:
        sy(2),

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

    recipientPhone: {
      width: "100%",

      marginTop:
        sy(3),

      color:
        COLORS.muted,

      fontSize:
        sp(12),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "ltr",
    },

    recipientCheck: {
      width:
        sx(27),

      height:
        sx(27),

      borderRadius:
        sx(14),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.success,
    },

    changeRecipientButton: {
      minHeight:
        sy(42),

      marginTop:
        sy(12),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(6),

      borderRadius:
        sx(12),

      backgroundColor:
        COLORS.primarySoft,

      borderWidth: 1,

      borderColor:
        "#D7E6FF",
    },

    changeRecipientText: {
      color:
        COLORS.primary,

      fontSize:
        sp(12.5),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* Scan */

    scanCard: {
      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        sx(18),

      paddingVertical:
        sy(23),

      marginBottom:
        sy(23),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(18),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.03,

      shadowRadius: 7,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 1,
    },

    scanIcon: {
      width:
        sx(64),

      height:
        sx(64),

      borderRadius:
        sx(20),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    scanTitle: {
      marginTop:
        sy(11),

      color:
        COLORS.text,

      fontSize:
        sp(17),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    scanSubtitle: {
      maxWidth:
        sx(280),

      marginTop:
        sy(4),

      color:
        COLORS.muted,

      fontSize:
        sp(12),

      lineHeight:
        sp(18),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    scanButton: {
      minWidth:
        sx(165),

      minHeight:
        sy(44),

      marginTop:
        sy(14),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(7),

      borderRadius:
        sx(13),

      backgroundColor:
        COLORS.primary,
    },

    scanButtonText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(13),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Currency
    ===================================================== */

    currencyChoices: {
      flexDirection:
        "row-reverse",

      flexWrap:
        "wrap",

      gap:
        sx(10),

      marginBottom:
        sy(23),
    },

    currencyChoice: {
      flexGrow: 1,

      flexBasis:
        "47%",

      minWidth:
        sx(145),

      minHeight:
        sy(138),

      position:
        "relative",

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        sx(10),

      paddingVertical:
        sy(14),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(18),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.025,

      shadowRadius: 6,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 1,
    },

    currencyChoiceActive: {
      backgroundColor:
        "#F6FAFF",

      borderColor:
        COLORS.primary,

      borderWidth:
        1.5,
    },

    selectedCheck: {
      position:
        "absolute",

      top:
        sx(9),

      left:
        sx(9),

      width:
        sx(24),

      height:
        sx(24),

      borderRadius:
        sx(12),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primary,
    },

    currencyIcon: {
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

      backgroundColor:
        "#F3F5F8",
    },

    currencyIconActive: {
      backgroundColor:
        COLORS.primarySoft,
    },

    currencyTitle: {
      marginTop:
        sy(9),

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

    currencyTitleActive: {
      color:
        COLORS.primary,
    },

    currencyBalance: {
      width: "100%",

      marginTop:
        sy(6),

      color:
        COLORS.text,

      fontSize:
        sp(15),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "ltr",
    },

    availableLabel: {
      marginTop:
        sy(2),

      color:
        COLORS.muted,

      fontSize:
        sp(10.5),

      fontWeight:
        "700",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Loading / Error
    ===================================================== */

    loadingBox: {
      minHeight:
        sy(130),

      alignItems:
        "center",

      justifyContent:
        "center",

      marginBottom:
        sy(23),
    },

    loadingText: {
      marginTop:
        sy(9),

      color:
        COLORS.muted,

      fontSize:
        sp(12.5),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    errorCard: {
      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        sx(15),

      marginBottom:
        sy(23),

      backgroundColor:
        COLORS.dangerSoft,

      borderWidth: 1,

      borderColor:
        "#FECACA",

      borderRadius:
        sx(16),
    },

    errorText: {
      marginTop:
        sy(7),

      color:
        "#991B1B",

      fontSize:
        sp(12.5),

      lineHeight:
        sp(19),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    retryButton: {
      marginTop:
        sy(9),

      paddingHorizontal:
        sx(14),

      paddingVertical:
        sy(8),

      borderRadius:
        sx(10),

      backgroundColor:
        COLORS.danger,
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

    emptyWallets: {
      alignItems:
        "center",

      justifyContent:
        "center",

      paddingVertical:
        sy(28),

      paddingHorizontal:
        sx(16),

      marginBottom:
        sy(23),

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(17),

      backgroundColor:
        "#FFFFFF",
    },

    emptyWalletIcon: {
      width:
        sx(54),

      height:
        sx(54),

      borderRadius:
        sx(27),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    emptyWalletTitle: {
      marginTop:
        sy(10),

      color:
        COLORS.text,

      fontSize:
        sp(15),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    emptyWalletText: {
      marginTop:
        sy(4),

      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Amount
    ===================================================== */

    amountCard: {
      padding:
        sx(13),

      marginBottom:
        sy(23),

      backgroundColor:
        COLORS.card,

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(17),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.025,

      shadowRadius: 6,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 1,
    },

    amountRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(8),
    },

    amountInput: {
      flex: 1,

      minHeight:
        sy(56),

      paddingHorizontal:
        sx(14),

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(14),

      backgroundColor:
        "#F8FAFC",

      color:
        COLORS.text,

      fontSize:
        sp(22),

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "ltr",
    },

    currencyBadge: {
      minWidth:
        sx(75),

      minHeight:
        sy(56),

      paddingHorizontal:
        sx(9),

      borderRadius:
        sx(14),

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primary,
    },

    currencyBadgeText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(14),

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    balanceRow: {
      marginTop:
        sy(11),

      paddingTop:
        sy(10),

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        COLORS.line,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        sx(10),
    },

    balanceLabel: {
      color:
        COLORS.muted,

      fontSize:
        sp(12),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    balanceValue: {
      flexShrink: 1,

      color:
        COLORS.text,

      fontSize:
        sp(13),

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Note
    ===================================================== */

    noteHeading: {
      width: "100%",

      marginBottom:
        sy(10),

      alignItems:
        "flex-end",
    },

    optionalText: {
      marginTop:
        sy(-2),

      color:
        COLORS.muted,

      fontSize:
        sp(12),

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    noteCard: {
      minHeight:
        sy(100),

      marginBottom:
        sy(23),

      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      gap:
        sx(8),

      paddingHorizontal:
        sx(12),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    noteInput: {
      flex: 1,

      minHeight:
        sy(96),

      paddingVertical:
        sy(12),

      color:
        COLORS.text,

      fontSize:
        sp(13),

      lineHeight:
        sp(20),

      textAlign:
        "right",

      writingDirection:
        "rtl",

      textAlignVertical:
        "top",
    },

    /* =====================================================
       Summary
    ===================================================== */

    summaryCard: {
      paddingHorizontal:
        sx(13),

      paddingVertical:
        sy(3),

      marginBottom:
        sy(18),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(17),

      shadowColor:
        "#000000",

      shadowOpacity:
        0.025,

      shadowRadius: 6,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 1,
    },

    /* =====================================================
       Submit
    ===================================================== */

    submitButton: {
      minHeight:
        sy(52),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(7),

      backgroundColor:
        COLORS.primary,

      borderRadius:
        sx(14),
    },

    submitButtonDisabled: {
      backgroundColor:
        "#A6B4C7",
    },

    submitText: {
      color:
        "#FFFFFF",

      fontSize:
        sp(14),

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    submitHint: {
      marginTop:
        sy(8),

      paddingHorizontal:
        sx(10),

      color:
        COLORS.muted,

      fontSize:
        sp(11),

      lineHeight:
        sp(17),

      textAlign:
        "center",

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
    flex: {
      flex: 1,
    },

    page: {
      flex: 1,

      backgroundColor:
        COLORS.bg,
    },

    /* Summary */

    summaryRow: {
      minHeight: 54,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap: 12,
    },

    summaryLabelWrap: {
      flex: 1,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap: 8,
    },

    summaryIcon: {
      width: 31,
      height: 31,

      borderRadius: 9,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLORS.primarySoft,
    },

    summaryLabel: {
      flex: 1,

      color:
        COLORS.muted,

      fontSize: 12.5,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    summaryValue: {
      flex: 1,

      color:
        COLORS.text,

      fontSize: 13,

      fontWeight:
        "900",

      textAlign:
        "left",

      writingDirection:
        "rtl",
    },

    summaryValueHighlight: {
      color:
        COLORS.primary,

      fontSize: 14,
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