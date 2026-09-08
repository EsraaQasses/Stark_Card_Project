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

import {
  refreshTokenNormalized,
} from "../features/auth/api/authApi";

import {
  getCurrentUserNormalized,
} from "../features/profile/api/profileApi";

import {
  apiLogout,
} from "../api/auth";

import {
  subscribeAuthFailure,
} from "../api/client";


// ==============================
// Global auth mounted flag
// ==============================

if (
  typeof globalThis.__AUTH_CTX_MOUNTED
  === "undefined"
) {
  globalThis.__AUTH_CTX_MOUNTED = false;
}


// ==============================
// Post login boot
// ==============================

async function runPostLoginBootIfNeeded(
  userObj,
) {
  try {
    const uid =
      userObj?.id
      || userObj?.user?.id
      || null;

    const already =
      await getBootDoneForUser(uid);

    if (already === "1") {
      return;
    }

    const {
      postLoginBoot,
    } = await import(
      "../utils/postLoginBoot"
    );

    await postLoginBoot();

    await setBootDoneForUser(uid);
  } catch {
    // ما منوقف التطبيق إذا فشل تحميل
    // بيانات إضافية مثل المحافظ أو QR.
  }
}


// ==============================
// Context
// ==============================

const AuthCtx =
  createContext(null);


// ==============================
// Helpers
// ==============================

function isValidTokenString(
  value,
) {
  return (
    typeof value === "string"
    && value.trim() !== ""
    && value !== "undefined"
    && value !== "null"
  );
}


function isNetworkError(
  error,
) {
  const message = String(
    error?.message || "",
  ).toLowerCase();

  return (
    !error?.response
    && (
      message.includes("network")
      || message.includes("timeout")
      || message.includes("failed")
    )
  );
}


function isValidUserObject(
  value,
) {
  if (
    !value
    || typeof value !== "object"
  ) {
    return false;
  }

  /*
   * fetchProfile بيرجع User normalized
   * وفيه raw بحالة النجاح.
   */
  return (
    "raw" in value
    || "id" in value
    || "email" in value
    || "username" in value
  );
}


// ==============================
// Refresh access token
// ==============================

async function tryRefreshAccess() {
  const refresh =
    await getRefreshToken();

  if (
    !isValidTokenString(refresh)
  ) {
    return null;
  }

  try {
    const result =
      await refreshTokenNormalized(
        refresh,
      );

    if (!result.ok) {
      return null;
    }

    const data =
      result.data;

    const newAccess =
      data?.access;

    if (
      !isValidTokenString(
        newAccess,
      )
    ) {
      return null;
    }

    await setAccessToken(
      newAccess,
    );

    if (
      isValidTokenString(
        data?.refresh,
      )
    ) {
      await setRefreshToken(
        data.refresh,
      );
    }

    return newAccess;

  } catch {
    return null;
  }
}


// ==============================
// Normalize user
// ==============================

function normalizeUser(
  userData,
) {
  if (
    !userData
    || typeof userData !== "object"
  ) {
    return null;
  }

  const base = (
    userData.user
    && typeof userData.user === "object"
  )
    ? userData.user
    : userData;


  const first =
    base.first_name
    || base.firstName
    || "";


  const last =
    base.last_name
    || base.lastName
    || "";


  const fullName =
    base.full_name
    || base.name
    || [first, last]
      .filter(Boolean)
      .join(" ")
    || base.username
    || base.email
    || "";


  const role =
    base.role
    || userData.role
    || base?.profile?.role
    || userData?.profile?.role
    || null;


  const agentProfile =
    base.agent_profile
    || userData.agent_profile
    || base?.profile?.agent_profile
    || userData?.profile?.agent_profile
    || null;


  const roles =
    base.roles
    || userData.roles
    || base.groups
    || userData.groups
    || [];


  const groups =
    base.groups
    || userData.groups
    || [];


  const permissions =
    base.permissions
    || userData.permissions
    || [];


  const isAgent =
    base.is_agent === true
    || userData.is_agent === true
    || role === "agent"
    || Boolean(
      agentProfile
      && (
        agentProfile.id
        || agentProfile.code
        || agentProfile.agent_code
      )
    );


  const agentCode =
    base.agent_code
    || base.agentCode
    || userData.agent_code
    || userData.agentCode
    || null;


  return {
    id:
      base.id
      ?? base.pk
      ?? null,

    username:
      base.username
      ?? "",

    email:
      base.email
      ?? "",

    first_name:
      first,

    last_name:
      last,

    full_name:
      fullName,

    name:
      fullName,

    phone:
      base.phone
      ?? base.phone_number
      ?? "",

    avatar:
      base.avatar
      ?? base.image
      ?? null,

    role,

    is_agent:
      isAgent,

    roles:
      Array.isArray(roles)
        ? roles
        : [],

    groups:
      Array.isArray(groups)
        ? groups
        : [],

    permissions:
      Array.isArray(
        permissions,
      )
        ? permissions
        : [],

    agent_profile:
      agentProfile || null,

    agent:
      agentProfile || null,

    agent_code:
      agentCode,

    raw:
      userData,
  };
}


