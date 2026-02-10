import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

interface CoinbaseWebhookEvent {
  id: string;
  scheduled_for: string;
  attempt_number: number;
  event: {
    id: string;
    type: string;
    api_version: string;
    created_at: string;
    data: {
      id: string;
      code: string;
      name: string;
      description: string;
      pricing_type: string;
      addresses: Record<string, string>;
      pricing: Record<string, { amount: string; currency: string }>;
      payments: Array<{
        network: string;
        transaction_id: string;
        status: string;
        detected_at: string;
        value: {
          local: { amount: string; currency: string };
          crypto: { amount: string; currency: string };
        };
        block: {
          height: number;
          hash: string;
          confirmations: number;
          confirmations_required: number;
        };
      }>;
      timeline: Array<{
        status: string;
        time: string;
      }>;
      metadata: {
        userId: string;
      };
    };
  };
}

type WebhookEventType =
  | 'charge:created'
  | 'charge:confirmed'
  | 'charge:failed'
  | 'charge:delayed'
  | 'charge:pending'
  | 'charge:resolved';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  const hmac = createHmac('sha256', webhookSecret);
  hmac.update(payload);
  const computedSignature = hmac.digest('hex');
  return computedSignature === signature;
}

async function handleChargeConfirmed(data: CoinbaseWebhookEvent['event']['data']) {
  const userId = data.metadata?.userId;
  const payment = data.payments?.[0];

  if (!userId) {
    console.error('No userId in charge metadata');
    return;
  }

  const amount = payment?.value?.local?.amount || '0';
  const currency = payment?.value?.local?.currency || 'USD';

  console.log(`Payment confirmed for user ${userId}: ${currency} ${amount}`);

  try {
    const adminSecret = process.env.ADMIN_API_SECRET;
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!adminSecret || !apiBaseUrl) {
      console.error('Missing configuration: ADMIN_API_SECRET or NEXT_PUBLIC_API_BASE_URL');
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/v1/billing/credits/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': adminSecret,
      },
      body: JSON.stringify({
        cognito_user_id: userId, // Use cognito_user_id since userId is a Cognito UUID
        amount_usd: parseFloat(amount),
        description: `Coinbase payment: ${data.code} (${payment?.network || 'crypto'})`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to credit account: ${response.status} ${errorText}`);
      throw new Error(`Backend API returned ${response.status}`);
    }

    const result = await response.json();
    console.log('Account credited successfully:', result);

  } catch (error) {
    console.error('Error crediting account:', error);
    throw error;
  }
}

async function handleChargeFailed(data: CoinbaseWebhookEvent['event']['data']) {
  const userId = data.metadata?.userId;
  console.log(`Payment failed for user ${userId}, charge ${data.code}`);
}

async function handleChargeDelayed(data: CoinbaseWebhookEvent['event']['data']) {
  const userId = data.metadata?.userId;
  console.log(`Payment delayed for user ${userId}, charge ${data.code} - underpayment detected`);
}

async function handleChargePending(data: CoinbaseWebhookEvent['event']['data']) {
  const userId = data.metadata?.userId;
  console.log(`Payment pending for user ${userId}, charge ${data.code} - awaiting confirmations`);
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;

    const rawBody = await request.text();
    const signature = request.headers.get('x-cc-webhook-signature');

    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (webhookSecret && !signature) {
      console.error('Missing webhook signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const webhookEvent: CoinbaseWebhookEvent = JSON.parse(rawBody);
    const eventType = webhookEvent.event.type as WebhookEventType;
    const eventData = webhookEvent.event.data;

    console.log(`Received Coinbase webhook: ${eventType} for charge ${eventData.code}`);

    switch (eventType) {
      case 'charge:confirmed':
        await handleChargeConfirmed(eventData);
        break;
      case 'charge:failed':
        await handleChargeFailed(eventData);
        break;
      case 'charge:delayed':
        await handleChargeDelayed(eventData);
        break;
      case 'charge:pending':
        await handleChargePending(eventData);
        break;
      case 'charge:created':
      case 'charge:resolved':
        console.log(`Charge ${eventType}: ${eventData.code}`);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Coinbase webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
