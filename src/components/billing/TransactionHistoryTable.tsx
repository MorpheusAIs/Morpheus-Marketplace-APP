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
import { useBillingTransactions } from '@/lib/hooks/use-billing';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { formatCurrency, downloadCSV, formatLocaleDate, formatLocaleTime } from '@/lib/utils/billing-utils';
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

export function TransactionHistoryTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedType, setSelectedType] = useState<LedgerEntryTypeEnum | 'all'>('all');
  const { user } = useCognitoAuth();
  
  // MOR-346: Fetch larger batches to account for filtered staking_refresh entries
  // We fetch 3x the display amount to ensure we have enough visible items after filtering
  const fetchSize = pageSize * 3;
  
  const { data, isLoading, error } = useBillingTransactions({
    limit: fetchSize,
    offset: (page - 1) * fetchSize,
    entry_type: selectedType === 'all' ? undefined : selectedType,
  });

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

  // MOR-346: Filter out staking_refresh entries and limit to pageSize for display
  // We fetch 3x the amount to ensure we have enough items after filtering
  const filteredData = useMemo(() => {
    if (!data?.items) return data;
    const filteredItems = data.items
      .filter(item => item.entry_type !== 'staking_refresh')
      .slice(0, pageSize); // Only show pageSize items per page
    
    return {
      ...data,
      items: filteredItems,
      // Approximate pagination based on filtered results
      // has_more: true if we got a full page of filtered items (indicates more data likely exists)
      has_more: filteredItems.length === pageSize && data.has_more,
    };
  }, [data, pageSize]);

  // Calculate total pages based on approximate filtered count
  const totalPages = filteredData ? Math.ceil(filteredData.total / fetchSize) : 0;

  const handleExportCSV = () => {
    if (!filteredData?.items) return;

    const headers = [
      'ID',
      'Date',
      'Type',
      'Status',
      'Amount (Total)',
      'Amount (Paid)',
      'Amount (Staking)',
      'Source',
      'Description',
    ];

    const rows = filteredData.items.map((item) => [
      item.id,
      new Date(item.created_at).toISOString(),
      item.entry_type,
      item.status,
      item.amount_total,
      item.amount_paid,
      item.amount_staking,
      item.payment_source || '',
      item.description || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    downloadCSV(csvContent, `transactions-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              View your billing transactions, deposits, and usage charges
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!filteredData?.items.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
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
            <div className="flex flex-wrap items-center gap-4 mb-6">
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

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-red-500">
                      <AlertCircle className="h-6 w-6 mb-2" />
                      <p>Failed to load transactions</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {error instanceof Error ? error.message : 'Unknown error'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredData?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatLocaleDate(item.created_at)}
                      <span className="block text-xs text-muted-foreground">
                        {formatLocaleTime(item.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getTypeColor(item.entry_type)} capitalize`}
                      >
                        {item.entry_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(item.status)} capitalize`}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={item.amount_total.startsWith('-') ? 'text-foreground' : 'font-medium'}>
                        {formatCurrency(item.amount_total)}
                      </span>
                      {parseFloat(item.amount_staking) > 0 && (
                         <span className="block text-xs text-green-500">
                           {formatCurrency(item.amount_staking)} staked
                         </span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {item.payment_source || '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground" title={item.description || ''}>
                      {item.description || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            {filteredData?.items && filteredData.items.length > 0 ? (
              <>
                Showing <strong>{(page - 1) * pageSize + 1}</strong> to{' '}
                <strong>{(page - 1) * pageSize + filteredData.items.length}</strong>
                {filteredData.has_more && ' (more available)'}
              </>
            ) : (
              'No entries'
            )}
          </div>
          <div className="flex items-center space-x-2">
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
              disabled={!filteredData?.has_more || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
