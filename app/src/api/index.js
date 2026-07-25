// src/api/index.js
// ملف مركزي لتصدير جميع APIs

export * from './auth';
export * from './wallets';
export * from './store';
export * from './payment';
export * from './transactions';
export * from './system';
export * from './paymentMethods';
export * from './qrcode';

export {
  getAgents,
  getAgentUsers,
  getByFullUrl,
  getAgentCommission,
  getAgentRegions,
  makeAgentPurchase,
  approveTransaction as approveAgentTransaction,
} from './agent';

export {
  createDepositRequest,
  listDepositRequests,
  getDepositCounts as getDepositCountsFromDeposits,
} from './deposits';

// Export client و helpers
export { default as api } from './client';
export { agentsApi, buildUrl, absolutizeUrl, API_ROOT, API_BASE } from './client';
