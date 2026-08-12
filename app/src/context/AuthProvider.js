// src/context/AuthProvider.js
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  clearAuthStorage,
  getAccessToken,
  getBootDoneForUser,
  getRefreshToken,
  getUserSession,
  removeUserSession,
  setAccessToken,
  setBootDoneForUser,
  setCompatibleUserSession,
  setRefreshToken,
} from "../shared/storage/authStorage";
import { refreshTokenNormalized } from "../features/auth/api/authApi";
import { getCurrentUserNormalized } from "../features/profile/api/profileApi";
import { apiLogout } from "../api/auth";
import { subscribeAuthFailure } from "../api/client";

// مفاتيح توافقية اختيارية (SideMenu بيحاول يقراها)
// ⬇️ لافتة عالمية تشخّص النداء المبكر لـ useAuth()
if (typeof globalThis.__AUTH_CTX_MOUNTED === "undefined") {
  globalThis.__AUTH_CTX_MOUNTED = false;
}

async function runPostLoginBootIfNeeded(userObj) {
  try {
    const uid = userObj?.id || userObj?.user?.id || null;
    const already = await getBootDoneForUser(uid);
    if (already === "1") return;

    // ⬅️ استيراد كسول لمنع أي دورة استيراد محتملة
    const { postLoginBoot } = await import("../utils/postLoginBoot");
    await postLoginBoot();

    await setBootDoneForUser(uid);
  } catch {}
}

const AuthCtx = createContext(null);

function isValidTokenString(s) {
  return typeof s === "string" && s.trim() !== "" && s !== "undefined" && s !== "null";
}

function isNetworkError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return !err?.response && (msg.includes("network") || msg.includes("timeout") || msg.includes("failed"));
}

async function tryRefreshAccess() {
  const refresh = await getRefreshToken();
  if (!isValidTokenString(refresh)) return null;
  try {
    const result = await refreshTokenNormalized(refresh);
    if (!result.ok) return null;
    const data = result.data;
    const newAccess = data?.access;
    if (isValidTokenString(newAccess)) {
      await setAccessToken(newAccess);
      if (isValidTokenString(data?.refresh)) await setRefreshToken(data.refresh);
      return newAccess;
    }
    return null;
  } catch {
    return null;
  }
}

/** توحيد الحقول القادمة من الباك */
function normalizeUser(u) {
  if (!u || typeof u !== "object") return null;

  const base = (u.user && typeof u.user === "object") ? u.user : u;

  const first = base.first_name || base.firstName || "";
  const last = base.last_name || base.lastName || "";

  const fullName =
    base.full_name ||
    base.name ||
    [first, last].filter(Boolean).join(" ") ||
    base.username ||
    base.email ||
    "";

  const role =
    base.role ||
    u.role ||
    base?.profile?.role ||
    u?.profile?.role ||
    null;

  const agent_profile =
    base.agent_profile ||
    u.agent_profile ||
    base?.profile?.agent_profile ||
    u?.profile?.agent_profile ||
    null;

  const roles = base.roles || u.roles || base.groups || u.groups || [];
  const groups = base.groups || u.groups || [];
  const permissions = base.permissions || u.permissions || [];

  const is_agent =
    base.is_agent === true ||
    u.is_agent === true ||
    role === "agent" ||
    Boolean(agent_profile && (agent_profile.id || agent_profile.code || agent_profile.agent_code));

  const agent_code = base.agent_code || base.agentCode || u.agent_code || u.agentCode || null;

  return {
    id: base.id ?? base.pk ?? null,
    username: base.username ?? "",
    email: base.email ?? "",
    first_name: first,
    last_name: last,
    full_name: fullName,
    name: fullName,
    phone: base.phone ?? base.phone_number ?? "",
    avatar: base.avatar ?? base.image ?? null,

    role,
    is_agent,
    roles: Array.isArray(roles) ? roles : [],
    groups: Array.isArray(groups) ? groups : [],
    permissions: Array.isArray(permissions) ? permissions : [],
    agent_profile: agent_profile || null,
    agent: agent_profile || null,
    agent_code,

    raw: u,
  };
}

async function saveUserToStorage(user) {
  if (!user) {
    await removeUserSession();
    return;
  }
  try {
    await setCompatibleUserSession(user);
    // توافق مع أكواد أقدم
  } catch {}
}

async function loadUserFromStorage() {
  return getUserSession();
}

function MountFlagSetter() {
  useEffect(() => {
    globalThis.__AUTH_CTX_MOUNTED = true;
    return () => {
      globalThis.__AUTH_CTX_MOUNTED = false;
    };
  }, []);
  return null;
}

