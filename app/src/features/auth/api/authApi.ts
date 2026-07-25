import type { ApiResult } from "../../../shared/api/apiResult";
import { apiFailure, apiSuccess } from "../../../shared/api/apiResult";
import {
  apiLogout,
  getMe,
  login,
  register,
  requestPasswordReset,
  requestPasswordResetCode,
  resendOtp,
  resetPasswordWithCode,
  refreshToken,
  verifyOtp,
} from "../../../api/auth";

export type LoginResponse = Awaited<ReturnType<typeof login>>;
export type RegisterResponse = Awaited<ReturnType<typeof register>>;
export type GetMeResponse = Awaited<ReturnType<typeof getMe>>;
export type RefreshTokenResponse = Awaited<ReturnType<typeof refreshToken>>;
export type LogoutResponse = Awaited<ReturnType<typeof apiLogout>>;
export type VerifyOtpResponse = Awaited<ReturnType<typeof verifyOtp>>;
export type ResendOtpResponse = Awaited<ReturnType<typeof resendOtp>>;
export type PasswordResetResponse = Awaited<ReturnType<typeof requestPasswordReset>>;
export type PasswordResetCodeResponse = Awaited<ReturnType<typeof requestPasswordResetCode>>;
export type ResetPasswordWithCodeResponse = Awaited<ReturnType<typeof resetPasswordWithCode>>;

export async function loginNormalized(
  identifier: string,
  password: string
): Promise<ApiResult<LoginResponse>> {
  try {
    return apiSuccess(await login(identifier, password));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function registerNormalized(
  payload: Parameters<typeof register>[0]
): Promise<ApiResult<RegisterResponse>> {
  try {
    return apiSuccess(await register(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getMeNormalized(): Promise<ApiResult<GetMeResponse>> {
  try {
    return apiSuccess(await getMe());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function refreshTokenNormalized(
  refresh: Parameters<typeof refreshToken>[0]
): Promise<ApiResult<RefreshTokenResponse>> {
  try {
    return apiSuccess(await refreshToken(refresh));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function logoutNormalized(
  refresh: Parameters<typeof apiLogout>[0]
): Promise<ApiResult<LogoutResponse>> {
  try {
    return apiSuccess(await apiLogout(refresh));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function verifyOtpNormalized(
  payload: Parameters<typeof verifyOtp>[0]
): Promise<ApiResult<VerifyOtpResponse>> {
  try {
    return apiSuccess(await verifyOtp(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function resendOtpNormalized(
  payload: Parameters<typeof resendOtp>[0]
): Promise<ApiResult<ResendOtpResponse>> {
  try {
    return apiSuccess(await resendOtp(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function requestPasswordResetNormalized(
  email: Parameters<typeof requestPasswordReset>[0]
): Promise<ApiResult<PasswordResetResponse>> {
  try {
    return apiSuccess(await requestPasswordReset(email));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function requestPasswordResetCodeNormalized(
  email: Parameters<typeof requestPasswordResetCode>[0]
): Promise<ApiResult<PasswordResetCodeResponse>> {
  try {
    return apiSuccess(await requestPasswordResetCode(email));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function resetPasswordWithCodeNormalized(
  payload: Parameters<typeof resetPasswordWithCode>[0]
): Promise<ApiResult<ResetPasswordWithCodeResponse>> {
  try {
    return apiSuccess(await resetPasswordWithCode(payload));
  } catch (error) {
    return apiFailure(error);
  }
}
