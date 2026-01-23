'use client';

import React from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function PricingPlans() {
  const handleSeePricing = () => {
    window.open('https://apidocs.mor.org?utm_source=api-admin', '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <CardTitle>Pricing Plans</CardTitle>
        </div>
        <CardDescription>
          View our comprehensive pricing for all available models, tiers, and computational limits in our API documentation.
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
