// src/screens/OurAgents.js

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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PageLayout from "../ui/PageLayout";
import CornerSpinner from "../ui/CornerSpinner";

import { AppHeader } from "../shared/ui/layout";

import {
  getAgents,
  connectToAgent,
} from "../api/agent";

import { useAuth } from "../context/AuthProvider";
import { useScale } from "../ui/scale";

import {
  fontFamilies,
  shadows,
} from "../shared/theme";

/* =========================================================
   Colors - Light Only
========================================================= */

const COLOR = {
  primary: "#0B63D8",
  primaryDark: "#084EA9",
  primarySoft: "#EEF5FF",

  text: "#0E1B3B",
  muted: "#718198",

  bg: "#F7F9FC",
  white: "#FFFFFF",

  line: "#E4ECF2",

  success: "#16A34A",
  successSoft: "#F0FDF4",
  successBorder: "#BBF7D0",

  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
};

const MAX_W = 480;

/* =========================================================
   Helpers
========================================================= */

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(
    String(value || "")
  );
}

function getArabicMessage(
  value,
  fallback
) {
  if (!value) {
    return fallback;
  }

  if (
    typeof value === "object"
  ) {
    if (value?.ar) {
      return String(value.ar);
    }

    if (
      value?.message?.ar
    ) {
      return String(
        value.message.ar
      );
    }
  }

  const text =
    String(value).trim();

  if (
    text &&
    containsArabic(text)
  ) {
    return text;
  }

  return fallback;
}

function normalizeList(value) {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (
    value &&
    Array.isArray(
      value.results
    )
  ) {
    return value.results;
  }

  return [];
}

function makeInitials(value) {
  const parts =
    String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return "وك";
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[1][0]
  ).toUpperCase();
}

function pickAvatarColor(seed) {
  const palette = [
    "#2F8CFF",
    "#6C5CE7",
    "#E67E22",
    "#00B894",
    "#D63031",
    "#0984E3",
  ];

  const index =
    Math.abs(
      Number(seed) || 0
    ) %
    palette.length;

  return palette[index];
}

/* =========================================================
   Screen
========================================================= */

