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
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';

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
  const { getValidToken } = useCognitoAuth();

  const stripePaymentLinkUrl = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    // Handle both Stripe (has session_id) and Coinbase (no session_id) success
    if (payment === 'success') {
      setFlowState('stripe_success');
      window.history.replaceState({}, '', window.location.pathname);
      
      // FIXED: Actually trigger balance refresh from backend
      // This gives the webhook time to process (2-5 seconds typical)
      // Then refreshes the balance to show new credits
      if (onBalanceUpdate) {
        // Small delay to allow webhook to process
        setTimeout(() => {
          onBalanceUpdate(0); // This should trigger parent to refetch balance
          // Force a full page data refresh after 2 seconds
          window.location.reload();
        }, 2000);
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
    if (!stripePaymentLinkUrl) {
      setError('Stripe payment link is not configured. Please contact support.');
      return;
    }
    const url = userId ? `${stripePaymentLinkUrl}?client_reference_id=${encodeURIComponent(userId)}` : stripePaymentLinkUrl;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openCoinbaseCheckout = async (amount: string) => {
    // CRITICAL: Do not allow payments without authenticated user
    if (!userId) {
      setError('You must be logged in to make a payment');
      console.error('Attempted Coinbase checkout without userId');
      return;
    }

    try {
      const token = await getValidToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/coinbase/payment-link', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: amount,
          currency: 'USDC',
          description: 'Morpheus AI Credits Purchase',
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorData: Record<string, unknown> = {};
        try {
          errorData = responseText ? JSON.parse(responseText) : {};
        } catch {
          errorData = { raw: responseText };
        }

        console.error('Payment link creation failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });

        if (response.status === 404) {
          setError('Coinbase Business payment endpoint is unavailable. Please contact support.');
          return;
        }

        setError(
          (typeof errorData?.error === 'string' ? errorData.error : null) ||
            'Failed to create payment. Please try again.'
        );
        return;
      }

      const data = await response.json();
      const hostedUrl =
        data?.payment_link?.url ||
        data?.payment_link?.hosted_url ||
        data?.charge?.hosted_url ||
        data?.hosted_url;

      if (hostedUrl) {
        window.open(hostedUrl, '_blank', 'noopener,noreferrer');
      } else {
        setError('No payment URL received from Coinbase');
        console.error('Missing payment URL in Coinbase response:', data);
      }
    } catch (err) {
      console.error('Error opening Coinbase checkout:', err);
      setError('Failed to initialize payment. Please try again.');
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
              disabled={!stripePaymentLinkUrl}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Credit Card</p>
                  <p className="text-xs text-muted-foreground">
                    {stripePaymentLinkUrl ? 'Powered by Stripe' : 'Not configured'}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between h-auto p-4"
              onClick={() => handlePaymentMethodClick('coinbase')}
              disabled={!userId}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-md">
                  <Coins className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Pay with Crypto</p>
                  <p className="text-xs text-muted-foreground">
                    {userId ? 'USDC on Base via Coinbase' : 'Login required'}
                  </p>
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
