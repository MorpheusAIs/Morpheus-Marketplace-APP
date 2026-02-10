/**
 * Custom hooks for billing data
 * Uses React Query for caching and automatic refetching
 */

'use client';

import { useQuery, UseQueryResult, keepPreviousData } from '@tanstack/react-query';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import {
  getBalance,
  getUsage,
  getUsageForMonth,
  getTransactions,
  getMonthlySpending,
  getWalletStatus,
  getBillingPreferences,
  updateBillingPreferences,
  type GetUsageParams,
  type GetUsageForMonthParams,
  type GetTransactionsParams,
  type GetMonthlySpendingParams,
} from '@/lib/api/billing';
import type {
  BalanceResponse,
  UsageListResponse,
  UsageEntryResponse,
  LedgerListResponse,
  MonthlySpendingResponse,
  WalletStatusResponse,
  WalletLinkRequest,
  BillingPreferencesResponse,
  BillingPreferencesUpdateRequest,
} from '@/types/billing';

// ========== Balance Hook ==========

export function useBillingBalance(options?: {
  refetchInterval?: number;
  enabled?: boolean;
}): UseQueryResult<BalanceResponse, Error> {
  const { getValidToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'balance'],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return getBalance(token);
    },
    refetchInterval: options?.refetchInterval ?? 30000, // Refresh every 30s by default
    enabled: options?.enabled ?? true,
  });
}

// ========== Usage Hooks ==========

export function useBillingUsage(
  params?: GetUsageParams,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<UsageListResponse, Error> {
  const { getValidToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'usage', params],
    queryFn: async () => {
      const token = await getValidToken();
      if (process.env.NODE_ENV === 'development') {
        console.log('[useBillingUsage] Token status:', token ? 'Present' : 'Missing');
      }
      if (!token) throw new Error('Not authenticated');
      return getUsage(token, params);
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Fetch ALL usage entries across all pages.
 * The API returns max 100 entries per page. This hook iterates through
 * all pages to ensure complete data, preventing metric fluctuations
 * caused by only seeing a partial first page of results.
 */
export function useBillingUsageAll(
  params?: Omit<GetUsageParams, 'limit' | 'offset'>,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<UsageListResponse, Error> {
  const { getValidToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'usage', 'all', params],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');

      const PAGE_SIZE = 100;
      const allItems: UsageEntryResponse[] = [];
      let offset = 0;
      let hasMore = true;
      let total = 0;

      while (hasMore) {
        const response = await getUsage(token, {
          ...params,
          limit: PAGE_SIZE,
          offset,
        });

        allItems.push(...response.items);
        total = response.total;
        hasMore = response.has_more;
        offset += PAGE_SIZE;

        // Safety limit to prevent runaway loops
        if (offset > 10000) break;
      }

      return {
        items: allItems,
        total,
        limit: total,
        offset: 0,
        has_more: false,
      };
    },
    staleTime: 60_000, // Data stays fresh for 1 minute
    placeholderData: keepPreviousData, // Keep showing old data while fetching new
    enabled: options?.enabled ?? true,
  });
}

export function useBillingUsageForMonth(
  params: GetUsageForMonthParams,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<UsageListResponse, Error> {
  const { getValidToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'usage', 'month', params],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return getUsageForMonth(token, params);
    },
    enabled: options?.enabled ?? true,
  });
}

// ========== Transactions Hook ==========

export function useBillingTransactions(
  params?: GetTransactionsParams,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<LedgerListResponse, Error> {
  const { getValidToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'transactions', params],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return getTransactions(token, params);
    },
    enabled: options?.enabled ?? true,
  });
}

// ========== Spending Hook ==========

export function useBillingSpending(
  params?: GetMonthlySpendingParams,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<MonthlySpendingResponse, Error> {
  const { getValidToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'spending', params],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return getMonthlySpending(token, params);
    },
    enabled: options?.enabled ?? true,
  });
}

// ========== Wallet Status Hook ==========

export function useWalletStatus(options?: {
  refetchInterval?: number;
  enabled?: boolean;
}): UseQueryResult<WalletStatusResponse, Error> {
  const { getValidToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['wallet', 'status'],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return getWalletStatus(token);
    },
    refetchInterval: options?.refetchInterval ?? 60000, // Refresh every 60s by default
    enabled: options?.enabled ?? true,
  });
}

// ========== Wallet Mutation Hooks ==========

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateWalletNonce,
  linkWallet,
  unlinkWallet,
  checkWalletAvailability,
} from '@/lib/api/billing';

export function useGenerateWalletNonce() {
  const { getValidToken } = useCognitoAuth();
  
  return useMutation({
    mutationFn: async (walletAddress: string) => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return generateWalletNonce(token, walletAddress);
    }
  });
}

export function useLinkWallet() {
  const { getValidToken } = useCognitoAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: WalletLinkRequest) => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return linkWallet(token, data);
    },
    onSuccess: () => {
      // Invalidate wallet status to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
    }
  });
}

export function useUnlinkWallet() {
  const { getValidToken } = useCognitoAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (walletAddress: string) => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return unlinkWallet(token, walletAddress);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
    }
  });
}

// ========== Billing Preferences Hooks ==========

export function useBillingPreferences(options?: {
  enabled?: boolean;
}): UseQueryResult<BillingPreferencesResponse, Error> {
  const { getValidToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'preferences'],
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return getBillingPreferences(token);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateBillingPreferences() {
  const { getValidToken } = useCognitoAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: BillingPreferencesUpdateRequest) => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return updateBillingPreferences(token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'preferences'] });
    }
  });
}
