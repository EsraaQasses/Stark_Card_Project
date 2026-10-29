import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_LOCK_FAILURES_BEFORE_DELAY, APP_LOCK_PIN_LENGTH } from "../model/appLockPolicy";
import { useAppLock } from "../context/AppLockProvider";
import PinPad from "./PinPad";
import { useScale } from "../../../ui/scale";

type EnrollmentStep = "create" | "confirm";

function formatWaitTime(seconds: number) {
  if (seconds < 60) return `${seconds} ثانية`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} دقيقة`;
}

export default function AppLockGate() {
  const {
    phase,
    lockedUntil,
    errorMessage,
    biometricsAvailable,
    biometricsEnabled,
    biometricLabel,
    enroll,
    unlockWithPin,
    unlockWithBiometrics,
    recoverAccount,
  } = useAppLock();
  const insets = useSafeAreaInsets();
  const { sx, sy, sp, isSmallPhone } = useScale();

  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [enrollmentStep, setEnrollmentStep] = useState<EnrollmentStep>("create");
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [now, setNow] = useState(Date.now());
  const automaticBiometricAttemptedRef = useRef(false);

  const visible = phase === "enrolling" || phase === "locked" || phase === "error";
  const remainingSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1_000));
  const rateLimited = phase === "locked" && remainingSeconds > 0;

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  useEffect(() => {
    setPin("");
    setMessage(null);
    setBusy(false);

    if (phase === "enrolling") {
      setFirstPin("");
      setEnrollmentStep("create");
    }

    if (phase !== "locked") automaticBiometricAttemptedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase === "enrolling") setEnableBiometrics(biometricsAvailable);
  }, [biometricsAvailable, phase]);

  useEffect(() => {
    if (
      phase !== "locked"
      || !biometricsAvailable
      || !biometricsEnabled
      || automaticBiometricAttemptedRef.current
    ) {
      return;
    }

    automaticBiometricAttemptedRef.current = true;
    const timer = setTimeout(() => {
      setBusy(true);
      void unlockWithBiometrics().finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [biometricsAvailable, biometricsEnabled, phase, unlockWithBiometrics]);

  const submitCompletedPin = useCallback(async (completedPin: string) => {
    if (busy || recovering || rateLimited) return;

    if (phase === "enrolling") {
      if (enrollmentStep === "create") {
        setFirstPin(completedPin);
        setPin("");
        setMessage(null);
        setEnrollmentStep("confirm");
        return;
      }

      if (completedPin !== firstPin) {
        setPin("");
        setMessage("الرمزان غير متطابقين. حاول التأكيد مرة أخرى.");
        return;
      }

      setBusy(true);
      setMessage(null);
      try {
        await enroll(completedPin, enableBiometrics);
      } catch {
        // The provider fails closed and switches to its recovery state.
      } finally {
        setBusy(false);
      }
      return;
    }

    if (phase !== "locked") return;
    setBusy(true);
    setMessage(null);
    const result = await unlockWithPin(completedPin);
    setBusy(false);
    setPin("");

    if (result.ok) return;
    if (result.reason === "rate-limited" || result.lockedUntil > Date.now()) {
      setNow(Date.now());
      setMessage("تم إيقاف محاولات الرمز مؤقتاً لحماية حسابك.");
    } else if (result.reason === "invalid") {
      const attemptsUntilDelay = Math.max(
        0,
        APP_LOCK_FAILURES_BEFORE_DELAY - result.failedAttempts,
      );
      setMessage(
        attemptsUntilDelay > 0
          ? `رمز غير صحيح. تبقّت ${attemptsUntilDelay} محاولة قبل الإيقاف المؤقت.`
          : "رمز غير صحيح.",
      );
    }
  }, [
    busy,
    enableBiometrics,
    enroll,
    enrollmentStep,
    firstPin,
    phase,
    rateLimited,
    recovering,
    unlockWithPin,
  ]);

  const addDigit = useCallback((digit: string) => {
    if (busy || recovering || rateLimited) return;
    setMessage(null);
    setPin((current) => {
      if (current.length >= APP_LOCK_PIN_LENGTH) return current;
      const next = `${current}${digit}`;
      if (next.length === APP_LOCK_PIN_LENGTH) {
        setTimeout(() => void submitCompletedPin(next), 0);
      }
      return next;
    });
  }, [busy, rateLimited, recovering, submitCompletedPin]);

  const deleteDigit = useCallback(() => {
    if (busy || recovering || rateLimited) return;
    setMessage(null);
    setPin((current) => current.slice(0, -1));
  }, [busy, rateLimited, recovering]);

  const requestBiometricUnlock = useCallback(async () => {
    if (busy || recovering) return;
    setBusy(true);
    setMessage(null);
    const unlocked = await unlockWithBiometrics();
    setBusy(false);
    if (!unlocked) setMessage("لم تكتمل المصادقة الحيوية. يمكنك استخدام رمز التطبيق.");
  }, [busy, recovering, unlockWithBiometrics]);

  const confirmRecovery = useCallback(() => {
    Alert.alert(
      "نسيت رمز التطبيق؟",
      "سيتم تسجيل خروجك بأمان. بعد ذلك سجّل الدخول بكلمة مرور حسابك وأنشئ رمزاً جديداً.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: () => {
            setRecovering(true);
            setMessage(null);
            void recoverAccount()
              .catch(() => {
                setMessage("تعذّر إنهاء الجلسة بأمان. حاول مرة أخرى.");
                setRecovering(false);
              });
          },
        },
      ],
    );
  }, [recoverAccount]);

  if (!visible) return null;

  const isEnrollment = phase === "enrolling";
  const title = phase === "error"
    ? "تعذّر فتح القفل"
    : isEnrollment
      ? enrollmentStep === "create" ? "أنشئ رمز التطبيق" : "أكّد رمز التطبيق"
      : "التطبيق مقفل";
  const subtitle = phase === "error"
    ? errorMessage || "حدث خطأ في طبقة الحماية."
    : isEnrollment
      ? enrollmentStep === "create"
        ? `اختر رمزاً من ${APP_LOCK_PIN_LENGTH} أرقام لحماية حسابك على هذا الجهاز.`
        : "أدخل الرمز نفسه مرة أخرى للتأكيد."
      : rateLimited
        ? `حاول مجدداً بعد ${formatWaitTime(remainingSeconds)}.`
        : `أدخل رمزك المكوّن من ${APP_LOCK_PIN_LENGTH} أرقام للمتابعة.`;

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      onRequestClose={() => {}}
    >
      <View
        style={[
          styles.page,
          {
            paddingTop: Math.max(insets.top, sy(16)),
            paddingBottom: Math.max(insets.bottom, sy(12)),
          },
        ]}
        accessibilityViewIsModal
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: sx(26), paddingVertical: sy(isSmallPhone ? 10 : 18) },
          ]}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require("../../../../assets/images/Logo.png")}
            resizeMode="contain"
            style={{ width: sx(112), height: sy(58), marginBottom: sy(12) }}
            accessibilityLabel="Stark Card"
          />

          <View
            style={[
              styles.lockIcon,
              { width: sx(68), height: sx(68), borderRadius: sx(22), marginBottom: sy(16) },
            ]}
          >
            <Ionicons
              name={phase === "error" ? "shield-outline" : "lock-closed-outline"}
              size={sp(31)}
              color="#0B63D8"
            />
          </View>

          <Text style={[styles.title, { fontSize: sp(24) }]}>{title}</Text>
          <Text style={[styles.subtitle, { fontSize: sp(14), marginTop: sy(8) }]}>{subtitle}</Text>

          {phase !== "error" && (
            <>
              <View
                style={[styles.dots, { gap: sx(12), marginTop: sy(22), marginBottom: sy(18) }]}
                accessibilityLabel={`تم إدخال ${pin.length} من ${APP_LOCK_PIN_LENGTH} أرقام`}
              >
                {Array.from({ length: APP_LOCK_PIN_LENGTH }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      {
                        width: sx(13),
                        height: sx(13),
                        borderRadius: sx(7),
                      },
                      index < pin.length && styles.dotFilled,
                    ]}
                  />
                ))}
              </View>

              {message && <Text style={[styles.message, { fontSize: sp(13) }]}>{message}</Text>}
              {busy && <ActivityIndicator color="#0B63D8" style={{ marginVertical: sy(6) }} />}

              {isEnrollment && enrollmentStep === "confirm" && biometricsAvailable && (
                <View style={[styles.biometricSetting, { padding: sx(13), marginBottom: sy(14) }]}>
                  <View style={styles.biometricSettingText}>
                    <Text style={[styles.settingTitle, { fontSize: sp(14) }]}>
                      فتح باستخدام {biometricLabel}
                    </Text>
                    <Text style={[styles.settingHint, { fontSize: sp(11) }]}>
                      يبقى رمز التطبيق متاحاً كخيار احتياطي.
                    </Text>
                  </View>
                  <Switch
                    value={enableBiometrics}
                    onValueChange={setEnableBiometrics}
                    disabled={busy}
                    trackColor={{ false: "#CBD5E1", true: "#8BB9F4" }}
                    thumbColor={enableBiometrics ? "#0B63D8" : "#F8FAFC"}
                  />
                </View>
              )}

              <PinPad
                disabled={busy || recovering || rateLimited}
                onDigit={addDigit}
                onDelete={deleteDigit}
              />

              {isEnrollment && enrollmentStep === "confirm" && (
                <Pressable
                  disabled={busy}
                  onPress={() => {
                    setPin("");
                    setFirstPin("");
                    setMessage(null);
                    setEnrollmentStep("create");
                  }}
                  style={styles.textButton}
                >
                  <Text style={[styles.textButtonLabel, { fontSize: sp(13) }]}>اختيار رمز مختلف</Text>
                </Pressable>
              )}

              {!isEnrollment && biometricsAvailable && biometricsEnabled && (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || recovering}
                  onPress={requestBiometricUnlock}
                  style={({ pressed }) => [
                    styles.biometricButton,
                    { marginTop: sy(16), opacity: pressed || busy ? 0.65 : 1 },
                  ]}
                >
                  <Ionicons name="finger-print" size={sp(21)} color="#0B63D8" />
                  <Text style={[styles.biometricButtonLabel, { fontSize: sp(14) }]}>
                    استخدام {biometricLabel}
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {!isEnrollment && (
            <Pressable
              accessibilityRole="button"
              disabled={recovering}
              onPress={confirmRecovery}
              style={[styles.recoveryButton, { marginTop: sy(18) }]}
            >
              {recovering ? (
                <ActivityIndicator size="small" color="#B42318" />
              ) : (
                <Text style={[styles.recoveryLabel, { fontSize: sp(13) }]}>نسيت رمز التطبيق؟</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    alignItems: "center",
    backgroundColor: "#EAF3FF",
    justifyContent: "center",
  },
  title: {
    color: "#0E1B3B",
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 22,
    maxWidth: 340,
    textAlign: "center",
  },
  dots: {
    direction: "ltr",
    flexDirection: "row",
  },
  dot: {
    backgroundColor: "#FFFFFF",
    borderColor: "#A8B8CB",
    borderWidth: 1.5,
  },
  dotFilled: {
    backgroundColor: "#0B63D8",
    borderColor: "#0B63D8",
  },
  message: {
    color: "#B42318",
    marginBottom: 10,
    maxWidth: 330,
    textAlign: "center",
  },
  biometricSetting: {
    alignItems: "center",
    backgroundColor: "#F6F9FD",
    borderColor: "#DDE8F4",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    maxWidth: 330,
    width: "100%",
  },
  biometricSettingText: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    color: "#0E1B3B",
    fontWeight: "700",
    textAlign: "right",
  },
  settingHint: {
    color: "#64748B",
    lineHeight: 18,
    marginTop: 3,
    textAlign: "right",
  },
  textButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textButtonLabel: {
    color: "#0B63D8",
    fontWeight: "700",
  },
  biometricButton: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  biometricButtonLabel: {
    color: "#0B63D8",
    fontWeight: "700",
  },
  recoveryButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  recoveryLabel: {
    color: "#B42318",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
