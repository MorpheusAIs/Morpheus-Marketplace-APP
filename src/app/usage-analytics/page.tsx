'use client';

import React, { useState, useMemo } from 'react';
import { Activity, TrendingUp, Zap, AlertCircle } from 'lucide-react';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { StatCard } from '@/components/billing/StatCard';
import { BillingOverview } from '@/components/billing/BillingOverview';
import { MonthlySpendingChart } from '@/components/billing/MonthlySpendingChart';
import { TransactionHistoryTable } from '@/components/billing/TransactionHistoryTable';
import { TimeRangeFilter } from '@/components/billing/TimeRangeFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBillingUsageAll } from '@/lib/hooks/use-billing';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import {
  getDateRangeForTimeRange,
  formatCurrency,
  formatLargeNumber,
  aggregateUsageByDate,
} from '@/lib/utils/billing-utils';
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
    const range = getDateRangeForTimeRange(timeRange, customRange);
    
    // Debug logging to verify different time ranges produce different queries
    if (process.env.NODE_ENV === 'development') {
      console.log('[UsageAnalytics] Date range calculated:', {
        timeRange,
        startISO: range.start.toISOString(),
        endISO: range.end.toISOString(),
        durationDays: Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)),
      });
    }
    
    return range;
  }, [timeRange, customRange]);

  // Fetch all usage data (handles pagination automatically)
  const {
    data: usageData,
    isLoading,
    error,
  } = useBillingUsageAll({
    from: dateRange.start.toISOString(),
    to: dateRange.end.toISOString(),
  });

  // Debug logging
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[UsageAnalytics] Query State:', {
        timeRange,
        isLoading,
        hasError: !!error,
        errorMessage: error instanceof Error ? error.message : String(error),
        hasData: !!usageData,
        itemCount: usageData?.items?.length,
        total: usageData?.total,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          durationDays: Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)),
        }
      });
    }
  }, [isLoading, error, usageData, dateRange, timeRange]);

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

        {/* Summary Stats - always show layout, skeleton only on numbers when loading */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Spend"
            value={formatCurrency(stats.totalCost)}
            icon={TrendingUp}
            description={`${timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}`}
            isLoading={isLoading}
          />
          <StatCard
            title="Total Tokens"
            value={formatLargeNumber(stats.totalTokens)}
            icon={Zap}
            description="Input + Output"
            isLoading={isLoading}
          />
          <StatCard
            title="API Requests"
            value={stats.requestCount.toLocaleString()}
            icon={Activity}
            description={isLoading ? '—' : `${stats.requestCount} total`}
            isLoading={isLoading}
          />
          <StatCard
            title="Avg Cost/Request"
            value={formatCurrency(stats.avgCostPerRequest)}
            icon={TrendingUp}
            description="Per request"
            isLoading={isLoading}
          />
        </div>

        {/* Tabs for Overview and Detailed Charts */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {/* MOR-349: Monthly Spending tab disabled for launch - will re-enable after fixing validation issues */}
            {/* <TabsTrigger value="monthly">Monthly Spending</TabsTrigger> */}
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

          {/* MOR-349: Monthly Spending tab content disabled for launch - will re-enable after fixing validation issues */}
          {/* <TabsContent value="monthly" className="space-y-6">
            <MonthlySpendingChart />
          </TabsContent> */}

          <TabsContent value="transactions" className="space-y-6">
            <TransactionHistoryTable 
              dateRange={dateRange}
              timeRangeLabel={timeRange === '24h' ? '24 Hours' : timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : 'Custom'}
            />
          </TabsContent>
        </Tabs>

        {/* Debug Panel - MOR-337 Diagnostic Info */}
        {process.env.NODE_ENV === 'development' && usageData && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Debug Information (MOR-337)
            </h3>
            <div className="grid gap-4 md:grid-cols-3 text-sm font-mono">
              <div className="space-y-1">
                <p className="text-muted-foreground">Request Count:</p>
                <p className="text-foreground font-bold text-lg">{stats.requestCount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Total Tokens:</p>
                <p className="text-foreground font-bold text-lg">{stats.totalTokens.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Date Range:</p>
                <p className="text-foreground text-xs">{timeRange}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Input Tokens:</p>
                <p className="text-foreground">{usageData.items.reduce((sum, item) => sum + (item.tokens_input ?? 0), 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Output Tokens:</p>
                <p className="text-foreground">{usageData.items.reduce((sum, item) => sum + (item.tokens_output ?? 0), 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Total Cost:</p>
                <p className="text-foreground">{formatCurrency(stats.totalCost)}</p>
              </div>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                View Sample Data (first 3 records)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-4 rounded overflow-x-auto">
                {JSON.stringify(usageData.items.slice(0, 3), null, 2)}
              </pre>
            </details>
          </div>
        )}

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
