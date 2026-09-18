import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey
    ? new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion })
    : null;
}

async function creditUserAccount(userId: string, amount: string, transactionId: string) {
  const adminSecret = process.env.ADMIN_API_SECRET;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!adminSecret || !apiBaseUrl) {
    throw new Error('Missing configuration: ADMIN_API_SECRET or NEXT_PUBLIC_API_BASE_URL');
  }

  console.log('[Stripe Webhook] Crediting account', { userId, amount });

  const response = await fetch(`${apiBaseUrl}/api/v1/billing/credits/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': adminSecret,
    },
    body: JSON.stringify({
      user_id: userId,
      amount_usd: parseFloat(amount),
      description: `Stripe payment: ${transactionId}`,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    console.error('[Stripe Webhook] Backend credit failed', { status, userId });
    throw new Error(`Backend API returned ${status}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error('[Stripe Webhook] Stripe configuration is missing');
    return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.warn('[Stripe Webhook] Missing signature or webhook secret');
    return NextResponse.json(
      { error: 'Bad request' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed');
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const amount = session.metadata?.amount;

      if (userId && amount) {
        console.log('[Stripe Webhook] Processing payment', { userId });
        await creditUserAccount(userId, amount, session.id);
      } else {
        console.error('[Stripe Webhook] Missing userId or amount in metadata');
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // F-14: Generic error with bounded server-side logging
    console.error('[Stripe Webhook] Processing error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
