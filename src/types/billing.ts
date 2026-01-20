/**
 * Billing TypeScript types generated from OpenAPI schema
 * API Version: v1.12.13-test
 */

// ========== Balance Types ==========

export interface PaidBalanceInfo {
  posted_balance: string;
  pending_holds: string;
  available: string;
}

export interface StakingBalanceInfo {
  daily_amount: string;
  refresh_date: string | null;
  available: string;
}

export interface BalanceResponse {
  paid: PaidBalanceInfo;
  staking: StakingBalanceInfo;
  total_available: string;
  currency?: string;
}

// ========== Usage Types ==========

export interface UsageEntryResponse {
  id: string;
  created_at: string;
  model_name: string | null;
  model_id: string | null;
  endpoint: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tokens_total: number | null;
  amount_paid: string;
  amount_staking: string;
  amount_total: string;
  request_id: string | null;
}

export interface UsageListResponse {
  items: UsageEntryResponse[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ========== Transaction Types ==========

export type LedgerStatusEnum = 'pending' | 'posted' | 'voided';
export type LedgerEntryTypeEnum = 
  | 'purchase' 
  | 'staking_refresh' 
  | 'usage_hold' 
  | 'usage_charge' 
  | 'refund' 
  | 'adjustment';

export interface LedgerEntryResponse {
  id: string;
  user_id: number;
  currency: string;
  status: LedgerStatusEnum;
  entry_type: LedgerEntryTypeEnum;
  amount_paid: string;
  amount_staking: string;
  amount_total: string;
  idempotency_key: string | null;
  related_entry_id: string | null;
  payment_source: string | null;
  external_transaction_id: string | null;
  payment_metadata: Record<string, any> | null;
  request_id: string | null;
  api_key_id: number | null;
  model_name: string | null;
  model_id: string | null;
  endpoint: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tokens_total: number | null;
  input_price_per_million: string | null;
  output_price_per_million: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerListResponse {
  items: LedgerEntryResponse[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ========== Spending Types ==========

export type SpendingModeEnum = 'gross' | 'net';

export interface MonthlySpending {
  year: number;
  month: number;
  amount: string;
  transaction_count?: number;
}

export interface MonthlySpendingResponse {
  year: number;
  mode: SpendingModeEnum;
  months?: MonthlySpending[];
  total: string;
  currency?: string;
}

// ========== Wallet Types ==========

export interface WalletLinkResponse {
  id: number;
  wallet_address: string;
  staked_amount?: string;
  linked_at: string;
  updated_at: string;
}

export interface WalletStatusResponse {
  has_wallets: boolean;
  wallet_count: number;
  total_staked?: string;
  wallets?: WalletLinkResponse[];
}

export interface NonceResponse {
  nonce: string;
  message_template: string;
  expires_in?: number;
}

export interface WalletLinkRequest {
  wallet_address: string;
  signature: string;
  message: string;
  nonce: string;
  timestamp: string;
}

// ========== API Key Types ==========

export interface APIKeyDB {
  id: number;
  key_prefix: string;
  name: string | null;
  created_at: string;
  is_active: boolean;
  is_default?: boolean;
  encrypted_key: string | null;
  encryption_version?: number;
}

// ========== Aggregation Types (Client-side) ==========

export interface DailyAggregation {
  date: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  cost_staking: number;
  cost_balance: number;
}

export interface ApiKeyBreakdown {
  keyId: string;
  keyName: string;
  usage: number;
  cost: number;
}

export interface ModelBreakdown {
  modelName: string;
  usage: number;
  cost: number;
}

export interface TokenTypeBreakdown {
  type: 'input' | 'output';
  tokens: number;
  cost: number;
}

// ========== Time Range Types ==========

export type TimeRange = '24h' | '7d' | '30d' | 'custom';

export interface CustomDateRange {
  start: string;
  end: string;
}

// ========== Statistics Types ==========

export interface DailyStats {
  min: number;
  max: number;
  avg: number;
}

export interface UsageStatistics {
  cost: DailyStats;
  inputs: DailyStats;
  outputs: DailyStats;
}
