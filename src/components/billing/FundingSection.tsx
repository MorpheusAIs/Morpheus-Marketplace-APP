'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Coins,
  Loader2,
  Info,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  X,
  Copy,
  CheckCircle2,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FundingSectionProps {
  currentBalance: string;
  isLoading?: boolean;
  onBalanceUpdate?: (amount: number) => void;
  userId?: string;
  stakingWidget?: React.ReactNode;
}

type PaymentFlowState =
  | 'none'
  | 'crypto_amount'
  | 'crypto_loading'
  | 'crypto_checkout'
  | 'crypto_success'
  | 'stripe_success';

interface CoinbaseCharge {
  id: string;
  code: string;
  hosted_url: string;
  expires_at: string;
  addresses: Record<string, string>;
  pricing: Record<string, { amount: string; currency: string }>;
  timeline: Array<{ status: string; time: string }>;
}

const POLLING_INTERVAL = 5000;

export function FundingSection({ currentBalance, isLoading, onBalanceUpdate, userId, stakingWidget }: FundingSectionProps) {
  const [flowState, setFlowState] = useState<PaymentFlowState>('none');
  const [depositAmount, setDepositAmount] = useState('25.00');
  const [timeLeft, setTimeLeft] = useState(3599);
  const [error, setError] = useState<string | null>(null);

  const [charge, setCharge] = useState<CoinbaseCharge | null>(null);
  const [chargeStatus, setChargeStatus] = useState<string>('NEW');
  const [copied, setCopied] = useState(false);

  const checkChargeStatus = useCallback(async (chargeId: string) => {
    try {
      const response = await fetch(`/api/coinbase/charge?chargeId=${chargeId}`);
      if (response.ok) {
        const data = await response.json();
        const status = data.charge?.status || 'NEW';
        setChargeStatus(status);

        if (data.charge) {
          setCharge((prev) => (prev ? { ...prev, ...data.charge } : (data.charge as CoinbaseCharge)));
        }

        if (status === 'COMPLETED' || status === 'RESOLVED') {
          setFlowState('crypto_success');
          if (onBalanceUpdate) {
            onBalanceUpdate(parseFloat(depositAmount));
          }
          return true;
        }
      }
    } catch (err) {
      console.error('Error checking charge status:', err);
    }
    return false;
  }, [depositAmount, onBalanceUpdate]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (flowState === 'crypto_checkout' && charge?.id) {
      interval = setInterval(async () => {
        const completed = await checkChargeStatus(charge.id);
        if (completed) {
          clearInterval(interval);
        }
      }, POLLING_INTERVAL);
    }
    return () => clearInterval(interval);
  }, [flowState, charge?.id, checkChargeStatus]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (flowState === 'crypto_checkout' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [flowState, timeLeft]);

  // Check for Stripe return parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    if (payment === 'success' && sessionId) {
      setFlowState('stripe_success');
      window.history.replaceState({}, '', window.location.pathname);
      if (onBalanceUpdate) {
        onBalanceUpdate(0); 
      }
    } else if (payment === 'cancelled') {
      setError('Payment was cancelled');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onBalanceUpdate]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const resetFlow = () => {
    setFlowState('none');
    setDepositAmount('25.00');
    setError(null);
    setCharge(null);
    setChargeStatus('NEW');
    setCopied(false);
  };

  const validateAmount = () => {
    const amount = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amount) || amount < 10) {
      setError('Please enter a valid amount (minimum $10)');
      return false;
    }
    if (amount > 10000) {
      setError('Maximum amount is $10,000');
      return false;
    }
    setError(null);
    return true;
  };

  const startCryptoFlow = () => {
    setError(null);
    setFlowState('crypto_amount');
  };

  const createCoinbaseCharge = async () => {
    if (!validateAmount()) return;

    setFlowState('crypto_loading');
    setError(null);

    try {
      const response = await fetch('/api/coinbase/charge', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: depositAmount,
          currency: 'USD',
          userId: userId || 'anonymous',
          description: `Morpheus AI Credits - $${depositAmount}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment');
      }

      const chargeData = data.charge as CoinbaseCharge;
      setCharge(chargeData);

      const expiresAt = new Date(chargeData.expires_at);
      const now = new Date();
      const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeLeft(secondsLeft);

      setFlowState('crypto_checkout');
    } catch (err) {
      console.error('Error creating charge:', err);
      setError(err instanceof Error ? err.message : 'Failed to create payment');
      setFlowState('crypto_amount');
    }
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const openHostedCheckout = () => {
    if (charge?.hosted_url) {
      window.open(charge.hosted_url, '_blank');
    }
  };

  const openStripeCheckout = () => {
    window.open('https://buy.stripe.com/test_9B6bJ0eU08TG6Pi4EIgnK00', '_blank', 'noopener,noreferrer');
  };

  if (flowState === 'crypto_amount') {
    return (
      <Card className="animate-in fade-in duration-300">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={resetFlow}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Add Funds</CardTitle>
            <div className="w-10" />
          </div>
          <CardDescription>Enter the amount you&apos;d like to add</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Amount (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => {
                  setDepositAmount(e.target.value);
                  setError(null);
                }}
                className="pl-8 text-2xl h-14 font-bold"
                placeholder="0.00"
                min="10"
                max="10000"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['10', '25', '50', '100', '250', '500'].map((val) => (
              <Button
                key={val}
                variant={depositAmount === val ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setDepositAmount(val);
                  setError(null);
                }}
                className={cn(depositAmount === val && 'bg-green-500 hover:bg-green-600 text-black')}
              >
                ${val}
              </Button>
            ))}
          </div>

          <Button
            onClick={createCoinbaseCharge}
            className="w-full bg-blue-600 hover:bg-blue-500"
          >
            Continue with Coinbase
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (flowState === 'crypto_loading') {
    return (
      <Card className="animate-in fade-in duration-300">
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-muted-foreground">Creating payment...</p>
        </CardContent>
      </Card>
    );
  }

  if (flowState === 'crypto_checkout' && charge) {
    const primaryAddress = charge.addresses?.['base'] || charge.addresses?.['ethereum'] || Object.values(charge.addresses || {})[0] || '';
    const primaryNetwork = charge.addresses?.['base'] ? 'Base' : charge.addresses?.['ethereum'] ? 'Ethereum' : Object.keys(charge.addresses || {})[0] || 'Unknown';
    const usdcPricing = charge.pricing?.['USDC'] || charge.pricing?.['usdc'];

    return (
      <Card className="animate-in slide-in-from-right duration-300 overflow-hidden">
        <div className="bg-[#0052FF] p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="font-bold text-xs italic">C</span>
            </div>
            <span className="font-bold">Coinbase</span>
            <span className="opacity-70">Commerce</span>
          </div>
          <Button variant="ghost" size="sm" onClick={resetFlow} className="text-white hover:bg-white/10">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <CardContent className="p-6 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">Morpheus AI</h3>
              <p className="text-sm text-muted-foreground">Account Credit Top-up</p>
            </div>
            <div className="text-right">
              <div className="font-bold text-xl">${parseFloat(depositAmount).toFixed(2)}</div>
              {usdcPricing && (
                <div className="text-xs text-blue-500 font-medium">{usdcPricing.amount} USDC</div>
              )}
            </div>
          </div>

          {chargeStatus === 'PENDING' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Payment detected, awaiting confirmations...</span>
            </div>
          )}

          <div className="bg-muted/50 p-4 rounded-lg border flex flex-col items-center space-y-4">
            {primaryAddress && (
              <>
                <div className="bg-white p-2 rounded-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${primaryAddress}`}
                    alt="Wallet Address QR"
                    className="w-32 h-32"
                  />
                </div>
                <div className="w-full space-y-2">
                  <div className="text-xs text-muted-foreground">Address ({primaryNetwork})</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background p-2 rounded border break-all">
                      {primaryAddress}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyAddress(primaryAddress)}
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-1">
              <Timer className="h-4 w-4" />
              <span>Expires in {formatTime(timeLeft)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Code: <span className="font-mono font-bold">{charge.code}</span></span>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="default"
              className="w-full bg-[#0052FF] hover:bg-[#0040CC]"
              onClick={openHostedCheckout}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Coinbase Checkout
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Or send {usdcPricing?.amount || depositAmount} USDC to the address above
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (flowState === 'crypto_success' || flowState === 'stripe_success') {
    const isStripe = flowState === 'stripe_success';
    return (
      <Card className="animate-in zoom-in-95 duration-300">
        <CardContent className="flex flex-col items-center justify-center text-center p-12 space-y-6">
          <div
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center',
              isStripe ? 'bg-[#635BFF]/20 text-[#635BFF]' : 'bg-green-500/20 text-green-500'
            )}
          >
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Payment Successful</h3>
            <p className="text-muted-foreground">
              Your payment of{' '}
              <span className="font-bold text-foreground">${parseFloat(depositAmount).toFixed(2)}</span>{' '}
              has been confirmed and credited to your balance.
            </p>
          </div>
          <Button onClick={resetFlow} variant="outline" className="mt-4">
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Funds</CardTitle>
          <CardDescription>Choose a method to increase your credits</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full justify-between h-auto p-4"
            onClick={openStripeCheckout}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-md">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium">Credit Card</p>
                <p className="text-xs text-muted-foreground">Powered by Stripe</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Staking Status Box */}
      {stakingWidget && (
        <div className="mt-6">
          {stakingWidget}
        </div>
      )}

    </div>
  );
}
