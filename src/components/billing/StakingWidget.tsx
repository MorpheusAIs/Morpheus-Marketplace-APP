'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, ExternalLink, RefreshCcw, Loader2, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { WalletStatusResponse } from '@/types/billing';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useSignMessage, useDisconnect } from 'wagmi';
import { useGenerateWalletNonce, useLinkWallet, useUnlinkWallet } from '@/lib/hooks/use-billing';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface StakingWidgetProps {
  walletStatus?: WalletStatusResponse;
  stakingBalance?: string;
  dailyAllowance?: string;
  isLoading?: boolean;
  onConnectWallet?: () => void; // Kept for backward compatibility, but we use internal logic now
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
  const [isLinking, setIsLinking] = useState(false);
  
  // AppKit & Wagmi hooks
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  
  // Mutation hooks
  const generateNonce = useGenerateWalletNonce();
  const linkWallet = useLinkWallet();
  const unlinkWallet = useUnlinkWallet();
  const queryClient = useQueryClient();

  const hasWallet = walletStatus?.has_wallets ?? false;
  const walletCount = walletStatus?.wallet_count ?? 0;
  
  // Calculate total staked from stakers array if available, otherwise use total_staked
  const totalStaked = React.useMemo(() => {
    if (walletStatus?.stakers && walletStatus.stakers.length > 0) {
      // Sum up staked amounts from the stakers array (amount is in wei)
      const totalWei = walletStatus.stakers.reduce((sum, staker) => {
        return sum + BigInt(staker.staked || '0');
      }, BigInt(0));
      return (Number(totalWei) / 1e18).toString();
    }
    // Fallback to total_staked if available
    return walletStatus?.total_staked ?? '0';
  }, [walletStatus]);

  // Check if the currently connected wallet is already linked
  const isCurrentWalletLinked = React.useMemo(() => {
    if (!walletStatus?.wallets || !address) return false;
    return walletStatus.wallets.some(w => w.wallet_address.toLowerCase() === address.toLowerCase());
  }, [walletStatus, address]);

  const handleRefresh = async () => {
    if (onRefreshStatus) {
      setIsRefreshing(true);
      try {
        await onRefreshStatus();
        toast.success('Staking status refreshed');
      } catch (error) {
        console.error('Refresh failed:', error);
        toast.error('Failed to refresh status');
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const handleConnectAnother = async () => {
    await open();
  };


  const handleLinkWallet = async () => {
    if (!address) return;
    
    try {
      setIsLinking(true);
      
      // 1. Generate nonce
      const nonceData = await generateNonce.mutateAsync(address);
      
      // 2. Prepare message to sign
      let message = nonceData.message_template;
      // Replace all possible placeholders
      message = message.replace('{wallet_address}', address)
                       .replace('{nonce}', nonceData.nonce)
                       .replace('{timestamp}', new Date().toISOString()); // Note: Server likely expects the timestamp it can validate or just informative.
                       
      // If the template uses {{ }} style, handle that too just in case
      message = message.replace('{{wallet_address}}', address)
                       .replace('{{nonce}}', nonceData.nonce)
                       .replace('{{timestamp}}', new Date().toISOString());
      
      // 3. Sign message
      const signature = await signMessageAsync({ message });
      
      // 4. Link wallet
      await linkWallet.mutateAsync({
        wallet_address: address,
        signature,
        message,
        nonce: nonceData.nonce,
        timestamp: new Date().toISOString()
      });
      
      toast.success('Wallet linked successfully!');
      if (onRefreshStatus) onRefreshStatus();
      
    } catch (error) {
      console.error('Failed to link wallet:', error);
      toast.error('Failed to link wallet: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkWallet = async (walletId: number) => {
    try {
      await unlinkWallet.mutateAsync(walletId);
      toast.success('Wallet unlinked successfully');
      if (onRefreshStatus) onRefreshStatus();
    } catch (error) {
      console.error('Failed to unlink wallet:', error);
      toast.error('Failed to unlink wallet');
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // Helper to format address
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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
        ) : (
          <>
            {hasWallet ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">
                    {walletCount} wallet{walletCount !== 1 ? 's' : ''} connected
                  </span>
                </div>

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

                {walletStatus?.wallets && walletStatus.wallets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Connected Wallets:</p>
                    {walletStatus.wallets.map((wallet) => (
                      <div
                        key={wallet.id}
                        className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                      >
                        <div className="flex flex-col">
                          <code className="text-xs text-muted-foreground">
                            {formatAddress(wallet.wallet_address)}
                          </code>
                          {(() => {
                            // Find matching staker info for this wallet
                            const stakerInfo = walletStatus?.stakers?.find(
                              s => s.address.toLowerCase() === wallet.wallet_address.toLowerCase()
                            );
                            // Use staker info if available, otherwise fallback to wallet.staked_amount
                            const stakedAmount = stakerInfo 
                              ? (Number(BigInt(stakerInfo.staked)) / 1e18).toString()
                              : wallet.staked_amount;
                              
                            return stakedAmount ? (
                              <span className="text-[10px] text-green-500">
                                {parseFloat(stakedAmount).toFixed(2)} MOR
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => handleUnlinkWallet(wallet.id)}
                          disabled={unlinkWallet.isPending}
                        >
                          <span className="sr-only">Unlink</span>
                          &times;
                        </Button>
                      </div>
                    ))}
                    
                    <Button
                      onClick={handleConnectAnother}
                      variant="outline"
                      className="w-full text-xs mt-2"
                      size="sm"
                    >
                      Connect Another Wallet
                    </Button>
                  </div>
                )}
                
                {/* Connected provider but not linked to any wallet */}
                {isConnected && !isCurrentWalletLinked && address && (
                   <Alert className="bg-yellow-500/10 border-yellow-500/20">
                     <AlertCircle className="h-4 w-4 text-yellow-500" />
                     <AlertDescription className="text-xs text-muted-foreground">
                       Connected: <span className="font-mono">{formatAddress(address)}</span>
                       <div className="mt-2 flex gap-2">
                         <Button 
                           size="sm" 
                           variant="outline" 
                           className="h-7 text-xs border-yellow-500/50 hover:bg-yellow-500/10"
                           onClick={handleLinkWallet}
                           disabled={isLinking}
                         >
                           {isLinking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                           Link This Wallet
                         </Button>
                         <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={handleDisconnect}
                         >
                           Disconnect
                         </Button>
                       </div>
                     </AlertDescription>
                   </Alert>
                )}

                {/* Not connected to provider, but has wallets linked (add another) */}
                {!isConnected && (
                  <Button
                    onClick={handleConnectAnother}
                    variant="outline"
                    className="w-full text-xs"
                    size="sm"
                  >
                    Connect Another Wallet
                  </Button>
                )}


                <Alert className="bg-green-500/10 border-green-500/20 mt-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-xs text-muted-foreground">
                    Your staking rewards refresh daily at midnight UTC
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              // Empty State (No wallets linked in backend)
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                  <Wallet className={`mx-auto h-12 w-12 ${isConnected ? 'text-green-500' : 'text-muted-foreground/50'}`} />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {isConnected ? 'Wallet Connected' : 'No wallet connected'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isConnected 
                      ? <span className="font-mono">{address ? formatAddress(address) : ''}</span> 
                      : 'Connect your wallet to view staking status and earn daily credits'}
                  </p>
                </div>

                {isConnected ? (
                  <div className="space-y-2">
                    <Button
                      onClick={handleLinkWallet}
                      className="w-full bg-green-500 hover:bg-green-600 text-black"
                      disabled={isLinking}
                    >
                      {isLinking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Linking...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Link Connected Wallet
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDisconnect}
                      className="w-full"
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectAnother}
                    className="w-full bg-green-500 hover:bg-green-600 text-black"
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </Button>
                )}

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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
