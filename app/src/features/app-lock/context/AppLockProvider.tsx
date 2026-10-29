import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useAuth } from "../../../context/AuthProvider";
import { getAppLockAccountId } from "../model/accountIdentity";
import {
  getLockoutRemainingMs,
  recordFailedAttempt,
  resetRateLimit,
} from "../model/appLockPolicy";
import {
  type AppLockRecord,
  createAppLockRecord,
  loadAppLockRecord,
  removeAppLockRecord,
  saveAppLockRecord,
  verifyAppLockPin,
} from "../storage/appLockStorage";

export type AppLockPhase =
  | "disabled"
  | "loading"
  | "enrolling"
  | "locked"
  | "unlocked"
  | "error";

export interface PinUnlockResult {
  ok: boolean;
  reason?: "invalid" | "rate-limited" | "storage-error";
  failedAttempts: number;
  lockedUntil: number;
}

interface AppLockContextValue {
  phase: AppLockPhase;
  failedAttempts: number;
  lockedUntil: number;
  errorMessage: string | null;
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  biometricLabel: string;
  enroll: (pin: string, enableBiometrics: boolean) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<PinUnlockResult>;
  unlockWithBiometrics: () => Promise<boolean>;
  recoverAccount: () => Promise<void>;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

export default function AppLockProvider({ children }: { children: ReactNode }) {
  const { user, booting, clearLocalSession } = useAuth();
  const accountId = useMemo(() => getAppLockAccountId(user), [user]);
  const [loadedAccountId, setLoadedAccountId] = useState<string | null>(null);
  const [phase, setPhase] = useState<AppLockPhase>("loading");
  const [record, setRecord] = useState<AppLockRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("المصادقة الحيوية");

  const recordRef = useRef<AppLockRecord | null>(null);
  const biometricPromptRef = useRef(false);
  const suppressAppStateLockUntilRef = useRef(0);
  const previousAppStateRef = useRef<AppStateStatus>(AppState.currentState);

  const replaceRecord = useCallback((next: AppLockRecord | null) => {
    recordRef.current = next;
    setRecord(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [hasHardware, enrolled, supportedTypes] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        if (cancelled) return;

        setBiometricsAvailable(hasHardware && enrolled);
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricLabel("التعرّف على الوجه");
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricLabel("بصمة الإصبع");
        }
      } catch {
        if (!cancelled) setBiometricsAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (booting) return;

    if (!user) {
      setLoadedAccountId(null);
      replaceRecord(null);
      setErrorMessage(null);
      setPhase("disabled");
      return;
    }

    if (!accountId) {
      setLoadedAccountId(null);
      replaceRecord(null);
      setErrorMessage("تعذّر ربط قفل التطبيق بهذا الحساب بأمان.");
      setPhase("error");
      return;
    }

    let cancelled = false;
    setLoadedAccountId(accountId);
    replaceRecord(null);
    setErrorMessage(null);
    setPhase("loading");

    void loadAppLockRecord(accountId)
      .then((result) => {
        if (cancelled) return;

        if (result.status === "missing") {
          setPhase("enrolling");
          return;
        }

        if (result.status === "corrupt") {
          setErrorMessage("بيانات قفل التطبيق غير صالحة. سجّل الدخول من جديد لاستعادة الوصول بأمان.");
          setPhase("error");
          return;
        }

        replaceRecord(result.record);
        setPhase("locked");
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage("تعذّر الوصول إلى التخزين الآمن. لم يتم فتح الحساب.");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, booting, replaceRecord, user]);

  const forceLock = useCallback(() => {
    if (!recordRef.current) return;
    setPhase((current) => current === "unlocked" ? "locked" : current);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = previousAppStateRef.current;
      previousAppStateRef.current = nextState;

      const isLeaving = nextState === "inactive" || nextState === "background";
      const isReturning = nextState === "active"
        && (previousState === "inactive" || previousState === "background");
      const biometricTransition = biometricPromptRef.current
        || Date.now() < suppressAppStateLockUntilRef.current;

      if ((isLeaving || isReturning) && !biometricTransition) forceLock();
    });

    return () => subscription.remove();
  }, [forceLock]);

  const enroll = useCallback(async (pin: string, enableBiometrics: boolean) => {
    if (!accountId || loadedAccountId !== accountId || phase !== "enrolling") {
      throw new Error("App lock enrollment is not available.");
    }

    try {
      const next = await createAppLockRecord(
        accountId,
        pin,
        enableBiometrics && biometricsAvailable,
      );
      replaceRecord(next);
      setErrorMessage(null);
      setPhase("unlocked");
    } catch (error) {
      setErrorMessage("تعذّر حفظ رمز القفل في التخزين الآمن.");
      setPhase("error");
      throw error;
    }
  }, [accountId, biometricsAvailable, loadedAccountId, phase, replaceRecord]);

  const unlockWithPin = useCallback(async (pin: string): Promise<PinUnlockResult> => {
    const current = recordRef.current;
    if (!accountId || !current || loadedAccountId !== accountId) {
      return { ok: false, reason: "storage-error", failedAttempts: 0, lockedUntil: 0 };
    }

    if (getLockoutRemainingMs(current) > 0) {
      return {
        ok: false,
        reason: "rate-limited",
        failedAttempts: current.failedAttempts,
        lockedUntil: current.lockedUntil,
      };
    }

    try {
      const matches = await verifyAppLockPin(accountId, pin, current);
      if (matches) {
        const next = { ...current, ...resetRateLimit() };
        await saveAppLockRecord(accountId, next);
        replaceRecord(next);
        setPhase("unlocked");
        return { ok: true, failedAttempts: 0, lockedUntil: 0 };
      }

      const rateLimit = recordFailedAttempt(current);
      const next = { ...current, ...rateLimit };
      await saveAppLockRecord(accountId, next);
      replaceRecord(next);
      return {
        ok: false,
        reason: "invalid",
        failedAttempts: next.failedAttempts,
        lockedUntil: next.lockedUntil,
      };
    } catch {
      setErrorMessage("تعذّر التحقق من رمز القفل بأمان.");
      setPhase("error");
      return {
        ok: false,
        reason: "storage-error",
        failedAttempts: current.failedAttempts,
        lockedUntil: current.lockedUntil,
      };
    }
  }, [accountId, loadedAccountId, replaceRecord]);

  const unlockWithBiometrics = useCallback(async () => {
    const current = recordRef.current;
    if (
      !accountId
      || !current?.biometricsEnabled
      || !biometricsAvailable
      || biometricPromptRef.current
    ) {
      return false;
    }

    biometricPromptRef.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "فتح تطبيق Stark Card",
        cancelLabel: "إلغاء",
        fallbackLabel: "استخدام رمز التطبيق",
        disableDeviceFallback: true,
      });
      if (!result.success) return false;

      const next = { ...current, ...resetRateLimit() };
      await saveAppLockRecord(accountId, next);
      replaceRecord(next);
      setPhase("unlocked");
      return true;
    } catch {
      return false;
    } finally {
      biometricPromptRef.current = false;
      suppressAppStateLockUntilRef.current = Date.now() + 1_000;
    }
  }, [accountId, biometricsAvailable, replaceRecord]);

  const recoverAccount = useCallback(async () => {
    const accountToClear = accountId;

    // End the authenticated session first. If deletion fails or the process is
    // interrupted, protected account data is still never exposed.
    await clearLocalSession();
    if (accountToClear) await removeAppLockRecord(accountToClear);
  }, [accountId, clearLocalSession]);

  const effectivePhase: AppLockPhase = booting
    ? "loading"
    : user && (!accountId || loadedAccountId !== accountId)
      ? "loading"
      : phase;

  const value = useMemo<AppLockContextValue>(() => ({
    phase: effectivePhase,
    failedAttempts: record?.failedAttempts ?? 0,
    lockedUntil: record?.lockedUntil ?? 0,
    errorMessage,
    biometricsAvailable,
    biometricsEnabled: Boolean(record?.biometricsEnabled),
    biometricLabel,
    enroll,
    unlockWithPin,
    unlockWithBiometrics,
    recoverAccount,
  }), [
    biometricLabel,
    biometricsAvailable,
    effectivePhase,
    enroll,
    errorMessage,
    record?.biometricsEnabled,
    record?.failedAttempts,
    record?.lockedUntil,
    recoverAccount,
    unlockWithBiometrics,
    unlockWithPin,
  ]);

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (!context) throw new Error("useAppLock must be used inside AppLockProvider");
  return context;
}
