'use client';

import React, { useState } from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PaymentAmountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethod: 'stripe' | 'coinbase';
  onConfirm: (amount: string) => Promise<void>;
}

const PRESET_AMOUNTS = ['10', '25', '50', '100', '250', '500'];

export function PaymentAmountDialog({
  open,
  onOpenChange,
  paymentMethod,
  onConfirm,
}: PaymentAmountDialogProps) {
  const [amount, setAmount] = useState('10.00');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePresetClick = (preset: string) => {
    setAmount(preset + '.00');
    setError(null);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setAmount(value);
      setError(null);
    }
  };

  const handleConfirm = async () => {
    const numericAmount = parseFloat(amount);
    
    if (!amount || isNaN(numericAmount)) {
      setError('Please enter a valid amount');
      return;
    }

    if (numericAmount < 1) {
      setError('Minimum amount is $1.00');
      return;
    }

    if (numericAmount > 10000) {
      setError('Maximum amount is $10,000.00');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(amount);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isLoading) {
      onOpenChange(open);
      if (!open) {
        // Reset state when closing
        setAmount('10.00');
        setError(null);
      }
    }
  };

  const paymentMethodName = paymentMethod === 'stripe' ? 'Credit Card' : 'USDC';
  const paymentProvider = paymentMethod === 'stripe' ? 'Stripe' : 'Coinbase';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md p-6 bg-card text-card-foreground rounded-lg shadow-lg border-none">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Add Funds with {paymentMethodName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Select or enter the amount you want to add to your account via {paymentProvider}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-5">
          {/* Preset Amount Buttons */}
          <div className="space-y-2">
            <Label>Quick Select</Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={amount === preset + '.00' ? 'default' : 'outline'}
                  className="h-12 text-base font-semibold"
                  onClick={() => handlePresetClick(preset)}
                  disabled={isLoading}
                >
                  ${preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Custom Amount (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                className="pl-10 text-lg font-semibold"
                disabled={isLoading}
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum: $10 • Maximum: $10,000
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleClose(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Continue to Payment`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