export default function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null); // null => خارج / object => داخل

  useEffect(() => subscribeAuthFailure(() => {
    clearAuthStorage().finally(() => setUser(null));
  }), []);

  /** جلب البروفايل من الباك (مع التوكن إن لزم) */
  const fetchProfile = useCallback(async (accessMaybe) => {
    void accessMaybe;
    try {
      const result = await getCurrentUserNormalized();
      if (!result.ok) {
        const error = result.error;
        return error.status
          ? { message: error.message, response: { status: error.status, data: error.details } }
          : error;
      }
      const res = result.data;
      const profile = res?.data ?? res;
      return normalizeUser(profile);
    } catch (e) {
      return e;
    }
  }, []);

  /** Hydration أولي */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) حمل المستخدم المخزّن سريعًا لتحسين الـ UX
        // 2) تحقق من التوكن وجدّد البروفايل
        const access = await getAccessToken();
        const cached = await loadUserFromStorage();
        if (isValidTokenString(access)) {
          const freshOrErr = await fetchProfile(access);
          if (alive) {
            if (freshOrErr && !freshOrErr?.response) {
              const finalUser = { ...freshOrErr, token: access };
              setUser(finalUser);
              await saveUserToStorage(finalUser);
              await runPostLoginBootIfNeeded(finalUser); // بووت لمرة واحدة بعد استرجاع جلسة
            } else if (isNetworkError(freshOrErr)) {
              if (cached) setUser(cached);
            } else {
              const newAccess = await tryRefreshAccess();
              if (newAccess) {
                const fresh2 = await fetchProfile(newAccess);
                if (fresh2 && !fresh2?.response) {
                  const finalUser = { ...fresh2, token: newAccess };
                  setUser(finalUser);
                  await saveUserToStorage(finalUser);
                  await runPostLoginBootIfNeeded(finalUser);
                } else if (isNetworkError(fresh2)) {
                  if (cached) setUser(cached);
                } else {
                  await clearAuthStorage();
                  setUser(null);
                }
              } else {
                await clearAuthStorage();
                setUser(null);
              }
            }
          }
        } else {
          const newAccess = await tryRefreshAccess();
          if (newAccess) {
            const fresh2 = await fetchProfile(newAccess);
            if (fresh2 && !fresh2?.response) {
              const finalUser = { ...fresh2, token: newAccess };
              setUser(finalUser);
              await saveUserToStorage(finalUser);
              await runPostLoginBootIfNeeded(finalUser);
            } else if (isNetworkError(fresh2)) {
              if (cached) setUser(cached);
            } else {
              await clearAuthStorage();
              if (alive) setUser(null);
            }
          } else {
            // لا توكن: نظافة
            await clearAuthStorage();
            if (alive) setUser(null);
          }
        }
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchProfile]);

  /** تسجيل الدخول */
  const signIn = useCallback(
    async ({ user: uFromCall, profile, access, refresh }) => {
      if (!isValidTokenString(access)) throw new Error("Missing access token");

      await setAccessToken(access);
      if (isValidTokenString(refresh)) await setRefreshToken(refresh);

      // في حال ما وصلنا بيانات user ضمن الاستجابة، نطلب /me
      let normalized = normalizeUser(uFromCall || profile);
      if (!normalized) {
        normalized = await fetchProfile(access);
      }
      const finalUser = normalized ? { ...normalized, token: access } : { token: access };

      setUser(finalUser);
      await saveUserToStorage(finalUser);

      // تشغيل البووت مباشرة بعد تسجيل الدخول
      await runPostLoginBootIfNeeded(finalUser);

      return finalUser;
    },
    [fetchProfile]
  );

  /** تسجيل الخروج */
  const signOut = useCallback(async () => {
    const refresh = await getRefreshToken();
    try {
      if (isValidTokenString(refresh)) await apiLogout(refresh);
    } finally {
      await clearAuthStorage();
      setUser(null);
    }
  }, []);

  /** تحديث البروفايل يدويًا */
  const refreshUser = useCallback(async () => {
    let access = await getAccessToken();
    if (!isValidTokenString(access)) {
      access = await tryRefreshAccess();
    }
    if (!isValidTokenString(access)) return null;
    const freshOrErr = await fetchProfile(access);
    if (!freshOrErr || freshOrErr?.response) return null;
    const finalUser = { ...freshOrErr, token: access };
    setUser(finalUser);
    await saveUserToStorage(finalUser);
    return finalUser;
  }, [fetchProfile]);

  /** تحديث محلي سريع */
  const setUserUnsafe = useCallback(async (partial) => {
    if (!partial) return;
    setUser((prev) => {
      const mergedRaw = { ...(prev?.raw || {}), ...(partial.raw || partial) };
      const normalized = normalizeUser(mergedRaw) || {};
      const merged = { ...(prev || {}), ...normalized, ...partial };
      if (prev?.token && !merged.token) merged.token = prev.token;
      saveUserToStorage(merged);
      return merged;
    });
  }, []);

  const value = useMemo(
    () => ({ user, booting, signIn, signOut, refreshUser, setUserUnsafe }),
    [user, booting, signIn, signOut, refreshUser, setUserUnsafe]
  );

  return (
    <AuthCtx.Provider value={value}>
      <MountFlagSetter />
      {children}
    </AuthCtx.Provider>
  );
}

// Hook آمن: يرمي خطأ فقط إذا كان خارج <AuthProvider>
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (ctx == null) {
    const err = new Error("useAuth must be used inside <AuthProvider>");
    // هذا سيطبع أسماء الملفات والأسطر في DevTools/Chrome
    console.error(err.stack);
    throw err;
  }
  return ctx;
};

/**
 * Hook مساعد للتحقق من حالة المستخدم
 * @returns {boolean} - هل المستخدم مسجل دخول؟
 */
export const useIsLoggedIn = () => {
  const { user } = useAuth();
  return !!user && !!user.id;
};

/**
 * Hook مساعد للتحقق من حالة التحميل
 * @returns {boolean} - هل التطبيق جاري تحميل البيانات؟
 */
export const useIsAuthBooting = () => {
  const { booting } = useAuth();
  return booting;
};
