/**
 * Component that listens for Coinbase payment notifications
 * and displays toasts when payments are confirmed
 */

'use client';

import { useCoinbaseNotifications } from '@/lib/hooks/use-coinbase-notifications';

export function CoinbaseNotificationListener() {
  // This component doesn't render anything - it just runs the notification polling hook
  useCoinbaseNotifications();
  return null;
}
