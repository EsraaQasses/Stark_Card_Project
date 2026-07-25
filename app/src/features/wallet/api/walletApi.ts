import type { ApiResult } from "../../../shared/api/apiResult";
import { apiFailure, apiSuccess } from "../../../shared/api/apiResult";
import {
  changeUserCurrency,
  getDepositCounts,
  getDeposits,
  getExchangeRate,
  getWallet,
} from "../../../api/wallets";

export type WalletSummaryResponse = Awaited<ReturnType<typeof getWallet>>;
export type WalletBalanceResponse = WalletSummaryResponse;
export type ExchangeRateResponse = Awaited<ReturnType<typeof getExchangeRate>>;
export type ChangeUserCurrencyResponse = Awaited<ReturnType<typeof changeUserCurrency>>;
export type WalletDepositsResponse = Awaited<ReturnType<typeof getDeposits>>;
export type WalletDepositCountsResponse = Awaited<ReturnType<typeof getDepositCounts>>;

export async function getWalletSummaryNormalized(): Promise<ApiResult<WalletSummaryResponse>> {
  try {
    return apiSuccess(await getWallet());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getWalletBalanceNormalized(): Promise<ApiResult<WalletBalanceResponse>> {
  return getWalletSummaryNormalized();
}

export async function getWalletExchangeRateNormalized(): Promise<ApiResult<ExchangeRateResponse>> {
  try {
    return apiSuccess(await getExchangeRate());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function changeUserCurrencyNormalized(
  currency: Parameters<typeof changeUserCurrency>[0]
): Promise<ApiResult<ChangeUserCurrencyResponse>> {
  try {
    return apiSuccess(await changeUserCurrency(currency));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getWalletTopUpsNormalized(
  params?: Parameters<typeof getDeposits>[0]
): Promise<ApiResult<WalletDepositsResponse>> {
  try {
    return apiSuccess(await getDeposits(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getWalletDepositCountsNormalized(): Promise<ApiResult<WalletDepositCountsResponse>> {
  try {
    return apiSuccess(await getDepositCounts());
  } catch (error) {
    return apiFailure(error);
  }
}
