/**
 * Billing utility functions for data aggregation, date formatting, and CSV export
 */

import type {
  UsageEntryResponse,
  DailyAggregation,
  APIKeyDB,
  TimeRange,
  CustomDateRange,
  DailyStats,
} from '@/types/billing';

// ========== Date Utilities ==========

/**
 * Manually parse ISO date string to avoid timezone shifting
 * Critical for accurate daily aggregations
 */
export function parseISODateManually(isoString: string): Date {
  const parts = isoString.split('T')[0].split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(isoString);
}

/**
 * Ensure a timestamp string is parsed as UTC (MOR-368).
 *
 * The API may return timestamps without timezone info (e.g. "2026-02-25T00:10:00").
 * JavaScript treats such strings as *local* time, not UTC, which shifts the date
 * by the user's UTC offset and causes display bugs like "-1 days ago".
 *
 * This function appends "Z" when no timezone indicator is present so the string
 * is always interpreted as UTC, matching the server's intent.
 */
export function ensureUTCTimestamp(dateString: string): string {
  // Already has timezone info: "Z" suffix or "+/-HH:MM" / "+/-HHMM" offset
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(dateString)) return dateString;
  // Normalise space-separated format ("2026-02-25 00:10:00") to ISO, then mark UTC
  return dateString.replace(' ', 'T') + 'Z';
}

/**
 * Format date as MM/DD for chart displays
 */
export function formatChartDate(dateString: string): string {
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  }
  return dateString;
}

/**
 * Get browser locale, falling back to 'en-US' if not available
 */
function getBrowserLocale(): string {
  if (typeof window === 'undefined') {
    return 'en-US';
  }
  // Use navigator.language which reflects the browser's language setting
  return navigator.language || navigator.languages?.[0] || 'en-US';
}

/**
 * Format date using browser's locale
 * Uses the format selected on the browser (e.g., dd/mm/YYYY for EU, mm/dd/YYYY for US)
 */
export function formatLocaleDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getBrowserLocale();
  return dateObj.toLocaleDateString(locale);
}

/**
 * Format time using browser's locale
 * Uses the format selected on the browser (e.g., 24h for EU, am/pm for US)
 */
export function formatLocaleTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getBrowserLocale();
  
  // Check if locale prefers 24-hour format (most European locales)
  // US, Canada, and some other countries use 12-hour format
  const uses12HourFormat = locale.startsWith('en-US') || 
                          locale.startsWith('en-CA') || 
                          locale.startsWith('en-PH') ||
                          locale.startsWith('en-IN');
  
  return dateObj.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: uses12HourFormat
  });
}

/**
 * Format date in GMT timezone (MOR-350)
 * Returns format: YYYY-MM-DD
 */
export function formatGMTDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}

/**
 * Format time in GMT timezone (MOR-350)
 * Returns format: HH:MM:SS GMT
 */
export function formatGMTTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const timeStr = dateObj.toISOString().split('T')[1].split('.')[0];
  return `${timeStr} GMT`;
}

/**
 * Format full date and time in GMT timezone (MOR-350)
 * Returns format: YYYY-MM-DD HH:MM:SS GMT
 */
export function formatGMTDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const isoStr = dateObj.toISOString();
  const [datePart, timePart] = isoStr.split('T');
  const timeOnly = timePart.split('.')[0];
  return `${datePart} ${timeOnly} GMT`;
}

/**
 * Format date and time using browser's locale
 * Combines date and time in a single formatted string
 */
export function formatLocaleDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getBrowserLocale();
  return dateObj.toLocaleString(locale, options);
}

/**
 * Get date range based on time range selection.
 * Uses stable time boundaries (rounded to the start of the current minute)
 * to ensure consistent API query params and cache keys across renders/refreshes.
 */
