'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  /** When true, shows skeleton only on the value (keeps title, description, icon visible) */
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  isLoading = false,
}: StatCardProps) {
  return (
    <Card className={cn('bg-card', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-9 w-24 rounded-md" />
            ) : (
              <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
            )}
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.isPositive ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground">vs last period</span>
              </div>
            )}
          </div>
          {Icon && (
            <Icon className="h-[18px] w-[18px] text-primary" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
