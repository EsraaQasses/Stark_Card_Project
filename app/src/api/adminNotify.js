// src/api/adminNotify.js
import api from "./client";

/**
 * في حال ثبّتوا لاحقاً Endpoint ثابت، حددوه هون:
 *   setAdminNotifyEndpoint("/system/admin/notify/");
 */
let FIXED_ENDPOINT = null;
export function setAdminNotifyEndpoint(path) {
  FIXED_ENDPOINT = path || null;
}

/**
 * مرشّحات منطقية تحت /api/system/ بما أن الإشعارات ضمن system
 * نجرّبها بالتسلسل، وإذا ما في ولا واحد—منسكت بصمت.
 */
/**
 * يحاول تبليغ الأدمن بوجود طلب إيداع جديد.
 * يرجّع true لو نجح، false إن لم يوجد Endpoint صالح. لا يرمي أخطاء للواجهة.
 */
export async function notifyAdminsDeposit({ userId, walletId, amount, note }) {
  // حمولة صغيرة لتقليل احتمال 400
  const payloads = [
    // حمولة غنيّة
    {
      title: "New deposit request",
      message: `User #${userId ?? "N/A"} requested a deposit of ${amount} to wallet #${walletId}${note ? " - " + String(note).slice(0, 120) : ""}`,
      severity: "info",
      recipient_role: "admin",
      meta: { kind: "deposit", userId, walletId, amount },
    },
    // حمولة أخف
    {
      title: "New deposit request",
      message: `Deposit ${amount} to wallet #${walletId}${userId ? " by user #" + userId : ""}`,
    },
  ];

  const paths = FIXED_ENDPOINT ? [FIXED_ENDPOINT] : [];

  for (const path of paths) {
    for (const body of payloads) {
      try {
        const res = await api.post(path, body);
        if (res?.status >= 200 && res?.status < 300) return true;
      } catch (e) {
        const st = e?.response?.status;
        // إن كان توكين أو صلاحيات، ما نكمل
        if (st === 401 || st === 403) return false;
        // غير ذلك: جرّب حمولة أخرى أو مسار آخر
        continue;
      }
    }
  }
  return false;
}