export function getDateRangeForTimeRange(
  timeRange: TimeRange,
  customRange?: CustomDateRange
): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (timeRange === 'custom' && customRange) {
    start = new Date(customRange.start);
    // Add one day to end date to include the full day
    end = new Date(new Date(customRange.end).getTime() + 24 * 60 * 60 * 1000 - 1);
  } else {
    // Round 'end' to the start of the current minute for cache stability.
    // Within the same minute, repeated calls produce identical boundaries,
    // preventing unnecessary refetches and cache key mismatches.
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);

    switch (timeRange) {
      case '24h':
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        // Start at midnight N days ago for clean day boundaries
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
        break;
      case '30d':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
    }
  }

  return { start, end };
}

// ========== Data Aggregation ==========

/**
 * Aggregate usage entries by date
 */
export function aggregateUsageByDate(
  entries: UsageEntryResponse[]
): DailyAggregation[] {
  const grouped: Record<string, DailyAggregation> = {};

  entries.forEach((entry) => {
    const date = entry.created_at.split('T')[0]; // Get YYYY-MM-DD

    if (!grouped[date]) {
      grouped[date] = {
        date,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost: 0,
        cost_staking: 0,
        cost_balance: 0,
      };
    }

    grouped[date].input_tokens += entry.tokens_input ?? 0;
    grouped[date].output_tokens += entry.tokens_output ?? 0;
    grouped[date].total_tokens += entry.tokens_total ?? 0;
    grouped[date].cost += parseFloat(entry.amount_total);
    grouped[date].cost_staking += parseFloat(entry.amount_staking);
    grouped[date].cost_balance += parseFloat(entry.amount_paid);
  });

  // Fill gaps if needed
  const dates = Object.keys(grouped).sort();
  if (dates.length > 1) {
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: dateStr,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost: 0,
          cost_staking: 0,
          cost_balance: 0,
        };
      }
    }
  }

  return Object.values(grouped).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Aggregate usage by API key
 */
export function aggregateUsageByKey(
  entries: UsageEntryResponse[],
  apiKeys: APIKeyDB[]
): Record<string, { tokens: number; cost: number; name: string }> {
  const grouped: Record<string, { tokens: number; cost: number; name: string }> = {};

  // Initialize with all keys
  apiKeys.forEach((key) => {
    grouped[key.id.toString()] = {
      tokens: 0,
      cost: 0,
      name: key.name || key.key_prefix,
    };
  });

  // Aggregate data
  entries.forEach((entry) => {
    const keyId = entry.request_id?.split('_')[0] || 'unknown'; // Extract key from request_id if available
    
    if (!grouped[keyId]) {
      grouped[keyId] = {
        tokens: 0,
        cost: 0,
        name: 'Unknown Key',
      };
    }

    grouped[keyId].tokens += entry.tokens_total ?? 0;
    grouped[keyId].cost += parseFloat(entry.amount_total);
  });

  return grouped;
}

/**
 * Aggregate usage by model
 */
export function aggregateUsageByModel(
  entries: UsageEntryResponse[]
): Record<string, { tokens: number; cost: number }> {
  const grouped: Record<string, { tokens: number; cost: number }> = {};

  entries.forEach((entry) => {
    const modelName = entry.model_name || 'Unknown Model';

    if (!grouped[modelName]) {
      grouped[modelName] = {
        tokens: 0,
        cost: 0,
      };
    }

    grouped[modelName].tokens += entry.tokens_total ?? 0;
    grouped[modelName].cost += parseFloat(entry.amount_total);
  });

  return grouped;
}

/**
 * Calculate daily statistics (min, max, avg)
 */
export function calculateDailyStats(dailyData: DailyAggregation[]): {
  cost: DailyStats;
  inputs: DailyStats;
  outputs: DailyStats;
} | null {
  if (dailyData.length === 0) return null;

  const costs = dailyData.map((d) => d.cost);
  const inputs = dailyData.map((d) => d.input_tokens);
  const outputs = dailyData.map((d) => d.output_tokens);

  const calculateStats = (arr: number[]): DailyStats => ({
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  });

  return {
    cost: calculateStats(costs),
    inputs: calculateStats(inputs),
    outputs: calculateStats(outputs),
  };
}

// ========== CSV Export ==========

/**
 * Generate CSV from usage entries
 */
