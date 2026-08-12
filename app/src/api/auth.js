// src/api/auth.js
import api, { buildUrl, USERS_PREFIX } from "./client";
import { clearAuthTokens, setAuthTokens } from "../shared/storage/authStorage";

// Compatibility API: existing screens still import these throwing functions.
// New auth API integrations should prefer src/features/auth/api/authApi.ts.

/* ============== Helpers ============== */
async function setTokens({ access, refresh }) {
  await setAuthTokens({ access, refresh });
}

async function clearTokens() {
  await clearAuthTokens();
}

/* ============== Auth APIs ============== */

/** Register */
export async function register(payload) {
  // Basic validation
  if (!payload.full_name || !payload.full_name.trim()) {
    throw new Error("الاسم الكامل مطلوب");
  }
  if (!payload.name || !payload.name.trim()) {
    throw new Error("اسم المستخدم مطلوب");
  }
  if (!payload.password || payload.password.length < 6) {
    throw new Error("كلمة المرور يجب أن تكون على الأقل 6 أحرف");
  }
  if (payload.provider === "email" && !payload.email) {
    throw new Error("البريد الإلكتروني مطلوب");
  }
  if (payload.provider === "phone" && !payload.phone) {
    throw new Error("رقم الهاتف مطلوب");
  }

  try {
    // POST .../api/users/register/
    const { data } = await api.post(buildUrl(USERS_PREFIX, "register/"), payload);
    return data;
  } catch (error) {
    // معالجة الأخطاء الشائعة
    if (error?.response?.status === 400) {
      const errData = error.response.data;
      if (errData?.name) throw new Error(`اسم المستخدم: ${errData.name[0] || "خطأ"}`);
      if (errData?.email) throw new Error(`البريد: ${errData.email[0] || "خطأ"}`);
      if (errData?.phone) throw new Error(`الهاتف: ${errData.phone[0] || "خطأ"}`);
      if (errData?.agent_code) throw new Error(`رمز الوكيل: ${errData.agent_code[0] || "غير صحيح"}`);
    }
    throw error;
  }
}

/**
 * Login: يقبل identifier (username أو email) + password.
 * يعيد دومًا كائن موحّد { access, refresh, user, _raw }
 * + يخزّن التوكنات في AsyncStorage ليستعملها الإنترسبتور تلقائيًا.
 */
export async function login(identifier, password) {
  // Validation
  if (!identifier || !identifier.trim()) {
    throw new Error("اسم المستخدم مطلوب");
  }
  if (!password) {
    throw new Error("كلمة المرور مطلوبة");
  }

  try {
    // Backend expects 'name' (username) and 'password'
    const payload = { name: identifier.trim(), password };

    // POST .../api/users/login/
    const { data } = await api.post(buildUrl(USERS_PREFIX, "login/"), payload);

    // دعم أكثر من شكل استجابة
    const access =
      data?.access ?? data?.token ?? data?.key ?? null;
    const refresh = data?.refresh ?? null;
    const user = data?.user ?? data?.profile ?? null;

    if (!access) {
      throw new Error("لم يتم استلام توكن الوصول من الخادم.");
    }

    await setTokens({ access, refresh });

    return { access, refresh, user, _raw: data };
  } catch (error) {
    // إعادة طرح مع معالجة الأخطاء
    if (error?.response?.status === 401) {
      throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    }
    if (error?.response?.status === 429) {
      throw new Error("عدد محاولات تسجيل الدخول كثير. انتظر قليلاً وحاول مجدداً.");
    }
    throw error;
  }
}

/** الملف الشخصي الحالي (الإنترسبتور يضيف Authorization تلقائيًا) */

export async function getMe() {
  // Compatibility export: new current-user integrations should prefer
  // src/features/profile/api/profileApi.ts.
  const { data } = await api.get(buildUrl(USERS_PREFIX, "me/"));
  return data;
}

/** Verify OTP */
export async function verifyOtp({ name, code }) {
  const { data } = await api.post(buildUrl(USERS_PREFIX, "verify-otp/"), {
    name,
    otp_code: code,
  });
  return data;
}

/** Resend OTP */
export async function resendOtp({ name }) {
  const { data } = await api.post(buildUrl(USERS_PREFIX, "resend-otp/"), { name });
  return data;
}

/** Refresh JWT (عادةً الإنترسبتور يستخدمها تلقائيًا عند 401) */
export async function refreshToken(refresh) {
  const { data } = await api.post(buildUrl(USERS_PREFIX, "token/refresh/"), { refresh });
  // إذا الباك يرجّع access فقط، خليه يحدّث التخزين (اختياري)
  if (data?.access) {
    await setTokens({ access: data.access, refresh: data.refresh || refresh });
  }
  return data;
}

/**
 * Logout: يفضَّل تمرير refresh لعمل blacklist على الخادم.
 * ننظّف التوكنات محليًا سواء نجح طلب اللوغ-آوت أم لا.
 */
export async function apiLogout(refresh) {
  try {
    await api.post(buildUrl(USERS_PREFIX, "logout/"), { refresh });
  } catch {
    // حتى لو فشل السيرفر، كمّل تنظيف الجلسة محليًا
  } finally {
    await clearTokens();
  }
  return { ok: true };
}

/**
 * طلب "نسيت كلمة المرور"
 * الباك إند عندك:
 *   path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
 * لذلك المسار هنا: /users/forgot-password/
 */
export async function requestPasswordReset(email) {
  const { data } = await api.post(
    buildUrl(USERS_PREFIX, "password-reset/request/"),
    { email }
  );
  return data;
}

export async function verifyPasswordResetCode({ request_id, code }) {
  const { data } = await api.post(
    buildUrl(USERS_PREFIX, "password-reset/verify/"),
    { request_id, code }
  );
  return data;
}

export async function resendPasswordResetCode(request_id) {
  const { data } = await api.post(
    buildUrl(USERS_PREFIX, "password-reset/resend/"),
    { request_id }
  );
  return data;
}

export async function resetPassword({ reset_token, token, new_password, confirm_password }) {
  const { data } = await api.post(
    buildUrl(USERS_PREFIX, "password-reset/confirm/"),
    { reset_token: reset_token || token, new_password, confirm_password }
  );
  return data;
}

export const requestPasswordResetCode = requestPasswordReset;

export async function resetPasswordWithCode({ request_id, code, new_password, confirm_password }) {
  const verification = await verifyPasswordResetCode({ request_id, code });
  return resetPassword({
    reset_token: verification.reset_token,
    new_password,
    confirm_password,
  });
}

export default api;