// ==============================
// User storage
// ==============================

async function saveUserToStorage(
  user,
) {
  if (!user) {
    await removeUserSession();
    return;
  }

  try {
    await setCompatibleUserSession(
      user,
    );
  } catch {
    // التخزين المحلي ما لازم يوقف التطبيق.
  }
}


async function loadUserFromStorage() {
  return getUserSession();
}


// ==============================
// Mount flag
// ==============================

function MountFlagSetter() {
  useEffect(() => {
    globalThis.__AUTH_CTX_MOUNTED =
      true;

    return () => {
      globalThis.__AUTH_CTX_MOUNTED =
        false;
    };
  }, []);

  return null;
}


// ==============================
// Auth Provider
// ==============================

export default function AuthProvider({
  children,
}) {
  const [
    booting,
    setBooting,
  ] = useState(true);


  const [
    user,
    setUser,
  ] = useState(null);


  // ============================
  // Global auth failure
  // ============================

  useEffect(
    () => (
      subscribeAuthFailure(() => {
        void clearAuthStorage()
          .finally(() => {
            setUser(null);
          });
      })
    ),
    [],
  );


  // ============================
  // Fetch profile
  // ============================

  const fetchProfile =
    useCallback(
      async (
        accessMaybe,
      ) => {
        void accessMaybe;

        try {
          const result =
            await getCurrentUserNormalized();


          if (!result.ok) {
            const error =
              result.error;

            return error.status
              ? {
                  message:
                    error.message,

                  response: {
                    status:
                      error.status,

                    data:
                      error.details,
                  },
                }
              : error;
          }


          const response =
            result.data;

          const profile =
            response?.data
            ?? response;

          return normalizeUser(
            profile,
          );

        } catch (error) {
          return error;
        }
      },
      [],
    );


  // ============================
  // Initial hydration
  // ============================

  useEffect(() => {
    let alive = true;


    /*
     * تطبيق مستخدم جديد قادم من السيرفر.
     */
    const applyFreshUser =
      async (
        freshUser,
        accessToken,
      ) => {
        if (
          !alive
          || !isValidUserObject(
            freshUser,
          )
        ) {
          return false;
        }


        const finalUser = {
          ...freshUser,
          token: accessToken,
        };


        setUser(
          finalUser,
        );


        await saveUserToStorage(
          finalUser,
        );


        /*
         * مهم:
         * QR + Wallets + postLoginBoot
         * يصيروا بالخلفية.
         *
         * ما عاد ننتظرهم حتى يفتح التطبيق.
         */
        void runPostLoginBootIfNeeded(
          finalUser,
        );


        return true;
      };


    /*
     * تحديث الجلسة بالخلفية بعد ما ندخل
     * المستخدم مباشرة من البيانات المخزنة.
     */
    const refreshSessionInBackground =
      async (
        accessToken,
        cachedUser,
      ) => {
        try {
          let currentAccess =
            accessToken;


          // نجرب التوكن الحالي أولاً
          const freshOrErr =
            await fetchProfile(
              currentAccess,
            );


          if (!alive) {
            return;
          }


          /*
           * إذا النت ضعيف أو السيرفر غير متاح،
           * منضل على المستخدم المخزن محلياً.
           */
          if (
            isNetworkError(
              freshOrErr,
            )
          ) {
            return;
          }


          /*
           * التوكن صالح والبروفايل رجع بنجاح.
           */
          if (
            isValidUserObject(
              freshOrErr,
            )
          ) {
            await applyFreshUser(
              freshOrErr,
              currentAccess,
            );

            return;
          }


          /*
           * احتمال access token منتهي.
           * منجرب refresh token.
           */
          const newAccess =
            await tryRefreshAccess();


          if (!alive) {
            return;
          }


          if (
            isValidTokenString(
              newAccess,
            )
          ) {
            currentAccess =
              newAccess;


            const freshAfterRefresh =
              await fetchProfile(
                currentAccess,
              );


            if (!alive) {
              return;
            }


            if (
              isNetworkError(
                freshAfterRefresh,
              )
            ) {
              return;
            }


            if (
              isValidUserObject(
                freshAfterRefresh,
              )
            ) {
              await applyFreshUser(
                freshAfterRefresh,
                currentAccess,
              );

              return;
            }
          }


          /*
           * إذا وصلنا لهون:
           * الجلسة فعلياً غير صالحة.
           */
          await clearAuthStorage();


          if (alive) {
            setUser(null);
          }

        } catch (error) {
          /*
           * إذا صار خطأ غير متوقع أثناء تحديث
           * الخلفية، لا نطرد المستخدم مباشرة.
           */
          if (__DEV__) {
            console.warn(
              "Background auth refresh failed:",
              error,
            );
          }


          if (
            cachedUser
            && alive
          ) {
            setUser(
              cachedUser,
            );
          }
        }
      };


    // ==========================
    // Start app boot
    // ==========================

    (async () => {
      try {
        const access =
          await getAccessToken();


        const cached =
          await loadUserFromStorage();


        if (!alive) {
          return;
        }


        /*
         * ====================================
         * الحالة الأسرع:
         *
         * المستخدم مسجل دخول من قبل
         * وعندنا User + Access محفوظين.
         *
         * ندخله مباشرة.
         * ====================================
         */
        if (
          cached
          && isValidTokenString(
            access,
          )
        ) {
          const localUser = {
            ...cached,
            token: access,
          };


          setUser(
            localUser,
          );


          /*
           * أهم تعديل:
           *
           * ما عاد ننتظر API حتى نفتح التطبيق.
           */
          setBooting(false);


          /*
           * نتحقق من الحساب والتوكن بالخلفية.
           */
          void refreshSessionInBackground(
            access,
            localUser,
          );


          return;
        }


        /*
         * ====================================
         * إذا ما عندنا جلسة محلية جاهزة.
         * ====================================
         */

        let activeAccess =
          access;


        /*
         * ما في access؟
         * نجرب refresh token.
         */
        if (
          !isValidTokenString(
            activeAccess,
          )
        ) {
          activeAccess =
            await tryRefreshAccess();
        }


        if (!alive) {
          return;
        }


        /*
         * لا access ولا refresh صالح.
         * المستخدم خارج الحساب.
         */
        if (
          !isValidTokenString(
            activeAccess,
          )
        ) {
          await clearAuthStorage();


          if (alive) {
            setUser(null);
          }


          return;
        }


        /*
         * عندنا token لكن ما عندنا cached user.
         * لازم نجيب البروفايل مرة.
         */
        const freshOrErr =
          await fetchProfile(
            activeAccess,
          );


        if (!alive) {
          return;
        }


        /*
         * لو النت فاصل وكان عندنا cached
         * بأي شكل، نستعمله.
         */
        if (
          isNetworkError(
            freshOrErr,
          )
        ) {
          if (cached) {
            setUser({
              ...cached,
              token: activeAccess,
            });
          }


          return;
        }


        /*
         * البروفايل رجع بنجاح.
         */
        if (
          isValidUserObject(
            freshOrErr,
          )
        ) {
          await applyFreshUser(
            freshOrErr,
            activeAccess,
          );


          return;
        }


        /*
         * التوكن غير صالح.
         */
        await clearAuthStorage();


        if (alive) {
          setUser(null);
        }

      } catch (error) {
        console.warn(
          "Auth boot failed:",
          error,
        );

      } finally {
        /*
         * بالحالة cached:
         * setBooting(false)
         * صار فوق مباشرة.
         *
         * بباقي الحالات يصير هون.
         */
        if (alive) {
          setBooting(false);
        }
      }
    })();


    return () => {
      alive = false;
    };
  }, [
    fetchProfile,
  ]);


  // ==============================
  // Sign in
  // ==============================

  const signIn =
    useCallback(
      async ({
        user: userFromCall,
        profile,
        access,
        refresh,
      }) => {
        if (
          !isValidTokenString(
            access,
          )
        ) {
          throw new Error(
            "Missing access token",
          );
        }


        await setAccessToken(
          access,
        );


        if (
          isValidTokenString(
            refresh,
          )
        ) {
          await setRefreshToken(
            refresh,
          );
        }


        /*
         * إذا login رجع بيانات المستخدم
         * نستعملها مباشرة.
         */
        let normalized =
          normalizeUser(
            userFromCall
            || profile,
          );


        /*
         * إذا login ما رجع profile كامل،
         * نطلب /me.
         */
        if (!normalized) {
          const fetched =
            await fetchProfile(
              access,
            );


          if (
            isValidUserObject(
              fetched,
            )
          ) {
            normalized =
              fetched;
          }
        }


        const finalUser =
          normalized
            ? {
                ...normalized,
                token: access,
              }
            : {
                token: access,
              };


        setUser(
          finalUser,
        );


        await saveUserToStorage(
          finalUser,
        );


        /*
         * مهم:
         *
         * لا ننتظر postLoginBoot.
         * يتم تشغيله بالخلفية.
         */
        void runPostLoginBootIfNeeded(
          finalUser,
        );


        return finalUser;
      },
      [
        fetchProfile,
      ],
    );


  // ==============================
  // Sign out
  // ==============================

  const signOut =
    useCallback(
      async () => {
        const refresh =
          await getRefreshToken();


        try {
          if (
            isValidTokenString(
              refresh,
            )
          ) {
            await apiLogout(
              refresh,
            );
          }

        } finally {
          await clearAuthStorage();

          setUser(null);
        }
      },
      [],
    );


  // ==============================
  // Manual profile refresh
  // ==============================

  const refreshUser =
    useCallback(
      async () => {
        let access =
          await getAccessToken();


        if (
          !isValidTokenString(
            access,
          )
        ) {
          access =
            await tryRefreshAccess();
        }


        if (
          !isValidTokenString(
            access,
          )
        ) {
          return null;
        }


        const freshOrErr =
          await fetchProfile(
            access,
          );


        if (
          !isValidUserObject(
            freshOrErr,
          )
        ) {
          return null;
        }


        const finalUser = {
          ...freshOrErr,
          token: access,
        };


        setUser(
          finalUser,
        );


        await saveUserToStorage(
          finalUser,
        );


        return finalUser;
      },
      [
        fetchProfile,
      ],
    );


  // ==============================
  // Local user update
  // ==============================

  const setUserUnsafe =
    useCallback(
      async (
        partial,
      ) => {
        if (!partial) {
          return;
        }


        setUser(
          (previous) => {
            const mergedRaw = {
              ...(previous?.raw || {}),
              ...(partial.raw || partial),
            };


            const normalized =
              normalizeUser(
                mergedRaw,
              ) || {};


            const merged = {
              ...(previous || {}),
              ...normalized,
              ...partial,
            };


            if (
              previous?.token
              && !merged.token
            ) {
              merged.token =
                previous.token;
            }


            /*
             * ما لازم نوقف الـstate update
             * بانتظار التخزين.
             */
            void saveUserToStorage(
              merged,
            );


            return merged;
          },
        );
      },
      [],
    );


  // ==============================
  // Context value
  // ==============================

  const value =
    useMemo(
      () => ({
        user,
        booting,
        signIn,
        signOut,
        refreshUser,
        setUserUnsafe,
      }),
      [
        user,
        booting,
        signIn,
        signOut,
        refreshUser,
        setUserUnsafe,
      ],
    );


  return (
    <AuthCtx.Provider
      value={value}
    >
      <MountFlagSetter />

      {children}
    </AuthCtx.Provider>
  );
}


// ==============================
// useAuth
// ==============================

export const useAuth = () => {
  const ctx =
    useContext(
      AuthCtx,
    );


  if (ctx == null) {
    const error =
      new Error(
        "useAuth must be used inside <AuthProvider>",
      );


    console.error(
      error.stack,
    );


    throw error;
  }


  return ctx;
};


// ==============================
// Helpers hooks
// ==============================

export const useIsLoggedIn = () => {
  const {
    user,
  } = useAuth();


  return (
    !!user
    && !!user.id
  );
};


export const useIsAuthBooting = () => {
  const {
    booting,
  } = useAuth();


  return booting;
};