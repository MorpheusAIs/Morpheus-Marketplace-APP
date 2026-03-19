import { NextRequest, NextResponse } from 'next/server';

interface CreatePaymentLinkRequest {
  amount: string;
  currency?: string;
  userId: string;
  description?: string;
}

/**
 * Extract the Bearer token from the incoming request's Authorization header.
 * The browser client sends its Cognito token which we forward to the backend.
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function buildBackendHeaders(config: { adminSecret: string }, bearerToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Admin-Secret': config.adminSecret,
  };
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  }
  return headers;
}

interface BackendPaymentLinkResponse {
  id: string;
  url?: string;
  status?: string;
  amount?: string;
  currency?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
}

function getBackendConfig() {
  const adminSecret = process.env.ADMIN_API_SECRET;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!adminSecret || !apiBaseUrl) {
    return null;
  }

  return { adminSecret, apiBaseUrl };
}

/**
 * POST /api/coinbase/payment-link
 *
 * Creates a Coinbase Business payment link via the backend admin API.
 * The backend handles JWT auth with Coinbase and auto-injects user_id metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const origin =
      request.headers.get('origin') ||
      request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://app.mor.org';

    let body: CreatePaymentLinkRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { amount, currency = 'USDC', userId, description } = body;

    if (!amount) {
      return NextResponse.json(
        { error: 'Missing required field: amount is required' },
        { status: 400 }
      );
    }

    if (!userId || userId === 'anonymous') {
      console.error('[Payment Link] Creation attempted without valid userId');
      return NextResponse.json(
        { error: 'Authentication required. Please log in to make a payment.' },
        { status: 401 }
      );
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 1) {
      return NextResponse.json(
        { error: 'Amount must be a valid number greater than or equal to 1' },
        { status: 400 }
      );
    }

    const config = getBackendConfig();
    if (!config) {
      console.error('[Payment Link] ADMIN_API_SECRET or NEXT_PUBLIC_API_BASE_URL not configured');
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    const payload = {
      amount: amount,
      currency: currency,
      metadata: {
        user_id: userId,
      },
      description: description || `Account credit top-up of ${currency} ${amount}`,
      success_redirect_url: `${origin}/billing?payment=success`,
      failure_redirect_url: `${origin}/billing?payment=cancelled`,
    };

    console.log('[Payment Link] Creating payment link:', {
      origin,
      userId,
      amount,
      currency,
    });

    const bearerToken = extractBearerToken(request);

    const response = await fetch(
      `${config.apiBaseUrl}/api/v1/billing/admin/payment-links`,
      {
        method: 'POST',
        headers: buildBackendHeaders(config, bearerToken),
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();
    let linkData: BackendPaymentLinkResponse;

    try {
      linkData = JSON.parse(responseText);
    } catch {
      console.error('[Payment Link] Backend returned non-JSON:', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'Payment service returned invalid response' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[Payment Link] Backend API error:', {
        status: response.status,
        statusText: response.statusText,
        error: linkData,
      });
      return NextResponse.json(
        { error: 'Failed to create payment link', details: linkData },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      payment_link: {
        id: linkData.id,
        url: linkData.url,
        status: linkData.status,
        amount: linkData.amount,
        currency: linkData.currency,
        expires_at: linkData.expiresAt,
        metadata: linkData.metadata,
      },
    });
  } catch (error) {
    console.error('[Payment Link] Error creating payment link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/coinbase/payment-link?id=xxx
 *
 * Fetches the status of a payment link via the backend admin API.
 * Used by the frontend to poll for payment completion.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentLinkId = searchParams.get('id');

    if (!paymentLinkId) {
      return NextResponse.json(
        { error: 'Missing id parameter' },
        { status: 400 }
      );
    }

    const config = getBackendConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    const bearerToken = extractBearerToken(request);

    const response = await fetch(
      `${config.apiBaseUrl}/api/v1/billing/admin/payment-links/${paymentLinkId}`,
      {
        method: 'GET',
        headers: buildBackendHeaders(config, bearerToken),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch payment link status' },
        { status: response.status }
      );
    }

    const linkData: BackendPaymentLinkResponse = await response.json();

    return NextResponse.json({
      success: true,
      payment_link: {
        id: linkData.id,
        url: linkData.url,
        status: linkData.status,
        amount: linkData.amount,
        currency: linkData.currency,
        expires_at: linkData.expiresAt,
        metadata: linkData.metadata,
      },
    });
  } catch (error) {
    console.error('[Payment Link] Error fetching payment link status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
