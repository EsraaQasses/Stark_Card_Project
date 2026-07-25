import type { ApiResult } from "../../../shared/api/apiResult";
import { apiFailure, apiSuccess } from "../../../shared/api/apiResult";
import {
  deleteNotification,
  getAdminActions,
  getAds,
  getNotifications,
  getSystemLogs,
  getUnreadCount,
  markNotificationAsRead,
} from "../../../api/system";
import {
  notifyAdminsDeposit,
  setAdminNotifyEndpoint,
} from "../../../api/adminNotify";

export type NotificationsResponse = Awaited<ReturnType<typeof getNotifications>>;
export type UnreadNotificationCountResponse = Awaited<ReturnType<typeof getUnreadCount>>;
export type MarkNotificationReadResponse = Awaited<ReturnType<typeof markNotificationAsRead>>;
export type DeleteNotificationResponse = Awaited<ReturnType<typeof deleteNotification>>;
export type SystemAdsResponse = Awaited<ReturnType<typeof getAds>>;
export type SystemLogsResponse = Awaited<ReturnType<typeof getSystemLogs>>;
export type AdminActionsResponse = Awaited<ReturnType<typeof getAdminActions>>;
export type NotifyAdminsDepositResponse = Awaited<ReturnType<typeof notifyAdminsDeposit>>;
export type SetAdminNotifyEndpointResponse = ReturnType<typeof setAdminNotifyEndpoint>;

function apiResultFromLegacy<T>(response: T): ApiResult<T> {
  const legacyResponse = response as { ok?: boolean; error?: unknown; data?: unknown };

  if (legacyResponse?.ok === false) {
    return apiFailure(legacyResponse.error ?? legacyResponse.data ?? response);
  }

  return apiSuccess(response);
}

export async function getNotificationsNormalized(
  params?: Parameters<typeof getNotifications>[0]
): Promise<ApiResult<NotificationsResponse>> {
  try {
    return apiResultFromLegacy(await getNotifications(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getSystemNotificationsNormalized(
  params?: Parameters<typeof getNotifications>[0]
): Promise<ApiResult<NotificationsResponse>> {
  return getNotificationsNormalized(params);
}

export async function getUnreadNotificationCountNormalized(): Promise<ApiResult<UnreadNotificationCountResponse>> {
  try {
    return apiResultFromLegacy(await getUnreadCount());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function markNotificationReadNormalized(
  id: Parameters<typeof markNotificationAsRead>[0]
): Promise<ApiResult<MarkNotificationReadResponse>> {
  try {
    return apiResultFromLegacy(await markNotificationAsRead(id));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function deleteNotificationNormalized(
  id: Parameters<typeof deleteNotification>[0]
): Promise<ApiResult<DeleteNotificationResponse>> {
  try {
    return apiResultFromLegacy(await deleteNotification(id));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getAdsNormalized(
  params?: Parameters<typeof getAds>[0]
): Promise<ApiResult<SystemAdsResponse>> {
  try {
    return apiResultFromLegacy(await getAds(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getSystemLogsNormalized(
  params?: Parameters<typeof getSystemLogs>[0]
): Promise<ApiResult<SystemLogsResponse>> {
  try {
    return apiResultFromLegacy(await getSystemLogs(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getAdminActionsNormalized(
  params?: Parameters<typeof getAdminActions>[0]
): Promise<ApiResult<AdminActionsResponse>> {
  try {
    return apiResultFromLegacy(await getAdminActions(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function notifyAdminsDepositNormalized(
  payload: Parameters<typeof notifyAdminsDeposit>[0]
): Promise<ApiResult<NotifyAdminsDepositResponse>> {
  try {
    return apiSuccess(await notifyAdminsDeposit(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export function setAdminNotifyEndpointNormalized(
  path: Parameters<typeof setAdminNotifyEndpoint>[0]
): ApiResult<SetAdminNotifyEndpointResponse> {
  try {
    return apiSuccess(setAdminNotifyEndpoint(path));
  } catch (error) {
    return apiFailure(error);
  }
}
