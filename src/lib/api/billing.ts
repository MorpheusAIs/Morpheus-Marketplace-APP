/**
 * Billing API Client
 * Handles all billing-related API calls including balance, usage, transactions, and wallet management
 */

import { apiGet, apiPost, apiPut, apiDelete, buildApiUrl, type ApiResponse } from './client';
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
  BillingPreferencesResponse,
  BillingPreferencesUpdateRequest,
} from '@/types/billing';

/**
 * Helper to convert any error value to a string message
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    // Handle FastAPI-style validation errors: { "detail": [{ "msg": "...", "loc": [...] }] }
    if ('detail' in error) {
      const detail = (error as { detail: unknown }).detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (Array.isArray(detail)) {
        // Validation error array
        return detail.map((d: any) => d?.msg || d?.message || JSON.stringify(d)).join('; ');
      }
      if (typeof detail === 'object' && detail !== null) {
        // Nested object
        return JSON.stringify(detail);
      }
    }
    // Handle standard error objects
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    // Fallback to JSON stringification
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Helper to unwrap API responses and handle errors
 */
async function request<T>(promise: Promise<ApiResponse<T>>): Promise<T> {
  try {
    const response = await promise;
    
    // Log success for debugging (remove in prod)
    if (process.env.NODE_ENV === 'development') {
      console.log('[BillingAPI] Response:', { 
        status: response.status, 
        hasData: !!response.data,
        error: response.error 
      });
    }

    if (response.error) {
      const errMsg = getErrorMessage(response.error);
      console.error('[BillingAPI] Request failed:', errMsg);
      throw new Error(errMsg);
    }
    
    if (!response.data && response.status !== 204) {
      console.error('[BillingAPI] No data returned from API', response);
      throw new Error('No data returned from API');
    }
    
    return response.data as T;
  } catch (err) {
    console.error('[BillingAPI] Network or parsing error:', err);
    throw err;
  }
}

// ========== Balance API ==========

/**
 * Get current credit balance (paid + staking buckets)
 */
export async function getBalance(token: string): Promise<BalanceResponse> {
  const url = buildApiUrl('/billing/balance');
  return request(apiGet<BalanceResponse>(url, token));
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
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[BillingAPI] Fetching usage:', {
      url,
      params: {
        limit: params?.limit,
        offset: params?.offset,
        from: params?.from,
        to: params?.to,
        model: params?.model,
      },
    });
  }
  
  return request(apiGet<UsageListResponse>(url, token));
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
  return request(apiGet<UsageListResponse>(url, token));
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
  return request(apiGet<LedgerListResponse>(url, token));
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
  return request(apiGet<MonthlySpendingResponse>(url, token));
}

// ========== Wallet API ==========

/**
 * Get wallet linking status and staking info
 */
export async function getWalletStatus(token: string): Promise<WalletStatusResponse> {
  const url = buildApiUrl('/auth/wallet/');
  return request(apiGet<WalletStatusResponse>(url, token));
}

/**
 * Generate nonce for wallet signature
 */
export async function generateWalletNonce(token: string, walletAddress: string): Promise<NonceResponse> {
  const url = buildApiUrl(`/auth/wallet/nonce/${walletAddress}`);
  // Using POST as per OpenAPI spec
  return request(apiPost<NonceResponse>(url, {}, token));
}

/**
 * Link wallet with signature
 */
export async function linkWallet(
  token: string,
  data: WalletLinkRequest
): Promise<WalletLinkResponse> {
  const url = buildApiUrl('/auth/wallet/link');
  return request(apiPost<WalletLinkResponse>(url, data, token));
}

/**
 * Unlink a wallet
 */
export async function unlinkWallet(
  token: string,
  walletAddress: string
): Promise<{ message: string; wallet_address: string }> {
  const url = buildApiUrl(`/auth/wallet/${walletAddress}`);
  return request(apiDelete<{ message: string; wallet_address: string }>(url, token));
}

/**
 * Check if a wallet address is available to be linked
 */
export async function checkWalletAvailability(
  walletAddress: string
): Promise<{ wallet_address: string; is_available: boolean }> {
  const url = buildApiUrl(`/auth/wallet/check/${walletAddress}`);
  // This endpoint is likely public, but we can pass token if available/needed. 
  // Based on previous code it didn't use token. 
  // apiGet(url, undefined)
  return request(apiGet<{ wallet_address: string; is_available: boolean }>(url));
}

// ========== Convenience API URLs ==========

// ========== Billing Preferences API ==========

export async function getBillingPreferences(token: string): Promise<BillingPreferencesResponse> {
  const url = buildApiUrl('/billing/preferences');
  return request(apiGet<BillingPreferencesResponse>(url, token));
}

export async function updateBillingPreferences(
  token: string,
  data: BillingPreferencesUpdateRequest
): Promise<BillingPreferencesResponse> {
  const url = buildApiUrl('/billing/preferences');
  return request(apiPut<BillingPreferencesResponse>(url, data, token));
}

export const BILLING_URLS = {
  balance: () => buildApiUrl('/billing/balance'),
  usage: () => buildApiUrl('/billing/usage'),
  usageMonth: () => buildApiUrl('/billing/usage/month'),
  transactions: () => buildApiUrl('/billing/transactions'),
  spending: () => buildApiUrl('/billing/spending'),
  preferences: () => buildApiUrl('/billing/preferences'),
  walletStatus: () => buildApiUrl('/auth/wallet/'),
  walletNonce: () => buildApiUrl('/auth/wallet/nonce'),
  walletLink: () => buildApiUrl('/auth/wallet/link'),
  walletUnlink: (walletId: number) => buildApiUrl(`/auth/wallet/${walletId}`),
  walletCheck: (address: string) => buildApiUrl(`/auth/wallet/check/${address}`),
};
