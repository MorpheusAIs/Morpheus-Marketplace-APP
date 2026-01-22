import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia' as any,
});

export async function POST(request: NextRequest) {
  try {
    const { amount, userId, email } = await request.json();

    if (!amount || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount and userId are required' },
        { status: 400 }
      );
    }

    // Ensure amount is valid
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat < 0.50) { // Stripe minimum is usually $0.50
      return NextResponse.json(
        { error: 'Invalid amount. Minimum amount is $0.50' },
        { status: 400 }
      );
    }

    // Get the base URL for redirects
    // Use NEXT_PUBLIC_APP_URL if set, otherwise fallback to request origin
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Morpheus AI Credits',
              description: `Account credit top-up of $${amountFloat.toFixed(2)}`,
            },
            unit_amount: Math.round(amountFloat * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?payment=cancelled`,
      customer_email: email, // Pre-fill email if available
      metadata: {
        userId: userId.toString(),
        amount: amount.toString(),
        type: 'credit_purchase'
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
