// src/utils/guestFavs.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@guest_favs";
const keyOf = (product) => String(product?.store_product_id ?? product?.id ?? "");

export async function readGuestFavs() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isGuestFav(product) {
  const list = await readGuestFavs();
  const k = keyOf(product);
  return list.some((x) => keyOf(x.product) === k);
}

export async function saveGuestFav(product) {
  try {
    const list = await readGuestFavs();
    const k = keyOf(product);
    if (!k) return;
    const entry = { product, saved_at: Date.now() };
    const i = list.findIndex((x) => keyOf(x.product) === k);
    if (i >= 0) list[i] = entry;
    else list.unshift(entry);
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  } catch {}
}

export async function removeGuestFav(productOrId) {
  try {
    const list = await readGuestFavs();
    const k =
      typeof productOrId === "string" || typeof productOrId === "number"
        ? String(productOrId)
        : keyOf(productOrId);
    const next = list.filter((x) => keyOf(x.product) !== k);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
