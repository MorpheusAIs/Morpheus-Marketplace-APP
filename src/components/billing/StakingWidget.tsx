'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Wallet, ExternalLink, RefreshCcw, Loader2, CheckCircle2, AlertCircle, LogOut, Info } from 'lucide-react';
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
  const [isConnectingAnother, setIsConnectingAnother] = useState(false);
  const [pendingStakingFlow, setPendingStakingFlow] = useState(false);
  
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
  
  // Track previous connection state to detect disconnections and connections
  const prevIsConnectedRef = useRef<boolean>(isConnected);
  const prevAddressRef = useRef<string | undefined>(address);

  const hasWallet = walletStatus?.has_wallets ?? false;
  const walletCount = walletStatus?.wallet_count ?? 0;
  
  // Reactively detect wallet connections and address changes to immediately refresh status
  useEffect(() => {
    const wasDisconnected = !prevIsConnectedRef.current && !prevAddressRef.current;
    const nowConnected = isConnected && address;
    const addressChanged = prevIsConnectedRef.current && isConnected && 
                          prevAddressRef.current && address && 
                          prevAddressRef.current !== address;
    
    // Detect connection: was disconnected, now connected with address
    if (wasDisconnected && nowConnected) {
      console.log('[StakingWidget] Wallet connection detected - refreshing status');
      
      // Immediately invalidate queries to refresh UI with connected wallet state
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
    }
    
    // Detect address change: wallet stays connected but user switched accounts
    if (addressChanged) {
      console.log('[StakingWidget] Wallet address changed - refreshing status');
      
      // Immediately invalidate queries to refresh UI with new wallet address
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
    }
  }, [isConnected, address, queryClient]);
  
  const formatMorAmount = (value: string | undefined): string => {
    if (!value || value === '0') return '0';
    const num = parseFloat(value);
    if (num > 1e12) {
      return (num / 1e18).toString();
    }
    return value;
  };

  const totalStaked = React.useMemo(() => {
    if (walletStatus?.stakers && walletStatus.stakers.length > 0) {
      const totalWei = walletStatus.stakers.reduce((sum, staker) => {
        return sum + BigInt(staker.staked || '0');
      }, BigInt(0));
      return (Number(totalWei) / 1e18).toString();
    }
    return formatMorAmount(walletStatus?.total_staked);
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

  const handleConnectAnother = () => {
    // Set flag to prevent showing "Connect Wallet" button during process
    setIsConnectingAnother(true);
    
    if (isConnected) {
      // Disconnect first, then open modal after brief delay
      disconnect();
      setTimeout(() => {
        open();
      }, 100);
    } else {
      // No wallet connected, just open modal
      open();
      // Reset flag after modal opens
      setTimeout(() => {
        setIsConnectingAnother(false);
      }, 100);
    }
  };
  
  // Reset connecting flag when wallet gets connected
  useEffect(() => {
    if (isConnectingAnother && isConnected) {
      setIsConnectingAnother(false);
    }
  }, [isConnected, isConnectingAnother]);

  // Reactively detect wallet disconnections from any source (MetaMask extension, etc.)
  // This effect runs whenever isConnected or address changes
  useEffect(() => {
    const wasConnected = prevIsConnectedRef.current;
    const hadAddress = prevAddressRef.current;
    const nowDisconnected = !isConnected && !address;
    
    // Detect disconnection: was connected with an address, now neither
    if (wasConnected && hadAddress && nowDisconnected) {
      console.log('[StakingWidget] Wallet disconnection detected - cleaning up state');
      
      // Cancel any in-flight queries to prevent stale data issues
      queryClient.cancelQueries({ queryKey: ['wallet', 'status'] });
      queryClient.cancelQueries({ queryKey: ['billing', 'balance'] });
      
      // Immediately invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
      
      // Reset all state flags to clean up UI
      setPendingStakingFlow(false);
      setIsConnectingAnother(false);
      setIsRefreshing(false);
      setIsLinking(false);
      
      // Show a subtle notification to user
      toast.info('Wallet disconnected');
    }
    
    // Update refs for next comparison
    prevIsConnectedRef.current = isConnected;
    prevAddressRef.current = address;
  }, [isConnected, address, queryClient]);

  // Additional listener for direct MetaMask/provider events
  // This catches disconnections that happen at the provider level
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    // Type assertion for ethereum provider - using unknown for safety
    const provider = window.ethereum as unknown as {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    if (!provider.on || !provider.removeListener) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      // Empty accounts array means disconnected
      if ((!accounts || accounts.length === 0) && prevIsConnectedRef.current) {
        console.log('[StakingWidget] Direct provider disconnect detected via accountsChanged');
        
        // Cancel and invalidate queries
        queryClient.cancelQueries({ queryKey: ['wallet', 'status'] });
        queryClient.cancelQueries({ queryKey: ['billing', 'balance'] });
        queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
        queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
        
        // Reset state
        setPendingStakingFlow(false);
        setIsConnectingAnother(false);
        setIsRefreshing(false);
        setIsLinking(false);
      }
    };

    const handleDisconnect = () => {
      console.log('[StakingWidget] Direct provider disconnect event');
      
      // Cancel and invalidate queries
      queryClient.cancelQueries({ queryKey: ['wallet', 'status'] });
      queryClient.cancelQueries({ queryKey: ['billing', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
      
      // Reset state
      setPendingStakingFlow(false);
      setIsConnectingAnother(false);
      setIsRefreshing(false);
      setIsLinking(false);
    };

    // Listen to provider events
    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('disconnect', handleDisconnect);

    return () => {
      // Cleanup listeners
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('disconnect', handleDisconnect);
    };
  }, [queryClient]);

  const handleLinkWallet = React.useCallback(async () => {
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
  }, [address, generateNonce, signMessageAsync, linkWallet, onRefreshStatus]);

  // Auto-trigger linking flow when wallet connects during initial staking flow
  // This prevents the need for a second click to trigger the signature request
  useEffect(() => {
    if (pendingStakingFlow && isConnected && address && !isCurrentWalletLinked) {
      setPendingStakingFlow(false);
      handleLinkWallet();
    }
  }, [pendingStakingFlow, isConnected, address, isCurrentWalletLinked, handleLinkWallet]);

  // Clear pending staking flow if user disconnects or closes modal without connecting
  useEffect(() => {
    if (pendingStakingFlow && !isConnected && !address) {
      // Give a short delay to allow for reconnection scenarios
      const timer = setTimeout(() => {
        if (!isConnected) {
          setPendingStakingFlow(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [pendingStakingFlow, isConnected, address]);

  const handleUnlinkWallet = async (walletAddress: string) => {
    try {
      await unlinkWallet.mutateAsync(walletAddress);
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
        <CardDescription className="space-y-1">
          <span>
            Earn API daily credits by staking MOR tokens in the{' '}
            <a
              href="https://dashboard.mor.org/builders/morpheus-marketplace-api?subnet_id=0x415471125cc4d03b89818acb8426981fa28a3eee03a9097176297a9a6ae87c8d&network=Base"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 hover:underline"
            >
              Morpheus Marketplace API Builders Subnet
            </a>
          </span>
          <span className="block">
            Already staking? Link your wallet to assign your daily API credits to your account.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {hasWallet ? (
              <div className="space-y-4">
                {/* Landscape layout for stats */}
                <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Linked Wallets</div>
                    <div className="flex items-center justify-center gap-1 text-sm font-medium text-foreground">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {walletCount}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Total Staked</div>
                    <div className="text-sm font-medium text-foreground">
                      {parseFloat(totalStaked).toFixed(2)} MOR
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Daily Allowance</div>
                    <div className="text-sm font-medium text-green-500">
                      ${dailyAllowance ? parseFloat(dailyAllowance).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>

                {walletStatus?.wallets && walletStatus.wallets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Linked Wallets:</p>
                    <div className="flex flex-col md:flex-row md:overflow-x-auto gap-2 pb-2">
                      {walletStatus.wallets.map((wallet) => (
                        <div
                          key={wallet.id}
                          className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 w-full md:w-auto md:min-w-[200px] md:flex-shrink-0"
                        >
                          <div className="flex flex-col">
                            <code className="text-xs text-muted-foreground">
                              {formatAddress(wallet.wallet_address)}
                            </code>
                            {(() => {
                              const stakerInfo = walletStatus?.stakers?.find(
                                s => s.address.toLowerCase() === wallet.wallet_address.toLowerCase()
                              );
                              const stakedAmount = stakerInfo 
                                ? (Number(BigInt(stakerInfo.staked)) / 1e18).toString()
                                : formatMorAmount(wallet.staked_amount);
                                
                              return stakedAmount && stakedAmount !== '0' ? (
                                <span className="text-[10px] text-green-500">
                                  {parseFloat(stakedAmount).toFixed(2)} MOR
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 ml-2"
                            onClick={() => handleUnlinkWallet(wallet.wallet_address)}
                            disabled={unlinkWallet.isPending}
                          >
                            <span className="sr-only">Unlink</span>
                            &times;
                          </Button>
                        </div>
                      ))}
                    </div>
                    
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
                           className="h-7 text-xs bg-green-500 hover:bg-green-600 text-black font-medium"
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

                {/* Connect Wallet button and Alert - side by side on desktop, stacked on mobile */}
                {!isConnected && !isConnectingAnother ? (
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2">
                    <Button
                      onClick={handleConnectAnother}
                      className="w-full md:w-1/2 bg-green-500 hover:bg-green-600 text-black"
                      size="lg"
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      Connect Wallet
                    </Button>
                    <Alert className="bg-green-500/10 border-green-500/20 md:w-1/2 [&>svg~*]:pl-0">
                      {/* <CheckCircle2 className="h-4 w-4 text-green-500" /> */}
                      <AlertDescription className="text-xs text-muted-foreground">
                        Daily Credit Allowance from staking refreshes daily at midnight UTC
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : isConnected ? (
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2">
                    <Button
                      onClick={handleConnectAnother}
                      variant="outline"
                      className="w-full md:w-1/2 text-xs border-green-500/20 hover:bg-green-500/10 py-5 rounded-lg"
                      size="sm"
                    >
                      Connect Another Wallet
                    </Button>
                    <Alert className="bg-green-500/10 border-green-500/20 md:w-1/2 [&>svg~*]:pl-0">
                      {/* <CheckCircle2 className="h-4 w-4 text-green-500" /> */}
                      <AlertDescription className="text-xs text-muted-foreground">
                        Daily Credit Allowance from staking refreshes daily at midnight UTC
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}
              </div>
            ) : (
              // Empty State (No wallets linked in backend)
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      Staking MOR? Connect your wallet to see your daily allowance
                    </p>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs text-green-500"
                      asChild
                    >
                      <a
                        href="https://mor.org/staking"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Info className="h-3 w-3 mr-1" />
                        How Staking Works
                      </a>
                    </Button>
                  </div>

                  {isConnected ? (
                    <Alert className="bg-yellow-500/10 border-yellow-500/20">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <AlertDescription className="text-xs text-muted-foreground">
                        Connected: <span className="font-mono">{formatAddress(address || '')}</span>
                        <div className="mt-2 flex gap-2">
                          <Button 
                            size="sm" 
                            className="h-7 text-xs bg-green-500 hover:bg-green-600 text-black font-medium"
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
                        <p className="text-xs text-muted-foreground mt-2">
                          Stake your tokens to receive a daily allowance instead of paying per usage.
                        </p>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2 flex flex-col items-center">
                      <Button
                        onClick={() => {
                          setPendingStakingFlow(true);
                          handleConnectAnother();
                        }}
                        className="w-full md:w-1/4 bg-green-500 hover:bg-green-600 text-black"
                      >
                        <Wallet className="mr-2 h-4 w-4" />
                        Connect Wallet
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Stake your tokens to receive a daily allowance instead of paying per usage.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t border-border mt-4">
              Stake MOR tokens to receive an ongoing daily allowance of daily API credits
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
