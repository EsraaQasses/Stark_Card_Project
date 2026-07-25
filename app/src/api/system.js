// src/api/system.js
import api from "./client";

/**
 * جلب الإشعارات
 */
export async function getNotifications(params = {}) {
  try {
    const { data } = await api.get("system/notifications/", { params });
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.data)
          ? data.data
          : [];
    return { ok: true, data: list, raw: data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: [] };
  }
}

/**
 * Unread notifications count
 */
export async function getUnreadCount() {
  try {
    const { data } = await api.get("system/notifications/unread-count/");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: { unread: 0 } };
  }
}
/**
 * تحديد إشعار كمقروء
 */
export async function markNotificationAsRead(id) {
  try {
    const { data } = await api.patch(`system/notifications/${id}/`, { is_read: true });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error) };
  }
}

/**
 * حذف إشعار
 */
export async function deleteNotification(id) {
  try {
    await api.delete(`system/notifications/${id}/`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error) };
  }
}

/**
 * جلب الإعلانات
 */
export async function getAds(params = {}) {
  try {
    const { data } = await api.get("system/all/", { params });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * جلب سجلات النظام (للأدمن)
 */
export async function getSystemLogs(params = {}) {
  try {
    const { data } = await api.get("system/system-logs/", { params });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * جلب سجل الإجراءات الأدمن (للأدمن)
 */
export async function getAdminActions(params = {}) {
  try {
    const { data } = await api.get("system/admin-actions/", { params });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: extractErrorMessage(error), data: null };
  }
}

/**
 * Helper
 */
function extractErrorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "فشل الطلب"
  );
}

export default {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  deleteNotification,
  getAds,
  getSystemLogs,
  getAdminActions,
};
