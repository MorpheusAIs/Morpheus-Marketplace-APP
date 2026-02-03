'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Coins,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaymentAmountDialog } from './PaymentAmountDialog';

interface FundingSectionProps {
  currentBalance: string;
  isLoading?: boolean;
  onBalanceUpdate?: (amount: number) => void;
  userId?: string;
  stakingWidget?: React.ReactNode;
}

type PaymentFlowState = 'none' | 'stripe_success';
type PaymentMethod = 'stripe' | 'coinbase' | null;

export function FundingSection({ currentBalance, isLoading, onBalanceUpdate, userId, stakingWidget }: FundingSectionProps) {
  const [flowState, setFlowState] = useState<PaymentFlowState>('none');
  const [error, setError] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(null);

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

  const resetFlow = () => {
    setFlowState('none');
    setError(null);
  };

  const handlePaymentMethodClick = (method: 'stripe' | 'coinbase') => {
    setSelectedPaymentMethod(method);
    setShowPaymentDialog(true);
    setError(null);
  };

  const handlePaymentConfirm = async (amount: string) => {
    if (selectedPaymentMethod === 'stripe') {
      await openStripeCheckout(amount);
    } else if (selectedPaymentMethod === 'coinbase') {
      await openCoinbaseCheckout(amount);
    }
  };

  const openStripeCheckout = async (amount?: string) => {
    const baseUrl = 'https://buy.stripe.com/test_9B6bJ0eU08TG6Pi4EIgnK00';
    const url = userId ? `${baseUrl}?client_reference_id=${encodeURIComponent(userId)}` : baseUrl;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openCoinbaseCheckout = async (amount: string) => {
    const response = await fetch('/api/coinbase/charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'USD',
        userId: userId || 'anonymous',
        description: 'Morpheus AI Credits Purchase',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Coinbase charge creation failed:', errorData);
      throw new Error(errorData.error || 'Failed to create Coinbase charge');
    }

    const data = await response.json();
    
    // Response structure: { success: true, charge: { hosted_url, ... } }
    if (data.charge?.hosted_url) {
      window.open(data.charge.hosted_url, '_blank', 'noopener,noreferrer');
    } else {
      throw new Error('No payment URL received from Coinbase');
    }
  };

  if (flowState === 'stripe_success') {
    return (
      <Card className="animate-in zoom-in-95 duration-300">
        <CardContent className="flex flex-col items-center justify-center text-center p-12 space-y-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[#635BFF]/20 text-[#635BFF]">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2">Payment Successful</h3>
            <p className="text-muted-foreground">
              Your payment has been confirmed and credited to your balance.
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
          <CardDescription>Add credits to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-between h-auto p-4"
              onClick={() => openStripeCheckout()}
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
            <Button
              variant="outline"
              className="w-full justify-between h-auto p-4"
              onClick={() => handlePaymentMethodClick('coinbase')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Coins className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Pay with Crypto</p>
                  <p className="text-xs text-muted-foreground">Powered by Coinbase Commerce</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {stakingWidget && (
        <div className="mt-6">
          {stakingWidget}
        </div>
      )}

      {/* Payment Amount Dialog */}
      <PaymentAmountDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        paymentMethod={selectedPaymentMethod || 'stripe'}
        onConfirm={handlePaymentConfirm}
      />
    </div>
  );
}
