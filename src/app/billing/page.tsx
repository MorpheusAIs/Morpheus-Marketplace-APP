'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DollarSign, TrendingUp, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { StatCard } from '@/components/billing/StatCard';
import { FundingSection } from '@/components/billing/FundingSection';
import { StakingWidget } from '@/components/billing/StakingWidget';
import { PricingPlans } from '@/components/billing/PricingPlans';
import { useBillingBalance, useWalletStatus } from '@/lib/hooks/use-billing';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  
  const { data: balance, isLoading: isLoadingBalance, error: balanceError, refetch: refetchBalance } = useBillingBalance();
  const { data: walletStatus, isLoading: isLoadingWallet, refetch: refetchWallet } = useWalletStatus();

  const handleConnectWallet = () => {
    // TODO: Implement wallet connection flow
    // This will use the wallet linking API endpoints
    alert('Wallet connection coming soon. Please check back later.');
  };

  const handleRefreshWallet = async () => {
    // Refetch both wallet status and balance when refreshing staking status
    await Promise.all([
      refetchWallet(),
      refetchBalance()
    ]);
  };

  const handleBalanceUpdate = async (amount: number) => {
    // Refetch balance after simulated payment
    await refetchBalance();
  };

  // Check for payment success query parameter
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      setShowSuccess(true);
      // Refetch balance to show updated amount
      refetchBalance();
      
      // Start countdown and redirect
      const countdownInterval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Remove query parameter and redirect
            router.replace('/billing');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [searchParams, router, refetchBalance]);

  const handleManualRedirect = () => {
    router.replace('/billing');
  };

  // Show success message overlay if payment was successful
  if (showSuccess) {
    return (
      <AuthenticatedLayout>
        <div className="container mx-auto flex min-h-[calc(100vh-200px)] items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Payment Successful!</CardTitle>
              <CardDescription className="text-base">
                Your payment has been processed successfully. Your account balance will be updated shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Redirecting to billing page in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
                </p>
              </div>
              <Button 
                onClick={handleManualRedirect}
                className="w-full"
                variant="default"
              >
                Go to Billing Page Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground">
            Manage your account balance, funding sources, and staking rewards
          </p>
        </div>

        {/* Error Alert */}
        {balanceError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load billing data</p>
              <p className="text-xs text-muted-foreground">
                {balanceError.message || 'Please try refreshing the page'}
              </p>
            </div>
          </div>
        )}

        {/* Balance Overview Stats */}
        {isLoadingBalance ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl" />
            ))}
          </div>
        ) : balance ? (
          <div className="grid gap-4 md:grid-cols-2">
            <StatCard
              title="Available Credit"
              value={`$${parseFloat(balance.paid?.available || '0').toFixed(2)}`}
              icon={DollarSign}
              description="Pre-paid credits available for inference"
            />
            <StatCard
              title="Daily API credit remaining"
              value={`$${parseFloat(balance.staking?.available || '0').toFixed(2)}`}
              icon={Clock}
              description={(() => {
                const dailyAmount = parseFloat(balance.staking?.daily_amount || '0');
                const available = parseFloat(balance.staking?.available || '0');
                const used = Math.max(0, dailyAmount - available);
                return `${used.toFixed(2)} of ${dailyAmount.toFixed(2)} used today`;
              })()}
            />
          </div>
        ) : null}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Funding (2/3 width) */}
          <div className="lg:col-span-2">
            {isLoadingBalance ? (
              <Skeleton className="h-[800px] rounded-xl" />
            ) : (
              <FundingSection
                currentBalance={balance?.total_available ?? '0'}
                isLoading={isLoadingBalance}
                onBalanceUpdate={handleBalanceUpdate}
                stakingWidget={
                  <StakingWidget
                    walletStatus={walletStatus}
                    stakingBalance={balance?.staking?.available}
                    dailyAllowance={balance?.staking?.daily_amount}
                    isLoading={isLoadingWallet}
                    onConnectWallet={handleConnectWallet}
                    onRefreshStatus={handleRefreshWallet}
                  />
                }
              />
            )}
          </div>

          {/* Right Column - Pricing Plans (1/3 width) */}
          <div className="lg:col-span-1">
            <PricingPlans />
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
