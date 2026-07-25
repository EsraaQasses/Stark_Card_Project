// src/utils/lang.js
import i18n, { initI18n } from "../i18n";

/**
 * Keeps the app language Arabic without forcing React Native layout direction.
 */
export async function loadSavedLanguage() {
  // 1. Force Arabic in i18n
  if (!i18n.isInitialized) {
    initI18n("ar");
  } else if (i18n.language !== "ar") {
    await i18n.changeLanguage("ar");
  }

  return { code: "ar", needsReload: false };
}

/**
 * دالة فارغة لأن اللغة ثابتة
 */
export async function setAppLanguage(code) {
  // لا تفعل شيئاً، اللغة دائماً عربية
  return loadSavedLanguage();
}
