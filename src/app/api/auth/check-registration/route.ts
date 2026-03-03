import { NextRequest, NextResponse } from 'next/server';

interface CheckRegistrationRequestBody {
  fingerprint_hash: string;
  device_token: string | null;
  email: string;
}

interface CheckRegistrationResponse {
  allowed: boolean;
  reason: string | null;
  fingerprint_count: number;
  ip_count: number;
  device_token_count: number;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.mor.org').replace(/\/+$/, '');
const CHECK_REGISTRATION_URL = `${API_BASE_URL}/api/v1/fingerprint/check-registration`;

function sanitizeIp(rawIp: string): string {
  const candidate = rawIp.split(',')[0].trim();
  const bracketMatch = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) {
    return bracketMatch[1];
  }

  const ipv4PortMatch = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4PortMatch) {
    return ipv4PortMatch[1];
  }

  return candidate;
}

function extractClientIp(request: NextRequest): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return sanitizeIp(cfIp);
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return sanitizeIp(forwardedFor);
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return sanitizeIp(realIp);
  }

  return '127.0.0.1';
}

function calculateIpSubnet(ipAddress: string): string {
  const normalizedIp = ipAddress.replace(/^::ffff:/i, '');

  if (normalizedIp.includes('.')) {
    const octets = normalizedIp.split('.');
    if (octets.length === 4) {
      return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
    }
    return '127.0.0.0/24';
  }

  const hextets = normalizedIp.split(':').filter(Boolean).slice(0, 3);
  while (hextets.length < 3) {
    hextets.push('0');
  }

  return `${hextets.join(':')}::/48`;
}

function allowByDefault(): CheckRegistrationResponse {
  return {
    allowed: true,
    reason: null,
    fingerprint_count: 0,
    ip_count: 0,
    device_token_count: 0,
  };
}

export async function POST(request: NextRequest) {
  let body: CheckRegistrationRequestBody;

  try {
    body = (await request.json()) as CheckRegistrationRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const ipAddress = extractClientIp(request);
  const ipSubnet = calculateIpSubnet(ipAddress);

  const payload = {
    fingerprint_hash: body.fingerprint_hash,
    device_token: body.device_token,
    email: body.email,
    ip_address: ipAddress,
    ip_subnet: ipSubnet,
  };

  try {
    const backendResponse = await fetch(CHECK_REGISTRATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!backendResponse.ok) {
      return NextResponse.json(allowByDefault());
    }

    const backendData = (await backendResponse.json()) as CheckRegistrationResponse;
    return NextResponse.json(backendData, { status: backendResponse.status });
  } catch {
    return NextResponse.json(allowByDefault());
  }
}
