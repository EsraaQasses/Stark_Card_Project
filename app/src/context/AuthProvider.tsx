// src/context/AuthProvider.tsx
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
    ReactNode,
} from "react";
import { refreshTokenNormalized } from "../features/auth/api/authApi";
import { getCurrentUserNormalized } from "../features/profile/api/profileApi";
import {
    clearAuthStorage,
    getAccessToken,
    getBootDoneForUser,
    getRefreshToken,
    getUserSession,
    removeAccessAndRefreshTokens,
    removeUserSession,
    setAccessToken,
    setBootDoneForUser,
    setCompatibleUserSession,
    setRefreshToken,
} from "../shared/storage/authStorage";

declare global {
    var __AUTH_CTX_MOUNTED: boolean | undefined;
}

if (typeof globalThis.__AUTH_CTX_MOUNTED === "undefined") {
    globalThis.__AUTH_CTX_MOUNTED = false;
}

async function runPostLoginBootIfNeeded(userObj: any) {
    try {
        const uid = userObj?.id || userObj?.user?.id || null;
        const already = await getBootDoneForUser(uid);
        if (already === "1") return;

        // @ts-ignore
        const { postLoginBoot } = await import("../utils/postLoginBoot");
        await postLoginBoot();

        await setBootDoneForUser(uid);
    } catch { }
}

export interface User {
    id: string | number | null;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    name: string;
    phone: string;
    avatar: string | null;
    role: string | null;
    is_agent: boolean;
    roles: string[];
    groups: string[];
    permissions: string[];
    agent_profile: any | null;
    agent: any | null;
    agent_code: string | null;
    token?: string;
    raw: any;
}

function normalizeUser(u: any): User | null {
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
        base.agent ||
        u.agent ||
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

async function saveUserToStorage(user: User | null) {
    if (!user) {
        await removeUserSession();
        return;
    }
    try {
        await setCompatibleUserSession(user);
    } catch { }
}

async function loadUserFromStorage(): Promise<User | null> {
    return getUserSession<User>();
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

interface AuthContextType {
    user: User | null;
    booting: boolean;
    signIn: (data: { user?: any; profile?: any; access: string; refresh?: string }) => Promise<User>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<User | null>;
    setUserUnsafe: (partial: any) => Promise<void>;
}

const AuthCtx = createContext<AuthContextType | null>(null);

function isValidTokenString(s: any): s is string {
    return typeof s === "string" && s.trim() !== "" && s !== "undefined" && s !== "null";
}

function isNetworkError(err: any) {
    const msg = String(err?.message || "").toLowerCase();
    return !err?.response && (msg.includes("network") || msg.includes("timeout") || msg.includes("failed"));
}

async function tryRefreshAccess(): Promise<string | null> {
    const refresh = await getRefreshToken();
    if (!isValidTokenString(refresh)) return null;
    try {
        const result = await refreshTokenNormalized(refresh);
        if (!result.ok) return null;
        const data = result.data;
        const newAccess = data?.access;
        if (isValidTokenString(newAccess)) {
            await setAccessToken(newAccess);
            return newAccess;
        }
        return null;
    } catch {
        return null;
    }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [booting, setBooting] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    const fetchProfile = useCallback(async (accessMaybe?: string) => {
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
            return e as any;
        }
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const cachedUser = await loadUserFromStorage();
                if (alive && cachedUser) setUser(cachedUser);

                const access = await getAccessToken();
                const cached = await loadUserFromStorage();
                if (isValidTokenString(access)) {
                    const freshOrErr: any = await fetchProfile(access);
                    if (alive) {
                        if (freshOrErr && !freshOrErr?.response) {
                            const finalUser = { ...freshOrErr, token: access };
                            setUser(finalUser);
                            await saveUserToStorage(finalUser);
                            await runPostLoginBootIfNeeded(finalUser);
                        } else if (isNetworkError(freshOrErr)) {
                            if (cached) setUser(cached);
                        } else {
                            const newAccess = await tryRefreshAccess();
                            if (newAccess) {
                                const fresh2: any = await fetchProfile(newAccess);
                                if (fresh2 && !fresh2?.response) {
                                    const finalUser = { ...fresh2, token: newAccess };
                                    setUser(finalUser);
                                    await saveUserToStorage(finalUser);
                                    await runPostLoginBootIfNeeded(finalUser);
                                } else if (isNetworkError(fresh2)) {
                                    if (cached) setUser(cached);
                                } else {
                                    await removeAccessAndRefreshTokens();
                                    await removeUserSession();
                                    setUser(null);
                                }
                            } else {
                                await removeAccessAndRefreshTokens();
                                await removeUserSession();
                                setUser(null);
                            }
                        }
                    }
                } else {
                    const newAccess = await tryRefreshAccess();
                    if (newAccess) {
                        const fresh2: any = await fetchProfile(newAccess);
                        if (fresh2 && !fresh2?.response) {
                            const finalUser = { ...fresh2, token: newAccess };
                            setUser(finalUser);
                            await saveUserToStorage(finalUser);
                            await runPostLoginBootIfNeeded(finalUser);
                        } else if (isNetworkError(fresh2)) {
                            if (cached) setUser(cached);
                        } else {
                            await removeAccessAndRefreshTokens();
                            await removeUserSession();
                            if (alive) setUser(null);
                        }
                    } else {
                        await removeUserSession();
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

    const signIn = useCallback(
        async ({ user: uFromCall, profile, access, refresh }: { user?: any; profile?: any; access: string; refresh?: string }) => {
            if (!isValidTokenString(access)) throw new Error("Missing access token");

            await setAccessToken(access);
            if (isValidTokenString(refresh)) await setRefreshToken(refresh);

            let normalized = normalizeUser(uFromCall || profile);
            if (!normalized) {
                normalized = await fetchProfile(access);
            }
            const finalUser = normalized ? { ...normalized, token: access } : ({ token: access } as any);

            setUser(finalUser);
            await saveUserToStorage(finalUser);

            await runPostLoginBootIfNeeded(finalUser);

            return finalUser;
        },
        [fetchProfile]
    );

    const signOut = useCallback(async () => {
        await clearAuthStorage();
        setUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        let access = await getAccessToken();
        if (!isValidTokenString(access)) {
            access = await tryRefreshAccess();
        }
        if (!isValidTokenString(access)) return null;
        const freshOrErr: any = await fetchProfile(access);
        if (!freshOrErr || freshOrErr?.response) return null;
        const finalUser = { ...freshOrErr, token: access };
        setUser(finalUser);
        await saveUserToStorage(finalUser);
        return finalUser;
    }, [fetchProfile]);

    const setUserUnsafe = useCallback(async (partial: any) => {
        if (!partial) return;
        setUser((prev: any) => {
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

export const useAuth = () => {
    const ctx = useContext(AuthCtx);
    if (ctx == null) {
        const err = new Error("useAuth must be used inside <AuthProvider>");
        console.error(err.stack);
        throw err;
    }
    return ctx;
};

export const useIsLoggedIn = () => {
    const { user } = useAuth();
    return !!user && !!user.id;
};

export const useIsAuthBooting = () => {
    const { booting } = useAuth();
    return booting;
};
