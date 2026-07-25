export const AUTH_STORAGE_KEYS = {
  access: "access",
  refresh: "refresh",
  legacyAuthToken: "auth_token",
  legacyAccessToken: "accessToken",
  user: "user",
  authUser: "auth_user",
  profile: "profile",
  pendingName: "pending_name",
  bootDonePrefix: "@boot_done_for_user:",
} as const;

export const FAVORITES_STORAGE_KEYS = {
  guestFavorites: "@guest_favs",
} as const;

export const WALLET_STORAGE_KEYS = {
  walletsCache: "@wallets_cache",
  defaultWalletId: "@default_wallet_id",
  qrUrl: "@qr_url",
} as const;

export const PREFERENCE_STORAGE_KEYS = {
  currency: "currency",
  appLanguage: "app_lang",
  onboardingFinished: "HAS_FINISHED_ONBOARDING",
} as const;

export const NAVIGATION_STORAGE_KEYS = {
  paymentMethodsCount: "@payment_methods_count",
  lastNotificationId: "@last_notif_id",
  notificationUnreadOverride: "@notif_unread_override",
} as const;

export const CACHE_STORAGE_KEYS = {
  cachePrefix: "@cache:",
  qrCachePrefix: "@qr_cache:",
} as const;

export const AGENT_STORAGE_KEYS = {
  pendingAgentCode: "@pending_agent_code",
} as const;

export const STORAGE_KEYS = {
  auth: AUTH_STORAGE_KEYS,
  favorites: FAVORITES_STORAGE_KEYS,
  wallet: WALLET_STORAGE_KEYS,
  preferences: PREFERENCE_STORAGE_KEYS,
  navigation: NAVIGATION_STORAGE_KEYS,
  cache: CACHE_STORAGE_KEYS,
  agents: AGENT_STORAGE_KEYS,
} as const;
