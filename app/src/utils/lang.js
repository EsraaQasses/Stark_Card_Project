// src/utils/lang.js
import i18n, { initI18n } from "../i18n";

import { getItem, setItem } from "../shared/storage/appStorage";
const LANGUAGE_KEY = "stark.language";
const languageCode = code => String(code).startsWith("en") ? "en" : "ar";
export async function loadSavedLanguage() {
  const saved = await getItem(LANGUAGE_KEY);
  const code = languageCode(saved || i18n.language || "ar");
  if (!i18n.isInitialized) initI18n(code);
  else if (i18n.language !== code) await i18n.changeLanguage(code);
  return {code,needsReload:false};
}
export async function setAppLanguage(value) {
  const code = languageCode(value);
  await setItem(LANGUAGE_KEY,code);
  if (!i18n.isInitialized) initI18n(code);
  else await i18n.changeLanguage(code);
  return {code,needsReload:false};
}
