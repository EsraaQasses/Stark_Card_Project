import type { ApiResult } from "../../../shared/api/apiResult";
import { apiFailure, apiSuccess } from "../../../shared/api/apiResult";
import {
  approveCashout,
  approveTransaction,
  cancelCashout,
  connectToAgent,
  createCashout,
  disconnectFromAgent,
  getAgentCommission,
  getAgentRegions,
  getAgentUsers,
  getAgents,
  getByFullUrl,
  listCashouts,
  makeAgentPurchase,
} from "../../../api/agent";

export type AgentsResponse = Awaited<ReturnType<typeof getAgents>>;
export type AgentUsersResponse = Awaited<ReturnType<typeof getAgentUsers>>;
export type AgentFullUrlResponse = Awaited<ReturnType<typeof getByFullUrl>>;
export type AgentCommissionResponse = Awaited<ReturnType<typeof getAgentCommission>>;
export type AgentRegionsResponse = Awaited<ReturnType<typeof getAgentRegions>>;
export type AgentPurchaseResponse = Awaited<ReturnType<typeof makeAgentPurchase>>;
export type ApproveAgentTransactionResponse = Awaited<ReturnType<typeof approveTransaction>>;
export type AgentCashoutsResponse = Awaited<ReturnType<typeof listCashouts>>;
export type CreateAgentCashoutResponse = Awaited<ReturnType<typeof createCashout>>;
export type ApproveAgentCashoutResponse = Awaited<ReturnType<typeof approveCashout>>;
export type CancelAgentCashoutResponse = Awaited<ReturnType<typeof cancelCashout>>;
export type ConnectToAgentResponse = Awaited<ReturnType<typeof connectToAgent>>;
export type DisconnectFromAgentResponse = Awaited<ReturnType<typeof disconnectFromAgent>>;

export async function getAgentsNormalized(
  params?: Parameters<typeof getAgents>[0]
): Promise<ApiResult<AgentsResponse>> {
  try {
    return apiSuccess(await getAgents(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getPublicAgentsNormalized(
  params?: Parameters<typeof getAgents>[0]
): Promise<ApiResult<AgentsResponse>> {
  return getAgentsNormalized(params);
}

export async function getAgentUsersNormalized(
  agentId: Parameters<typeof getAgentUsers>[0]
): Promise<ApiResult<AgentUsersResponse>> {
  try {
    return apiSuccess(await getAgentUsers(agentId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getAgentByFullUrlNormalized(
  fullUrl: Parameters<typeof getByFullUrl>[0]
): Promise<ApiResult<AgentFullUrlResponse>> {
  try {
    return apiSuccess(await getByFullUrl(fullUrl));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getAgentCommissionNormalized(
  agentId: Parameters<typeof getAgentCommission>[0]
): Promise<ApiResult<AgentCommissionResponse>> {
  try {
    return apiSuccess(await getAgentCommission(agentId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function getAgentRegionsNormalized(): Promise<ApiResult<AgentRegionsResponse>> {
  try {
    return apiSuccess(await getAgentRegions());
  } catch (error) {
    return apiFailure(error);
  }
}

export async function makeAgentPurchaseNormalized(
  payload: Parameters<typeof makeAgentPurchase>[0]
): Promise<ApiResult<AgentPurchaseResponse>> {
  try {
    return apiSuccess(await makeAgentPurchase(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function approveAgentTransactionNormalized(
  transactionId: Parameters<typeof approveTransaction>[0],
  approve?: Parameters<typeof approveTransaction>[1]
): Promise<ApiResult<ApproveAgentTransactionResponse>> {
  try {
    return apiSuccess(await approveTransaction(transactionId, approve));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function listAgentCashoutsNormalized(
  params?: Parameters<typeof listCashouts>[0]
): Promise<ApiResult<AgentCashoutsResponse>> {
  try {
    return apiSuccess(await listCashouts(params));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function createAgentCashoutNormalized(
  payload: Parameters<typeof createCashout>[0]
): Promise<ApiResult<CreateAgentCashoutResponse>> {
  try {
    return apiSuccess(await createCashout(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function approveAgentCashoutNormalized(
  transactionId: Parameters<typeof approveCashout>[0]
): Promise<ApiResult<ApproveAgentCashoutResponse>> {
  try {
    return apiSuccess(await approveCashout(transactionId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function cancelAgentCashoutNormalized(
  transactionId: Parameters<typeof cancelCashout>[0]
): Promise<ApiResult<CancelAgentCashoutResponse>> {
  try {
    return apiSuccess(await cancelCashout(transactionId));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function connectToAgentNormalized(
  payload?: Parameters<typeof connectToAgent>[0]
): Promise<ApiResult<ConnectToAgentResponse>> {
  try {
    return apiSuccess(await connectToAgent(payload));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function assignAgentNormalized(
  payload?: Parameters<typeof connectToAgent>[0]
): Promise<ApiResult<ConnectToAgentResponse>> {
  return connectToAgentNormalized(payload);
}

export async function disconnectFromAgentNormalized(): Promise<ApiResult<DisconnectFromAgentResponse>> {
  try {
    return apiSuccess(await disconnectFromAgent());
  } catch (error) {
    return apiFailure(error);
  }
}
