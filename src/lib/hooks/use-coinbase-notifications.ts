/**
 * Hook to poll for Coinbase payment notifications and display toasts
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useCognitoAuth } from '@/lib/auth/CognitoAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface CoinbaseNotification {
  userId: string;
  chargeId: string;
  amount: string;
  currency: string;
  timestamp: number;
  status: 'confirmed' | 'failed';
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
        const notificationKey = `${notification.chargeId}-${notification.timestamp}`;
        if (hasShownNotificationRef.current.has(notificationKey)) {
          continue;
        }

        // Mark as shown
        hasShownNotificationRef.current.add(notificationKey);

        // Show toast with animation
        if (notification.status === 'confirmed') {
          toast.success(
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-green-500" />
              <div>
                <div className="font-semibold">Payment Confirmed!</div>
                <div className="text-sm text-muted-foreground">
                  {notification.currency} {notification.amount} has been added to your account
                </div>
              </div>
            </div>,
            {
              duration: 5000,
              important: true,
            }
          );

          // Refresh balance after a short delay to ensure backend has processed the payment
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['billing', 'balance'] });
            queryClient.invalidateQueries({ queryKey: ['billing', 'transactions'] });
          }, 1500);
        } else {
          toast.error(
            <div className="flex items-center gap-3">
              <div>
                <div className="font-semibold">Payment Failed</div>
                <div className="text-sm text-muted-foreground">
                  There was an issue processing your payment
                </div>
              </div>
            </div>,
            {
              duration: 5000,
            }
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
      // Clear polling if user logs out
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
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
