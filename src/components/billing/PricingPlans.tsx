'use client';

import React from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function PricingPlans() {
  const handleSeePricing = () => {
    window.open('https://apidocs.mor.org/documentation/models/pricing?utm_source=api-admin', '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <CardTitle>Pricing</CardTitle>
        </div>
        <CardDescription className="pt-4 space-y-3">
          <p>
            View the current model pricing and associated rate limits on apidocs.mor.org. Daily Credit Allowance from Staking is spent first, followed by the pre-paid Available Credit (when allow overages is enabled).
          </p>
          <div className="space-y-1">
            <div>
              <span className="font-medium">Model Pricing:</span>{' '}
              <a
                href="https://apidocs.mor.org/documentation/models/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-500 hover:underline inline-flex items-center gap-1"
              >
                apidocs.mor.org/documentation/models/pricing
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div>
              <span className="font-medium">Rate Limits:</span>{' '}
              <a
                href="https://apidocs.mor.org/documentation/models/rate-limits"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-500 hover:underline inline-flex items-center gap-1"
              >
                apidocs.mor.org/documentation/models/rate-limits
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSeePricing}
        >
          See Pricing
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
