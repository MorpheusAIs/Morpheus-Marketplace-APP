import { NextRequest, NextResponse } from 'next/server';

interface CreatePaymentLinkRequest {
  amount: string;
  currency?: string;
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

    const { amount, currency = 'USDC', description } = body;

    if (!amount) {
      return NextResponse.json(
        { error: 'Missing required field: amount is required' },
        { status: 400 }
      );
    }

    const bearerToken = extractBearerToken(request);
    if (!bearerToken) {
      console.error('[Payment Link] Creation attempted without Cognito bearer token');
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
      description: description || `Account credit top-up of ${currency} ${amount}`,
      success_redirect_url: `${origin}/billing?payment=success`,
      failure_redirect_url: `${origin}/billing?payment=cancelled`,
    };

    console.log('[Payment Link] Creating payment link');

    const response = await fetch(
      `${config.apiBaseUrl}/api/v1/billing/coinbase/payment-links`,
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
      console.error('[Payment Link] Backend returned non-JSON');
      return NextResponse.json(
        { error: 'Service error' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error('[Payment Link] Backend API error', { status: response.status });
      return NextResponse.json(
        { error: 'Request failed' },
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
    console.error('[Payment Link] Error creating payment link:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/coinbase/payment-link?id=xxx
 *
 * Fetches the status of a payment link via the backend admin API.
 * Used by the frontend to poll for payment completion.
 *
 * F-06: Requires bearer token authentication and strips metadata from response.
 */
export async function GET(request: NextRequest) {
  try {
    // F-06: Require bearer token for GET requests
    const bearerToken = extractBearerToken(request);
    if (!bearerToken) {
      console.warn('[Payment Link] GET attempted without bearer token');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const paymentLinkId = searchParams.get('id');

    if (!paymentLinkId) {
      return NextResponse.json(
        { error: 'Bad request' },
        { status: 400 }
      );
    }

    const config = getBackendConfig();
    if (!config) {
      console.error('[Payment Link] Backend config not available');
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 500 }
      );
    }

    console.log('[Payment Link] Fetching status', { paymentLinkId });

    const response = await fetch(
      `${config.apiBaseUrl}/api/v1/billing/coinbase/payment-links/${paymentLinkId}`,
      {
        method: 'GET',
        headers: buildBackendHeaders(config, bearerToken),
      }
    );

    if (!response.ok) {
      // F-14: Generic client errors, bounded server diagnostics
      console.error('[Payment Link] Backend GET failed', {
        status: response.status,
        paymentLinkId,
      });

      if (response.status >= 400 && response.status < 500) {
        return NextResponse.json(
          { error: 'Request failed' },
          { status: response.status }
        );
      }

      return NextResponse.json(
        { error: 'Service error' },
        { status: 502 }
      );
    }

    const linkData: BackendPaymentLinkResponse = await response.json();

    // F-06: Strip metadata from response
    return NextResponse.json({
      success: true,
      payment_link: {
        id: linkData.id,
        url: linkData.url,
        status: linkData.status,
        amount: linkData.amount,
        currency: linkData.currency,
        expires_at: linkData.expiresAt,
        // metadata intentionally omitted
      },
    });
  } catch (error) {
    // F-14: Generic error with bounded server-side logging
    console.error('[Payment Link] GET error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
