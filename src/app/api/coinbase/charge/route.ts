import { NextRequest, NextResponse } from 'next/server';

const COINBASE_COMMERCE_API_URL = 'https://api.commerce.coinbase.com';

interface CreateChargeRequest {
  amount: string;
  currency: string;
  userId: string;
  description?: string;
}

interface CoinbaseChargeResponse {
  data: {
    id: string;
    code: string;
    name: string;
    description: string;
    pricing_type: string;
    addresses: {
      [network: string]: string;
    };
    pricing: {
      [currency: string]: {
        amount: string;
        currency: string;
      };
    };
    exchange_rates: {
      [pair: string]: string;
    };
    hosted_url: string;
    created_at: string;
    expires_at: string;
    timeline: Array<{
      status: string;
      time: string;
    }>;
    metadata: {
      userId: string;
    };
    payments: Array<unknown>;
    payment_threshold: {
      overpayment_absolute_threshold: {
        amount: string;
        currency: string;
      };
      overpayment_relative_threshold: string;
      underpayment_absolute_threshold: {
        amount: string;
        currency: string;
      };
      underpayment_relative_threshold: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: CreateChargeRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    const { amount, currency = 'USD', userId, description } = body;

    if (!amount) {
      return NextResponse.json(
        { error: 'Missing required field: amount is required' },
        { status: 400 }
      );
    }
    
    // Use a fallback for userId if not provided (anonymous payment)
    const effectiveUserId = userId || 'anonymous';

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 1) {
      return NextResponse.json(
        { error: 'Amount must be a valid number greater than or equal to 1' },
        { status: 400 }
      );
    }

    const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
    if (!apiKey) {
      console.error('COINBASE_COMMERCE_API_KEY not configured');
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    const chargePayload = {
      name: 'Morpheus AI Credits',
      description: description || `Account credit top-up of ${currency} ${amount}`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: amount,
        currency: currency,
      },
      metadata: {
        userId: effectiveUserId,
      },
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mor.org'}/billing?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.mor.org'}/billing?payment=cancelled`,
    };

    const response = await fetch(`${COINBASE_COMMERCE_API_URL}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': apiKey,
        'X-CC-Version': '2018-03-22',
      },
      body: JSON.stringify(chargePayload),
    });

    const responseText = await response.text();
    let chargeData: CoinbaseChargeResponse;
    
    try {
      chargeData = JSON.parse(responseText);
    } catch {
      console.error('Coinbase Commerce API returned non-JSON:', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'Payment service returned invalid response' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('Coinbase Commerce API error:', {
        status: response.status,
        statusText: response.statusText,
        error: chargeData,
      });
      return NextResponse.json(
        { error: 'Failed to create payment charge', details: chargeData },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      charge: {
        id: chargeData.data.id,
        code: chargeData.data.code,
        hosted_url: chargeData.data.hosted_url,
        expires_at: chargeData.data.expires_at,
        addresses: chargeData.data.addresses,
        pricing: chargeData.data.pricing,
        timeline: chargeData.data.timeline,
      },
    });
  } catch (error) {
    console.error('Error creating Coinbase charge:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chargeId = searchParams.get('chargeId');

    if (!chargeId) {
      return NextResponse.json(
        { error: 'Missing chargeId parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${COINBASE_COMMERCE_API_URL}/charges/${chargeId}`, {
      method: 'GET',
      headers: {
        'X-CC-Api-Key': apiKey,
        'X-CC-Version': '2018-03-22',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch charge status' },
        { status: response.status }
      );
    }

    const chargeData: CoinbaseChargeResponse = await response.json();
    const timeline = chargeData.data.timeline;
    const latestStatus = timeline[timeline.length - 1]?.status || 'NEW';

    return NextResponse.json({
      success: true,
      charge: {
        id: chargeData.data.id,
        code: chargeData.data.code,
        status: latestStatus,
        hosted_url: chargeData.data.hosted_url,
        expires_at: chargeData.data.expires_at,
        addresses: chargeData.data.addresses,
        pricing: chargeData.data.pricing,
        payments: chargeData.data.payments,
        timeline: chargeData.data.timeline,
      },
    });
  } catch (error) {
    console.error('Error fetching charge status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
