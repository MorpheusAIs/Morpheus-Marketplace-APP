import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// In-memory store for pending notifications
// In production, this should be Redis or a database
interface PendingNotification {
  userId: string;
  paymentLinkId: string;
  amount: string;
  currency: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
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

// Replay protection: reject events older than 5 minutes
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Verify Payment Link API webhook signature (X-Hook0-Signature format)
 * Format: t=<timestamp>,h=<header_names>,v1=<hmac_sha256>
 */
function verifyPaymentLinkWebhook(
  payload: string,
  signatureHeader: string,
  secret: string
): boolean {
  try {
    const parts = signatureHeader.split(',');
    const params: Record<string, string> = {};
    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');
      params[key] = valueParts.join('=');
    }

    const timestamp = params['t'];
    const signature = params['v1'];

    if (!timestamp || !signature) {
      console.error('[Payment Link Webhook] Missing timestamp or signature in header');
      return false;
    }

    // Replay protection
    const eventTime = parseInt(timestamp, 10) * 1000;
    if (Date.now() - eventTime > REPLAY_WINDOW_MS) {
      console.error('[Payment Link Webhook] Event too old, possible replay attack');
      return false;
    }

    // Compute HMAC: sign the "timestamp.payload" string
    const signedPayload = `${timestamp}.${payload}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signedPayload);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Payment Link Webhook] Signature verification error:', error);
    return false;
  }
}

/**
 * POST /api/webhooks/coinbase-notification
 *
 * Receives webhook notifications from Coinbase Business Payment Link API.
 * Stores notifications temporarily for frontend polling to display toasts.
 */
export async function POST(request: NextRequest) {
  try {
    const signatureHeader = request.headers.get('x-hook0-signature');

    // Read the raw body
    const rawBody = await request.text();

    // Verify webhook signature
    const webhookSecret = process.env.COINBASE_PAYMENT_LINK_WEBHOOK_SECRET;
    if (webhookSecret && signatureHeader) {
      const isValid = verifyPaymentLinkWebhook(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        console.error('[Payment Link Webhook] Invalid signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } else if (!webhookSecret) {
      console.warn('[Payment Link Webhook] No webhook secret configured - accepting unverified webhook');
    }

    // Parse the webhook payload
    const body = JSON.parse(rawBody);

    // Payment Link API event format
    const eventType: string = body.event_type || body.type;
    const eventData = body.data || body.event?.data;

    console.log('[Payment Link Webhook] Received event:', {
      type: eventType,
      paymentLinkId: eventData?.id,
    });

    // Map Payment Link API events to notification statuses
    const eventStatusMap: Record<string, 'pending' | 'confirmed' | 'failed'> = {
      'payment_link.payment.success': 'confirmed',
      'payment_link.payment.failed': 'failed',
      'payment_link.payment.expired': 'failed',
    };

    const status = eventStatusMap[eventType];
    if (!status) {
      console.log('[Payment Link Webhook] Ignoring event type:', eventType);
      return NextResponse.json({ received: true });
    }

    // Extract user ID from metadata
    const userId = eventData?.metadata?.user_id || eventData?.metadata?.userId;
    if (!userId || userId === 'anonymous') {
      console.error('[Payment Link Webhook] Missing or invalid user_id in metadata');
      return NextResponse.json({ received: true }); // Return success to prevent retries
    }

    // Extract payment details
    const amount = eventData?.amount || '0';
    const currency = eventData?.currency || 'USDC';

    // Create notification
    const notification: PendingNotification = {
      userId,
      paymentLinkId: eventData?.id || 'unknown',
      amount,
      currency,
      timestamp: Date.now(),
      status,
    };

    // Store notification for this user
    const userNotifications = pendingNotifications.get(userId) || [];
    userNotifications.push(notification);
    pendingNotifications.set(userId, userNotifications);

    console.log('[Payment Link Webhook] Notification stored for user:', {
      userId,
      paymentLinkId: notification.paymentLinkId,
      amount: notification.amount,
      currency: notification.currency,
      status: notification.status,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Payment Link Webhook] Error processing webhook:', error);
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
    console.error('[Payment Link Webhook] Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
