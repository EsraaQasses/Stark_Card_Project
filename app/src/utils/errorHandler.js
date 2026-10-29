import { getApiErrorMessage } from "../shared/api/errors/apiError";
// src/utils/errorHandler.js

/**
 * معالج أخطاء موحد لجميع API calls
 * يستخرج الرسالة من استجابة الـ Backend بصيغ مختلفة
 */
export function extractErrorMessage(error, defaultMsg) {
  return getApiErrorMessage(error) || defaultMsg;
}

export function handleApiError(error, defaultMsg) {
  return getApiErrorMessage(error) || defaultMsg;
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
  maxAttempts = 1,
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
