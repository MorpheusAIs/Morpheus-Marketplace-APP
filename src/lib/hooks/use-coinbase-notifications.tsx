/**
 * Hook to poll for Coinbase payment notifications and display toasts
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { hasSuccessPageToast, getAndClearSuccessPageToastId } from '@/lib/payment-success-toast-store';

interface CoinbaseNotification {
  userId: string;
  paymentLinkId: string;
  amount: string;
  currency: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

interface NotificationResponse {
  notifications: CoinbaseNotification[];
  count: number;
}

export function useCoinbaseNotifications() {
  const { user } = useCognitoAuth();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownNotificationRef = useRef<Set<string>>(new Set());
  const pendingToastIdsRef = useRef<Map<string, string | number>>(new Map());

  const pollForNotifications = useCallback(async () => {
    if (!user?.sub) return;

    try {
      const response = await fetch(
        `/api/webhooks/coinbase-notification?userId=${encodeURIComponent(user.sub)}`
      );

      if (!response.ok) {
        console.error('[Coinbase Notifications] Failed to poll:', response.statusText);
        return;
      }

      const data: NotificationResponse = await response.json();

      // Process each notification
      for (const notification of data.notifications) {
        // Skip if we've already shown this notification
        const notificationKey = `${notification.paymentLinkId}-${notification.status}-${notification.timestamp}`;
        if (hasShownNotificationRef.current.has(notificationKey)) {
          continue;
        }

        // Mark as shown
        hasShownNotificationRef.current.add(notificationKey);

        if (notification.status === 'pending') {
          // Payment detected - Show loading toast (skip if success page already showed one)
          if (!hasSuccessPageToast()) {
            const toastId = toast.loading(
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <div>
                  <div className="font-semibold">Payment Detected</div>
                  <div className="text-sm text-muted-foreground">
                    Your USDC payment is being confirmed. This typically takes under a minute on Base.
                  </div>
                </div>
              </div>,
              { duration: Infinity }
            );
            pendingToastIdsRef.current.set(notification.paymentLinkId, toastId);
          }
        } else if (notification.status === 'confirmed') {
          // Payment confirmed - Dismiss pending toasts, show success, refresh balance
          const pendingToastId = pendingToastIdsRef.current.get(notification.paymentLinkId);
          if (pendingToastId !== undefined) {
            toast.dismiss(pendingToastId);
            pendingToastIdsRef.current.delete(notification.paymentLinkId);
          }
          const successPageToastId = getAndClearSuccessPageToastId();
          if (successPageToastId !== null) {
            toast.dismiss(successPageToastId);
          }

          toast.success(
            <div className="flex items-center gap-3">
              <div>
                <div className="font-semibold">Payment Confirmed!</div>
                <div className="text-sm text-muted-foreground">
                  {notification.amount} {notification.currency} has been added to your account
                </div>
              </div>
            </div>,
            { duration: 5000 }
          );

          // Refresh balance after a short delay to ensure backend has processed the payment
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
            queryClient.invalidateQueries({ queryKey: ['billing', 'transactions'] });
          }, 1500);
        } else {
          // Payment failed/expired - Dismiss pending toasts
          const pendingToastId = pendingToastIdsRef.current.get(notification.paymentLinkId);
          if (pendingToastId !== undefined) {
            toast.dismiss(pendingToastId);
            pendingToastIdsRef.current.delete(notification.paymentLinkId);
          }
          const successPageToastId = getAndClearSuccessPageToastId();
          if (successPageToastId !== null) {
            toast.dismiss(successPageToastId);
          }

          toast.error(
            <div className="flex items-center gap-3">
              <div>
                <div className="font-semibold">Payment Failed</div>
                <div className="text-sm text-muted-foreground">
                  There was an issue processing your payment
                </div>
              </div>
            </div>,
            { duration: 5000 }
          );
        }
      }

      // Clean up old notification keys (keep only last 50)
      if (hasShownNotificationRef.current.size > 50) {
        const entries = Array.from(hasShownNotificationRef.current);
        hasShownNotificationRef.current = new Set(entries.slice(-50));
      }
    } catch (error) {
      console.error('[Coinbase Notifications] Error polling for notifications:', error);
    }
  }, [user?.sub, queryClient]);

  useEffect(() => {
    if (!user?.sub) {
      // Clear polling and pending toasts if user logs out
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      for (const toastId of pendingToastIdsRef.current.values()) {
        toast.dismiss(toastId);
      }
      pendingToastIdsRef.current.clear();
      return;
    }

    // Poll immediately on mount
    pollForNotifications();

    // Then poll every 3 seconds
    pollingIntervalRef.current = setInterval(pollForNotifications, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [user?.sub, pollForNotifications]);
}
