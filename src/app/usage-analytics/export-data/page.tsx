'use client';

import React, { useState, useMemo } from 'react';
import { ArrowLeft, Download, Search, Calendar as CalendarIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useBillingUsage } from '@/lib/hooks/use-billing';
import { generateUsageCSV, downloadCSV } from '@/lib/utils/billing-utils';
import type { UsageEntryResponse } from '@/types/billing';

export default function ExportDataPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Fetch all usage data (last 90 days by default)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const { data: usageData, isLoading } = useBillingUsage({
    from: startDate.toISOString(),
    to: endDate.toISOString(),
    limit: 1000,
  });

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!usageData?.items) return [];
    if (!searchQuery) return usageData.items;

    const query = searchQuery.toLowerCase();
    return usageData.items.filter(
      (item) =>
        item.model_name?.toLowerCase().includes(query) ||
        item.endpoint?.toLowerCase().includes(query) ||
        item.request_id?.toLowerCase().includes(query) ||
        new Date(item.created_at).toLocaleDateString().includes(query)
    );
  }, [usageData, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const handleExport = () => {
    if (!filteredData.length) return;
    const csv = generateUsageCSV(filteredData);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `morpheus-usage-export-${timestamp}.csv`;
    downloadCSV(csv, filename);
  };

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toFixed(4)}`;
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Export Usage Data</h1>
            <p className="text-muted-foreground">
              View and export your complete API usage history
            </p>
          </div>
        </div>

        {/* Export Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Usage Data Export</CardTitle>
                <CardDescription>
                  {isLoading
                    ? 'Loading data...'
                    : `${filteredData.length} records available (last 90 days)`}
                </CardDescription>
              </div>
              <Button
                onClick={handleExport}
                disabled={isLoading || filteredData.length === 0}
                className="bg-green-500 hover:bg-green-600 text-black"
              >
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by model, endpoint, or request ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page on search
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-foreground">No data found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No usage records match your search criteria.'
                    : 'No API usage found in the last 90 days.'}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead className="text-right">Input Tokens</TableHead>
                        <TableHead className="text-right">Output Tokens</TableHead>
                        <TableHead className="text-right">Total Tokens</TableHead>
                        <TableHead className="text-right">Staking</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {new Date(entry.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {entry.model_name || 'N/A'}
                            </code>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {entry.endpoint || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(entry.tokens_input ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(entry.tokens_output ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {(entry.tokens_total ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-green-500">
                            {formatCurrency(entry.amount_staking)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-blue-500">
                            {formatCurrency(entry.amount_paid)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatCurrency(entry.amount_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                      {Math.min(currentPage * itemsPerPage, filteredData.length)} of{' '}
                      {filteredData.length} records
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className={
                                currentPage === pageNum
                                  ? 'bg-green-500 hover:bg-green-600 text-black'
                                  : ''
                              }
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Information */}
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Export Information</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  <span>
                    The table shows the last 90 days of API usage data by default.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  <span>
                    Use the search box to filter by model name, endpoint, or request ID.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  <span>
                    Click "Download CSV" to export all filtered records to a spreadsheet.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  <span>
                    Costs are split between staking credits (green) and paid balance (blue).
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
