'use client';

import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, TrendingUp, Filter, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatLargeNumber } from '@/lib/utils/billing-utils';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import type { UsageEntryResponse, UsageListResponse } from '@/types/billing';

const COLORS = ['#00FF85', '#20DC8E', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  valueFormatter?: (value: number) => string;
}

const CustomTooltip = ({ active, payload, label, valueFormatter }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} className="text-sm text-muted-foreground">
            <span style={{ color: entry.color }}>{entry.name}: </span>
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface DailyData {
  date: string;
  staking: number;
  credit: number;
  inputTokens: number;
  outputTokens: number;
}

interface SpendData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

function aggregateByDate(items: UsageEntryResponse[]): DailyData[] {
  const grouped = items.reduce<Record<string, DailyData>>((acc, entry) => {
    const date = new Date(entry.created_at).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
    });

    if (!acc[date]) {
      acc[date] = {
        date,
        staking: 0,
        credit: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    }

    acc[date].staking += parseFloat(entry.amount_staking);
    acc[date].credit += parseFloat(entry.amount_paid);
    acc[date].inputTokens += entry.tokens_input ?? 0;
    acc[date].outputTokens += entry.tokens_output ?? 0;

    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => {
    const [aMonth, aDay] = a.date.split('/').map(Number);
    const [bMonth, bDay] = b.date.split('/').map(Number);
    if (aMonth !== bMonth) return aMonth - bMonth;
    return aDay - bDay;
  });
}

