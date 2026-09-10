import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyCognitoToken, extractBearerToken } from '@/lib/auth/cognito-jwt-verify';

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
      console.error('[Coinbase Webhook] Missing timestamp or signature in header');
      return false;
    }

    // Replay protection: reject stale and implausibly future-dated events.
    const eventTimestamp = Number(timestamp);
    if (!Number.isInteger(eventTimestamp) || eventTimestamp <= 0) {
      console.error('[Coinbase Webhook] Invalid timestamp');
      return false;
    }
    const eventTime = eventTimestamp * 1000;
    if (Math.abs(Date.now() - eventTime) > REPLAY_WINDOW_MS) {
      console.error('[Coinbase Webhook] Event outside replay window');
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
    console.error('[Coinbase Webhook] Signature verification error:', error);
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
  // F-04: Fail-closed - check secret before parsing body
  const webhookSecret = process.env.COINBASE_PAYMENT_LINK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Coinbase Webhook] COINBASE_PAYMENT_LINK_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 500 }
    );
  }

  try {
    const signatureHeader = request.headers.get('x-hook0-signature');
    if (!signatureHeader) {
      console.warn('[Coinbase Webhook] Missing signature header');
      return NextResponse.json(
        { error: 'Bad request' },
        { status: 400 }
      );
    }

    // Read the raw body
    const rawBody = await request.text();

    // Verify webhook signature
    const isValid = verifyPaymentLinkWebhook(rawBody, signatureHeader, webhookSecret);
    if (!isValid) {
      console.error('[Coinbase Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const body = JSON.parse(rawBody);

    // Payment Link API event format
    const eventType: string = body.event_type || body.type;
    const eventData = body.data || body.event?.data;

    console.log('[Coinbase Webhook] Event received', {
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
      console.log('[Coinbase Webhook] Ignoring event type:', eventType);
      return NextResponse.json({ received: true });
    }

    // Extract user ID from metadata
    const userId = eventData?.metadata?.user_id || eventData?.metadata?.userId;
    if (!userId || userId === 'anonymous') {
      console.error('[Coinbase Webhook] Missing or invalid user_id in metadata');
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

    console.log('[Coinbase Webhook] Notification stored', {
      userId,
      paymentLinkId: notification.paymentLinkId,
      status: notification.status,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Coinbase Webhook] Processing error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
/**
 * GET /api/webhooks/coinbase-notification
 *
 * Poll for pending notifications for a user.
 * Requires Bearer token authentication with Cognito JWKS verification.
 * Returns all pending notifications for the authenticated user and clears them.
 */
export async function GET(request: NextRequest) {
  try {
    // F-05: Extract and verify Bearer token using Cognito JWKS
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      console.error('[Coinbase Webhook GET] Missing authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify token and extract user ID from 'sub' claim
    let userId: string;
    try {
      const payload = await verifyCognitoToken(token);
      if (!payload.sub) {
        throw new Error('Token missing sub claim');
      }
      userId = payload.sub;
      console.log('[Coinbase Webhook GET] Authenticated request for user (sub from token)');
    } catch (error) {
      console.error('[Coinbase Webhook GET] Token verification failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get and clear notifications for this authenticated user
    const notifications = pendingNotifications.get(userId) || [];
    pendingNotifications.delete(userId);

    console.log(`[Coinbase Webhook GET] Returned ${notifications.length} notifications for authenticated user`);

    return NextResponse.json({
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('[Coinbase Webhook GET] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      { error: 'Service error' },
      { status: 500 }
    );
  }
}
