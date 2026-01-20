/**
 * Custom hooks for billing data
 * Uses React Query for caching and automatic refetching
 */

'use client';

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import {
  getBalance,
  getUsage,
  getUsageForMonth,
  getTransactions,
  getMonthlySpending,
  getWalletStatus,
  type GetUsageParams,
  type GetUsageForMonthParams,
  type GetTransactionsParams,
  type GetMonthlySpendingParams,
} from '@/lib/api/billing';
import type {
  BalanceResponse,
  UsageListResponse,
  LedgerListResponse,
  MonthlySpendingResponse,
  WalletStatusResponse,
  WalletLinkRequest,
} from '@/types/billing';

// ========== Balance Hook ==========

export function useBillingBalance(options?: {
  refetchInterval?: number;
  enabled?: boolean;
}): UseQueryResult<BalanceResponse, Error> {
  const { getValidToken, isAuthenticated } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'balance'],
    queryFn: async () => {
      // Return default/empty state if not authenticated yet, to avoid error flash
      if (!isAuthenticated) return { paid: { posted_balance: '0', pending_holds: '0', available: '0' }, staking: { daily_amount: '0', refresh_date: null, available: '0' }, total_available: '0' };
      
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return getBalance(token);
    },
    refetchInterval: options?.refetchInterval ?? 30000,
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      // Don't retry if it's an auth error
      if (error.message === 'Not authenticated') return false;
      return failureCount < 3;
    }
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
      if (!token) throw new Error('Not authenticated');
      return getUsage(token, params);
    },
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
    refetchInterval: options?.refetchInterval ?? 60000,
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      // Don't retry if it's an auth error
      if (error.message === 'Not authenticated') return false;
      return failureCount < 3;
    }
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
    mutationFn: async (walletId: number) => {
      const token = await getValidToken();
      if (!token) throw new Error('Not authenticated');
      return unlinkWallet(token, walletId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
    }
  });
}
