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
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import type { TimeRange, CustomDateRange } from '@/types/billing';

export default function UsageAnalyticsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { apiKeys } = useCognitoAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customRange, setCustomRange] = useState<CustomDateRange | undefined>();

  // Calculate date range for API call
  const dateRange = useMemo(() => {
    const range = getDateRangeForTimeRange(timeRange, customRange);
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

    // MOR-339: Use absolute values for spending metrics - API returns negative values (deductions)
    // but users expect to see positive spend amounts (e.g. $10.00 not -$10.00)
    const totalCost = Math.abs(
      usageData.items.reduce(
        (sum, item) => sum + parseFloat(item.amount_total),
        0
      )
    );
    const totalTokens = usageData.items.reduce(
      (sum, item) => sum + (item.tokens_total ?? 0),
      0
    );
    const requestCount = usageData.items.length;

    return {
      totalCost,
      totalTokens,
      avgCostPerRequest: requestCount > 0 ? Math.abs(totalCost / requestCount) : 0,
      requestCount,
    };
  }, [usageData]);

  const handleCustomRangeChange = (start: string, end: string) => {
    setCustomRange({ start, end });
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto space-y-6 p-6 [&_[data-skeleton]]:!bg-muted">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{t('usage.title')}</h1>
          <p className="text-muted-foreground">
            {t('usage.subtitle')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-foreground">{t('usage.errorLoad')}</p>
              <p className="text-xs text-muted-foreground">
                {typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
                  ? error.message
                  : t('usage.errorRetry')}
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
            className="text-primary border-primary hover:bg-primary/10"
            data-analytics-action="export-usage-data"
            data-analytics-destination="/usage-analytics/export-data"
          >
            {t('usage.export')}
          </Button>
        </div>

        {/* Summary Stats - always show layout, skeleton only on numbers when loading */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title={t('usage.statSpend')}
            value={formatCurrency(stats.totalCost)}
            icon={TrendingUp}
            description={timeRange === '24h' ? t('usage.range24h') : timeRange === '7d' ? t('usage.range7d') : t('usage.range30d')}
            isLoading={isLoading}
          />
          <StatCard
            title={t('usage.statTokens')}
            value={formatLargeNumber(stats.totalTokens)}
            icon={Zap}
            description={t('usage.statTokensSub')}
            isLoading={isLoading}
          />
          <StatCard
            title={t('usage.statRequests')}
            value={stats.requestCount.toLocaleString()}
            icon={Activity}
            description={isLoading ? '—' : t('usage.statRequestsSub', { count: stats.requestCount })}
            isLoading={isLoading}
          />
          <StatCard
            title={t('usage.statAvgCost')}
            value={formatCurrency(stats.avgCostPerRequest)}
            icon={TrendingUp}
            description={t('usage.statAvgCostSub')}
            isLoading={isLoading}
          />
        </div>

        {/* Tabs for Overview and Detailed Charts */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">{t('usage.tabOverview')}</TabsTrigger>
            {/* MOR-349: Monthly Spending tab disabled for launch - will re-enable after fixing validation issues */}
            {/* <TabsTrigger value="monthly">Monthly Spending</TabsTrigger> */}
            <TabsTrigger value="transactions">{t('usage.tabTransactions')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <BillingOverview
              usageData={usageData}
              isLoading={isLoading}
              error={error instanceof Error ? error : error ? new Error(String(error)) : null}
              timeRangeLabel={timeRange === '24h' ? t('usage.range24h') : timeRange === '7d' ? t('usage.range7d') : timeRange === '30d' ? t('usage.range30d') : t('usage.rangeCustom')}
            />
          </TabsContent>

          {/* MOR-349: Monthly Spending tab content disabled for launch - will re-enable after fixing validation issues */}
          {/* <TabsContent value="monthly" className="space-y-6">
            <MonthlySpendingChart />
          </TabsContent> */}

          <TabsContent value="transactions" className="space-y-6">
            <TransactionHistoryTable
              dateRange={dateRange}
              timeRangeLabel={timeRange === '24h' ? t('usage.range24h') : timeRange === '7d' ? t('usage.range7d') : timeRange === '30d' ? t('usage.range30d') : t('usage.rangeCustom')}
            />
          </TabsContent>
        </Tabs>

        {/* Debug Panel - MOR-337 Diagnostic Info */}
        {process.env.NODE_ENV === 'development' && usageData && (
          <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Debug Information (MOR-337)
            </h3>
            <div className="grid gap-4 md:grid-cols-3 text-sm font-mono">
              <div className="space-y-1">
                <p className="text-muted-foreground">{t('usage.requestCount')}</p>
                <p className="text-foreground font-bold text-lg">{stats.requestCount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">{t('usage.statTokens')}:</p>
                <p className="text-foreground font-bold text-lg">{stats.totalTokens.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">{t('usage.dateRange')}</p>
                <p className="text-foreground text-xs">{timeRange}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">{t('usage.tokenInput')}:</p>
                <p className="text-foreground">{usageData.items.reduce((sum, item) => sum + (item.tokens_input ?? 0), 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">{t('usage.tokenOutput')}:</p>
                <p className="text-foreground">{usageData.items.reduce((sum, item) => sum + (item.tokens_output ?? 0), 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">{t('usage.totalCost')}</p>
                <p className="text-foreground">{formatCurrency(stats.totalCost)}</p>
              </div>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                {t('usage.viewSample')}
              </summary>
              <pre className="mt-2 text-xs bg-muted p-4 rounded overflow-x-auto">
                {JSON.stringify(usageData.items.slice(0, 3), null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Additional Information */}
        <div className="rounded border border-border bg-muted/30 p-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">
            {t('usage.helpTitle')}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">{t('usage.helpTokenTitle')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('usage.helpTokenBody')}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">{t('usage.helpCostTitle')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('usage.helpCostBody')}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">{t('usage.helpRetentionTitle')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('usage.helpRetentionBody')}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">{t('usage.helpTrackingTitle')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('usage.helpTrackingBody')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
