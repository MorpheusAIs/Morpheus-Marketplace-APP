import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// In-memory store for pending notifications
// In production, this should be Redis or a database
interface PendingNotification {
  userId: string;
  chargeId: string;
  amount: string;
  currency: string;
  timestamp: number;
  status: 'confirmed' | 'failed';
}

// Store notifications for 5 minutes
const NOTIFICATION_TTL = 5 * 60 * 1000;
const pendingNotifications = new Map<string, PendingNotification[]>();

// Cleanup old notifications periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, notifications] of pendingNotifications.entries()) {
    const fresh = notifications.filter(n => now - n.timestamp < NOTIFICATION_TTL);
    if (fresh.length === 0) {
      pendingNotifications.delete(userId);
    } else {
      pendingNotifications.set(userId, fresh);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Verify Coinbase webhook signature
 */
function verifyCoinbaseWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

/**
 * POST /api/webhooks/coinbase-notification
 * 
 * Receives webhook notifications from Coinbase Commerce after successful payments.
 * This endpoint stores the notification temporarily and allows the frontend to
 * poll for new notifications to display toast messages and refresh balance.
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const signature = headersList.get('x-cc-webhook-signature');
    
    // Read the raw body
    const rawBody = await request.text();
    
    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = verifyCoinbaseWebhook(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('[Coinbase Webhook] Invalid signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } else if (!webhookSecret) {
      console.warn('[Coinbase Webhook] No webhook secret configured - accepting unverified webhook');
    }

    // Parse the webhook payload
    const body = JSON.parse(rawBody);
    
    // Extract event data (supports both Commerce API and Payment Links API)
    const eventType = body.event?.type || body.event_type;
    const eventData = body.event?.data || body.data;
    
    console.log('[Coinbase Webhook] Received event:', {
      type: eventType,
      chargeId: eventData?.id,
      chargeCode: eventData?.code,
    });

    // Only handle charge:confirmed events
    if (eventType !== 'charge:confirmed') {
      console.log('[Coinbase Webhook] Ignoring non-confirmed event:', eventType);
      return NextResponse.json({ received: true });
    }

    // Extract user ID from metadata
    const userId = eventData?.metadata?.user_id || eventData?.metadata?.userId;
    if (!userId || userId === 'anonymous') {
      console.error('[Coinbase Webhook] Missing or invalid user_id in metadata');
      return NextResponse.json({ received: true }); // Return success to prevent retries
    }

    // Extract payment details
    const payments = eventData?.payments || [];
    const payment = payments[0] || {};
    const amount = payment?.value?.local?.amount || payment?.value?.crypto?.amount || '0';
    const currency = payment?.value?.local?.currency || payment?.value?.crypto?.currency || 'USD';

    // Create notification
    const notification: PendingNotification = {
      userId,
      chargeId: eventData?.id || 'unknown',
      amount,
      currency,
      timestamp: Date.now(),
      status: 'confirmed',
    };

    // Store notification for this user
    const userNotifications = pendingNotifications.get(userId) || [];
    userNotifications.push(notification);
    pendingNotifications.set(userId, userNotifications);

    console.log('[Coinbase Webhook] Notification stored for user:', {
      userId,
      chargeId: notification.chargeId,
      amount: notification.amount,
      currency: notification.currency,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Coinbase Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/coinbase-notification?userId=xxx
 * 
 * Poll for pending notifications for a user.
 * Returns all pending notifications and clears them.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get and clear notifications for this user
    const notifications = pendingNotifications.get(userId) || [];
    pendingNotifications.delete(userId);

    return NextResponse.json({
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('[Coinbase Webhook] Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
