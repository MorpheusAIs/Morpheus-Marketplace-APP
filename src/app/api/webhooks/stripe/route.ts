import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

async function creditUserAccount(userId: string, amount: string, transactionId: string) {
  const adminSecret = process.env.ADMIN_API_SECRET;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!adminSecret || !apiBaseUrl) {
    throw new Error('Missing configuration: ADMIN_API_SECRET or NEXT_PUBLIC_API_BASE_URL');
  }

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
    const errorText = await response.text();
    console.error(`Failed to credit account: ${response.status} ${errorText}`);
    throw new Error(`Backend API returned ${response.status}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: 'Missing signature or webhook secret' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
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
        console.log(`Processing Stripe payment for user ${userId}: $${amount}`);
        await creditUserAccount(userId, amount, session.id);
      } else {
        console.error('Missing userId or amount in session metadata');
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
