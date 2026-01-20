'use client';

import React from 'react';
import { DollarSign, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { StatCard } from '@/components/billing/StatCard';
import { FundingSection } from '@/components/billing/FundingSection';
import { StakingWidget } from '@/components/billing/StakingWidget';
import { useBillingBalance, useWalletStatus } from '@/lib/hooks/use-billing';
import { Skeleton } from '@/components/ui/skeleton';

import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';

export default function BillingPage() {
  const { user } = useCognitoAuth();
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

  const handleBalanceUpdate = async () => {
    await refetchBalance();
  };

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

        {/* Error Alert - only show if we have an error AND no data */}
        {balanceError && !balance && (
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
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl" />
            ))}
          </div>
        ) : balance ? (
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Total Available"
              value={`$${parseFloat(balance.total_available || '0').toFixed(2)}`}
              icon={DollarSign}
              description="Combined balance"
            />
            <StatCard
              title="Paid Balance"
              value={`$${parseFloat(balance.paid?.available || '0').toFixed(2)}`}
              icon={TrendingUp}
              description={`$${parseFloat(balance.paid?.posted_balance || '0').toFixed(2)} posted`}
            />
            <StatCard
              title="Staking Credits"
              value={`$${parseFloat(balance.staking?.available || '0').toFixed(2)}`}
              icon={Clock}
              description={`$${parseFloat(balance.staking?.daily_amount || '0').toFixed(2)} daily`}
            />
            <StatCard
              title="Pending Holds"
              value={`$${parseFloat(balance.paid?.pending_holds || '0').toFixed(2)}`}
              icon={AlertCircle}
              description="Temporary holds"
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
                userId={user?.sub}
              />
            )}
          </div>

          {/* Right Column - Staking (1/3 width) */}
          <div className="lg:col-span-1">
            {isLoadingWallet ? (
              <Skeleton className="h-[600px] rounded-xl" />
            ) : (
              <StakingWidget
                walletStatus={walletStatus}
                stakingBalance={balance?.staking?.available}
                dailyAllowance={balance?.staking?.daily_amount}
                isLoading={isLoadingWallet}
                onConnectWallet={handleConnectWallet}
                onRefreshStatus={handleRefreshWallet}
              />
            )}
          </div>
        </div>

        {/* Additional Information */}
        <div className="rounded-lg border border-border bg-muted/30 p-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">
            Billing Information
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Payment Priority</h4>
              <p className="text-sm text-muted-foreground">
                Staking credits are used first, followed by your paid balance. This ensures you
                maximize the value of your staked tokens.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Pending Holds</h4>
              <p className="text-sm text-muted-foreground">
                Holds are placed during API requests and converted to charges upon completion.
                Failed requests release the hold back to your available balance.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Staking Refresh</h4>
              <p className="text-sm text-muted-foreground">
                Daily staking allowances refresh automatically at midnight UTC based on your
                current MOR stake amount.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Transaction History</h4>
              <p className="text-sm text-muted-foreground">
                View detailed transaction history including purchases, staking refreshes, and
                usage charges in the Usage Analytics page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
