'use client';

import React from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function PricingPlans() {
  const { t } = useTranslation();
  const handleSeePricing = () => {
    window.open('https://apidocs.mor.org/documentation/models/pricing?utm_source=api-admin', '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>{t('billing.pricingTitle')}</CardTitle>
        </div>
        <CardDescription className="pt-4 space-y-3">
          <p>
            {t('billing.pricingBody')}
          </p>
          <div className="space-y-1">
            <div>
              <a
                href="https://apidocs.mor.org/documentation/models/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {t('billing.pricingModels')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div>
              <a
                href="https://apidocs.mor.org/documentation/models/rate-limits"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {t('billing.pricingRateLimits')}
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
          data-analytics-action="open-pricing-docs"
          data-analytics-destination="https://apidocs.mor.org/documentation/models/pricing?utm_source=api-admin"
          onClick={handleSeePricing}
        >
          {t('billing.pricingSee')}
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
