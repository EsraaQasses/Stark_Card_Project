import api from "../../../api/client";
import { getMe } from "../../../api/auth";
import type { ApiResult } from "../../../shared/api/apiResult";
import { apiFailure, apiSuccess } from "../../../shared/api/apiResult";

export type CurrentUserResponse = Awaited<ReturnType<typeof getMe>>;
export type DeleteCurrentUserResponse = unknown;

export async function getCurrentUserNormalized(): Promise<ApiResult<CurrentUserResponse>> {
  try {
    return apiSuccess(await getMe());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getProfileNormalized(): Promise<ApiResult<CurrentUserResponse>> {
  return getCurrentUserNormalized();
}

export async function deleteCurrentUserNormalized(): Promise<ApiResult<DeleteCurrentUserResponse>> {
  try {
    const { data } = await api.delete("/users/me/delete/");
    return apiSuccess(data);
  } catch (error) {
    return apiFailure(error);
  }
}
