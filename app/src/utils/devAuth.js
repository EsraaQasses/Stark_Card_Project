import api from "../api/client";
import {
  getLegacyAccessToken,
  removeLegacyAccessToken,
  setLegacyAccessToken,
} from "../shared/storage/authStorage";

const DEV_FAKE_TOKEN = "dev.fake.token.1234567890"; // مجرد قيمة، ضع أي نص

export async function setFakeAuth() {
  await setLegacyAccessToken(DEV_FAKE_TOKEN);
  api.defaults.headers.common["Authorization"] = `Bearer ${DEV_FAKE_TOKEN}`;
  return true;
}

export async function clearFakeAuth() {
  await removeLegacyAccessToken();
  delete api.defaults.headers.common["Authorization"];
  return true;
}

export async function initAuthFromStorage() {
  const token = await getLegacyAccessToken();
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    return true;
  }
  return false;
}
