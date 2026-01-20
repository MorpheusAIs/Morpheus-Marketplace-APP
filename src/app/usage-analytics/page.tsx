'use client';

import React, { useState, useMemo } from 'react';
import { Activity, TrendingUp, Zap, AlertCircle } from 'lucide-react';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { StatCard } from '@/components/billing/StatCard';
import { UsageCharts } from '@/components/billing/UsageCharts';
import { BillingOverview } from '@/components/billing/BillingOverview';
import { MonthlySpendingChart } from '@/components/billing/MonthlySpendingChart';
import { TransactionHistoryTable } from '@/components/billing/TransactionHistoryTable';
import { TimeRangeFilter } from '@/components/billing/TimeRangeFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBillingUsage } from '@/lib/hooks/use-billing';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import {
  aggregateUsageByDate,
  getDateRangeForTimeRange,
  formatCurrency,
  formatLargeNumber,
} from '@/lib/utils/billing-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import type { TimeRange, CustomDateRange } from '@/types/billing';

export default function UsageAnalyticsPage() {
  const router = useRouter();
  const { apiKeys } = useCognitoAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customRange, setCustomRange] = useState<CustomDateRange | undefined>();

  // Calculate date range for API call
  const dateRange = useMemo(() => {
    return getDateRangeForTimeRange(timeRange, customRange);
  }, [timeRange, customRange]);

  // Fetch usage data
  const {
    data: usageData,
    isLoading,
    error,
  } = useBillingUsage({
    from: dateRange.start.toISOString(),
    to: dateRange.end.toISOString(),
    limit: 100, // API max is 100
  });

  // Aggregate data by date for charts
  const dailyData = useMemo(() => {
    if (!usageData?.items) return [];
    return aggregateUsageByDate(usageData.items);
  }, [usageData]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!usageData?.items || usageData.items.length === 0) {
      return {
        totalCost: 0,
        totalTokens: 0,
        avgCostPerRequest: 0,
        requestCount: 0,
      };
    }

    const totalCost = usageData.items.reduce(
      (sum, item) => sum + parseFloat(item.amount_total),
      0
    );
    const totalTokens = usageData.items.reduce(
      (sum, item) => sum + (item.tokens_total ?? 0),
      0
    );
    const requestCount = usageData.items.length;

    return {
      totalCost,
      totalTokens,
      avgCostPerRequest: requestCount > 0 ? totalCost / requestCount : 0,
      requestCount,
    };
  }, [usageData]);

  const handleCustomRangeChange = (start: string, end: string) => {
    setCustomRange({ start, end });
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Usage Analytics</h1>
          <p className="text-muted-foreground">
            Monitor your API usage, costs, and token consumption patterns
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load usage data</p>
              <p className="text-xs text-muted-foreground">
                {typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
                  ? error.message
                  : 'Please try refreshing the page'}
              </p>
            </div>
          </div>
        )}

        {/* Time Range Filter & Export Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TimeRangeFilter
            value={timeRange}
            onChange={setTimeRange}
            onCustomRangeChange={handleCustomRangeChange}
          />
          <Button
            onClick={() => router.push('/usage-analytics/export-data')}
            variant="outline"
            className="text-green-500 border-green-500 hover:bg-green-500/10"
          >
            Export Data
          </Button>
        </div>

        {/* Summary Stats */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Total Spend"
              value={formatCurrency(stats.totalCost)}
              icon={TrendingUp}
              description={`${timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}`}
            />
            <StatCard
              title="Total Tokens"
              value={formatLargeNumber(stats.totalTokens)}
              icon={Zap}
              description="Input + Output"
            />
            <StatCard
              title="API Requests"
              value={stats.requestCount.toLocaleString()}
              icon={Activity}
              description={`${stats.requestCount} total`}
            />
            <StatCard
              title="Avg Cost/Request"
              value={formatCurrency(stats.avgCostPerRequest)}
              icon={TrendingUp}
              description="Per request"
            />
          </div>
        )}

        {/* Tabs for Overview and Detailed Charts */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Analytics</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Spending</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <BillingOverview 
              usageData={usageData}
              isLoading={isLoading}
              error={error instanceof Error ? error : error ? new Error(String(error)) : null}
              timeRangeLabel={timeRange === '24h' ? '24 Hours' : timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : 'Custom'}
            />
          </TabsContent>

          <TabsContent value="monthly" className="space-y-6">
            <MonthlySpendingChart />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <TransactionHistoryTable />
          </TabsContent>

          <TabsContent value="detailed" className="space-y-6">
            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-[400px] rounded-xl" />
                <Skeleton className="h-[400px] rounded-xl" />
              </div>
            ) : dailyData.length > 0 ? (
              <UsageCharts 
                dailyData={dailyData} 
                apiKeys={apiKeys as never} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12">
                <Activity className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-foreground">No usage data</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  No API usage found for the selected time period.
                  {timeRange === 'custom'
                    ? ' Try adjusting your date range.'
                    : ' Start using the API to see analytics here.'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Additional Information */}
        <div className="rounded-lg border border-border bg-muted/30 p-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">
            Understanding Your Usage
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Token Calculation</h4>
              <p className="text-sm text-muted-foreground">
                Tokens are calculated based on the model&apos;s tokenizer. Input tokens are the prompt,
                and output tokens are the generated response. Different models have different
                pricing per token.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Cost Breakdown</h4>
              <p className="text-sm text-muted-foreground">
                Costs are split between staking credits (if available) and paid balance. Staking
                credits are always used first to minimize your out-of-pocket expenses.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Data Retention</h4>
              <p className="text-sm text-muted-foreground">
                Usage data is retained for 12 months. You can export your data at any time for
                your records or analysis.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">API Key Tracking</h4>
              <p className="text-sm text-muted-foreground">
                Each request is associated with an API key, allowing you to track usage across
                different applications or team members.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
