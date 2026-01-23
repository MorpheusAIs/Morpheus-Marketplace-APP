'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UsageEntryResponse } from '@/types/billing';
import { generateUsageCSV, downloadCSV, formatLocaleDate } from '@/lib/utils/billing-utils';

interface DataExportProps {
  usageData: UsageEntryResponse[];
  isLoading?: boolean;
}

export function DataExport({ usageData, isLoading }: DataExportProps) {
  const handleExport = () => {
    const csv = generateUsageCSV(usageData);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `morpheus-usage-${timestamp}.csv`;
    downloadCSV(csv, filename);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Usage Data</CardTitle>
        <CardDescription>
          Download your usage data as a CSV file for analysis or record-keeping
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
          <div>
            <p className="font-medium text-foreground">CSV Export</p>
            <p className="text-sm text-muted-foreground">
              {usageData.length} records available
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={isLoading || usageData.length === 0}
            className="bg-green-500 hover:bg-green-600 text-black"
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>

        {/* Preview Table */}
        {usageData.length > 0 && (
          <div className="rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Model</th>
                    <th className="px-4 py-3 text-right font-medium text-foreground">
                      Input Tokens
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-foreground">
                      Output Tokens
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-foreground">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {usageData.slice(0, 5).map((entry, index) => (
                    <tr key={entry.id || index} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatLocaleDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {entry.model_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {entry.tokens_input?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {entry.tokens_output?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        ${parseFloat(entry.amount_total).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {usageData.length > 5 && (
              <div className="border-t border-border bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
                Showing 5 of {usageData.length} records. Download CSV for full data.
              </div>
            )}
          </div>
        )}

        {usageData.length === 0 && !isLoading && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">No usage data available to export</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
