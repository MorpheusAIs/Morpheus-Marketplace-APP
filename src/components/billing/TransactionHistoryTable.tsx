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
  
  // Fetch data for client-side aggregation and pagination
  // API has a max limit of 100 records per request
  const FETCH_LIMIT = 100;
  
  const { data, isLoading, error } = useBillingTransactions({
    limit: FETCH_LIMIT,
    offset: 0, // Client-side pagination on aggregated data
    entry_type: selectedType === 'all' ? undefined : selectedType,
    from: dateRange?.start.toISOString(),
    to: dateRange?.end.toISOString(),
  });

  // Debug logging for fetched data
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && data) {
      console.log('[TransactionHistoryTable] Data fetched:', {
        totalItems: data.items.length,
        total: data.total,
        dateRange: dateRange ? {
          from: dateRange.start.toISOString(),
          to: dateRange.end.toISOString(),
        } : 'none',
        sampleDates: data.items.slice(0, 3).map(item => item.created_at),
      });
    }
  }, [data, dateRange]);

  // MOR-350: Fetch all transactions for CSV export (up to 10,000 rows)
  // This runs ONLY when user clicks Export CSV (enabled: shouldFetchAll)
  const [shouldFetchAll, setShouldFetchAll] = useState(false);
  const { 
    data: allData, 
    isLoading: isLoadingAll,
    error: allError,
  } = useBillingTransactionsAll(
    {
      entry_type: selectedType === 'all' ? undefined : selectedType,
      from: dateRange?.start.toISOString(),
      to: dateRange?.end.toISOString(),
    },
    { enabled: shouldFetchAll }
  );

  // Reset fetch state and page when type filter or date range changes
  useEffect(() => {
    if (shouldFetchAll) {
      setShouldFetchAll(false);
    }
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
    // If already loading, don't trigger again
    if (isLoadingAll) {
      return;
    }

    // If there was an error fetching all data, reset and try again
    if (allError) {
      console.error('Previous fetch failed, resetting:', allError);
      setShouldFetchAll(false);
      setTimeout(() => setShouldFetchAll(true), 100);
      return;
    }

    // First click: Trigger fetching all data
    if (!shouldFetchAll) {
      setShouldFetchAll(true);
      return;
    }

    // Second click: Export if data is ready
    if (!allData?.items || allData.items.length === 0) {
      console.error('No data available for export');
      return;
    }

    try {
      // Filter out staking_refresh entries
      const filteredItems = allData.items.filter(item => item.entry_type !== 'staking_refresh');
      
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
              disabled={paginatedData.length === 0 || isLoadingAll}
            >
              <Download className="mr-2 h-4 w-4" />
              {isLoadingAll 
                ? 'Loading all data...' 
                : allError 
                ? 'Retry Export' 
                : shouldFetchAll && allData 
                ? `Export CSV (${allData.items.length} rows)` 
                : 'Export CSV'}
            </Button>
            {allError && (
              <span className="text-xs text-red-500" title={allError instanceof Error ? allError.message : 'Export failed'}>
                Export failed
              </span>
            )}
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

        {/* CSV Export Error */}
        {allError && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/5 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-semibold text-foreground">CSV Export Failed</p>
                <p className="text-xs text-muted-foreground">
                  {allError instanceof Error && allError.message.includes('Database connection') 
                    ? 'Database is temporarily overloaded. Please try again in a few moments.' 
                    : 'Failed to load transaction data for export. Click "Retry Export" to try again.'}
                </p>
                {allError instanceof Error && (
                  <details className="text-xs text-muted-foreground mt-2">
                    <summary className="cursor-pointer">Error details</summary>
                    <code className="block mt-2 p-2 bg-muted rounded text-xs break-all">
                      {allError.message}
                    </code>
                  </details>
                )}
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
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No transactions found
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
