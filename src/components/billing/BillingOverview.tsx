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
import { Database, TrendingUp, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatLargeNumber } from '@/lib/utils/billing-utils';

// Mock data - will be replaced with real API data
const MOCK_API_KEYS = [
  { id: 'all', name: 'All API Keys' },
  { id: 'prod-001', name: 'Production App' },
  { id: 'dev-002', name: 'Development' },
];

const MOCK_DAILY_DATA = [
  { date: '1/8', staking: 12.5, credit: 2.1, inputTokens: 2500000, outputTokens: 850000 },
  { date: '1/9', staking: 15.2, credit: 3.4, inputTokens: 4200000, outputTokens: 1800000 },
  { date: '1/10', staking: 11.8, credit: 1.9, inputTokens: 3100000, outputTokens: 900000 },
  { date: '1/11', staking: 13.6, credit: 2.8, inputTokens: 3800000, outputTokens: 1500000 },
  { date: '1/12', staking: 10.2, credit: 1.5, inputTokens: 2800000, outputTokens: 700000 },
  { date: '1/13', staking: 18.4, credit: 35.8, inputTokens: 13044951, outputTokens: 4728099 },
  { date: '1/14', staking: 14.7, credit: 3.2, inputTokens: 4900000, outputTokens: 2100000 },
  { date: '1/15', staking: 12.1, credit: 2.3, inputTokens: 3200000, outputTokens: 1100000 },
];

const MOCK_SPEND_BY_KEY = [
  { name: 'Production App', value: 91.29, color: '#00FF85' },
  { name: 'Development', value: 52.32, color: '#20DC8E' },
];

const MOCK_SPEND_BY_MODEL = [
  { name: 'Other', value: 98.5, color: '#3b82f6' },
  { name: 'kimi-k2-thinking', value: 22.3, color: '#8b5cf6' },
  { name: 'llama-3.2-3b', value: 15.8, color: '#00FF85' },
  { name: 'venice-uncensored', value: 7.01, color: '#f59e0b' },
];

const MOCK_SPEND_BY_TOKEN_TYPE = [
  { name: 'Input', value: 85.4, color: '#3b82f6' },
  { name: 'Output', value: 58.21, color: '#8b5cf6' },
];

const COLORS = ['#00FF85', '#20DC8E', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueFormatter?: (value: number) => string;
}

const CustomTooltip = ({ active, payload, label, valueFormatter }: CustomTooltipProps) => {
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

export function BillingOverview() {
  const [selectedKeyId, setSelectedKeyId] = useState('all');

  // Calculate totals
  const totalTokens = useMemo(() => {
    return MOCK_DAILY_DATA.reduce(
      (sum, day) => sum + day.inputTokens + day.outputTokens,
      0
    );
  }, []);

  const totalCost = useMemo(() => {
    return MOCK_DAILY_DATA.reduce((sum, day) => sum + day.staking + day.credit, 0);
  }, []);

  const stakingTotal = useMemo(() => {
    return MOCK_DAILY_DATA.reduce((sum, day) => sum + day.staking, 0);
  }, []);

  const creditTotal = useMemo(() => {
    return MOCK_DAILY_DATA.reduce((sum, day) => sum + day.credit, 0);
  }, []);

  // Calculate daily stats
  const dailyStats = useMemo(() => {
    const costs = MOCK_DAILY_DATA.map((d) => d.staking + d.credit);
    const inputs = MOCK_DAILY_DATA.map((d) => d.inputTokens);
    const outputs = MOCK_DAILY_DATA.map((d) => d.outputTokens);

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
  }, []);

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
                  Total Usage (7 Days)
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
              {MOCK_SPEND_BY_KEY.map((key, index) => (
                <div key={key.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{key.name}</span>
                    <span className="font-medium">{formatLargeNumber(totalTokens * 0.6)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(key.value / totalCost) * 100}%`,
                        backgroundColor: key.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Estimated Cost Card */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="text-xs text-muted-foreground">
                  Estimated Cost (7 Days)
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
              {MOCK_SPEND_BY_KEY.map((key) => (
                <div key={key.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{key.name}</span>
                    <span className="font-medium text-orange-500">{formatCurrency(key.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{ width: `${(key.value / totalCost) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
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
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={MOCK_SPEND_BY_KEY}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {MOCK_SPEND_BY_KEY.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {MOCK_SPEND_BY_KEY.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spend by Model Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spend by Model Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={MOCK_SPEND_BY_MODEL}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {MOCK_SPEND_BY_MODEL.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {MOCK_SPEND_BY_MODEL.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spend by Token Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spend by Token Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={MOCK_SPEND_BY_TOKEN_TYPE}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {MOCK_SPEND_BY_TOKEN_TYPE.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {MOCK_SPEND_BY_TOKEN_TYPE.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
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
              {MOCK_API_KEYS.map((key) => (
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
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={MOCK_DAILY_DATA}>
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
        </CardContent>
      </Card>

      {/* Daily Token Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Token Volume</CardTitle>
          <CardDescription>Input and output tokens consumed daily</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={MOCK_DAILY_DATA}>
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
        </CardContent>
      </Card>
    </div>
  );
}
