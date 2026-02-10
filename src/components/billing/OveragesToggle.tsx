'use client';

import React from 'react';
import { Info, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBillingPreferences, useUpdateBillingPreferences } from '@/lib/hooks/use-billing';
import { toast } from 'sonner';

export function OveragesToggle() {
  const { data: preferences, isLoading, error } = useBillingPreferences();
  const updatePreferences = useUpdateBillingPreferences();

  const handleToggle = async (checked: boolean) => {
    try {
      console.log('[OveragesToggle] Attempting to update allow_overages to:', checked);
      console.log('[OveragesToggle] Current preferences:', preferences);
      
      const result = await updatePreferences.mutateAsync({ allow_overages: checked });
      
      console.log('[OveragesToggle] Update successful:', result);
      
      toast.success(
        checked 
          ? 'Overages enabled - Credit Balance will be used when Daily Allowance is exhausted'
          : 'Overages disabled - Only Daily Staking Allowance will be used'
      );
    } catch (error) {
      console.error('[OveragesToggle] Failed to update allow_overages:', error);
      console.error('[OveragesToggle] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      toast.error(
        `Failed to update preference: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  // Show loading state while fetching preferences
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Check if API endpoint exists (404 = endpoint not implemented yet)
  const isApiNotImplemented = error?.message?.includes('Not Found') || error?.message?.includes('404');
  
  // Per MOR-323: Default should be disabled (false), not enabled (true)
  // If API returns 404, use default value but show as disabled/read-only
  const isEnabled = preferences?.allow_overages ?? false;
  const isDisabled = updatePreferences.isPending || isApiNotImplemented;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Allow Overages
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>
                  When enabled, if your Daily Staking Allowance is exhausted, 
                  charges will automatically be deducted from your Credit Balance 
                  to prevent service interruption.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription className="text-xs">
          {isApiNotImplemented 
            ? 'Feature coming soon - Backend API not yet available'
            : 'Use Credit Balance when Daily Allowance runs out'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="allow-overages" className="text-sm font-medium">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isEnabled 
                ? 'Credit Balance will be used as fallback'
                : 'Only Daily Staking Allowance will be used'
              }
            </p>
          </div>
          <Switch
            id="allow-overages"
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isDisabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
