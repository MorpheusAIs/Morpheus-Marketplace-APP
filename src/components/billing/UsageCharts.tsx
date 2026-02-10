'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyAggregation, APIKeyDB } from '@/types/billing';
import { formatChartDate, formatCurrency, formatLargeNumber } from '@/lib/utils/billing-utils';

interface UsageChartsProps {
  dailyData: DailyAggregation[];
  selectedKeyId?: string | null;
  apiKeys?: APIKeyDB[];
}

const COLORS = ['#00FF85', '#20DC8E', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
const TOKEN_TYPE_COLORS = ['#3b82f6', '#8b5cf6']; // Blue for Input, Purple for Output

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label, valueFormatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
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

export function UsageCharts({ dailyData, selectedKeyId, apiKeys = [] }: UsageChartsProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    if (dailyData.length === 0) return null;

    const costs = dailyData.map((d) => d.cost);
    const inputs = dailyData.map((d) => d.input_tokens);
    const outputs = dailyData.map((d) => d.output_tokens);

    const calculateStats = (arr: number[]) => ({
      min: Math.min(...arr),
      max: Math.max(...arr),
      avg: arr.reduce((a, b) => a + b, 0) / arr.length,
    });

    return {
      cost: calculateStats(costs),
      inputs: calculateStats(inputs),
      outputs: calculateStats(outputs),
    };
  }, [dailyData]);

  // Prepare data for daily spend breakdown (stacking + credit)
  const dailySpendData = useMemo(() => {
    return dailyData.map((item) => ({
      date: formatChartDate(item.date),
      Staking: Math.abs(parseFloat(item.cost_staking.toFixed(2))),
      Credit: Math.abs(parseFloat(item.cost_balance.toFixed(2))),
    }));
  }, [dailyData]);

  // Prepare data for daily token volume (input vs output)
  const dailyTokenData = useMemo(() => {
    return dailyData.map((item) => ({
      date: formatChartDate(item.date),
      Input: item.input_tokens,
      Output: item.output_tokens,
    }));
  }, [dailyData]);

  // Prepare data for spend by token type pie chart
  const tokenTypeData = useMemo(() => {
    const totalInput = dailyData.reduce((sum, d) => sum + d.input_tokens, 0);
    const totalOutput = dailyData.reduce((sum, d) => sum + d.output_tokens, 0);

    return [
      { name: 'Input Tokens', value: totalInput, cost: 0 }, // Cost would need price per token
      { name: 'Output Tokens', value: totalOutput, cost: 0 },
    ];
  }, [dailyData]);

  if (dailyData.length === 0) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-muted-foreground">No usage data available for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily Stats Summary */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Daily Cost Range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Min:</span>
                  <span className="font-medium">{formatCurrency(stats.cost.min)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max:</span>
                  <span className="font-medium">{formatCurrency(stats.cost.max)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg:</span>
                  <span className="font-medium text-green-500">
                    {formatCurrency(stats.cost.avg)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Daily Input Tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Min:</span>
                  <span className="font-medium">{formatLargeNumber(stats.inputs.min)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max:</span>
                  <span className="font-medium">{formatLargeNumber(stats.inputs.max)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg:</span>
                  <span className="font-medium text-blue-500">
                    {formatLargeNumber(Math.round(stats.inputs.avg))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Daily Output Tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Min:</span>
                  <span className="font-medium">{formatLargeNumber(stats.outputs.min)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max:</span>
                  <span className="font-medium">{formatLargeNumber(stats.outputs.max)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg:</span>
                  <span className="font-medium text-purple-500">
                    {formatLargeNumber(Math.round(stats.outputs.avg))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily Spend Breakdown (Stacked Area Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Spend Breakdown</CardTitle>
          <CardDescription>Staking credits vs. paid balance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailySpendData}>
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
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="Staking"
                stackId="1"
                stroke="#00FF85"
                fill="#00FF85"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="Credit"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily Token Volume (Stacked Bar Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Token Volume</CardTitle>
          <CardDescription>Input and output tokens consumed daily</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyTokenData}>
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
              <Bar dataKey="Input" stackId="a" fill="#3b82f6" barSize={40} />
              <Bar dataKey="Output" stackId="a" fill="#8b5cf6" barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Token Type Distribution (Pie Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>Token Type Distribution</CardTitle>
          <CardDescription>Breakdown of input vs. output tokens</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={tokenTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${formatLargeNumber(value)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {tokenTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TOKEN_TYPE_COLORS[index % TOKEN_TYPE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatLargeNumber(value) : ''} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
