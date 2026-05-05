import { NextRequest, NextResponse } from 'next/server';

interface CreatePayRamPaymentRequest {
  amount: string;
  currency?: 'USDC' | 'USDT';
  chain?: 'base' | 'tron' | 'polygon' | 'ethereum' | 'bitcoin';
  customerId?: string;
  customerEmail?: string;
  description?: string;
}

interface PayRamPaymentResponse {
  url?: string;
  deposit_address?: string;
  reference_id?: string;
  expires_at?: string;
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function getPayRamConfig() {
  const apiKey = process.env.PAYRAM_API_KEY;
  const baseUrl = process.env.PAYRAM_BASE_URL;

  if (!apiKey || !baseUrl) {
    return null;
  }

  return { apiKey, baseUrl: baseUrl.replace(/\/$/, '') };
}

function createReferenceId(customerId: string): string {
  return `mor_${customerId}_${Date.now()}`;
}

export async function POST(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    if (!bearerToken) {
      console.error('[PayRam Payment] Creation attempted without Cognito bearer token');
      return NextResponse.json(
        { error: 'Authentication required. Please log in to make a payment.' },
        { status: 401 }
      );
    }

    let body: CreatePayRamPaymentRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const {
      amount,
      currency = 'USDC',
      chain = 'base',
      customerId,
      customerEmail,
    } = body;

    if (!amount) {
      return NextResponse.json(
        { error: 'Missing required field: amount is required' },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Missing required field: customerId is required' },
        { status: 400 }
      );
    }

    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 10) {
      return NextResponse.json(
        { error: 'Amount must be a valid number greater than or equal to 10' },
        { status: 400 }
      );
    }

    if (currency !== 'USDC' || chain !== 'base') {
      return NextResponse.json(
        { error: 'Only USDC payments on Base are supported at this time' },
        { status: 400 }
      );
    }

    const config = getPayRamConfig();
    if (!config) {
      console.error('[PayRam Payment] PAYRAM_API_KEY or PAYRAM_BASE_URL not configured');
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    const payload = {
      amount: numericAmount,
      currency,
      chain,
      customer_email: customerEmail,
      customer_id: customerId,
      reference_id: createReferenceId(customerId),
    };

    console.log('[PayRam Payment] Creating payment:', {
      amount: numericAmount,
      currency,
      chain,
      customerId,
    });

    const response = await fetch(`${config.baseUrl}/api/v1/payment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let paymentData: PayRamPaymentResponse;

    try {
      paymentData = JSON.parse(responseText);
    } catch {
      console.error('[PayRam Payment] PayRam returned non-JSON:', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'Payment service returned invalid response' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[PayRam Payment] PayRam API error:', {
        status: response.status,
        statusText: response.statusText,
        error: paymentData,
      });
      return NextResponse.json(
        { error: 'Failed to create PayRam payment', details: paymentData },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      payment: {
        url: paymentData.url,
        deposit_address: paymentData.deposit_address,
        reference_id: paymentData.reference_id,
        expires_at: paymentData.expires_at,
      },
    });
  } catch (error) {
    console.error('[PayRam Payment] Error creating payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
