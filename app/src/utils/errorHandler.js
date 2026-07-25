// src/utils/errorHandler.js

/**
 * معالج أخطاء موحد لجميع API calls
 * يستخرج الرسالة من استجابة الـ Backend بصيغ مختلفة
 */
export function extractErrorMessage(error, defaultMsg = "حدث خطأ") {
  // إذا كان الـ error نص مباشر
  if (typeof error === "string") return error;

  // إذا كان كائن بـ detail
  if (error?.detail) return error.detail;

  // إذا كان كائن بـ message
  if (error?.message) return error.message;

  // إذا كان كائن بـ error
  if (error?.error) return error.error;

  // إذا كانت هناك non_field_errors
  if (Array.isArray(error?.non_field_errors) && error.non_field_errors.length > 0) {
    return error.non_field_errors[0];
  }

  // محاولة جمع جميع أخطاء الحقول
  if (typeof error === "object") {
    const errors = [];
    for (const [key, value] of Object.entries(error)) {
      if (Array.isArray(value)) {
        errors.push(`${key}: ${value.join(", ")}`);
      } else if (typeof value === "string") {
        errors.push(`${key}: ${value}`);
      }
    }
    if (errors.length > 0) return errors.join(" | ");
  }

  return defaultMsg;
}

/**
 * معالج شامل لأخطاء HTTP
 */
export function handleApiError(error, defaultMsg = "فشل الطلب") {
  // إذا لم يكن هناك استجابة (مشكلة في الشبكة)
  if (!error?.response) {
    if (error?.message === "Network Error" || error?.code === "ECONNABORTED") {
      return "خطأ في الاتصال. تحقق من اتصالك بالإنترنت.";
    }
    return error?.message || defaultMsg;
  }

  const status = error.response.status;
  const data = error.response.data;

  // معالجة أخطاء محددة حسب الـ status code
  switch (status) {
    case 400:
      return extractErrorMessage(data, "البيانات غير صحيحة");
    case 401:
      return "انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.";
    case 403:
      return "ليس لديك صلاحيات للوصول لهذا المورد.";
    case 404:
      return "المورد المطلوب غير موجود.";
    case 409:
      return "حدث تضارب. قد تكون المحاولة الأخيرة نجحت. حاول مجدداً.";
    case 429:
      return "عدد المحاولات كثير. انتظر قليلاً ثم حاول مجدداً.";
    case 500:
    case 502:
    case 503:
      return "خطأ في الخادم. حاول لاحقاً.";
    default:
      return extractErrorMessage(data, defaultMsg);
  }
}

/**
 * معالج موحد لـ try-catch في API calls
 * @returns {Object} - { ok, error, data }
 */
export async function safeApiCall(apiFunction, defaultMsg = "فشل الطلب") {
  try {
    const response = await apiFunction();
    return {
      ok: true,
      data: response,
      error: null,
    };
  } catch (error) {
    const errorMessage = handleApiError(error, defaultMsg);
    console.error("API Error:", errorMessage, error);
    return {
      ok: false,
      data: null,
      error: errorMessage,
    };
  }
}

/**
 * محاولة تنفيذ عملية عدة مرات (retry with exponential backoff)
 */
export async function retryOperation(
  operation,
  maxAttempts = 3,
  delayMs = 1000,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * تنسيق رسالة الخطأ للعرض
 */
export function formatErrorMessage(error) {
  const msg = handleApiError(error);
  return msg.length > 100 ? msg.substring(0, 97) + "..." : msg;
}

export default {
  extractErrorMessage,
  handleApiError,
  safeApiCall,
  retryOperation,
  formatErrorMessage,
};
