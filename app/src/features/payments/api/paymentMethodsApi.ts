import type { ApiResult } from "../../../shared/api/apiResult";
import { apiFailure, apiSuccess } from "../../../shared/api/apiResult";
import { listUserPaymentMethods } from "../../../api/paymentMethods";

export type UserPaymentMethodsResponse = Awaited<ReturnType<typeof listUserPaymentMethods>>;

export async function getUserPaymentMethodsNormalized(
  options?: Parameters<typeof listUserPaymentMethods>[0]
): Promise<ApiResult<UserPaymentMethodsResponse>> {
  try {
    return apiSuccess(await listUserPaymentMethods(options));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getPaymentMethodsNormalized(
  options?: Parameters<typeof listUserPaymentMethods>[0]
): Promise<ApiResult<UserPaymentMethodsResponse>> {
  return getUserPaymentMethodsNormalized(options);
}

export async function getAvailablePaymentMethodsNormalized(
  options?: Parameters<typeof listUserPaymentMethods>[0]
): Promise<ApiResult<UserPaymentMethodsResponse>> {
  return getUserPaymentMethodsNormalized(options);
}
