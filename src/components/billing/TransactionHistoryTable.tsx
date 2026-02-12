'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  Search,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBillingTransactions, useBillingTransactionsAll } from '@/lib/hooks/use-billing';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { 
  formatCurrency, 
  downloadCSV, 
  formatGMTDate, 
  formatGMTTime,
  aggregateLedgerEntriesByDayKeyModel,
  type AggregatedTransaction,
} from '@/lib/utils/billing-utils';
import {
  validateLedgerEntries,
  reportValidationIssues,
  shouldDisplayData,
} from '@/lib/utils/data-isolation-validator';
import type { LedgerEntryResponse, LedgerEntryTypeEnum, LedgerStatusEnum } from '@/types/billing';

const ENTRY_TYPES: { value: LedgerEntryTypeEnum | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'usage_hold', label: 'Usage Hold' },
  { value: 'usage_charge', label: 'Usage Charge' },
  { value: 'refund', label: 'Refund' },
  { value: 'adjustment', label: 'Adjustment' },
];

const STATUS_TYPES: { value: LedgerStatusEnum | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'posted', label: 'Posted' },
  { value: 'voided', label: 'Voided' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'posted':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'voided':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'purchase':
      return 'bg-green-500/10 text-green-500';
    case 'usage_charge':
      return 'bg-blue-500/10 text-blue-500';
    case 'refund':
      return 'bg-purple-500/10 text-purple-500';
    case 'staking_refresh':
      return 'bg-orange-500/10 text-orange-500';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

interface TransactionHistoryTableProps {
  dateRange?: {
    start: Date;
    end: Date;
  };
  timeRangeLabel?: string;
}

export function TransactionHistoryTable({ dateRange, timeRangeLabel }: TransactionHistoryTableProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10; // MOR-350: Fixed page size of 10 aggregated records
  const [selectedType, setSelectedType] = useState<LedgerEntryTypeEnum | 'all'>('all');
  const { user, apiKeys } = useCognitoAuth();
  
  // Debug logging for date range
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && dateRange) {
      console.log('[TransactionHistoryTable] Date range updated:', {
        from: dateRange.start.toISOString(),
        to: dateRange.end.toISOString(),
        label: timeRangeLabel,
      });
    }
  }, [dateRange, timeRangeLabel]);
  
  // MOR-350 FIX: Use useBillingTransactionsAll to fetch ALL transactions across all pages
  // This ensures we show data spanning the full date range, not just the first 100 records
  const { data, isLoading, error } = useBillingTransactionsAll({
    entry_type: selectedType === 'all' ? undefined : selectedType,
    from: dateRange?.start.toISOString(),
    to: dateRange?.end.toISOString(),
  });

  // Debug logging for fetched data
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && data) {
      const uniqueDates = new Set(data.items.map(item => formatGMTDate(item.created_at)));
      const expectedStartDate = dateRange ? formatGMTDate(dateRange.start) : 'none';
      const expectedEndDate = dateRange ? formatGMTDate(dateRange.end) : 'none';
      
      console.log('[TransactionHistoryTable] Data fetched:', {
        totalItems: data.items.length,
        total: data.total,
        requestedDateRange: dateRange ? {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString(),
          fromDate: expectedStartDate,
          toDate: expectedEndDate,
        } : 'none',
        actualDatesInResponse: Array.from(uniqueDates).sort(),
        uniqueDateCount: uniqueDates.size,
        sampleTransactions: data.items.slice(0, 3).map(item => ({
          date: formatGMTDate(item.created_at),
          type: item.entry_type,
          amount: item.amount_total,
        })),
      });
      
      // CRITICAL: Detect if backend is ignoring date filter
      if (dateRange && uniqueDates.size === 1 && data.items.length >= 100) {
        const onlyDate = Array.from(uniqueDates)[0];
        console.warn('⚠️ [BACKEND BUG] All transactions from single date:', onlyDate);
        console.warn('⚠️ Expected date range:', expectedStartDate, 'to', expectedEndDate);
        console.warn('⚠️ This suggests the backend is ignoring the from/to parameters!');
      }
    }
  }, [data, dateRange]);

  // Reset page when type filter or date range changes
  useEffect(() => {
    setPage(1); // Reset to first page when filter changes
  }, [selectedType, dateRange]);

  // MOR-333: Validate data isolation for ledger entries
  const validationResult = useMemo(() => {
    if (!data?.items || data.items.length === 0) return null;
    
    return validateLedgerEntries(data.items, {
      cognitoSub: user?.sub,
      userEmail: user?.email,
    });
  }, [data, user]);

  // Report validation issues
  useEffect(() => {
    if (validationResult) {
      reportValidationIssues('TransactionHistoryTable', validationResult, {
        cognitoSub: user?.sub,
        userEmail: user?.email,
      });
    }
  }, [validationResult, user]);

  // Check if we should display this data
  const shouldDisplay = validationResult ? shouldDisplayData(validationResult) : true;

  // Detect if backend is ignoring date filter (all transactions from same date)
  // Note: After the MOR-350 pagination fix, this should be much less common
  const dateFilterWarning = useMemo(() => {
    if (!data?.items || data.items.length === 0 || !dateRange) return null;
    
    const uniqueDates = new Set(data.items.map(item => formatGMTDate(item.created_at)));
    const expectedStartDate = formatGMTDate(dateRange.start);
    const expectedEndDate = formatGMTDate(dateRange.end);
    
    // If we expect multiple days but only got one date, backend likely ignoring filter
    const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    // Only show warning if we have 100+ transactions (indicating significant data volume)
    if (daysDiff > 1 && uniqueDates.size === 1 && data.items.length >= 100) {
      const onlyDate = Array.from(uniqueDates)[0];
      return {
        message: `All ${data.items.length} transactions are from ${onlyDate}, but the requested date range is ${expectedStartDate} to ${expectedEndDate}. The backend may not be filtering by date correctly.`,
        onlyDate,
        expectedStart: expectedStartDate,
        expectedEnd: expectedEndDate,
      };
    }
    
    return null;
  }, [data, dateRange]);

  // MOR-346: Filter out staking_refresh entries
  // MOR-350: Aggregate by day, API key, and model
  const aggregatedData = useMemo(() => {
    if (!data?.items) return [];
    
    const filteredItems = data.items.filter(item => item.entry_type !== 'staking_refresh');
    
    // Convert APIKey[] to APIKeyDB[] format expected by aggregation function
    const apiKeysFormatted = apiKeys.map(key => ({
      id: key.id,
      key_prefix: key.key_prefix,
      name: key.name || null,
      created_at: key.created_at,
      is_active: key.is_active,
      is_default: key.is_default,
      encrypted_key: null,
      encryption_version: undefined,
    }));
    
    return aggregateLedgerEntriesByDayKeyModel(filteredItems, apiKeysFormatted);
  }, [data, apiKeys]);

  // Paginate aggregated data
  const paginatedData = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    return aggregatedData.slice(startIdx, endIdx);
  }, [aggregatedData, page, pageSize]);

  // Calculate total pages
  const totalPages = Math.ceil(aggregatedData.length / pageSize);
  const hasNextPage = page < totalPages;

  // MOR-350: Export CSV with ALL data (up to 10,000 rows) in GMT timezone
  const handleExportCSV = async () => {
    if (!data?.items || data.items.length === 0) {
      console.error('No data available for export');
      return;
    }

    try {
      // Filter out staking_refresh entries
      const filteredItems = data.items.filter(item => item.entry_type !== 'staking_refresh');
      
      // Convert APIKey[] to APIKeyDB[] format
      const apiKeysFormatted = apiKeys.map(key => ({
        id: key.id,
        key_prefix: key.key_prefix,
        name: key.name || null,
        created_at: key.created_at,
        is_active: key.is_active,
        is_default: key.is_default,
        encrypted_key: null,
        encryption_version: undefined,
      }));
      
      // Aggregate all data
      const aggregated = aggregateLedgerEntriesByDayKeyModel(filteredItems, apiKeysFormatted);

      const headers = [
        'Date (GMT)',
        'API Key',
        'Model',
        'Type',
        'Transaction Count',
        'Total Amount',
        'Amount (Paid)',
        'Amount (Staking)',
        'Tokens Input',
        'Tokens Output',
        'Tokens Total',
      ];

      const rows = aggregated.map((item) => [
        item.date,
        item.api_key_name,
        item.model_name || 'No Model',
        item.entry_type,
        item.transaction_count,
        item.total_amount.toFixed(6),
        item.total_amount_paid.toFixed(6),
        item.total_amount_staking.toFixed(6),
        item.tokens_input,
        item.tokens_output,
        item.tokens_total,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      downloadCSV(csvContent, `transactions-aggregated-${new Date().toISOString().split('T')[0]}.csv`);
      
      console.log(`✅ Exported ${aggregated.length} aggregated transaction records`);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              Daily aggregated transactions by API Key and Model (times shown in GMT).
              {timeRangeLabel && (
                <span className="block mt-1 text-xs">
                  Time Range: {timeRangeLabel}
                  {dateRange && (
                    <span className="text-muted-foreground ml-2">
                      ({formatGMTDate(dateRange.start)} to {formatGMTDate(dateRange.end)})
                    </span>
                  )}
                </span>
              )}
              {data?.items && (
                <span className="block mt-1 text-xs">
                  Showing {aggregatedData.length} aggregated rows from {data.items.length} transactions
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV} 
              disabled={paginatedData.length === 0 || isLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              {data?.items ? `Export CSV (${data.items.length} rows)` : 'Export CSV'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* MOR-333: Data validation warnings */}
        {validationResult && validationResult.warnings.length > 0 && (
          <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-semibold text-foreground">Data Anomalies Detected</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {validationResult.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground pt-2">
                  If these transactions don't belong to you, please contact support immediately. Reference: <code className="text-xs bg-muted px-1 py-0.5 rounded">MOR-333</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MOR-333: Block display if critical issues */}
        {validationResult && !shouldDisplay ? (
          <div className="flex items-center justify-center p-12 border border-destructive/50 rounded-lg bg-destructive/5">
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <div>
                <p className="text-sm font-semibold text-destructive">Data Validation Failed</p>
                <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto">
                  We detected potential data integrity issues and have hidden this information for your security.
                  Please contact support immediately. Reference: <code className="text-xs bg-muted px-1 py-0.5 rounded">MOR-333</code>
                </p>
              </div>
              {validationResult.issues.length > 0 && process.env.NODE_ENV === 'development' && (
                <details className="text-left mt-4 p-3 bg-destructive/10 rounded text-xs">
                  <summary className="cursor-pointer font-semibold">Technical Details (Dev Mode)</summary>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {validationResult.issues.map((issue, i) => (
                      <li key={i} className="text-muted-foreground">{issue}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-[200px]">
                  <Select
                    value={selectedType}
                    onValueChange={(value) => {
                      setSelectedType(value as LedgerEntryTypeEnum | 'all');
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTRY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <strong>Note:</strong> Only <code className="bg-muted px-1 py-0.5 rounded">usage_charge</code> transactions have API Keys and Models.
                Other transaction types (purchases, refunds, adjustments) will show "N/A" for these columns.
              </div>
            </div>

            {/* Backend Date Filter Warning */}
            {dateFilterWarning && (
              <div className="flex items-start gap-3 p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Date Filter May Not Be Working</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All {data?.items.length} transactions returned are from <strong>{dateFilterWarning.onlyDate}</strong>, 
                    but you requested data from <strong>{dateFilterWarning.expectedStart}</strong> to <strong>{dateFilterWarning.expectedEnd}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    This appears to be a backend API issue. The frontend is correctly sending the date range parameters, 
                    but the backend may not be filtering by them. Check the browser console for detailed API request logs.
                  </p>
                </div>
              </div>
            )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date (GMT)</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Txn Count</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-red-500">
                      <AlertCircle className="h-6 w-6 mb-2" />
                      <p>Failed to load transactions</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {error instanceof Error ? error.message : 'Unknown error'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="space-y-2">
                      <p className="text-muted-foreground">No transactions found</p>
                      {dateRange && (
                        <p className="text-xs text-muted-foreground">
                          for date range: {formatGMTDate(dateRange.start)} to {formatGMTDate(dateRange.end)}
                        </p>
                      )}
                      {selectedType !== 'all' && (
                        <p className="text-xs text-muted-foreground">
                          with type filter: {ENTRY_TYPES.find(t => t.value === selectedType)?.label}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, idx) => (
                  <TableRow key={`${item.date}-${item.api_key_id}-${item.model_name}-${idx}`}>
                    <TableCell className="whitespace-nowrap font-mono text-sm">
                      {item.date}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={item.api_key_name}>
                      {item.api_key_id ? (
                        <span>{item.api_key_name}</span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          {item.entry_type === 'usage_charge' ? 'Unknown' : 'N/A'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={item.model_name || 'No Model'}>
                      {item.model_name || 'No Model'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getTypeColor(item.entry_type)} capitalize`}
                      >
                        {item.entry_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {item.transaction_count}
                    </TableCell>
                    <TableCell>
                      <span className={item.total_amount < 0 ? 'text-foreground' : 'font-medium'}>
                        {formatCurrency(item.total_amount)}
                      </span>
                      {item.total_amount_staking > 0 && (
                         <span className="block text-xs text-green-500">
                           {formatCurrency(item.total_amount_staking)} staked
                         </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.tokens_total > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{item.tokens_total.toLocaleString()}</span>
                          <span className="text-xs">
                            {item.tokens_input > 0 && `↓${item.tokens_input.toLocaleString()}`}
                            {item.tokens_input > 0 && item.tokens_output > 0 && ' '}
                            {item.tokens_output > 0 && `↑${item.tokens_output.toLocaleString()}`}
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              {paginatedData.length > 0 ? (
                <>
                  Showing <strong>{(page - 1) * pageSize + 1}</strong> to{' '}
                  <strong>{Math.min(page * pageSize, aggregatedData.length)}</strong> of{' '}
                  <strong>{aggregatedData.length}</strong> aggregated entries
                  {data?.has_more && page === totalPages && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (more data available - use CSV export for full dataset)
                    </span>
                  )}
                </>
              ) : (
                'No entries'
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground mr-2">
                Page {page} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNextPage || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
