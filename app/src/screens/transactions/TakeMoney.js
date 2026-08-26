// src/screens/transactions/TakeMoney.js

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

import { createCashout } from "../../api/agent";

import {
  createAgentCashoutRequest,
} from "../../api/deposits";

import { useAuth } from "../../context/AuthProvider";

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

  warning: "#CA8A04",
  warningSoft: "#FFFBEB",

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

function getArabicError(error, fallback) {
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

  return "—";
}

function getCurrencyIcon(currency) {
  const value =
    normalizeCurrency(currency);

  if (value === "USD") {
    return "logo-usd";
  }

  return "cash-outline";
}

function getWalletAmount(wallet) {
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

function formatWalletAmount(
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

export default function TakeMoney({
  navigation,
}) {
  const { user } =
    useAuth() || {};

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

  /* =======================================================
     State
  ======================================================= */

  const [
    wallets,
    setWallets,
  ] = useState([]);

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    walletError,
    setWalletError,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const submitLockRef =
    useRef(false);

  /* =======================================================
     User
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
    user?.raw?.is_agent === true;

  const connectedAgent =
    user?.raw?.connected_agent ||
    user?.raw?.agent ||
    user?.connected_agent ||
    user?.agent ||
    null;

  const hasAgent =
    Boolean(
      connectedAgent
    );

  /* =======================================================
     Load only USD + SYP
  ======================================================= */

  const loadWallets =
    useCallback(async () => {
      try {
        setLoading(true);
        setWalletError("");

        const data =
          await getWallet();

        const normalized =
          normalizeWalletsResponse(
            data
          );

        /*
         * المستخدم لازم يشوف فقط:
         * دولار
         * سوري
         */
        const allowed =
          Array.isArray(
            normalized
          )
            ? normalized.filter(
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
              )
            : [];

        /*
         * إذا رجع الباك أكثر من سجل
         * لنفس العملة، نعرض خيار واحد فقط.
         */
        const byCurrency =
          new Map();

        for (
          const wallet of allowed
        ) {
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

        /*
         * ترتيب ثابت:
         * دولار
         * سوري
         */
        const list = [
          byCurrency.get("USD"),
          byCurrency.get("SYP"),
        ].filter(Boolean);

        setWallets(list);

        setSelected(
          (previous) => {
            if (
              previous
            ) {
              const oldCurrency =
                normalizeCurrency(
                  previous?.currency
                );

              const same =
                list.find(
                  (wallet) =>
                    normalizeCurrency(
                      wallet?.currency
                    ) ===
                    oldCurrency
                );

              if (same) {
                return same;
              }
            }

            return (
              list[0] ||
              null
            );
          }
        );
      } catch (error) {
        setWallets([]);
        setSelected(null);

        setWalletError(
          getArabicError(
            error,
            "تعذر تحميل العملات. يرجى المحاولة مرة أخرى."
          )
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  /* =======================================================
     Selected Currency
  ======================================================= */

  const selectedCurrency =
    normalizeCurrency(
      selected?.currency
    );

  const selectedBalance =
    useMemo(
      () =>
        getWalletAmount(
          selected
        ),
      [selected]
    );

  /* =======================================================
     Amount
  ======================================================= */

  const safeAmount =
    useMemo(() => {
      const cleaned =
        String(amount || "")
          .replace(",", ".")
          .replace(
            /[^0-9.]/g,
            ""
          );

      const parsed =
        Number(cleaned);

      return Number.isFinite(
        parsed
      )
        ? parsed
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
     Mode
  ======================================================= */

  const modeInfo =
  useMemo(() => {
    if (isAgent) {
      return {
        pageTitle: "سحب عبر الإدارة",
        text: "سيتم إرسال طلب السحب إلى الإدارة للمراجعة والموافقة.",
      };
    }

    return {
      pageTitle: "سحب عبر الوكيل",
      text: "سيتم إرسال طلب السحب إلى وكيلك المرتبط للمراجعة.",
    };
  }, [isAgent]);

  /* =======================================================
     Submit
  ======================================================= */

  const onSubmit =
    useCallback(async () => {
      if (
        submitting ||
        submitLockRef.current
      ) {
        return;
      }

      if (
        !isAgent &&
        !hasAgent
      ) {
        Alert.alert(
          "لا يوجد وكيل مرتبط",
          "يجب ربط حسابك بوكيل قبل إرسال طلب السحب."
        );

        return;
      }

      if (!selected) {
        Alert.alert(
          "اختر العملة",
          "يرجى اختيار دولار أو سوري أولاً."
        );

        return;
      }

      if (
        !selected?.id ||
        String(
          selected.id
        ).startsWith(
          "LOCAL-"
        )
      ) {
        Alert.alert(
          "تعذر استخدام العملة",
          "هذا الخيار غير متاح للسحب حالياً."
        );

        return;
      }

      if (
        !safeAmount ||
        safeAmount <= 0
      ) {
        Alert.alert(
          "المبلغ غير صحيح",
          "يرجى إدخال مبلغ سحب صحيح."
        );

        return;
      }

      const currencyLabel =
        getCurrencyLabel(
          selectedCurrency
        );

      const amountLabel =
        formatWalletAmount(
          safeAmount,
          selectedCurrency
        );

      const confirmed =
        await new Promise(
          (resolve) => {
            Alert.alert(
              "تأكيد طلب السحب",

              `هل تريد إرسال طلب سحب بقيمة ${amountLabel} ${currencyLabel}؟`,

              [
                {
                  text: "إلغاء",
                  style: "cancel",

                  onPress: () =>
                    resolve(
                      false
                    ),
                },

                {
                  text: "تأكيد",

                  onPress: () =>
                    resolve(
                      true
                    ),
                },
              ],

              {
                cancelable:
                  true,

                onDismiss: () =>
                  resolve(
                    false
                  ),
              }
            );
          }
        );

      if (!confirmed) {
        return;
      }

      submitLockRef.current =
        true;

      try {
        setSubmitting(true);

        if (isAgent) {
          const payload = {
            amount:
              safeAmount,

            currency:
              selectedCurrency,

            wallet_currency:
              selectedCurrency,

            note:
              note?.trim() ||
              "",
          };

          const response =
            await createAgentCashoutRequest(
              payload
            );

          if (
            response?.ok ===
            false
          ) {
            throw response;
          }

          Alert.alert(
            "تم إرسال الطلب",
            "تم إرسال طلب السحب إلى الإدارة بنجاح."
          );
        } else {
          const payload = {
            wallet_id:
              Number(
                selected.id
              ),

            amount:
              safeAmount,

            note:
              note?.trim() ||
              "",
          };

          const response =
            await createCashout(
              payload
            );

          if (
            response?.ok ===
            false
          ) {
            throw response;
          }

          Alert.alert(
            "تم إرسال الطلب",
            "تم إرسال طلب السحب إلى الوكيل بنجاح."
          );
        }

        setAmount("");
        setNote("");

        navigation.goBack();
      } catch (error) {
        Alert.alert(
          "تعذر إرسال الطلب",

          getArabicError(
            error,
            "تعذر إرسال طلب السحب. يرجى المحاولة مرة أخرى."
          )
        );
      } finally {
        submitLockRef.current =
          false;

        setSubmitting(false);
      }
    }, [
      hasAgent,
      isAgent,
      navigation,
      note,
      safeAmount,
      selected,
      selectedCurrency,
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
          title={modeInfo.pageTitle}
        />

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
                No Agent
            ================================================= */}

            {!isAgent &&
              !hasAgent && (
                <View
                  style={
                    S.warningCard
                  }
                >
                  <View
                    style={
                      S.warningTop
                    }
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={22}
                      color={
                        COLORS.danger
                      }
                    />

                    <View
                      style={
                        S.warningTextWrap
                      }
                    >
                      <Text
                        style={
                          S.warningTitle
                        }
                      >
                        يجب ربط وكيل
                      </Text>

                      <Text
                        style={
                          S.warningText
                        }
                      >
                        لا يمكنك إرسال طلب سحب قبل ربط حسابك بوكيل.
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() =>
                      navigation.navigate(
                        "OurAgents"
                      )
                    }
                    style={
                      S.agentButton
                    }
                  >
                    <Ionicons
                      name="people-outline"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        S.agentButtonText
                      }
                    >
                      الذهاب إلى الوكلاء
                    </Text>
                  </Pressable>
                </View>
              )}

            {/* =================================================
                Currency Title - 22
            ================================================= */}

            <SectionTitle
              title="اختر العملة"
              S={S}
            />

            {/* =================================================
                Currencies
            ================================================= */}

            {loading ? (
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
                  S.emptyCard
                }
              >
                <View
                  style={
                    S.emptyIcon
                  }
                >
                  <Ionicons
                    name="cash-outline"
                    size={25}
                    color={
                      COLORS.primary
                    }
                  />
                </View>

                <Text
                  style={
                    S.emptyTitle
                  }
                >
                  لا توجد عملات متاحة
                </Text>

                <Text
                  style={
                    S.emptyText
                  }
                >
                  لا يوجد دولار أو سوري متاح للسحب حالياً.
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
                        selected?.id
                      ) ===
                      String(
                        wallet?.id
                      );

                    return (
                      <Pressable
                        key={String(
                          wallet?.id
                        )}
                        onPress={() =>
                          setSelected(
                            wallet
                          )
                        }
                        style={[
                          S.currencyChoice,

                          active &&
                            S.currencyChoiceActive,
                        ]}
                      >
                        {/* Selected */}

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

                        {/* Icon */}

                        <View
                          style={[
                            S.currencyChoiceIcon,

                            active &&
                              S.currencyChoiceIconActive,
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

                        {/* Dollar / Syrian */}

                        <Text
                          style={[
                            S.currencyChoiceTitle,

                            active &&
                              S.currencyChoiceTitleActive,
                          ]}
                        >
                          {getCurrencyLabel(
                            currency
                          )}
                        </Text>

                        {/* Balance */}

                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={
                            S.currencyChoiceBalance
                          }
                        >
                          {formatWalletAmount(
                            getWalletAmount(
                              wallet
                            ),
                            currency
                          )}
                        </Text>

                        <Text
                          style={
                            S.availableText
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
                Amount Title - 22
            ================================================= */}

            <SectionTitle
              title="مبلغ السحب"
              S={S}
            />

            {/* =================================================
                Amount
            ================================================= */}

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
                    numberOfLines={1}
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

              {!!selected && (
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
                    style={
                      S.balanceValue
                    }
                  >
                    {formatWalletAmount(
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
                Note Title - 22
            ================================================= */}

            <View
              style={
                S.noteTitleRow
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

            {/* =================================================
                Note
            ================================================= */}

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
                placeholder="اكتب ملاحظة للطلب إن وجدت"
                placeholderTextColor="#98A5B7"
                multiline
                maxLength={300}
                style={
                  S.noteInput
                }
              />
            </View>

            {/* =================================================
                Summary Title - 22
            ================================================= */}

            <SectionTitle
              title="ملخص الطلب"
              S={S}
            />

            {/* =================================================
                Summary
            ================================================= */}

            <View
              style={
                S.summaryCard
              }
            >
              <SummaryRow
                icon="cash-outline"
                label="العملة"
                value={
                  selectedCurrency
                    ? getCurrencyLabel(
                        selectedCurrency
                      )
                    : "—"
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
                    ? `${formatWalletAmount(
                        safeAmount,
                        selectedCurrency
                      )} ${getCurrencyLabel(
                        selectedCurrency
                      )}`
                    : "—"
                }
                highlight
              />

              <View
                style={
                  styles.divider
                }
              />

              <SummaryRow
                icon={
                  isAgent
                    ? "shield-checkmark-outline"
                    : "people-outline"
                }
                label="طريقة السحب"
                value={
                  isAgent
                    ? "عبر الإدارة"
                    : "عبر الوكيل"
                }
              />
            </View>

            {/* =================================================
                Submit
            ================================================= */}

            <Pressable
              onPress={
                onSubmit
              }
              disabled={
                submitting ||
                loading ||
                !selected ||
                (
                  !isAgent &&
                  !hasAgent
                )
              }
              style={[
                S.submitButton,

                (
                  submitting ||
                  loading ||
                  !selected ||
                  (
                    !isAgent &&
                    !hasAgent
                  )
                ) && {
                  opacity:
                    0.55,
                },
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
                  ? "جاري إرسال الطلب..."
                  : "إرسال طلب السحب"}
              </Text>
            </Pressable>

            <Text
              style={
                S.submitHint
              }
            >
              سيتم إرسال الطلب للمراجعة قبل إتمام عملية السحب.
            </Text>
          </View>
        </ScrollView>
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
        S.sectionHeader
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
            styles.summaryRowIcon
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



    modeText: {
      width: "100%",

      marginTop:
        sy(3),

      color:
        COLORS.muted,

      fontSize:
        sp(11.5),

      lineHeight:
        sp(18),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Warning
    ===================================================== */

    warningCard: {
      padding:
        sx(13),

      marginBottom:
        sy(20),

      backgroundColor:
        COLORS.dangerSoft,

      borderWidth: 1,

      borderColor:
        "#FECACA",

      borderRadius:
        sx(16),
    },

    warningTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        sx(9),
    },

    warningTextWrap: {
      flex: 1,

      alignItems:
        "flex-end",
    },

    warningTitle: {
      width: "100%",

      color:
        "#991B1B",

      fontSize:
        sp(14),

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    warningText: {
      width: "100%",

      marginTop:
        sy(2),

      color:
        "#B42318",

      fontSize:
        sp(11.5),

      lineHeight:
        sp(18),

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    agentButton: {
      minHeight:
        sy(44),

      marginTop:
        sy(11),

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        sx(7),

      borderRadius:
        sx(12),

      backgroundColor:
        COLORS.danger,
    },

    agentButtonText: {
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
       Section Titles - 22
    ===================================================== */

    sectionHeader: {
      width: "100%",

      marginTop:
        sy(2),

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
       Currency Options
    ===================================================== */

    currencyChoices: {
      flexDirection:
        "row-reverse",

      gap:
        sx(10),

      marginBottom:
        sy(24),
    },

    currencyChoice: {
      flex: 1,

      minWidth: 0,

      minHeight:
        sy(138),

      position:
        "relative",

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        sx(9),

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

      borderWidth: 1.5,
    },

    currencyChoiceIcon: {
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
        "#F4F6F9",
    },

    currencyChoiceIconActive: {
      backgroundColor:
        COLORS.primarySoft,
    },

    currencyChoiceTitle: {
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

    currencyChoiceTitleActive: {
      color:
        COLORS.primary,
    },

    currencyChoiceBalance: {
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

    availableText: {
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
        sy(20),
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
        sy(20),

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
        sy(6),

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
        sx(13),

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
        "800",

      writingDirection:
        "rtl",
    },

    emptyCard: {
      alignItems:
        "center",

      justifyContent:
        "center",

      paddingVertical:
        sy(28),

      paddingHorizontal:
        sx(16),

      marginBottom:
        sy(20),

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        COLORS.line,

      borderRadius:
        sx(16),
    },

    emptyIcon: {
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

    emptyTitle: {
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

    emptyText: {
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
        sy(24),

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
        sx(76),

      maxWidth:
        sx(92),

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

    noteTitleRow: {
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
        sy(24),

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

      borderRadius:
        sx(14),

      backgroundColor:
        COLORS.primary,
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

    summaryRowIcon: {
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

    /* Background */

    spinnerBg: {
      position:
        "absolute",

      top: 0,
      left: 0,
      right: 0,

      height: 0,
    },
  });