// src/utils/validation.js

export const Validators = {
  /**
   * التحقق من بريد إلكتروني
   */
  email: (email) => {
    if (!email) return "البريد الإلكتروني مطلوب";
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) return "صيغة البريد غير صحيحة";
    return null;
  },

  /**
   * التحقق من رقم الهاتف
   * يقبل: +963123456789 أو 0963123456789
   */
  phone: (phone) => {
    if (!phone) return "رقم الهاتف مطلوب";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 9) return "رقم الهاتف قصير جداً";
    if (cleaned.length > 15) return "رقم الهاتف طويل جداً";
    return null;
  },

  /**
   * التحقق من كلمة المرور
   */
  password: (password, minLength = 6) => {
    if (!password) return "كلمة المرور مطلوبة";
    if (password.length < minLength)
      return `كلمة المرور يجب أن تكون على الأقل ${minLength} أحرف`;
    return null;
  },

  /**
   * التحقق من اسم المستخدم
   */
  username: (username) => {
    if (!username) return "اسم المستخدم مطلوب";
    if (username.length < 3) return "اسم المستخدم قصير جداً";
    if (!/^[a-zA-Z0-9_-]+$/.test(username))
      return "اسم المستخدم يجب أن يحتوي على أحرف وأرقام و _ - فقط";
    return null;
  },

  /**
   * التحقق من الاسم الكامل
   */
  fullName: (name) => {
    if (!name) return "الاسم الكامل مطلوب";
    if (name.trim().length < 3) return "الاسم قصير جداً";
    return null;
  },

  /**
   * التحقق من المبلغ المالي
   */
  amount: (amount, min = 0.01, max = null) => {
    const num = Number(amount);
    if (isNaN(num)) return "المبلغ يجب أن يكون رقماً";
    if (num < min) return `الحد الأدنى: ${min}`;
    if (max && num > max) return `الحد الأقصى: ${max}`;
    return null;
  },

  /**
   * التحقق من رمز OTP (6 أرقام)
   */
  otp: (code) => {
    if (!code) return "رمز التحقق مطلوب";
    if (!/^\d{6}$/.test(code)) return "رمز التحقق يجب أن يكون 6 أرقام";
    return null;
  },

  /**
   * التحقق من رمز الوكيل (اختياري)
   */
  agentCode: (code) => {
    if (!code) return null; // اختياري
    if (code.length < 3) return "رمز الوكيل قصير جداً";
    return null;
  },
};

/**
 * التحقق من form كامل
 * @param {Object} data - البيانات المراد التحقق منها
 * @param {Object} schema - قواعد التحقق { field: validator }
 * @returns {Object} - { isValid, errors }
 */
export function validateForm(data, schema) {
  const errors = {};

  for (const [field, validator] of Object.entries(schema)) {
    const error = validator(data[field]);
    if (error) {
      errors[field] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * التحقق من أن جميع الحقول المطلوبة موجودة
 */
export function hasRequiredFields(data, requiredFields) {
  return requiredFields.every((field) => {
    const value = data[field];
    return value !== null && value !== undefined && value !== "";
  });
}

export default Validators;
