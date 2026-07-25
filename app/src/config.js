// src/config.js
// هذا الملف للتوافق - الإعدادات الفعلية في src/api/client.js
// Base API URL - يمكن تغييره عبر EXPO_PUBLIC_API_BASE
import { API_BASE } from "./api/client";

// MEDIA_ORIGIN يستخدم نفس الدومين من client.js
export const MEDIA_ORIGIN = API_BASE;

// Re-export للتوافق
export { API_BASE };
