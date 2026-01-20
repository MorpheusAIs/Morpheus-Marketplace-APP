/**
 * Billing API Client
 * Handles all billing-related API calls including balance, usage, transactions, and wallet management
 */

import { apiGet, apiPost, apiDelete, buildApiUrl } from './client';
import type {
  BalanceResponse,
  UsageListResponse,
  LedgerListResponse,
  MonthlySpendingResponse,
  WalletStatusResponse,
  WalletLinkRequest,
  WalletLinkResponse,
  NonceResponse,
  SpendingModeEnum,
  LedgerEntryTypeEnum,
} from '@/types/billing';

// ========== Balance API ==========

/**
 * Get current credit balance (paid + staking buckets)
 */
export async function getBalance(token: string): Promise<BalanceResponse> {
  const url = buildApiUrl('/billing/balance');
  return apiGet<BalanceResponse>(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

// ========== Usage API ==========

export interface GetUsageParams {
  limit?: number;
  offset?: number;
  from?: string; // ISO datetime
  to?: string; // ISO datetime
  model?: string;
}

/**
 * Get paginated usage entries
 */
export async function getUsage(
  token: string,
  params?: GetUsageParams
): Promise<UsageListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.model) queryParams.append('model', params.model);

  const url = buildApiUrl(`/billing/usage${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  return apiGet<UsageListResponse>(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

export interface GetUsageForMonthParams {
  year: number;
  month: number; // 1-12
  limit?: number;
  offset?: number;
}

/**
 * Get usage for a specific month
 */
export async function getUsageForMonth(
  token: string,
  params: GetUsageForMonthParams
): Promise<UsageListResponse> {
  const queryParams = new URLSearchParams({
    year: params.year.toString(),
    month: params.month.toString(),
  });
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());

  const url = buildApiUrl(`/billing/usage/month?${queryParams.toString()}`);
  return apiGet<UsageListResponse>(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

// ========== Transactions API ==========

export interface GetTransactionsParams {
  limit?: number;
  offset?: number;
  entry_type?: LedgerEntryTypeEnum;
  from?: string; // ISO datetime
  to?: string; // ISO datetime
}

/**
 * Get paginated transaction history (ledger entries)
 */
export async function getTransactions(
  token: string,
  params?: GetTransactionsParams
): Promise<LedgerListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.entry_type) queryParams.append('entry_type', params.entry_type);
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);

  const url = buildApiUrl(`/billing/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  return apiGet<LedgerListResponse>(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

// ========== Spending API ==========

export interface GetMonthlySpendingParams {
  year?: number;
  mode?: SpendingModeEnum;
}

/**
 * Get monthly spending metrics for a year
 */
export async function getMonthlySpending(
  token: string,
  params?: GetMonthlySpendingParams
): Promise<MonthlySpendingResponse> {
  const queryParams = new URLSearchParams();
  if (params?.year) queryParams.append('year', params.year.toString());
  if (params?.mode) queryParams.append('mode', params.mode);

  const url = buildApiUrl(`/billing/spending${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  return apiGet<MonthlySpendingResponse>(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

// ========== Wallet API ==========

/**
 * Get wallet linking status and staking info
 */
export async function getWalletStatus(token: string): Promise<WalletStatusResponse> {
  const url = buildApiUrl('/auth/wallet/');
  return apiGet<WalletStatusResponse>(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

/**
 * Generate nonce for wallet signature
 */
export async function generateWalletNonce(token: string): Promise<NonceResponse> {
  const url = buildApiUrl('/auth/wallet/nonce');
  return apiPost<NonceResponse>(url, {}, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

/**
 * Link wallet with signature
 */
export async function linkWallet(
  token: string,
  data: WalletLinkRequest
): Promise<WalletLinkResponse> {
  const url = buildApiUrl('/auth/wallet/link');
  return apiPost<WalletLinkResponse>(url, data, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

/**
 * Unlink a wallet
 */
export async function unlinkWallet(
  token: string,
  walletId: number
): Promise<{ message: string; wallet_address: string }> {
  const url = buildApiUrl(`/auth/wallet/${walletId}`);
  return apiDelete<{ message: string; wallet_address: string }>(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

/**
 * Check if a wallet address is available to be linked
 */
export async function checkWalletAvailability(
  walletAddress: string
): Promise<{ wallet_address: string; is_available: boolean }> {
  const url = buildApiUrl(`/auth/wallet/check/${walletAddress}`);
  return apiGet<{ wallet_address: string; is_available: boolean }>(url);
}

// ========== Convenience API URLs ==========

export const BILLING_URLS = {
  balance: () => buildApiUrl('/billing/balance'),
  usage: () => buildApiUrl('/billing/usage'),
  usageMonth: () => buildApiUrl('/billing/usage/month'),
  transactions: () => buildApiUrl('/billing/transactions'),
  spending: () => buildApiUrl('/billing/spending'),
  walletStatus: () => buildApiUrl('/auth/wallet/'),
  walletNonce: () => buildApiUrl('/auth/wallet/nonce'),
  walletLink: () => buildApiUrl('/auth/wallet/link'),
  walletUnlink: (walletId: number) => buildApiUrl(`/auth/wallet/${walletId}`),
  walletCheck: (address: string) => buildApiUrl(`/auth/wallet/check/${address}`),
};
