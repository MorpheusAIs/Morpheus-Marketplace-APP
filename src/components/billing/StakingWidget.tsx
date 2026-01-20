'use client';

import React, { useState } from 'react';
import { Wallet, ExternalLink, RefreshCcw, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { WalletStatusResponse } from '@/types/billing';

interface StakingWidgetProps {
  walletStatus?: WalletStatusResponse;
  stakingBalance?: string;
  dailyAllowance?: string;
  isLoading?: boolean;
  onConnectWallet?: () => void;
  onRefreshStatus?: () => void;
}

export function StakingWidget({
  walletStatus,
  stakingBalance,
  dailyAllowance,
  isLoading,
  onConnectWallet,
  onRefreshStatus,
}: StakingWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasWallet = walletStatus?.has_wallets ?? false;
  const walletCount = walletStatus?.wallet_count ?? 0;
  const totalStaked = walletStatus?.total_staked ?? '0';

  const handleRefresh = async () => {
    if (onRefreshStatus) {
      setIsRefreshing(true);
      await onRefreshStatus();
      setIsRefreshing(false);
    }
  };

  return (
    <Card className="border-green-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-500" />
            <CardTitle>Staking Status</CardTitle>
          </div>
          {hasWallet && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
        <CardDescription>Earn daily credits by staking MOR tokens</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : hasWallet ? (
          <>
            {/* Wallet Connected */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">
                  {walletCount} wallet{walletCount !== 1 ? 's' : ''} connected
                </span>
              </div>

              {/* Staking Info */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Staked:</span>
                  <span className="text-sm font-medium text-foreground">
                    {parseFloat(totalStaked).toFixed(2)} MOR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Daily Allowance:</span>
                  <span className="text-sm font-medium text-green-500">
                    ${dailyAllowance ? parseFloat(dailyAllowance).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Available Credits:</span>
                  <span className="text-sm font-medium text-green-500">
                    ${stakingBalance ? parseFloat(stakingBalance).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>

              {/* Wallet Addresses */}
              {walletStatus?.wallets && walletStatus.wallets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Connected Wallets:</p>
                  {walletStatus.wallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                    >
                      <code className="text-xs text-muted-foreground">
                        {wallet.wallet_address.slice(0, 6)}...
                        {wallet.wallet_address.slice(-4)}
                      </code>
                      {wallet.staked_amount && (
                        <span className="text-xs text-muted-foreground">
                          {parseFloat(wallet.staked_amount).toFixed(2)} MOR
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Alert className="bg-green-500/10 border-green-500/20">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Your staking rewards refresh daily at midnight UTC
                </AlertDescription>
              </Alert>
            </div>
          </>
        ) : (
          <>
            {/* No Wallet Connected */}
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                <Wallet className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  No wallet connected
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connect your wallet to view staking status and earn daily credits
                </p>
              </div>

              <Button
                onClick={onConnectWallet}
                className="w-full bg-green-500 hover:bg-green-600 text-black"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>

              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-foreground">How Staking Works:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Stake MOR tokens to earn daily API credits</li>
                  <li>• Credits refresh automatically at midnight UTC</li>
                  <li>• Use staking credits before paid balance</li>
                  <li>• No additional fees or transaction costs</li>
                </ul>
              </div>

              <Button
                variant="link"
                className="w-full text-xs text-green-500"
                asChild
              >
                <a
                  href="https://mor.org/staking"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more about staking
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