export default function OurAgents({
  navigation,
  route,
}) {
  const {
    user,
    refreshUser,
  } = useAuth();

  const insets =
    useSafeAreaInsets();

  const {
    sx,
    sy,
  } = useScale();

  const NAV_HEIGHT =
    sy(64);

  const contentPadBottom =
    NAV_HEIGHT +
    insets.bottom +
    sy(24);

  const H_PAD =
    sx(14);

  /* =======================================================
     State
  ======================================================= */

  const [
    agents,
    setAgents,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    agentCode,
    setAgentCode,
  ] = useState("");

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    connectingCode,
    setConnectingCode,
  ] = useState(false);

  const [
    showAllAgents,
    setShowAllAgents,
  ] = useState(true);

  const [
    showConnectPanel,
    setShowConnectPanel,
  ] = useState(true);

  const scrollRef =
    useRef(null);

  const connectPanelY =
    useRef(0);

  const mounted =
    useRef(true);

  /* =======================================================
     Mounted
  ======================================================= */

  useEffect(() => {
    mounted.current =
      true;

    return () => {
      mounted.current =
        false;
    };
  }, []);

  /* =======================================================
     Load Agents
  ======================================================= */

  const load =
    useCallback(async () => {
      setLoadError("");
      setLoading(true);

      try {
        const response =
          await getAgents();

        const list =
          normalizeList(
            response
          );

        if (
          mounted.current
        ) {
          setAgents(
            list
          );
        }
      } catch {
        if (
          mounted.current
        ) {
          setLoadError(
            "تعذر تحميل الوكلاء. يرجى التحقق من الاتصال والمحاولة مرة أخرى."
          );
        }
      } finally {
        if (
          mounted.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* =======================================================
     Refresh
  ======================================================= */

  const onRefresh =
    useCallback(async () => {
      setRefreshing(true);

      await load();
    }, [load]);

  /* =======================================================
     Connected Agent
  ======================================================= */

  const connectedAgent =
    user?.raw
      ?.connected_agent ||
    user?.raw?.agent ||
    null;

  const connectedAgentId =
    connectedAgent?.id ??
    connectedAgent?.user_id ??
    null;

  const isPublic =
    route?.params?.public ===
    true;

  useEffect(() => {
    const hasAgent =
      !!connectedAgentId;

    setShowAllAgents(
      !hasAgent
    );

    setShowConnectPanel(
      !hasAgent
    );
  }, [connectedAgentId]);

  /* =======================================================
     Connect
  ======================================================= */

  const doConnect =
    useCallback(
      async ({
        agentId,
        agentCodeValue,
        allowSwitch = false,
      }) => {
        if (
          connectingCode
        ) {
          return;
        }

        try {
          setConnectingCode(
            true
          );

          const response =
            await connectToAgent({
              agent_id:
                agentId,

              agent_code:
                agentCodeValue,

              allow_switch:
                allowSwitch,
            });

          await refreshUser();

          setAgentCode("");

          Alert.alert(
            "تم الربط",

            getArabicMessage(
              response?.message ||
                response?.detail,

              "تم ربط حسابك بالوكيل بنجاح."
            )
          );
        } catch (error) {
          const responseData =
            error?.response?.data;

          const rawMessage =
            responseData?.message
              ?.ar ||
            responseData?.error ||
            responseData?.detail ||
            error?.message;

          Alert.alert(
            "تعذر الربط",

            getArabicMessage(
              rawMessage,
              "تعذر ربط الحساب بالوكيل. يرجى المحاولة مرة أخرى."
            )
          );
        } finally {
          setConnectingCode(
            false
          );
        }
      },
      [
        connectingCode,
        refreshUser,
      ]
    );

  /* =======================================================
     Switch Confirmation
  ======================================================= */

  const confirmSwitchIfNeeded =
    useCallback(
      ({
        agentId,
        agentCodeValue,
      }) => {
        const isSame =
          connectedAgentId !=
            null &&
          agentId != null &&
          String(
            connectedAgentId
          ) ===
            String(agentId);

        if (isSame) {
          Alert.alert(
            "الوكيل الحالي",
            "هذا الوكيل مرتبط بحسابك حالياً."
          );

          return;
        }

        if (
          connectedAgentId
        ) {
          Alert.alert(
            "تغيير الوكيل؟",

            "حسابك مرتبط بوكيل حالياً. هل تريد تغييره؟",

            [
              {
                text:
                  "إلغاء",

                style:
                  "cancel",
              },

              {
                text:
                  "تغيير",

                style:
                  "destructive",

                onPress:
                  () =>
                    doConnect({
                      agentId,
                      agentCodeValue,
                      allowSwitch:
                        true,
                    }),
              },
            ]
          );

          return;
        }

        doConnect({
          agentId,
          agentCodeValue,
          allowSwitch:
            false,
        });
      },
      [
        connectedAgentId,
        doConnect,
      ]
    );

  /* =======================================================
     Connect By Code
  ======================================================= */

  const handleConnectByCode =
    useCallback(() => {
      const code =
        String(
          agentCode || ""
        ).trim();

      if (!code) {
        Alert.alert(
          "رمز الوكيل",
          "يرجى إدخال رمز الوكيل أولاً."
        );

        return;
      }

      confirmSwitchIfNeeded({
        agentCodeValue:
          code,
      });
    }, [
      agentCode,
      confirmSwitchIfNeeded,
    ]);

  /* =======================================================
     Search
  ======================================================= */

  const filtered =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return agents;
      }

      return (
        agents || []
      ).filter(
        (agent) => {
          const searchText =
            `${agent.full_name || ""} ${agent.username || ""} ${agent.region || ""}`
              .toLowerCase();

          return searchText.includes(
            query
          );
        }
      );
    }, [
      agents,
      search,
    ]);

  /* =======================================================
     Show Change Section
  ======================================================= */

  const showChangeAgent =
    useCallback(() => {
      setShowConnectPanel(
        true
      );

      setShowAllAgents(
        true
      );

      setTimeout(() => {
        scrollRef.current?.scrollTo(
          {
            y: Math.max(
              0,
              connectPanelY.current -
                sy(12)
            ),

            animated:
              true,
          }
        );
      }, 100);
    }, [sy]);

  /* =======================================================
     Render
  ======================================================= */

  return (
    <PageLayout
      navigation={
        navigation
      }
      active="menu"
      withSideMenu={
        !isPublic
      }
    >
      <View
        style={
          styles.page
        }
      >
        {/* Decorative Background */}

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
              0.45
            }
          />
        </View>

        {/* =================================================
            Same Header As Other Screens
        ================================================= */}

        <AppHeader
          title="الوكلاء"
        />

        {/* =================================================
            Content
        ================================================= */}

        <ScrollView
          ref={
            scrollRef
          }
          style={
            styles.scroll
          }
          bounces={
            false
          }
          overScrollMode="never"
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={{
            paddingBottom:
              contentPadBottom,
          }}
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
            />
          }
        >
          <View
            style={[
              styles.content,
              {
                paddingHorizontal:
                  H_PAD,

                paddingTop:
                  sy(12),
              },
            ]}
          >
            {/* =================================================
                Current Agent
            ================================================= */}

            {!!connectedAgent &&
              !showAllAgents && (
                <CurrentAgentCard
                  agent={
                    connectedAgent
                  }
                  sx={sx}
                  sy={sy}
                  onShowAll={() =>
                    setShowAllAgents(
                      true
                    )
                  }
                  onChange={
                    showChangeAgent
                  }
                />
              )}

            {/* =================================================
                Connect Panel
            ================================================= */}

            {(showConnectPanel ||
              !connectedAgent) && (
              <View
                onLayout={(
                  event
                ) => {
                  connectPanelY.current =
                    event.nativeEvent.layout.y;
                }}
                style={{
                  marginBottom:
                    sy(16),
                }}
              >
                <View
                  style={[
                    styles.connectCard,
                    {
                      borderRadius:
                        sx(18),

                      padding:
                        sx(14),
                    },
                  ]}
                >
                  {/* Header */}

                  <SectionHeader
                    icon="link-outline"
                    title="ربط حسابك بوكيل"
                    subtitle="اختر الطريقة المناسبة لك"
                    sx={sx}
                  />

                  {/* Current info */}

                  {!!connectedAgent && (
                    <View
                      style={
                        styles.currentSmallBadge
                      }
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={17}
                        color={
                          COLOR.success
                        }
                      />

                      <Text
                        numberOfLines={
                          1
                        }
                        style={
                          styles.currentSmallText
                        }
                      >
                        مرتبط حالياً مع{" "}
                        {connectedAgent.full_name ||
                          connectedAgent.name ||
                          connectedAgent.username ||
                          "وكيل"}
                      </Text>
                    </View>
                  )}

                  {/* QR */}

                  <Pressable
                    onPress={() =>
                      navigation.navigate(
                        "AgentQRConnect",
                        {
                          mode:
                            "connect",
                        }
                      )
                    }
                    style={[
                      styles.qrButton,
                      {
                        minHeight:
                          sy(54),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.qrIcon,
                        {
                          width:
                            sx(38),

                          height:
                            sx(38),

                          borderRadius:
                            sx(11),
                        },
                      ]}
                    >
                      <Ionicons
                        name="scan-outline"
                        size={21}
                        color={
                          COLOR.primary
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.qrTextWrap
                      }
                    >
                      <Text
                        style={
                          styles.qrTitle
                        }
                      >
                        مسح رمز QR
                      </Text>

                      <Text
                        style={
                          styles.qrSubtitle
                        }
                      >
                        امسح رمز الوكيل للربط مباشرة
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-back-outline"
                      size={20}
                      color={
                        COLOR.muted
                      }
                    />
                  </Pressable>

                  {/* Divider */}

                  <View
                    style={
                      styles.orRow
                    }
                  >
                    <View
                      style={
                        styles.orLine
                      }
                    />

                    <Text
                      style={
                        styles.orText
                      }
                    >
                      أو
                    </Text>

                    <View
                      style={
                        styles.orLine
                      }
                    />
                  </View>

                  {/* Code Label */}

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    رمز الوكيل
                  </Text>

                  {/* Code Input */}

                  <View
                    style={
                      styles.codeRow
                    }
                  >
                    <View
                      style={
                        styles.codeIcon
                      }
                    >
                      <Ionicons
                        name="key-outline"
                        size={19}
                        color={
                          COLOR.primary
                        }
                      />
                    </View>

                    <TextInput
                      value={
                        agentCode
                      }
                      onChangeText={
                        setAgentCode
                      }
                      placeholder="أدخل رمز الوكيل"
                      placeholderTextColor={
                        "#98A5B7"
                      }
                      autoCapitalize="characters"
                      autoCorrect={
                        false
                      }
                      style={
                        styles.codeInput
                      }
                    />
                  </View>

                  {/* Connect Button */}

                  <Pressable
                    onPress={
                      handleConnectByCode
                    }
                    disabled={
                      connectingCode
                    }
                    style={[
                      styles.connectButton,

                      {
                        minHeight:
                          sy(48),
                      },

                      connectingCode && {
                        opacity:
                          0.6,
                      },
                    ]}
                  >
                    {connectingCode ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <Ionicons
                        name="link-outline"
                        size={19}
                        color="#FFFFFF"
                      />
                    )}

                    <Text
                      style={
                        styles.connectButtonText
                      }
                    >
                      {connectingCode
                        ? "جاري الربط..."
                        : "ربط بالرمز"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* =================================================
                Agents List Header
            ================================================= */}

            {showAllAgents && (
              <>
                <View
                  style={
                    styles.listTitleRow
                  }
                >
                  <View
                    style={
                      styles.listTitleTextWrap
                    }
                  >
                    <Text
                      style={
                        styles.listTitle
                      }
                    >
                      الوكلاء المتاحون
                    </Text>

                    <Text
                      style={
                        styles.listSubtitle
                      }
                    >
                      اختر الوكيل الذي تريد ربط حسابك معه
                    </Text>
                  </View>

                  <View
                    style={
                      styles.countBadge
                    }
                  >
                    <Text
                      style={
                        styles.countBadgeText
                      }
                    >
                      {
                        filtered.length
                      }
                    </Text>
                  </View>
                </View>

                {/* Search */}

                <View
                  style={
                    styles.searchBox
                  }
                >
                  <Ionicons
                    name="search-outline"
                    size={20}
                    color={
                      COLOR.muted
                    }
                  />

                  <TextInput
                    value={
                      search
                    }
                    onChangeText={
                      setSearch
                    }
                    placeholder="ابحث بالاسم أو اسم المستخدم أو المنطقة"
                    placeholderTextColor={
                      "#98A5B7"
                    }
                    autoCorrect={
                      false
                    }
                    style={
                      styles.searchInput
                    }
                  />

                  {!!search && (
                    <Pressable
                      onPress={() =>
                        setSearch(
                          ""
                        )
                      }
                      hitSlop={
                        10
                      }
                      style={
                        styles.clearSearch
                      }
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={
                          COLOR.muted
                        }
                      />
                    </Pressable>
                  )}
                </View>

                {/* =============================================
                    Loading
                ============================================= */}

                {loading ? (
                  <View
                    style={[
                      styles.loadingBox,
                      {
                        paddingVertical:
                          sy(35),
                      },
                    ]}
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
                      جاري تحميل الوكلاء...
                    </Text>
                  </View>
                ) : loadError ? (
                  <StateBox
                    icon="alert-circle-outline"
                    text={
                      loadError
                    }
                    onRetry={
                      load
                    }
                    sx={sx}
                    sy={sy}
                  />
                ) : filtered.length ===
                  0 ? (
                  <EmptyAgents
                    sx={sx}
                    sy={sy}
                  />
                ) : (
                  <View
                    style={[
                      styles.agentList,
                      {
                        gap:
                          sy(10),
                      },
                    ]}
                  >
                    {filtered.map(
                      (agent) => (
                        <AgentCard
                          key={
                            agent.id ??
                            agent.user_id ??
                            agent.username
                          }
                          agent={
                            agent
                          }
                          connectedAgentId={
                            connectedAgentId
                          }
                          connecting={
                            connectingCode
                          }
                          onConnect={() =>
                            confirmSwitchIfNeeded(
                              {
                                agentId:
                                  agent.id,
                                agentCodeValue:
                                  null,
                              }
                            )
                          }
                          sx={sx}
                          sy={sy}
                        />
                      )
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </PageLayout>
  );
}

/* =========================================================
   Current Agent Card
========================================================= */

function CurrentAgentCard({
  agent,
  sx,
  sy,
  onShowAll,
  onChange,
}) {
  const name =
    agent?.full_name ||
    agent?.name ||
    agent?.username ||
    "—";

  const phone =
    agent?.phone ||
    agent?.mobile ||
    "—";

  const region =
    agent?.region ||
    "غير محددة";

  return (
    <View
      style={[
        styles.currentCard,
        {
          padding:
            sx(15),

          borderRadius:
            sx(18),

          marginBottom:
            sy(14),
        },
      ]}
    >
      {/* Header */}

      <View
        style={
          styles.currentHeader
        }
      >
        <View
          style={[
            styles.currentAvatar,

            {
              width:
                sx(54),

              height:
                sx(54),

              borderRadius:
                sx(27),
            },
          ]}
        >
          <Text
            style={
              styles.currentAvatarText
            }
          >
            {makeInitials(
              name
            )}
          </Text>
        </View>

        <View
          style={
            styles.currentInfo
          }
        >
          <Text
            style={
              styles.currentLabel
            }
          >
            وكيلك الحالي
          </Text>

          <Text
            numberOfLines={
              1
            }
            style={
              styles.currentName
            }
          >
            {name}
          </Text>
        </View>

        <View
          style={
            styles.activePill
          }
        >
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={
              COLOR.success
            }
          />

          <Text
            style={
              styles.activePillText
            }
          >
            نشط
          </Text>
        </View>
      </View>

      {/* Info */}

      <View
        style={[
          styles.currentInfoGrid,
          {
            gap:
              sx(9),

            marginTop:
              sy(14),
          },
        ]}
      >
        <InfoBox
          icon="call-outline"
          label="الهاتف"
          value={phone}
          sx={sx}
          ltr
        />

        <InfoBox
          icon="location-outline"
          label="المنطقة"
          value={region}
          sx={sx}
        />
      </View>

      {/* Actions */}

      <View
        style={[
          styles.currentActions,
          {
            gap:
              sx(8),

            marginTop:
              sy(12),
          },
        ]}
      >
        <Pressable
          onPress={
            onShowAll
          }
          style={
            styles.secondaryButton
          }
        >
          <Ionicons
            name="people-outline"
            size={18}
            color={
              COLOR.primary
            }
          />

          <Text
            style={
              styles.secondaryButtonText
            }
          >
            عرض الوكلاء
          </Text>
        </Pressable>

        <Pressable
          onPress={
            onChange
          }
          style={
            styles.primaryButton
          }
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={18}
            color="#FFFFFF"
          />

          <Text
            style={
              styles.primaryButtonText
            }
          >
            تغيير الوكيل
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* =========================================================
   Info Box
========================================================= */

function InfoBox({
  icon,
  label,
  value,
  sx,
  ltr = false,
}) {
  return (
    <View
      style={[
        styles.infoBox,
        {
          borderRadius:
            sx(13),

          padding:
            sx(11),
        },
      ]}
    >
      <View
        style={
          styles.infoBoxHeader
        }
      >
        <Ionicons
          name={icon}
          size={16}
          color={
            COLOR.primary
          }
        />

        <Text
          style={
            styles.infoBoxLabel
          }
        >
          {label}
        </Text>
      </View>

      <Text
        numberOfLines={
          1
        }
        style={[
          styles.infoBoxValue,

          {
            writingDirection:
              ltr
                ? "ltr"
                : "rtl",
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   Section Header
========================================================= */

function SectionHeader({
  icon,
  title,
  subtitle,
  sx,
}) {
  return (
    <View
      style={
        styles.sectionHeader
      }
    >
      <View
        style={[
          styles.sectionIcon,
          {
            width:
              sx(38),

            height:
              sx(38),

            borderRadius:
              sx(12),
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={
            COLOR.primary
          }
        />
      </View>

      <View
        style={
          styles.sectionHeaderText
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={
              styles.sectionSubtitle
            }
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

/* =========================================================
   Agent Card
========================================================= */

function AgentCard({
  agent,
  connectedAgentId,
  connecting,
  onConnect,
  sx,
  sy,
}) {
  const name =
    agent?.full_name ||
    agent?.username ||
    `وكيل #${agent?.id}`;

  const region =
    agent?.region ||
    "المنطقة غير متوفرة";

  const initials =
    makeInitials(name);

  const avatarColor =
    pickAvatarColor(
      agent?.id
    );

  const isCurrent =
    connectedAgentId !=
      null &&
    (
      String(
        connectedAgentId
      ) ===
        String(
          agent?.id
        ) ||
      String(
        connectedAgentId
      ) ===
        String(
          agent?.user_id
        )
    );

  return (
    <View
      style={[
        styles.agentCard,

        {
          padding:
            sx(14),

          borderRadius:
            sx(17),
        },

        isCurrent &&
          styles.agentCardCurrent,
      ]}
    >
      {/* Top */}

      <View
        style={
          styles.agentTop
        }
      >
        <View
          style={[
            styles.agentAvatar,

            {
              width:
                sx(50),

              height:
                sx(50),

              borderRadius:
                sx(25),

              backgroundColor:
                avatarColor,
            },
          ]}
        >
          <Text
            style={
              styles.agentAvatarText
            }
          >
            {initials}
          </Text>
        </View>

        <View
          style={
            styles.agentMain
          }
        >
          <View
            style={
              styles.agentNameRow
            }
          >
            <Text
              numberOfLines={
                1
              }
              style={
                styles.agentName
              }
            >
              {name}
            </Text>

            {isCurrent && (
              <View
                style={
                  styles.currentAgentPill
                }
              >
                <Ionicons
                  name="checkmark-circle"
                  size={13}
                  color={
                    COLOR.success
                  }
                />

                <Text
                  style={
                    styles.currentAgentPillText
                  }
                >
                  الحالي
                </Text>
              </View>
            )}
          </View>

          <View
            style={
              styles.metaRow
            }
          >
            <Ionicons
              name="location-outline"
              size={14}
              color={
                COLOR.muted
              }
            />

            <Text
              numberOfLines={
                1
              }
              style={
                styles.metaText
              }
            >
              {region}
            </Text>
          </View>

          {!!agent?.username && (
            <View
              style={
                styles.metaRow
              }
            >
              <Ionicons
                name="person-outline"
                size={14}
                color={
                  COLOR.muted
                }
              />

              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.metaText,
                  styles.usernameText,
                ]}
              >
                {agent.username}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Divider */}

      <View
        style={[
          styles.agentDivider,
          {
            marginVertical:
              sy(12),
          },
        ]}
      />

      {/* Action */}

      <Pressable
        onPress={
          onConnect
        }
        disabled={
          connecting ||
          isCurrent
        }
        style={[
          styles.agentConnectButton,

          isCurrent &&
            styles.agentConnectButtonCurrent,

          connecting && {
            opacity:
              0.55,
          },
        ]}
      >
        {connecting &&
        !isCurrent ? (
          <ActivityIndicator
            size="small"
            color="#FFFFFF"
          />
        ) : (
          <Ionicons
            name={
              isCurrent
                ? "checkmark-circle-outline"
                : "link-outline"
            }
            size={18}
            color={
              isCurrent
                ? COLOR.success
                : "#FFFFFF"
            }
          />
        )}

        <Text
          style={[
            styles.agentConnectText,

            isCurrent &&
              styles.agentConnectTextCurrent,
          ]}
        >
          {isCurrent
            ? "وكيلك الحالي"
            : "تعيين هذا الوكيل"}
        </Text>
      </Pressable>
    </View>
  );
}

/* =========================================================
   State Box
========================================================= */

function StateBox({
  icon,
  text,
  onRetry,
  sx,
  sy,
}) {
  return (
    <View
      style={[
        styles.stateCard,
        {
          padding:
            sx(16),

          borderRadius:
            sx(16),

          marginTop:
            sy(8),
        },
      ]}
    >
      <View
        style={[
          styles.stateIcon,
          {
            width:
              sx(52),

            height:
              sx(52),

            borderRadius:
              sx(26),
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={25}
          color={
            COLOR.danger
          }
        />
      </View>

      <Text
        style={
          styles.stateText
        }
      >
        {text}
      </Text>

      {!!onRetry && (
        <Pressable
          onPress={
            onRetry
          }
          style={[
            styles.retryButton,
            {
              marginTop:
                sy(12),
            },
          ]}
        >
          <Ionicons
            name="refresh-outline"
            size={17}
            color="#FFFFFF"
          />

          <Text
            style={
              styles.retryButtonText
            }
          >
            إعادة المحاولة
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/* =========================================================
   Empty
========================================================= */

function EmptyAgents({
  sx,
  sy,
}) {
  return (
    <View
      style={[
        styles.emptyBox,
        {
          paddingVertical:
            sy(32),

          paddingHorizontal:
            sx(20),
        },
      ]}
    >
      <View
        style={[
          styles.emptyIcon,
          {
            width:
              sx(64),

            height:
              sx(64),

            borderRadius:
              sx(32),
          },
        ]}
      >
        <Ionicons
          name="people-outline"
          size={29}
          color={
            COLOR.primary
          }
        />
      </View>

      <Text
        style={[
          styles.emptyTitle,
          {
            marginTop:
              sy(13),
          },
        ]}
      >
        لا توجد نتائج
      </Text>

      <Text
        style={[
          styles.emptyText,
          {
            marginTop:
              sy(5),
          },
        ]}
      >
        جرّب البحث باسم آخر أو امسح عبارة البحث.
      </Text>
    </View>
  );
}

/* =========================================================
   Styles
========================================================= */

const styles =
  StyleSheet.create({
    /* Page */

    page: {
      flex: 1,
      backgroundColor:
        COLOR.bg,
    },

    scroll: {
      flex: 1,
      backgroundColor:
        "transparent",
    },

    content: {
      alignSelf:
        "center",

      width:
        "100%",

      maxWidth:
        MAX_W,
    },

    /* =====================================================
       Current Agent
    ===================================================== */

    currentCard: {
      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.successBorder,

      ...shadows.soft,
    },

    currentHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        10,
    },

    currentAvatar: {
      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primary,
    },

    currentAvatarText: {
      color:
        "#FFFFFF",

      fontFamily:
        fontFamilies.bold,

      fontSize:
        17,

      fontWeight:
        "900",
    },

    currentInfo: {
      flex: 1,
      alignItems:
        "flex-end",
    },

    currentLabel: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        11,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    currentName: {
      width:
        "100%",

      marginTop:
        3,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        18,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    activePill: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        4,

      paddingHorizontal:
        8,

      paddingVertical:
        5,

      borderRadius:
        999,

      backgroundColor:
        COLOR.successSoft,

      borderWidth:
        1,

      borderColor:
        COLOR.successBorder,
    },

    activePillText: {
      color:
        "#166534",

      fontFamily:
        fontFamilies.bold,

      fontSize:
        11,

      fontWeight:
        "800",

      writingDirection:
        "rtl",
    },

    currentInfoGrid: {
      flexDirection:
        "row-reverse",
    },

    infoBox: {
      flex: 1,

      minWidth:
        0,

      backgroundColor:
        "#F8FAFC",

      borderWidth:
        1,

      borderColor:
        COLOR.line,
    },

    infoBoxHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        6,
    },

    infoBoxLabel: {
      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        11,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    infoBoxValue: {
      width:
        "100%",

      marginTop:
        7,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        13,

      fontWeight:
        "800",

      textAlign:
        "right",
    },

    currentActions: {
      flexDirection:
        "row-reverse",
    },

    primaryButton: {
      flex: 1,

      minHeight:
        45,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        6,

      backgroundColor:
        COLOR.primary,

      borderRadius:
        13,
    },

    primaryButtonText: {
      color:
        "#FFFFFF",

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    secondaryButton: {
      flex: 1,

      minHeight:
        45,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        6,

      backgroundColor:
        COLOR.primarySoft,

      borderWidth:
        1,

      borderColor:
        "#D7E6FF",

      borderRadius:
        13,
    },

    secondaryButtonText: {
      color:
        COLOR.primary,

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Connect
    ===================================================== */

    connectCard: {
      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      ...shadows.soft,
    },

    sectionHeader: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        9,

      marginBottom:
        14,
    },

    sectionIcon: {
      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    sectionHeaderText: {
      flex: 1,
      alignItems:
        "flex-end",
    },

    sectionTitle: {
      width:
        "100%",

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        16,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    sectionSubtitle: {
      width:
        "100%",

      marginTop:
        2,

      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        12,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    currentSmallBadge: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        6,

      backgroundColor:
        COLOR.successSoft,

      borderWidth:
        1,

      borderColor:
        COLOR.successBorder,

      borderRadius:
        12,

      paddingHorizontal:
        10,

      paddingVertical:
        8,

      marginBottom:
        12,
    },

    currentSmallText: {
      flex: 1,

      color:
        "#166534",

      fontFamily:
        fontFamilies.bold,

      fontSize:
        12,

      fontWeight:
        "700",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    qrButton: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        10,

      backgroundColor:
        "#F8FAFC",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        14,

      paddingHorizontal:
        11,

      paddingVertical:
        8,
    },

    qrIcon: {
      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    qrTextWrap: {
      flex: 1,
      alignItems:
        "flex-end",
    },

    qrTitle: {
      width:
        "100%",

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        14,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    qrSubtitle: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        11.5,

      marginTop:
        3,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    orRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        9,

      marginVertical:
        13,
    },

    orLine: {
      flex: 1,

      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLOR.line,
    },

    orText: {
      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        11,

      writingDirection:
        "rtl",
    },

    inputLabel: {
      width:
        "100%",

      marginBottom:
        6,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        12.5,

      fontWeight:
        "800",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    codeRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        8,

      minHeight:
        50,

      backgroundColor:
        "#F8FAFC",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        13,

      paddingHorizontal:
        11,
    },

    codeIcon: {
      width:
        31,

      height:
        31,

      borderRadius:
        9,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    codeInput: {
      flex: 1,

      height:
        48,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        14,

      fontWeight:
        "800",

      textAlign:
        "right",

      // الكود نفسه ممكن يكون أحرف وأرقام
      writingDirection:
        "ltr",
    },

    connectButton: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        7,

      backgroundColor:
        COLOR.primary,

      borderRadius:
        13,

      marginTop:
        10,
    },

    connectButtonText: {
      color:
        "#FFFFFF",

      fontFamily:
        fontFamilies.bold,

      fontSize:
        14,

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       List Header
    ===================================================== */

    listTitleRow: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        10,

      marginBottom:
        10,
    },

    listTitleTextWrap: {
      flex: 1,
      alignItems:
        "flex-end",
    },

    listTitle: {
      width:
        "100%",

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        17,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    listSubtitle: {
      width:
        "100%",

      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        11.5,

      marginTop:
        2,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    countBadge: {
      minWidth:
        34,

      height:
        34,

      borderRadius:
        12,

      alignItems:
        "center",

      justifyContent:
        "center",

      paddingHorizontal:
        8,

      backgroundColor:
        COLOR.primarySoft,
    },

    countBadgeText: {
      color:
        COLOR.primary,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        12,

      fontWeight:
        "900",

      writingDirection:
        "ltr",
    },

    /* =====================================================
       Search
    ===================================================== */

    searchBox: {
      minHeight:
        50,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        8,

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        14,

      paddingHorizontal:
        12,

      marginBottom:
        14,

      ...shadows.soft,
    },

    searchInput: {
      flex: 1,

      height:
        48,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        14,

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    clearSearch: {
      alignItems:
        "center",

      justifyContent:
        "center",
    },

    /* =====================================================
       Agent List
    ===================================================== */

    agentList: {
      paddingBottom:
        12,
    },

    agentCard: {
      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      ...shadows.soft,
    },

    agentCardCurrent: {
      borderColor:
        COLOR.successBorder,

      backgroundColor:
        "#FBFFFC",
    },

    agentTop: {
      flexDirection:
        "row-reverse",

      alignItems:
        "flex-start",

      gap:
        10,
    },

    agentAvatar: {
      alignItems:
        "center",

      justifyContent:
        "center",
    },

    agentAvatarText: {
      color:
        "#FFFFFF",

      fontFamily:
        fontFamilies.bold,

      fontSize:
        16,

      fontWeight:
        "900",
    },

    agentMain: {
      flex: 1,
      minWidth: 0,
      alignItems:
        "flex-end",
    },

    agentNameRow: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        7,
    },

    agentName: {
      flex: 1,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        15.5,

      fontWeight:
        "900",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    currentAgentPill: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        3,

      paddingHorizontal:
        7,

      paddingVertical:
        4,

      borderRadius:
        999,

      backgroundColor:
        COLOR.successSoft,
    },

    currentAgentPillText: {
      color:
        "#166534",

      fontFamily:
        fontFamilies.bold,

      fontSize:
        10,

      fontWeight:
        "800",

      writingDirection:
        "rtl",
    },

    metaRow: {
      width:
        "100%",

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      gap:
        5,

      marginTop:
        6,
    },

    metaText: {
      flex: 1,

      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        12,

      fontWeight:
        "600",

      textAlign:
        "right",

      writingDirection:
        "rtl",
    },

    usernameText: {
      writingDirection:
        "ltr",
    },

    agentDivider: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        COLOR.line,
    },

    agentConnectButton: {
      minHeight:
        43,

      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        7,

      backgroundColor:
        COLOR.primary,

      borderRadius:
        12,
    },

    agentConnectButtonCurrent: {
      backgroundColor:
        COLOR.successSoft,

      borderWidth:
        1,

      borderColor:
        COLOR.successBorder,
    },

    agentConnectText: {
      color:
        "#FFFFFF",

      fontFamily:
        fontFamilies.bold,

      fontSize:
        13,

      fontWeight:
        "900",

      writingDirection:
        "rtl",
    },

    agentConnectTextCurrent: {
      color:
        "#166534",
    },

    /* =====================================================
       Loading / Error
    ===================================================== */

    loadingBox: {
      alignItems:
        "center",

      justifyContent:
        "center",
    },

    loadingText: {
      marginTop:
        9,

      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        13,

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    stateCard: {
      alignItems:
        "center",

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.dangerBorder,

      ...shadows.soft,
    },

    stateIcon: {
      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.dangerSoft,
    },

    stateText: {
      marginTop:
        10,

      color:
        COLOR.text,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        13,

      lineHeight:
        20,

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    retryButton: {
      flexDirection:
        "row-reverse",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap:
        6,

      backgroundColor:
        COLOR.primary,

      borderRadius:
        11,

      paddingHorizontal:
        14,

      paddingVertical:
        9,
    },

    retryButtonText: {
      color:
        "#FFFFFF",

      fontFamily:
        fontFamilies.bold,

      fontWeight:
        "800",

      writingDirection:
        "rtl",
    },

    /* =====================================================
       Empty
    ===================================================== */

    emptyBox: {
      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#FFFFFF",

      borderWidth:
        1,

      borderColor:
        COLOR.line,

      borderRadius:
        16,
    },

    emptyIcon: {
      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        COLOR.primarySoft,
    },

    emptyTitle: {
      color:
        COLOR.text,

      fontFamily:
        fontFamilies.bold,

      fontSize:
        17,

      fontWeight:
        "900",

      textAlign:
        "center",

      writingDirection:
        "rtl",
    },

    emptyText: {
      maxWidth:
        280,

      color:
        COLOR.muted,

      fontFamily:
        fontFamilies.regular,

      fontSize:
        12.5,

      lineHeight:
        19,

      textAlign:
        "center",

      writingDirection:
        "rtl",
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