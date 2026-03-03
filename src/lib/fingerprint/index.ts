'use client';

import FingerprintJS from '@fingerprintjs/fingerprintjs';

import type {
  FingerprintData,
  RegistrationCheckResponse,
} from '@/lib/fingerprint/types';

const DEVICE_TOKEN_KEY = 'mor_device_token';

function createUuidFallback(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getDeviceToken(): string {
  if (typeof window === 'undefined') {
    return crypto.randomUUID?.() ?? createUuidFallback();
  }

  try {
    const existingToken = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (existingToken) {
      return existingToken;
    }

    const newToken = crypto.randomUUID?.() ?? createUuidFallback();
    window.localStorage.setItem(DEVICE_TOKEN_KEY, newToken);
    return newToken;
  } catch {
    return crypto.randomUUID?.() ?? createUuidFallback();
  }
}

export async function hashFingerprint(visitorId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(visitorId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getFingerprint(): Promise<FingerprintData> {
  const fpAgent = await FingerprintJS.load();
  const fpResult = await fpAgent.get();
  const fingerprintHash = await hashFingerprint(fpResult.visitorId);

  return {
    visitorId: fpResult.visitorId,
    fingerprintHash,
    deviceToken: getDeviceToken(),
    components: fpResult.components as Record<string, unknown>,
  };
}

export async function checkRegistrationAllowed(
  email: string,
  fingerprintData: FingerprintData,
): Promise<RegistrationCheckResponse> {
  try {
    const response = await fetch('/api/auth/check-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fingerprint_hash: fingerprintData.fingerprintHash,
        device_token: fingerprintData.deviceToken,
        email,
      }),
    });

    if (!response.ok) {
      throw new Error(`Registration check failed: ${response.status}`);
    }

    return (await response.json()) as RegistrationCheckResponse;
  } catch {
    return {
      allowed: true,
      reason: null,
      fingerprint_count: 0,
      ip_count: 0,
      device_token_count: 0,
    };
  }
}

export async function recordRegistration(
  email: string,
  fingerprintData: FingerprintData,
  cognitoUserId?: string,
): Promise<void> {
  try {
    await fetch('/api/auth/record-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fingerprint_hash: fingerprintData.fingerprintHash,
        device_token: fingerprintData.deviceToken,
        email,
        cognito_user_id: cognitoUserId,
      }),
    });
  } catch {
    return;
  }
}
