import type { ApiResult } from "../../../shared/api/apiResult";
import { apiFailure, apiSuccess } from "../../../shared/api/apiResult";
import {
  approveTransaction,
  createTransfer,
  getAgentFinancialSummary,
  getFinancialSummary,
  getTransactionById,
  getTransactions,
  lookupRecipientByPhone,
  lookupRecipientByWallet,
} from "../../../api/transactions";
import { listDepositRequests } from "../../../api/deposits";
import { getWallet } from "../../../api/wallets";
import {
  getPaymentById,
  getPaymentsStatusSummary,
  listPaymentsHistory,
} from "../../../api/payment";

export type TransactionsResponse = Awaited<ReturnType<typeof getTransactions>>;
export type TransactionDetailResponse = Awaited<ReturnType<typeof getTransactionById>>;
export type FinancialSummaryResponse = Awaited<ReturnType<typeof getFinancialSummary>>;
export type AgentFinancialSummaryResponse = Awaited<ReturnType<typeof getAgentFinancialSummary>>;
export type ApproveTransactionResponse = Awaited<ReturnType<typeof approveTransaction>>;
export type LookupRecipientByPhoneResponse = Awaited<ReturnType<typeof lookupRecipientByPhone>>;
export type LookupRecipientByWalletResponse = Awaited<ReturnType<typeof lookupRecipientByWallet>>;
export type CreateTransferResponse = Awaited<ReturnType<typeof createTransfer>>;
export type DepositTransactionsResponse = Awaited<ReturnType<typeof listDepositRequests>>;
export type WalletTransactionsResponse = Awaited<ReturnType<typeof getWallet>>;
export type PaymentTransactionsResponse = Awaited<ReturnType<typeof listPaymentsHistory>>;
export type PaymentTransactionDetailResponse = Awaited<ReturnType<typeof getPaymentById>>;
export type PaymentTransactionsSummaryResponse = Awaited<ReturnType<typeof getPaymentsStatusSummary>>;

export async function getTransactionsNormalized(
  params?: Parameters<typeof getTransactions>[0]
): Promise<ApiResult<TransactionsResponse>> {
  try {
    return apiSuccess(await getTransactions(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getTransactionDetailNormalized(
  id: Parameters<typeof getTransactionById>[0]
): Promise<ApiResult<TransactionDetailResponse>> {
  try {
    return apiSuccess(await getTransactionById(id));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getFinancialSummaryNormalized(
  params?: Parameters<typeof getFinancialSummary>[0]
): Promise<ApiResult<FinancialSummaryResponse>> {
  try {
    return apiSuccess(await getFinancialSummary(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getAgentFinancialSummaryNormalized(
  params?: Parameters<typeof getAgentFinancialSummary>[0]
): Promise<ApiResult<AgentFinancialSummaryResponse>> {
  try {
    return apiSuccess(await getAgentFinancialSummary(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function approveTransactionNormalized(
  id: Parameters<typeof approveTransaction>[0],
  action?: Parameters<typeof approveTransaction>[1]
): Promise<ApiResult<ApproveTransactionResponse>> {
  try {
    return apiSuccess(await approveTransaction(id, action));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function lookupRecipientByPhoneNormalized(
  phone: Parameters<typeof lookupRecipientByPhone>[0]
): Promise<ApiResult<LookupRecipientByPhoneResponse>> {
  try {
    return apiSuccess(await lookupRecipientByPhone(phone));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function lookupRecipientByWalletNormalized(
  walletId: Parameters<typeof lookupRecipientByWallet>[0]
): Promise<ApiResult<LookupRecipientByWalletResponse>> {
  try {
    return apiSuccess(await lookupRecipientByWallet(walletId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function createTransferNormalized(
  payload: Parameters<typeof createTransfer>[0]
): Promise<ApiResult<CreateTransferResponse>> {
  try {
    return apiSuccess(await createTransfer(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getDepositTransactionsNormalized(
  params?: Parameters<typeof listDepositRequests>[0]
): Promise<ApiResult<DepositTransactionsResponse>> {
  try {
    return apiSuccess(await listDepositRequests(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getWalletTransactionsNormalized(): Promise<ApiResult<WalletTransactionsResponse>> {
  try {
    return apiSuccess(await getWallet());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getPaymentTransactionsNormalized(
  params?: Parameters<typeof listPaymentsHistory>[0]
): Promise<ApiResult<PaymentTransactionsResponse>> {
  try {
    return apiSuccess(await listPaymentsHistory(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getPaymentTransactionDetailNormalized(
  id: Parameters<typeof getPaymentById>[0]
): Promise<ApiResult<PaymentTransactionDetailResponse>> {
  try {
    return apiSuccess(await getPaymentById(id));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getPaymentTransactionsSummaryNormalized(): Promise<ApiResult<PaymentTransactionsSummaryResponse>> {
  try {
    return apiSuccess(await getPaymentsStatusSummary());
  } catch (error) {
    return apiFailure(error);
  }
}