function aggregateSpendByModel(items: UsageEntryResponse[]): SpendData[] {
  const grouped = items.reduce<Record<string, number>>((acc, entry) => {
    const modelName = entry.model_name || 'Unknown';
    if (!acc[modelName]) {
      acc[modelName] = 0;
    }
    acc[modelName] += parseFloat(entry.amount_total);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);
}

function aggregateTokenTypes(items: UsageEntryResponse[]): SpendData[] {
  const totals = items.reduce(
    (acc, entry) => {
      acc.input += entry.tokens_input ?? 0;
      acc.output += entry.tokens_output ?? 0;
      return acc;
    },
    { input: 0, output: 0 }
  );

  return [
    { name: 'Input Tokens', value: totals.input, color: '#3b82f6' },
    { name: 'Output Tokens', value: totals.output, color: '#8b5cf6' },
  ];
}

interface BillingOverviewProps {
  usageData?: UsageListResponse | null;
  isLoading?: boolean;
  error?: Error | null;
  timeRangeLabel?: string;
}

export function BillingOverview({ usageData, isLoading = false, error, timeRangeLabel = '7 Days' }: BillingOverviewProps) {
  const [selectedKeyId, setSelectedKeyId] = useState('all');
  const { apiKeys } = useCognitoAuth();

  const apiKeyOptions = useMemo(() => {
    const keys = [{ id: 'all', name: 'All API Keys' }];
    if (apiKeys && Array.isArray(apiKeys)) {
      apiKeys.forEach((key: { id?: number; key_prefix?: string; name?: string }) => {
        keys.push({
          id: key.id?.toString() || key.key_prefix || 'unknown',
          name: key.name || `Key ${key.key_prefix || key.id}...`,
        });
      });
    }
    return keys;
  }, [apiKeys]);

  const filteredItems = useMemo(() => {
    if (!usageData?.items) return [];
    if (selectedKeyId === 'all') return usageData.items;
    return usageData.items.filter((item: UsageEntryResponse & { api_key_id?: number }) => {
      const itemKeyId = item.api_key_id?.toString();
      return itemKeyId === selectedKeyId;
    });
  }, [usageData, selectedKeyId]);

  const dailyData = useMemo(() => aggregateByDate(filteredItems), [filteredItems]);

  const spendByModel = useMemo(() => aggregateSpendByModel(filteredItems), [filteredItems]);

  const tokenTypeData = useMemo(() => aggregateTokenTypes(filteredItems), [filteredItems]);

  const spendByKey = useMemo(() => {
    if (!usageData?.items || !apiKeys) return [];

    const grouped = usageData.items.reduce<Record<string, number>>((acc, entry: UsageEntryResponse & { api_key_id?: number }) => {
      const keyId = entry.api_key_id?.toString() || 'unknown';
      if (!acc[keyId]) {
        acc[keyId] = 0;
      }
      acc[keyId] += parseFloat(entry.amount_total);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([keyId, value], index) => {
        const apiKey = Array.isArray(apiKeys)
          ? apiKeys.find((k: { id?: number }) => k.id?.toString() === keyId)
          : null;
        return {
          name: (apiKey as { name?: string } | null)?.name || `Key ${keyId}`,
          value,
          color: COLORS[index % COLORS.length],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [usageData, apiKeys]);

  const totalTokens = useMemo(() => {
    return filteredItems.reduce((sum: number, item: UsageEntryResponse) => sum + (item.tokens_total ?? 0), 0);
  }, [filteredItems]);

  const totalCost = useMemo(() => {
    return filteredItems.reduce((sum: number, item: UsageEntryResponse) => sum + parseFloat(item.amount_total), 0);
  }, [filteredItems]);

  const stakingTotal = useMemo(() => {
    return filteredItems.reduce((sum: number, item: UsageEntryResponse) => sum + parseFloat(item.amount_staking), 0);
  }, [filteredItems]);

  const creditTotal = useMemo(() => {
    return filteredItems.reduce((sum: number, item: UsageEntryResponse) => sum + parseFloat(item.amount_paid), 0);
  }, [filteredItems]);

  const dailyStats = useMemo(() => {
    if (dailyData.length === 0) {
      return {
        cost: { avg: 0, min: 0, max: 0 },
        inputs: { avg: 0, min: 0, max: 0 },
        outputs: { avg: 0, min: 0, max: 0 },
      };
    }

    const costs = dailyData.map((d) => d.staking + d.credit);
    const inputs = dailyData.map((d) => d.inputTokens);
    const outputs = dailyData.map((d) => d.outputTokens);

    return {
      cost: {
        avg: costs.reduce((a, b) => a + b, 0) / costs.length,
        min: Math.min(...costs),
        max: Math.max(...costs),
      },
      inputs: {
        avg: inputs.reduce((a, b) => a + b, 0) / inputs.length,
        min: Math.min(...inputs),
        max: Math.max(...inputs),
      },
      outputs: {
        avg: outputs.reduce((a, b) => a + b, 0) / outputs.length,
        min: Math.min(...outputs),
        max: Math.max(...outputs),
      },
    };
  }, [dailyData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[350px] rounded-xl" />
          <Skeleton className="h-[350px] rounded-xl" />
          <Skeleton className="h-[350px] rounded-xl" />
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <p className="text-sm font-medium text-foreground">Failed to load overview data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error.message || 'Please try refreshing the page'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = filteredItems.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Total Usage Card */}
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="text-xs text-muted-foreground">
                  Total Usage ({timeRangeLabel})
                </CardDescription>
                <CardTitle className="text-4xl font-bold mt-2">
                  {formatLargeNumber(totalTokens)}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Total tokens processed</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/20">
                <Database className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Distribution by Key
              </p>
              {spendByKey.length > 0 ? (
                spendByKey.slice(0, 3).map((key) => (
                  <div key={key.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate max-w-[150px]">{key.name}</span>
                      <span className="font-medium">{formatCurrency(key.value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${totalCost > 0 ? (key.value / totalCost) * 100 : 0}%`,
                          backgroundColor: key.color,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No usage data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estimated Cost Card */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="text-xs text-muted-foreground">
                  Estimated Cost ({timeRangeLabel})
                </CardDescription>
                <CardTitle className="text-4xl font-bold mt-2">
                  {formatCurrency(totalCost)}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Staking:</span>
                    <span className="font-medium">{formatCurrency(stakingTotal)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-muted-foreground">Credits:</span>
                    <span className="font-medium">{formatCurrency(creditTotal)}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/20">
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Distribution by Key
              </p>
              {spendByKey.length > 0 ? (
                spendByKey.slice(0, 3).map((key) => (
                  <div key={key.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate max-w-[150px]">{key.name}</span>
                      <span className="font-medium text-orange-500">{formatCurrency(key.value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all"
                        style={{ width: `${totalCost > 0 ? (key.value / totalCost) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No usage data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Spend by API Key */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spend by API Key</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData && spendByKey.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={spendByKey}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {spendByKey.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {spendByKey.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground truncate max-w-[120px]">{entry.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <div className="p-3 rounded-full bg-muted/50 mb-3">
                  <Database className="h-6 w-6 opacity-20" />
                </div>
                <p className="text-sm font-medium">No API key data</p>
                <p className="text-xs mt-1 opacity-70">Start making requests to see breakdown</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spend by Model Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spend by Model Type</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData && spendByModel.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={spendByModel}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {spendByModel.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {spendByModel.slice(0, 5).map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground truncate max-w-[120px]">{entry.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <div className="p-3 rounded-full bg-muted/50 mb-3">
                  <TrendingUp className="h-6 w-6 opacity-20" />
                </div>
                <p className="text-sm font-medium">No model usage</p>
                <p className="text-xs mt-1 opacity-70">Try selecting a wider time range</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spend by Token Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spend by Token Type</CardTitle>
          </CardHeader>
          <CardContent>
            {hasData && tokenTypeData.some((d) => d.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={tokenTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {tokenTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatLargeNumber(Number(value) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {tokenTypeData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">{entry.name}</span>
                      </div>
                      <span className="font-medium">{formatLargeNumber(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <div className="p-3 rounded-full bg-muted/50 mb-3">
                  <Database className="h-6 w-6 opacity-20" />
                </div>
                <p className="text-sm font-medium">No token activity</p>
                <p className="text-xs mt-1 opacity-70">Input/Output tokens will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* API Key Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-green-500" />
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Label htmlFor="key-filter" className="text-sm font-medium whitespace-nowrap">
            Filter by Key:
          </Label>
          <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
            <SelectTrigger id="key-filter" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {apiKeyOptions.map((key) => (
                <SelectItem key={key.id} value={key.id}>
                  {key.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Daily Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Spend (Daily)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg</span>
              <span className="font-medium">{formatCurrency(dailyStats.cost.avg)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Min</span>
              <span className="font-medium">{formatCurrency(dailyStats.cost.min)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max</span>
              <span className="font-medium">{formatCurrency(dailyStats.cost.max)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Input Tokens (Daily)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg</span>
              <span className="font-medium">{formatLargeNumber(dailyStats.inputs.avg)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Min</span>
              <span className="font-medium">{formatLargeNumber(dailyStats.inputs.min)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max</span>
              <span className="font-medium">{formatLargeNumber(dailyStats.inputs.max)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Output Tokens (Daily)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg</span>
              <span className="font-medium">{formatLargeNumber(dailyStats.outputs.avg)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Min</span>
              <span className="font-medium">{formatLargeNumber(dailyStats.outputs.min)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max</span>
              <span className="font-medium">{formatLargeNumber(dailyStats.outputs.max)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Spend Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Spend Breakdown</CardTitle>
          <CardDescription>Staking credits vs. paid balance over time</CardDescription>
        </CardHeader>
        <CardContent>
          {hasData && dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorStaking" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF85" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#00FF85" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorCredit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
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
                <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="staking"
                  name="Staked Spend"
                  stackId="1"
                  stroke="#00FF85"
                  fill="url(#colorStaking)"
                />
                <Area
                  type="monotone"
                  dataKey="credit"
                  name="Credit Spend"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="url(#colorCredit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <TrendingUp className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-sm font-medium">No spending data for this period</p>
              <p className="text-xs mt-1 opacity-70">Try selecting a different time range or making requests</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Token Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Token Volume</CardTitle>
          <CardDescription>Input and output tokens consumed daily</CardDescription>
        </CardHeader>
        <CardContent>
          {hasData && dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => formatLargeNumber(value)}
                />
                <Tooltip content={<CustomTooltip valueFormatter={formatLargeNumber} />} />
                <Legend />
                <Bar dataKey="inputTokens" name="Input" stackId="a" fill="#3b82f6" />
                <Bar dataKey="outputTokens" name="Output" stackId="a" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Database className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-sm font-medium">No volume data for this period</p>
              <p className="text-xs mt-1 opacity-70">Token usage history will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
