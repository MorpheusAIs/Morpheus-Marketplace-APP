'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBillingTransactions } from '@/lib/hooks/use-billing';
import { formatCurrency, downloadCSV } from '@/lib/utils/billing-utils';
import type { LedgerEntryResponse, LedgerEntryTypeEnum, LedgerStatusEnum } from '@/types/billing';

const ENTRY_TYPES: { value: LedgerEntryTypeEnum | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'staking_refresh', label: 'Staking Refresh' },
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
  // API currently doesn't support filtering by status in the hook params directly based on the definition
  // but we can filter client side if needed, or update the hook.
  // The hook interface `GetTransactionsParams` only has `entry_type`.
  
  const { data, isLoading, error } = useBillingTransactions({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    entry_type: selectedType === 'all' ? undefined : selectedType,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const handleExportCSV = () => {
    if (!data?.items) return;

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

    const rows = data.items.map((item) => [
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
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data?.items.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
              ) : data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleTimeString()}
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
            {data?.total ? (
              <>
                Showing <strong>{(page - 1) * pageSize + 1}</strong> to{' '}
                <strong>{Math.min(page * pageSize, data.total)}</strong> of{' '}
                <strong>{data.total}</strong> entries
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
              disabled={!data?.has_more || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