export function generateUsageCSV(entries: UsageEntryResponse[]): string {
  const headers = [
    'Date',
    'Model',
    'Endpoint',
    'Input Tokens',
    'Output Tokens',
    'Total Tokens',
    'Cost (Staking)',
    'Cost (Paid)',
    'Total Cost',
    'Request ID',
  ];

  const rows = entries.map((entry) => [
    new Date(entry.created_at).toISOString(),
    entry.model_name || '',
    entry.endpoint || '',
    entry.tokens_input?.toString() || '0',
    entry.tokens_output?.toString() || '0',
    entry.tokens_total?.toString() || '0',
    entry.amount_staking,
    entry.amount_paid,
    entry.amount_total,
    entry.request_id || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ========== Formatting Utilities ==========

/**
 * Format currency amount - shows 4 decimals for small amounts < $0.01
 */
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Math.abs(num) < 0.01 && num !== 0) {
    return `$${num.toFixed(4)}`;
  }
  return `$${num.toFixed(2)}`;
}

/**
 * Format large numbers with K/M suffix
 * MOR-350: For numbers < 1000, show as integer (no decimals)
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  // Round to integer for numbers < 1000
  return Math.round(num).toString();
}

/**
 * Get readable key name from API key object
 */
export function getKeyName(keyId: string | number, apiKeys: APIKeyDB[]): string {
  const key = apiKeys.find((k) => k.id.toString() === keyId.toString());
  return key?.name || key?.key_prefix || 'Unknown Key';
}

// ========== Ledger Entry Aggregation (MOR-350) ==========

import type { LedgerEntryResponse } from '@/types/billing';

/**
 * Aggregated transaction entry grouped by day, API key, and model (MOR-350)
 */
export interface AggregatedTransaction {
  date: string; // YYYY-MM-DD
  api_key_id: number | null;
  api_key_name: string;
  model_name: string | null;
  entry_type: string;
  total_amount: number;
  total_amount_paid: number;
  total_amount_staking: number;
  transaction_count: number;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
}

/**
 * Aggregate ledger entries by day, API key, and model (MOR-350)
 * Groups transactions and sums amounts for each unique combination
 */
export function aggregateLedgerEntriesByDayKeyModel(
  entries: LedgerEntryResponse[],
  apiKeys: APIKeyDB[] = []
): AggregatedTransaction[] {
  const grouped: Record<string, AggregatedTransaction> = {};

  entries.forEach((entry) => {
    // Extract date (YYYY-MM-DD)
    const date = entry.created_at.split('T')[0];
    
    // Get API key info
    const apiKeyId = entry.api_key_id ?? null;
    const apiKeyName = apiKeyId 
      ? getKeyName(apiKeyId, apiKeys) 
      : 'No API Key';
    
    // Get model name
    const modelName = entry.model_name ?? 'No Model';
    
    // Create unique key for grouping
    const groupKey = `${date}|${apiKeyId}|${modelName}|${entry.entry_type}`;
    
    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        date,
        api_key_id: apiKeyId,
        api_key_name: apiKeyName,
        model_name: modelName,
        entry_type: entry.entry_type,
        total_amount: 0,
        total_amount_paid: 0,
        total_amount_staking: 0,
        transaction_count: 0,
        tokens_input: 0,
        tokens_output: 0,
        tokens_total: 0,
      };
    }
    
    // Aggregate values
    grouped[groupKey].total_amount += parseFloat(entry.amount_total);
    grouped[groupKey].total_amount_paid += parseFloat(entry.amount_paid);
    grouped[groupKey].total_amount_staking += parseFloat(entry.amount_staking);
    grouped[groupKey].transaction_count += 1;
    grouped[groupKey].tokens_input += entry.tokens_input ?? 0;
    grouped[groupKey].tokens_output += entry.tokens_output ?? 0;
    grouped[groupKey].tokens_total += entry.tokens_total ?? 0;
  });

  // Sort by date (newest first), then by API key, then by model
  return Object.values(grouped).sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    
    const keyCompare = (a.api_key_name || '').localeCompare(b.api_key_name || '');
    if (keyCompare !== 0) return keyCompare;
    
    return (a.model_name || '').localeCompare(b.model_name || '');
  });
}
