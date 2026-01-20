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
} from '@/types/billing';

// ========== Balance Hook ==========

export function useBillingBalance(options?: {
  refetchInterval?: number;
  enabled?: boolean;
}): UseQueryResult<BalanceResponse, Error> {
  const { getIdToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'balance'],
    queryFn: async () => {
      const token = await getIdToken();
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
  const { getIdToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'usage', params],
    queryFn: async () => {
      const token = await getIdToken();
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
  const { getIdToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'usage', 'month', params],
    queryFn: async () => {
      const token = await getIdToken();
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
  const { getIdToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'transactions', params],
    queryFn: async () => {
      const token = await getIdToken();
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
  const { getIdToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['billing', 'spending', params],
    queryFn: async () => {
      const token = await getIdToken();
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
  const { getIdToken } = useCognitoAuth();

  return useQuery({
    queryKey: ['wallet', 'status'],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');
      return getWalletStatus(token);
    },
    refetchInterval: options?.refetchInterval ?? 60000, // Refresh every 60s by default
    enabled: options?.enabled ?? true,
  });
}
