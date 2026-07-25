// src/utils/postLoginBoot.js
import api from "../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getWallet } from "../api/wallets";

/**
 * postLoginBoot:
 * - يُستدعى مباشرة بعد حفظ التوكنات بنجاح.
 * - يضمن توليد/جلب QR (بدون تعديل باك).
 * - يجلب المحافظ (لو موجودة) ويخزنها كـ cache خفيفة لسرعة العرض الأولى.
 */
export async function postLoginBoot() {
  try {
    // 1) ضمان/جلب QR (السيرفر سيُولّد إذا غير موجود)
    const qrRes = await api.get("/qr_code/my-qr/");
    const qrUrl = qrRes?.data?.qr_code_url || qrRes?.data?.url || null;
    if (qrUrl) await AsyncStorage.setItem("@qr_url", qrUrl);
    
    // 2) جلب المحافظ الحالية (لو موجودة)
    try {
      const wallets = await getWallet();
      await AsyncStorage.setItem("@wallets_cache", JSON.stringify(wallets));
    } catch (_e) {
      // إذا ما في محافظ أو رجع 404/400، تجاهل — ما عم نعدّل باك
      // console.warn("wallet fetch skipped:", e?.response?.status || e?.message);
    }
  } catch (_err) {
    // أي خطأ عام — نكمل حياة التطبيق عادي
    // console.warn("postLoginBoot failed:", err?.response?.data || err?.message);
  }
}
