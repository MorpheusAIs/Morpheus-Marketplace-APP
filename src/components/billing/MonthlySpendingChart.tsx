'use client';

import React, { useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { useBillingSpending } from '@/lib/hooks/use-billing';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { formatCurrency } from '@/lib/utils/billing-utils';
import {
  validateMonthlySpending,
  reportValidationIssues,
  shouldDisplayData,
} from '@/lib/utils/data-isolation-validator';
import type { SpendingModeEnum } from '@/types/billing';

interface MonthlySpendingChartProps {
  year?: number;
  mode?: SpendingModeEnum;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-muted-foreground">
            <span style={{ color: entry.color }}>{entry.name}: </span>
            {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function MonthlySpendingChart({ year, mode = 'gross' }: MonthlySpendingChartProps) {
  const currentYear = year || new Date().getFullYear();
  const { user } = useCognitoAuth();

  const { data: spendingData, isLoading, error } = useBillingSpending({
    year: currentYear,
    mode,
  });

  // MOR-333: Validate data isolation
  const validationResult = useMemo(() => {
    if (!spendingData) return null;
    
    return validateMonthlySpending(spendingData, {
      cognitoSub: user?.sub,
      userEmail: user?.email,
    });
  }, [spendingData, user]);

  // Report validation issues
  useEffect(() => {
    if (validationResult) {
      reportValidationIssues('MonthlySpendingChart', validationResult, {
        cognitoSub: user?.sub,
        userEmail: user?.email,
      });
    }
  }, [validationResult, user]);

  // Check if we should display this data
  const shouldDisplay = validationResult ? shouldDisplayData(validationResult) : true;

  // Prepare chart data with all 12 months
  const chartData = useMemo(() => {
    if (!spendingData?.months) return [];

    // Create array for all 12 months
    const monthsData = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const monthData = spendingData.months?.find((m) => m.month === monthNum);

      return {
        month: MONTH_NAMES[i],
        monthNum: monthNum,
        amount: monthData ? Math.abs(parseFloat(monthData.amount)) : 0,
        transactions: monthData?.transaction_count || 0,
      };
    });

    return monthsData;
  }, [spendingData]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const amounts = chartData.map((d) => d.amount).filter((a) => a > 0);
    if (amounts.length === 0) return null;

    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    const avg = total / 12; // Average across all months
    const max = Math.max(...amounts);
    const min = Math.min(...amounts);

    // Calculate trend (simple: compare last 3 months avg vs previous 3 months avg)
    const currentMonth = new Date().getMonth();
    const recentMonths = chartData
      .slice(Math.max(0, currentMonth - 2), currentMonth + 1)
      .map((d) => d.amount);
    const previousMonths = chartData
      .slice(Math.max(0, currentMonth - 5), currentMonth - 2)
      .map((d) => d.amount);

    const recentAvg =
      recentMonths.length > 0
        ? recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length
        : 0;
    const previousAvg =
      previousMonths.length > 0
        ? previousMonths.reduce((a, b) => a + b, 0) / previousMonths.length
        : 0;

    const trend =
      previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

    return {
      total,
      avg,
      max,
      min,
      trend,
    };
  }, [chartData]);

  // MOR-333: Block display if critical data isolation issues detected
  if (validationResult && !shouldDisplay) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <p className="text-sm font-semibold text-destructive">Data Validation Failed</p>
              <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto">
                We detected potential data integrity issues and have hidden this information for your security.
                Please contact support if this persists.
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
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-sm text-destructive">Failed to load spending data</p>
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
          <CardDescription>Spending trends for {currentYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* MOR-333: Data validation warnings */}
      {validationResult && validationResult.warnings.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Data Anomalies Detected</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {validationResult.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground pt-2">
                  If this data doesn't look right, please contact support. Reference: <code className="text-xs bg-muted px-1 py-0.5 rounded">MOR-333</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Spend
                  </p>
                  <p className="mt-2 text-2xl font-bold">{formatCurrency(stats.total)}</p>
                </div>
                <div className="rounded-lg bg-green-500/20 p-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Monthly Average
              </p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(stats.avg)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Peak Month
              </p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(stats.max)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Trend
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-2xl font-bold">
                      {stats.trend > 0 ? '+' : ''}
                      {stats.trend.toFixed(1)}%
                    </p>
                  </div>
                </div>
                {stats.trend !== 0 && (
                  <div
                    className={`rounded-lg p-2 ${
                      stats.trend > 0
                        ? 'bg-red-500/20'
                        : 'bg-green-500/20'
                    }`}
                  >
                    {stats.trend > 0 ? (
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">vs previous 3 months</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending - {currentYear}</CardTitle>
          <CardDescription>
            {mode === 'gross' ? 'Total spending' : 'Net spending'} by month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF85" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#00FF85" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="amount"
                name="Spending"
                fill="url(#colorAmount)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Line Chart - Trend View */}
      <Card>
        <CardHeader>
          <CardTitle>Spending Trend</CardTitle>
          <CardDescription>Visualize spending patterns over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="amount"
                name="Spending"
                stroke="#00FF85"
                strokeWidth={3}
                dot={{ fill: '#00FF85', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <CardDescription>Detailed spending by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Month</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-right font-medium">Transactions</th>
                  <th className="px-4 py-3 text-right font-medium">Avg per Transaction</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((month) => (
                  <tr key={month.monthNum} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{month.month} {currentYear}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatCurrency(month.amount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {month.transactions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {month.transactions > 0
                        ? formatCurrency(month.amount / month.transactions)
                        : '$0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
